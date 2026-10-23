import threading
from datetime import date, datetime, timedelta

from flask import current_app
from sqlalchemy import func

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
        §5.3): seña -> 7 días; pago completo o parcial -> 4 meses; renovación -> 1 mes. La reducción automática por
        cuota vencida es una fase posterior (todavía no implementada acá — ver el documento)."""
        base = base_date or date.today()
        tipo = (tipo_venta or '').strip().lower()
        tipo_norm = tipo.replace('ñ', 'n')
        if tipo_norm in ('sena', 'deposito', 'deposit', 'down_payment'):
            return base + timedelta(days=7)
        if tipo_norm.startswith('renov'):
            return _add_months(base, 1)  # las renovaciones son mes a mes (22/10/2026)
        return _add_months(base, 4)

    @staticmethod
    def closer_de(client, usuario=None):
        """El email del closer del que pasa a depender el alumno al inscribirlo en un producto: quien lo
        inscribe, si es un closer de ventas activo (`User.es_closer_de_ventas`); si lo hace otro del equipo, el vendedor de la venta más reciente
        del cliente (si resuelve a alguien activo con el rol closer: la venta de Mario se le registra a él). None = la Academia le deja el closer que tenía."""
        if usuario is not None and usuario.is_active and usuario.es_closer_de_ventas and usuario.email:
            return usuario.email.strip().lower()
        if client is None or not client.id:
            return None
        from app.models.financial import FinancialSale
        from app.services.closer_followup_service import CloserFollowUpService

        venta = FinancialSale.query.filter(
            FinancialSale.client_id == client.id, FinancialSale.email_vendedor.isnot(None),
            FinancialSale.email_vendedor != '').order_by(FinancialSale.date.desc(), FinancialSale.id.desc()).first()
        closer = CloserFollowUpService._resolve_closer_for_email_vendedor(venta.email_vendedor) if venta else None
        if closer and closer.is_active and closer.tiene_rol('closer') and closer.email:
            return closer.email.strip().lower()
        return None

    @staticmethod
    def avisar_baja(usuario):
        """Un closer se desactivó: la Academia reparte sus alumnos activos en partes iguales entre los
        closers que siguen activos (los manda Work, que es quien sabe quién está activo). Fuera de la
        request y sin levantar: la desactivación ya está guardada."""
        from app.models import User

        try:
            activos = [u for u in User.query.filter(User.role == 'closer', User.is_active.is_(True), User.id != usuario.id,
                                                    User.email.isnot(None), func.trim(User.email) != '').all()
                       if u.es_closer_de_ventas]
            payload = {'email': (usuario.email or '').strip().lower(),
                       'activos': [{'email': u.email.strip().lower(), 'nombre': u.username} for u in activos]}
        except Exception as e:  # noqa: BLE001
            current_app.logger.error(f'[ACADEMY CLOSERS] No se pudo armar el aviso de la baja de #{usuario.id}: {e}')
            return
        if not payload['email']:
            return
        app = current_app._get_current_object()

        def _correr():
            with app.app_context():
                try:
                    LearnationService.report_closer_deactivated(payload)
                except LearnationAPIError as e:
                    app.logger.warning(f"[ACADEMY CLOSERS] Baja de {payload['email']}: {e} ({e.status_code})")
                except Exception as e:  # noqa: BLE001
                    app.logger.error(f"[ACADEMY CLOSERS] Baja de {payload['email']}: {e}")

        threading.Thread(target=_correr, daemon=True, name='academy-closer-baja').start()

    @staticmethod
    def grant_access(client, programa_code, tipo_venta, expires_at_override=None, email_override=None, usuario=None):
        """Da (o renueva) el acceso de `client` en la Academia: upsert del usuario por email +
        asignación del producto vinculado a `programa_code`, con el vencimiento que decide esta
        función (o el que mande el closer a mano). Persiste el resultado en el propio `client`.

        `email_override`: el closer confirma/corrige acá el email real del cliente justo antes
        de darle acceso — es el email que va a usar para entrar a la Academia, así que este es
        el último punto de control antes de mandarlo. Si viene y es distinto al que ya tiene el
        cliente, se guarda en `client.email` (reemplaza sin condición: es una corrección
        explícita del closer, no un merge automático de datos)."""
        from app.services import person_service

        person = client.person
        if email_override:
            email_clean = str(email_override).strip().lower()
            if '@' not in email_clean:
                raise AcademyAccessError('El email ingresado no es válido.', status_code=422)
            if email_clean != (client.email or '').strip().lower():
                client.email = email_clean
            # El mail con que entra a la Academia (plan_personas): si no es el que ya vale para la
            # Academia (el de uso 'academia' o, sin él, el principal), queda como su uso 'academia'.
            if person is not None and email_clean != person_service.dato(person, 'email', uso='academia'):
                person_service.hacer_principal(person, 'email', email_clean, usuario, uso='academia',
                                               reason='El closer lo confirmó al dar el acceso a la Academia')
            # Se guarda ya (no se espera al commit final): si la llamada a la Academia
            # falla despues, el closer no debería tener que volver a tipear la corrección.
            db.session.commit()

        email_academia = (person_service.dato(person, 'email', uso='academia') if person else None) or client.email
        if not email_academia:
            raise AcademyAccessError('El cliente no tiene email registrado — no se puede vincular con la Academia.')
        if 'no-email-' in email_academia or 'no_email_' in email_academia:
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
            # Alargar pide una venta nueva (22/10/2026): se valida antes de tocar la Academia.
            from app.services.subscription_service import venta_que_extiende
            try:
                venta_que_extiende(client, product_slug, expires_at)
            except ValueError as e:
                raise AcademyAccessError(str(e), status_code=422)
        else:
            # Work es la fuente de verdad (20/10/2026): la fecha de su suscripción, ya calculada por
            # el pago; sin suscripción, la regla de siempre.
            from app.services.subscription_service import vencimiento_de
            de_la_suscripcion = vencimiento_de(client.id, programa_code)
            expires_at = de_la_suscripcion or AcademyAccessService.compute_default_expiration(tipo_venta)

        try:
            upsert_result = LearnationService.upsert_user(email_academia, client.full_name or email_academia, client.phone,
                                                          work_uuid=person.uuid if person else None)
        except LearnationAPIError as e:
            raise AcademyAccessError(f'No se pudo crear/actualizar el usuario en la Academia: {e}', status_code=e.status_code or 502)

        user_data = upsert_result.get('user') or {}
        learnation_user_id = user_data.get('id')
        if not learnation_user_id:
            raise AcademyAccessError('La Academia no devolvió un id de usuario válido.', status_code=502)
        was_created = upsert_result.get('action') == 'created'

        try:
            assign_result = LearnationService.assign_product(learnation_user_id, product_slug, expires_at=expires_at.isoformat(),
                                                             closer_email=AcademyAccessService.closer_de(client, usuario))
        except LearnationAPIError as e:
            raise AcademyAccessError(f'No se pudo asignar el producto en la Academia: {e}', status_code=e.status_code or 502)

        client.learnation_user_id = learnation_user_id
        if expires_at_override:
            # La fecha que eligió el closer queda en la suscripción, con su nombre.
            from app.services import subscription_service
            subscription_service.cambiar(client, programa_code, expires_at,
                                         'Fecha elegida por el closer al dar el acceso', usuario)
        elif de_la_suscripcion is None:
            # Sin suscripción, el acceso con la regla por defecto también queda registrado en Work
            # (Inventario 2c): si no, solo existiría en `academy_*` del cliente.
            from app.services import subscription_service
            subscription_service.otorgar(db.session, client.id, product_slug, expires_at, 'alta', programa=programa_code,
                                         reason='Acceso dado con la regla por defecto (sin pago que lo calcule)',
                                         actor_id=getattr(usuario, 'id', None))
        db.session.commit()

        return {
            'learnation_user_id': learnation_user_id,
            'was_created': was_created,
            'product_slug': product_slug,
            'expires_at': expires_at.isoformat(),
            'assignment': assign_result.get('assignment'),
            'email': email_academia,
            'work_uuid': person.uuid if person else None,
        }
