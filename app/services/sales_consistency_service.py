import re
import unicodedata
from difflib import SequenceMatcher

from sqlalchemy import or_, func


class SalesConsistencyService:
    """Valida y describe el estado de pago de un cliente para un programa dado, a partir del
    historial real en FinancialSale (agrupado por client_id desde la fase 0). Aplica las
    reglas de secuencia de pago confirmadas por el negocio:
      - El primer pago de un cliente en un programa solo puede ser Seña, Parcial o Completo.
      - Una Seña solo puede convertirse después en Parcial o Completo (nunca directo a Cuota).
      - Cuota solo puede existir si ya hubo un Parcial antes.
      - Renovación/Upsell requieren el programa completamente pagado (Completo, o Parcial +
        todas sus cuotas) — si queda saldo, el frontend debe ofrecer liquidarlo junto con la
        renovación/upsell en vez de solo bloquear.
    """

    TIPOS_VALIDOS = {'completo', 'parcial', 'seña', 'cuota', 'renovacion', 'upsell'}

    # Total por defecto que se autoasigna a un cliente según el programa de su primer pago,
    # cuando todavía no tiene un Client.total_amount propio guardado. Una vez que el closer
    # declara un pago con un "Precio Total" distinto, ese valor pasa a ser el total del
    # cliente (Client.total_amount) y reemplaza este default en todas las consultas futuras.
    PROGRAM_DEFAULT_TOTALS = {'AL': 1000.0, 'RR': 1500.0, 'SI': 2000.0}

    @staticmethod
    def _normalize_tipo(tipo_pago_simple):
        from app.services.sheets_service import SheetsService
        return SheetsService._extract_tipo_keyword(tipo_pago_simple)

    @staticmethod
    def _normalize_name(name):
        if not name:
            return ''
        name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
        return re.sub(r'\s+', ' ', name).strip().lower()

    @staticmethod
    def _names_corroborate(name_a, name_b):
        """True si dos nombres son lo bastante parecidos como para ser la misma persona.
        Usada para aceptar un cruce de un solo campo (email/instagram/telefono) entre dos
        client_id distintos — ver caso real Kervin Calderón/Emilia Collantes/Juan Camilo
        Sanchez Ramirez (docs/bitacora, 2 de Septiembre de 2026): un email compartido entre
        tres personas sin ningún parecido de nombre no debería fusionar su historial."""
        a = SalesConsistencyService._normalize_name(name_a)
        b = SalesConsistencyService._normalize_name(name_b)
        if not a or not b:
            return False
        tokens_a = {t for t in a.split(' ') if len(t) >= 3}
        tokens_b = {t for t in b.split(' ') if len(t) >= 3}
        if tokens_a & tokens_b:
            return True
        return SequenceMatcher(None, a, b).ratio() >= 0.72

    @staticmethod
    def _signal_match_count(client, sale):
        """Cuenta cuántas de las 3 señales (email/instagram/teléfono) coinciden entre el
        Client y una FinancialSale, normalizadas igual que el filtro SQL que las trajo."""
        count = 0
        if client.email and '@' in client.email and sale.mail_cliente:
            if sale.mail_cliente.strip().lower() == client.email.strip().lower():
                count += 1
        if client.instagram and client.instagram.lower() not in ('n/a', '') and sale.instagram:
            ig_clean = client.instagram.strip().replace('@', '').lower()
            sale_ig = sale.instagram.strip().replace('@', '').lower()
            if sale_ig == ig_clean:
                count += 1
        if client.phone and len(client.phone.strip()) >= 8 and sale.telefono:
            if client.phone.strip()[-8:] in sale.telefono:
                count += 1
        return count

    @staticmethod
    def get_client_payment_state(client_id, program_code):
        from app.models import FinancialSale, Client
        from app.services.sheets_service import SheetsService

        program_code = (program_code or '').strip().upper()

        client = Client.query.get(client_id) if client_id else None
        if client and client.total_amount is not None:
            program_price = float(client.total_amount)
        else:
            program_price = SalesConsistencyService.PROGRAM_DEFAULT_TOTALS.get(program_code, 0.0)

        # Cruzar por client_id Y por email/instagram/teléfono normalizados, no solo por
        # client_id: se detectó (reportado por un closer real que no podía declarar una Cuota
        # porque el sistema no encontraba su Parcial anterior) que FinancialSale.client_id está
        # NULL en prácticamente todas las filas de esta base local pese al backfill documentado
        # en una pasada anterior — depender solo de esa columna deja invisible casi todo el
        # historial real de pagos de un cliente. Mismo criterio de cruce que el resto del sistema
        # (BookingService.find_or_create_client).
        sale_filters = []
        if client_id:
            sale_filters.append(FinancialSale.client_id == client_id)
        if client:
            if client.email and '@' in client.email:
                sale_filters.append(func.lower(FinancialSale.mail_cliente) == client.email.strip().lower())
            if client.instagram and client.instagram.lower() not in ('n/a', ''):
                ig_clean = client.instagram.strip().replace('@', '').lower()
                sale_filters.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == ig_clean)
            if client.phone and len(client.phone.strip()) >= 8:
                sale_filters.append(FinancialSale.telefono.like(f"%{client.phone.strip()[-8:]}%"))

        # El filtro SQL de arriba es deliberadamente amplio (basta UNA señal para traer la fila
        # como candidata); la decisión de si de verdad pertenece a este cliente se hace acá en
        # Python con un criterio más estricto — requerir al menos 2 de las 3 señales (email/
        # instagram/teléfono), o si solo coincide una, corroborarla contra el nombre. Se detectó
        # en producción (Kervin Calderón, client_id=8523, 2 de Septiembre de 2026) que un solo
        # email compartido por una venta huérfana de OTRO cliente (Emilia Collantes, cuyos
        # propios campos denormalizados eran de un tercero, Juan Camilo Sanchez Ramirez) bastaba
        # para que el sistema creyera que Kervin ya había pagado el programa completo y le
        # bloqueara un Parcial real. Un match directo por client_id sigue siendo suficiente por
        # sí solo (es la señal más confiable, viene de un FK, no de texto libre importado) —
        # esto no debilita la detección de duplicados reales sin client_id que motivó el cruce
        # original (casos documentados: Jonathan Aparicio, Marcos Melo), que en general comparten
        # más de una señal o un nombre reconocible entre sí.
        all_sales = []
        if sale_filters:
            candidates = FinancialSale.query.filter(
                or_(*sale_filters),
                or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == '')
            ).order_by(FinancialSale.date.asc()).all()

            for s in candidates:
                if client_id and s.client_id == client_id:
                    all_sales.append(s)
                    continue
                if not client:
                    continue
                matches = SalesConsistencyService._signal_match_count(client, s)
                if matches >= 2:
                    all_sales.append(s)
                elif matches == 1 and SalesConsistencyService._names_corroborate(client.full_name, s.nombre_cliente):
                    all_sales.append(s)

        # Datos históricos tienen formatos inconsistentes (acentos, "Con Seña", sin prefijo de
        # programa). parse_tipo_pago normaliza eso; una venta sin prefijo de programa (legado)
        # se cuenta igual hacia ESTE programa solo si el cliente no tiene evidencia de estar
        # inscrito en otro programa distinto — evita contaminar el estado con pagos de otro programa.
        parsed = []  # (sale, code, tipo)
        other_codes = set()
        for s in all_sales:
            code, tipo = SheetsService.parse_tipo_pago(s.tipo_pago)
            if not tipo:
                continue
            parsed.append((s, code, tipo))
            if code and code != program_code:
                other_codes.add(code)

        relevant = [(s, tipo) for s, code, tipo in parsed if code == program_code or (not code and not other_codes)]

        tipos_presentes = {tipo for _, tipo in relevant}
        # Renovación/Upsell son de un ciclo de pago aparte (el "siguiente" programa/mejora):
        # no cuentan hacia el saldo del programa actual.
        total_paid = sum(float(s.monto or 0.0) for s, tipo in relevant if tipo not in ('renovacion', 'upsell'))

        has_deposit = 'seña' in tipos_presentes
        has_first_payment = 'parcial' in tipos_presentes
        has_full_payment = 'completo' in tipos_presentes
        has_installments = 'cuota' in tipos_presentes
        has_renewal_or_upsell = bool(tipos_presentes & {'renovacion', 'upsell'})

        balance_remaining = 0.0 if has_full_payment else max(0.0, round(program_price - total_paid, 2))

        return {
            'program_code': program_code,
            'program_price': program_price,
            'total_paid': round(total_paid, 2),
            'balance_remaining': balance_remaining,
            'has_deposit': has_deposit,
            'has_first_payment': has_first_payment,
            'has_full_payment': has_full_payment,
            'has_installments': has_installments,
            'has_renewal_or_upsell': has_renewal_or_upsell,
            'sales_count': len(relevant),
            'can_settle_balance_with_installment': has_first_payment and not has_full_payment and balance_remaining > 0.01,
        }

    @staticmethod
    def validate_next_payment_type(client_id, program_code, tipo_pago_simple):
        """Devuelve (ok: bool, reason: str|None, state: dict)."""
        tipo = SalesConsistencyService._normalize_tipo(tipo_pago_simple)
        state = SalesConsistencyService.get_client_payment_state(client_id, program_code)

        if tipo not in SalesConsistencyService.TIPOS_VALIDOS:
            return False, f"Tipo de pago '{tipo_pago_simple}' no reconocido.", state

        if tipo == 'seña':
            if state['has_first_payment'] or state['has_full_payment']:
                return False, "Este cliente ya tiene un pago real (Parcial o Completo) registrado en este programa — no corresponde declarar otra Seña.", state
            return True, None, state

        if tipo == 'completo':
            if state['has_first_payment'] or state['has_installments']:
                return False, "Este cliente ya tiene un Parcial/Cuotas registrados en este programa — usa Cuota para seguir cobrando el saldo, no Completo.", state
            if state['has_full_payment']:
                return False, "Este cliente ya tiene el programa pagado por completo.", state
            return True, None, state

        if tipo == 'parcial':
            if state['has_full_payment']:
                return False, "Este cliente ya pagó el programa por completo.", state
            if state['has_first_payment']:
                return False, "Este cliente ya tiene un Parcial registrado en este programa — usa Cuota para seguir cobrando el saldo.", state
            return True, None, state

        if tipo == 'cuota':
            # `has_installments` también cuenta como evidencia de que ya arrancó un plan de
            # pagos, no solo `has_first_payment` (Parcial): igual que se corrigió antes para
            # Renovación/Upsell (ver comentario más abajo, caso real Jonathan Aparicio), datos
            # históricos/importados suelen tener Cuotas ya cobradas sin que exista una fila de
            # Parcial explícita (el primer pago quedó etiquetado distinto o sin registrar). Caso
            # real: Marcos Melo, Seña $50 + 2 Cuotas ($450 y $500) ya cobradas en el programa,
            # sin ningún "RR - Parcial" en el historial — bloqueaba CUALQUIER cuota nueva pese a
            # que el cliente ya venía pagando en cuotas exitosamente.
            if not (state['has_first_payment'] or state['has_installments']):
                return False, "Este cliente no tiene un Parcial ni Cuotas previas registradas en este programa — las Cuotas solo pueden ir después de un primer pago.", state
            if state['balance_remaining'] <= 0.01:
                return False, "Este cliente ya no tiene saldo pendiente en este programa.", state
            return True, None, state

        if tipo in ('renovacion', 'upsell'):
            # Cuota/Seña también cuentan como "venta real" — no solo Parcial/Completo. Ventas
            # históricas/importadas suelen tener filas de Cuota sin que exista una fila de Parcial
            # explícita (el primer pago quedó sin registrar o con otra etiqueta), y bloquear la
            # renovación de un cliente que viene pagando en cuotas porque "no tiene venta
            # registrada" es un falso negativo. Reportado con un caso real: Jonathan Aparicio,
            # 4 ventas reales en el programa (3 Cuota + 1 Renovación previa) bloqueado igual.
            if not (state['has_full_payment'] or state['has_first_payment'] or state['has_installments'] or state['has_deposit']):
                return False, f"Este cliente no tiene ninguna venta real registrada en este programa todavía — no corresponde {tipo_pago_simple}.", state

            # La deuda para decidir si se bloquea la renovación usa el mismo cálculo que el
            # closer ya ve en pantalla (Program/Enrollment/Payment, `_client_debt` — el badge de
            # "Deuda pendiente" del seguimiento y del historial del cliente), no el saldo estimado
            # a partir de FinancialSale con un precio de programa genérico ($1000/1500/2000 según
            # AL/RR/SI): el 99.7% de los clientes de la base no tiene `Client.total_amount`
            # confirmado, así que ese saldo casi siempre está adivinando el precio real y termina
            # bloqueando renovaciones de clientes que el propio closer ve "al día". Decisión del
            # usuario: confiar en el número que el closer ya ve, no en el estimado.
            from app.services.closer_followup_service import CloserFollowUpService
            deuda_real = CloserFollowUpService._client_debt(client_id)
            if deuda_real > 0.01:
                return False, (
                    f"Este cliente aún debe ${deuda_real:.2f} del programa actual. "
                    f"Liquida el saldo pendiente junto con esta venta, o completá el pago antes de registrar {tipo_pago_simple}."
                ), state
            return True, None, state

        return False, "Tipo de pago no reconocido.", state

    @staticmethod
    def get_allowed_types(client_id, program_code):
        """Devuelve {tipo: (ok, reason)} para los 6 tipos, útil para deshabilitar opciones en el
        selector del frontend sin repetir la lógica de negocio ahí."""
        result = {}
        for tipo in ('completo', 'parcial', 'seña', 'cuota', 'renovacion', 'upsell'):
            ok, reason, _ = SalesConsistencyService.validate_next_payment_type(client_id, program_code, tipo)
            result[tipo] = {'ok': ok, 'reason': reason}
        return result
