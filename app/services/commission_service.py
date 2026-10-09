"""Comisión del mes visible en el espacio de trabajo de closers y setters (pedido del usuario,
10/sep/2026): % fijo sobre el cash collected NETO (ya descontadas las fees de Stripe/Hotmart)
que cada quien generó este mes — 10% para closers, 8% para setters.

Quien está en la nómina con un % propio (`SETTERS_CON_COMISION`, `CLOSERS_CON_COMISION`) ve el suyo, el del mes
según `comision_tasas_service` (editable desde Payroll desde el 08/10/2026): así la tarjeta y la
nómina dicen lo mismo. El resto del equipo, el caso general de 10% / 8%."""
from datetime import datetime, timedelta

CLOSER_RATE = 0.10
SETTER_RATE = 0.08
DIRECTOR_RATE = 0.05

# Quiénes cobran comisión variable en la nómina (Finanzas y Payroll; la cuenta vive en
# `nomina_service`), por el nombre con el que aparecen en las ventas (setter = fuente de la agenda
# que originó la venta, closer = `resolver_nombre_closer`, normalizado) -> clave con la que viajan
# en las respuestas. Marlon, como Director de Ventas, se lleva DIRECTOR_RATE de lo que venden estos
# closers, sin renovaciones.
#
# Nerina y Gabriel cerraron ventas en septiembre de 2026 y no estaban (08/10/2026). Nerina ya no
# está activa, pero `resolver_nombre_closer` resuelve contra todos los usuarios, activos o no.
# «Gabriel» es Gabriel Hernandez: el 'Gabriel' a secas es otro closer de abril y mayo de 2026
# (gabriel@thelearnation.com, del diccionario histórico) y Gabriel Cardozo no vendió.
#
# Marlon también vende: desde el 08/10/2026 cobra sus ventas propias como cualquier closer (con su %
# de closer) y aparte su % de director sobre las de los OTROS closers; las suyas no entran en esa
# parte. Sus ventas (marlon@thelearnation.com, marlongarcia27948@gmail.com) resuelven a su usuario,
# 'Marlon Garcia', o a 'Marlon' (el diccionario histórico, donde no está el usuario).
SETTERS_CON_COMISION = {'elias': 'elias', 'paula': 'paula'}
CLOSERS_CON_COMISION = {'jean carlo': 'jeancarlo', 'facundo': 'facundo', 'nerina': 'nerina',
                        'gabriel hernandez': 'gabriel', 'marlon garcia': 'marlon', 'marlon': 'marlon'}
DIRECTOR_DE_VENTAS = 'marlon'


def clave_de_closer(nombre):
    """La clave de nómina del closer con ese nombre canónico (`resolver_nombre_closer`), o None.
    Se compara normalizado (sin acentos ni mayúsculas): 'Marlon García' y 'Marlon Garcia' son el
    mismo usuario escrito de dos formas."""
    from app.services.fuente_service import normalizar
    return CLOSERS_CON_COMISION.get(normalizar(nombre))

# Fees de la pasarela que se descuentan para llegar al cash NETO. Los mismos factores viven
# repetidos en media docena de sitios de app/api/public (finance.py, financial_sales.py); acá se
# centralizan para lo nuevo, y se usan tambien desde el dashboard comercial.
FEES_POR_METODO = {'stripe': 0.955, 'hotmart': 0.911}


def cash_neto_de(monto, metodo_pago):
    """Lo que queda de un cobro despues de la fee de la pasarela. Un metodo desconocido (o
    ninguno) no descuenta nada: es el criterio que ya aplicaba el calculo de comision."""
    factor = FEES_POR_METODO.get((metodo_pago or '').strip().lower(), 1.0)
    return float(monto or 0.0) * factor

# Mismos valores que el resto del sistema considera "sin resultado todavía" para una agenda
# como fuente de un lead — ver `get_commissions_calculated` en app/api/public/finance.py.
_FUENTE_INVALIDA = {'s/f', 'n/a', ''}


def _tasa_propia(grupo, clave, mes, por_defecto):
    """El % (como fracción) de una persona de la nómina en ese mes, o `por_defecto` si no está."""
    if not clave:
        return por_defecto
    from app.services.comision_tasas_service import vigentes
    return vigentes(mes)[0][grupo][clave] / 100


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
        from app.services.closer_name_service import resolver_nombre_closer
        clave = clave_de_closer(resolver_nombre_closer(user.username))
        tasa = _tasa_propia('closers', clave, mes, CLOSER_RATE)
        return {
            'role': 'closer',
            'month': mes,
            'rate': tasa,
            'cash_neto': round(cash_neto, 2),
            'commission': round(cash_neto * tasa, 2),
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

                cash_neto += cash_neto_de(s.monto, s.metodo_pago)

        tasa = _tasa_propia('setters', SETTERS_CON_COMISION.get((user.username or '').strip().lower()),
                            mes, SETTER_RATE)
        return {
            'role': 'setter',
            'month': mes,
            'rate': tasa,
            'cash_neto': round(cash_neto, 2),
            'commission': round(cash_neto * tasa, 2),
        }

    @staticmethod
    def get_for_user(user):
        if user.role == 'closer':
            return CommissionService.get_closer_commission(user)
        if user.role == 'setter':
            return CommissionService.get_setter_commission(user)
        return None
