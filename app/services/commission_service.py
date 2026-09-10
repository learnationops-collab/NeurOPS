"""Comisión del mes visible en el espacio de trabajo de closers y setters (pedido del usuario,
10/sep/2026): % fijo sobre el cash collected NETO (ya descontadas las fees de Stripe/Hotmart)
que cada quien generó este mes — 10% para closers, 8% para setters.

No hay todavía un % configurable por persona: los 3 casos especiales de `finance.py`
(`get_commissions_calculated`) con un % propio para Elias/Jean Carlos/Marlon siguen viviendo
ahí sin tocarse — esto es el caso general para el resto del equipo, que hoy no tenía ninguna
comisión visible en su propio espacio de trabajo."""
from datetime import datetime, timedelta

CLOSER_RATE = 0.10
SETTER_RATE = 0.08

# Mismos valores que el resto del sistema considera "sin resultado todavía" para una agenda
# como fuente de un lead — ver `get_commissions_calculated` en app/api/public/finance.py.
_FUENTE_INVALIDA = {'s/f', 'n/a', ''}


class CommissionService:

    @staticmethod
    def _rango_mes_actual(user):
        """(inicio, fin, etiqueta) del mes calendario en curso, en la zona horaria del usuario
        — mismo criterio de "Este mes" que usa el resto del workspace."""
        from app.services.user_time_service import hoy_del_usuario
        hoy = hoy_del_usuario(user)
        inicio = hoy.replace(day=1)
        return inicio.isoformat(), hoy.isoformat(), hoy.strftime('%Y-%m')

    @staticmethod
    def get_closer_commission(user):
        """Reusa `CloserService.get_comprehensive_stats` — la misma fuente que ya alimenta el
        Cash Collected de "Ver mis datos" — para no calcular un cash distinto con otra regla."""
        from app.services.closer_service import CloserService

        inicio, fin, mes = CommissionService._rango_mes_actual(user)
        stats = CloserService.get_comprehensive_stats(user.id, start_date=inicio, end_date=fin)
        cash_neto = float((stats.get('sales') or {}).get('totals', {}).get('cash_neto') or 0.0)
        return {
            'role': 'closer',
            'month': mes,
            'rate': CLOSER_RATE,
            'cash_neto': round(cash_neto, 2),
            'commission': round(cash_neto * CLOSER_RATE, 2),
        }

    @staticmethod
    def get_setter_commission(user):
        """Mismo criterio de atribución que ya usa `get_commissions_calculated` para Elias
        (única persona con comisión de setter calculada hoy): la agenda que originó la venta
        (vía `AttributionService`) manda sobre el campo `FinancialSale.setter`; sin un origen
        válido, cae al campo de la venta. La comparación es por `User.username` (no hay un
        alias de setters como el de closers — se sigue el mismo criterio simple ya usado ahí,
        generalizado a cualquier setter en vez de solo 'elias')."""
        from app.models import FinancialSale, FinancialAgenda
        from app.services.attribution_service import AttributionService

        inicio, fin, mes = CommissionService._rango_mes_actual(user)
        start_dt = datetime.strptime(inicio, '%Y-%m-%d')
        end_dt = datetime.strptime(fin, '%Y-%m-%d') + timedelta(days=1)

        sales = FinancialSale.query.filter(
            FinancialSale.date >= start_dt, FinancialSale.date < end_dt
        ).all()
        cash_neto = 0.0
        if sales:
            all_agendas = FinancialAgenda.query.all()
            attribution_map = AttributionService.get_sales_attribution(sales=sales, agendas=all_agendas)
            username = (user.username or '').strip().lower()

            for s in sales:
                estado = (s.estado or '').strip().lower()
                if estado not in ('', 'completada', 'confirmada'):
                    continue

                resolved = None
                agenda = attribution_map.get(s.id)
                if agenda and agenda.nombre:
                    nombre = agenda.nombre.strip()
                    if (nombre.lower() not in _FUENTE_INVALIDA
                            and 'entrevista' not in nombre.lower()
                            and 'diagnostica' not in nombre.lower()
                            and 'diagnóstica' not in nombre.lower()):
                        resolved = nombre.lower()
                if not resolved:
                    s_setter = (s.setter or '').strip()
                    if s_setter and s_setter.lower() not in ('sin setter', 'confirmada'):
                        resolved = s_setter.lower()

                if resolved != username:
                    continue

                monto = float(s.monto or 0.0)
                metodo = (s.metodo_pago or '').strip().lower()
                if metodo == 'stripe':
                    cash_neto += monto * 0.955
                elif metodo == 'hotmart':
                    cash_neto += monto * 0.911
                else:
                    cash_neto += monto

        return {
            'role': 'setter',
            'month': mes,
            'rate': SETTER_RATE,
            'cash_neto': round(cash_neto, 2),
            'commission': round(cash_neto * SETTER_RATE, 2),
        }

    @staticmethod
    def get_for_user(user):
        if user.role == 'closer':
            return CommissionService.get_closer_commission(user)
        if user.role == 'setter':
            return CommissionService.get_setter_commission(user)
        return None
