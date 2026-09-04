from datetime import date, datetime, timedelta
from app import db
from app.models import Integration
from app.services.learnation_service import LearnationService, LearnationAPIError

# Fila de configuración (no secreta) donde vive el mapeo {AL/RR/SI -> product_slug de la
# Academia}. El token en sí NO vive acá (ver LearnationService, va por variable de entorno).
INTEGRATION_KEY = 'learnation_academy'


class AcademyAccessError(Exception):
    """Error de negocio (mapeo faltante, cliente sin email) o traducción de un
    LearnationAPIError — status_code pensado para reflejarlo tal cual en la respuesta HTTP."""
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def _add_months(d, months):
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                       31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


class AcademyAccessService:
    @staticmethod
    def get_product_mapping():
        integration = Integration.query.filter_by(key=INTEGRATION_KEY).first()
        if not integration or not integration.payload_config:
            return {}
        return integration.payload_config.get('product_mapping') or {}

    @staticmethod
    def set_product_mapping(mapping):
        clean = {str(k).strip().upper(): str(v).strip() for k, v in (mapping or {}).items() if str(v).strip()}
        integration = Integration.query.filter_by(key=INTEGRATION_KEY).first()
        if not integration:
            integration = Integration(key=INTEGRATION_KEY, name='Academia (Learnation)', payload_config={})
            db.session.add(integration)
        config = dict(integration.payload_config or {})
        config['product_mapping'] = clean
        integration.payload_config = config
        db.session.commit()
        return clean

    @staticmethod
    def compute_default_expiration(tipo_venta, base_date=None):
        """Regla de negocio pedida por Kerwin (2026-09-04, ver docs/integracion_learnation_api.md
        §5.3): seña -> 7 días; pago completo o parcial -> 4 meses. La reducción automática por
        cuota vencida es una fase posterior (todavía no implementada acá — ver el documento)."""
        base = base_date or date.today()
        tipo = (tipo_venta or '').strip().lower()
        tipo_norm = tipo.replace('ñ', 'n')
        if tipo_norm in ('sena', 'deposito', 'deposit', 'down_payment'):
            return base + timedelta(days=7)
        return _add_months(base, 4)

    @staticmethod
    def grant_access(client, programa_code, tipo_venta, expires_at_override=None, email_override=None):
        """Da (o renueva) el acceso de `client` en la Academia: upsert del usuario por email +
        asignación del producto vinculado a `programa_code`, con el vencimiento que decide esta
        función (o el que mande el closer a mano). Persiste el resultado en el propio `client`.

        `email_override`: el closer confirma/corrige acá el email real del cliente justo antes
        de darle acceso — es el email que va a usar para entrar a la Academia, así que este es
        el último punto de control antes de mandarlo. Si viene y es distinto al que ya tiene el
        cliente, se guarda en `client.email` (reemplaza sin condición: es una corrección
        explícita del closer, no un merge automático de datos)."""
        if email_override:
            email_clean = str(email_override).strip().lower()
            if '@' not in email_clean:
                raise AcademyAccessError('El email ingresado no es válido.', status_code=422)
            if email_clean != (client.email or '').strip().lower():
                client.email = email_clean
                # Se guarda ya (no se espera al commit final): si la llamada a la Academia
                # falla despues, el closer no debería tener que volver a tipear la corrección.
                db.session.commit()

        if not client.email:
            raise AcademyAccessError('El cliente no tiene email registrado — no se puede vincular con la Academia.')
        if 'no-email-' in client.email or 'no_email_' in client.email:
            raise AcademyAccessError(
                'El cliente todavía tiene un email temporal generado por el sistema (no uno real) — '
                'confirmá el email real del cliente antes de darle acceso a la Academia.',
                status_code=422
            )

        mapping = AcademyAccessService.get_product_mapping()
        product_slug = mapping.get((programa_code or '').strip().upper())
        if not product_slug:
            raise AcademyAccessError(
                f"No hay un producto de la Academia vinculado al programa '{programa_code}'. "
                "Configuralo primero en Configuración de Ventas → Integraciones.",
                status_code=422
            )

        if expires_at_override:
            expires_at = expires_at_override if isinstance(expires_at_override, date) else \
                datetime.strptime(expires_at_override, '%Y-%m-%d').date()
        else:
            expires_at = AcademyAccessService.compute_default_expiration(tipo_venta)

        try:
            upsert_result = LearnationService.upsert_user(client.email, client.full_name or client.email, client.phone)
        except LearnationAPIError as e:
            raise AcademyAccessError(f'No se pudo crear/actualizar el usuario en la Academia: {e}', status_code=e.status_code or 502)

        user_data = upsert_result.get('user') or {}
        learnation_user_id = user_data.get('id')
        if not learnation_user_id:
            raise AcademyAccessError('La Academia no devolvió un id de usuario válido.', status_code=502)
        was_created = upsert_result.get('action') == 'created'

        try:
            assign_result = LearnationService.assign_product(learnation_user_id, product_slug, expires_at=expires_at.isoformat())
        except LearnationAPIError as e:
            raise AcademyAccessError(f'No se pudo asignar el producto en la Academia: {e}', status_code=e.status_code or 502)

        client.learnation_user_id = learnation_user_id
        client.academy_product_slug = product_slug
        client.academy_expires_at = datetime.combine(expires_at, datetime.min.time())
        db.session.commit()

        return {
            'learnation_user_id': learnation_user_id,
            'was_created': was_created,
            'product_slug': product_slug,
            'expires_at': expires_at.isoformat(),
            'assignment': assign_result.get('assignment'),
            'email': client.email
        }
