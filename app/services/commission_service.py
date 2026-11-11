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

# La comisión de cada pasarela, como fracción del bruto: lo que se descuenta para llegar al cash NETO de un
# cobro. Es la ÚNICA definición: el Resumen de Finanzas, Payroll y las comisiones del equipo, el cash neto del
# dashboard comercial y del closer, marketing, el listado de ventas y la comisión estimada de Diferencias salen
# de acá.
#
# Desde el 02/11/2026 la comisión de un pago es la REAL cuando se conoce (verificado, `transaction_amount`) y,
# si no, el PROMEDIO de su plataforma calculado con las comisiones reales ya cargadas
# (`comision_plataforma_service`, Kerwin: no se fija un % a mano). Los valores de abajo son solo el último
# recurso, si todavía no hay pagos verificados de esa plataforma: 4,4 % y 8,2 % (los de septiembre de 2026
# según los CSV de Finanzas › Diferencias).
# Hotmart 8,8 % desde el 02/11/2026 (cobra 8,77 % real en 41 pagos verificados; antes 8,2 %).
COMISION_PASARELA = {'stripe': 0.044, 'hotmart': 0.088}


def cash_neto_de(monto, metodo_pago):
    """Lo que queda de un cobro despues de la comision PROMEDIO de su plataforma (la real, si se conoce, la
    lee `cash_neto`). Una plataforma de la que no se sabe cuanto cobra (o ninguna) no descuenta nada."""
    from app.services.comision_plataforma_service import tasa_promedio
    return float(monto or 0.0) * (1 - tasa_promedio(metodo_pago))


def cash_neto(venta):
    """El cash collect real de un pago: lo que entró según el extracto (`transaction_amount`, neto de la
    pasarela) si está verificado; si no, el estimado con el promedio de su plataforma (`cash_neto_de`). Es lo
    que cuenta para comisiones (Santiago, 26/10/2026)."""
    from app.services.comision_plataforma_service import tiene_comision_real
    if tiene_comision_real(venta):
        return float(venta.transaction_amount)
    return cash_neto_de(venta.monto, venta.metodo_pago)

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
            'verificacion': CommissionService._verificacion_del_closer(clave, user, inicio, fin),
        }

    @staticmethod
    def _verificacion_del_closer(clave, user, inicio, fin):
        """Los pagos del mes del closer por estado de verificación (ADR-W088): {verified, pending,
        unverified, bruto_sin_verificar}. Mismo cruce de closer que la nómina."""
        from app.services.closer_name_service import resolver_nombre_closer
        from app.services.nomina_service import venta_completada, ventas_del_rango

        cuenta = {'verified': 0, 'pending': 0, 'unverified': 0, 'bruto_sin_verificar': 0.0}
        desde, hasta = (datetime.strptime(d, '%Y-%m-%d').date() for d in (inicio, fin))
        email = (user.email or '').strip().lower()
        for v in ventas_del_rango(desde, hasta):
            vendedor = (v.email_vendedor or '').strip().lower()
            if not venta_completada(v) or not (vendedor == email or (
                    clave and clave_de_closer(resolver_nombre_closer(v.email_vendedor)) == clave)):
                continue
            estado = v.transaction_status or 'pending'
            cuenta[estado] = cuenta.get(estado, 0) + 1
            if estado != 'verified':
                cuenta['bruto_sin_verificar'] += float(v.monto or 0)
        cuenta['bruto_sin_verificar'] = round(cuenta['bruto_sin_verificar'], 2)
        return cuenta

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
        neto_total = 0.0
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

                neto_total += cash_neto(s)

        tasa = _tasa_propia('setters', SETTERS_CON_COMISION.get((user.username or '').strip().lower()),
                            mes, SETTER_RATE)
        return {
            'role': 'setter',
            'month': mes,
            'rate': tasa,
            'cash_neto': round(neto_total, 2),
            'commission': round(neto_total * tasa, 2),
        }

    @staticmethod
    def get_for_user(user):
        if user.role == 'closer':
            return CommissionService.get_closer_commission(user)
        if user.role == 'setter':
            return CommissionService.get_setter_commission(user)
        return None
