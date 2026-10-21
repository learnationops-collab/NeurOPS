import re
import unicodedata
from difflib import SequenceMatcher

from sqlalchemy import and_, false, func, or_


def contactos_de_persona(person_uuid):
    """(mails, instagrams) vigentes de la persona, normalizados como `person_service.normalizar`: con
    qué se reconocen sus pagos que todavía no tienen persona."""
    from app import db
    from app.models import PersonIdentity
    mails, igs = set(), set()
    if not person_uuid:
        return mails, igs
    for kind, value in db.session.query(PersonIdentity.kind, PersonIdentity.value).filter(
            PersonIdentity.person_uuid == person_uuid, PersonIdentity.kind.in_(('email', 'instagram')),
            PersonIdentity.retired_at.is_(None), PersonIdentity.review_note.is_(None)):
        (mails if kind == 'email' else igs).add(value)
    return mails, igs


def filtro_de_pagos(client=None, person_uuid=None, client_id=None):
    """La condición SQL de los pagos (`FinancialSale`) de alguien, con el criterio de todo el sistema
    (docs/plan_personas.md, Etapa 2b; el mismo de `ticket_service.claves_de_cliente`): los de su
    persona y los atados a su ficha por id. El mail y el instagram copiados en el pago cuentan solo
    en pagos sin persona; el teléfono y el nombre, nunca (se reciclan y se comparten: el caso Kervin
    Calderón, un correo compartido entre tres personas)."""
    from app.models import FinancialSale
    from app.services import person_service

    client_id = client_id or (client.id if client else None)
    person_uuid = person_uuid or (client.person_uuid if client else None)
    condiciones = [FinancialSale.client_id == client_id] if client_id else []
    if person_uuid:
        condiciones.append(FinancialSale.person_uuid == person_uuid)
        mails, igs = contactos_de_persona(person_uuid)
    else:
        mails = {m for m in [person_service.normalizar('email', client.email if client else None)] if m}
        igs = {i for i in [person_service.normalizar('instagram', client.instagram if client else None)] if i}
    por_copia = []
    if mails:
        por_copia.append(func.lower(func.trim(FinancialSale.mail_cliente)).in_(sorted(mails)))
    if igs:
        por_copia.append(func.lower(func.replace(func.trim(FinancialSale.instagram), '@', '')).in_(sorted(igs)))
    if por_copia:
        condiciones.append(and_(FinancialSale.person_uuid.is_(None), or_(*por_copia)))
    return or_(*condiciones) if condiciones else false()


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

    # Total por defecto de cada programa, para quien todavía no tiene una venta con su total
    # (`Sale.agreed_total`). Cuando el closer declara un "Precio Total", ése queda en la venta.
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
    def get_client_payment_state(client_id, program_code):
        from app.models import FinancialSale, Client
        from app.services.sheets_service import SheetsService

        program_code = (program_code or '').strip().upper()

        client = Client.query.get(client_id) if client_id else None
        # El total de su venta 'new' vigente de este programa (`deuda_service.total_acordado`: el acordado
        # o el de lista de su época); sin venta, el de lista de hoy.
        from app.services.deuda_service import total_acordado
        program_price = total_acordado(client, program_code)
        if program_price is None:
            program_price = SalesConsistencyService.PROGRAM_DEFAULT_TOTALS.get(program_code, 0.0)

        # Los pagos del cliente son los de su persona y los atados por id; la copia del pago cuenta
        # solo en pagos sin persona (`filtro_de_pagos`).
        all_sales = FinancialSale.query.filter(
            filtro_de_pagos(client, client_id=client_id),
            or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == '')
        ).order_by(FinancialSale.date.asc()).all()

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
