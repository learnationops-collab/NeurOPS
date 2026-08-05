from sqlalchemy import or_


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
    def get_client_payment_state(client_id, program_code):
        from app.models import FinancialSale, Client
        from app.services.sheets_service import SheetsService

        program_code = (program_code or '').strip().upper()

        client = Client.query.get(client_id) if client_id else None
        if client and client.total_amount is not None:
            program_price = float(client.total_amount)
        else:
            program_price = SalesConsistencyService.PROGRAM_DEFAULT_TOTALS.get(program_code, 0.0)

        all_sales = []
        if client_id:
            all_sales = FinancialSale.query.filter(
                FinancialSale.client_id == client_id,
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
            if not state['has_first_payment']:
                return False, "Este cliente no tiene un Parcial registrado en este programa — las Cuotas solo pueden ir después de un Parcial.", state
            if state['balance_remaining'] <= 0.01:
                return False, "Este cliente ya no tiene saldo pendiente en este programa.", state
            return True, None, state

        if tipo in ('renovacion', 'upsell'):
            if not (state['has_full_payment'] or state['has_first_payment']):
                return False, f"Este cliente no tiene ninguna venta real registrada en este programa todavía — no corresponde {tipo_pago_simple}.", state
            if state['balance_remaining'] > 0.01:
                return False, (
                    f"Este cliente aún debe ${state['balance_remaining']:.2f} del programa actual. "
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
