"""El motor de la nómina variable: UNA cuenta de comisiones para Payroll y Finanzas (08/10/2026).

Antes eran dos copias del mismo cálculo: la sección Payroll (`/public/financial-sales/payroll`, por
rango) y la pestaña Nómina de Finanzas (`get_commissions_calculated`, por mes). Ya no decían lo
mismo: Finanzas no miraba las ventas sacadas de la nómina (`is_excluded_from_payroll`) y Payroll sí.
Ahora las dos piden acá, y Finanzas es el rango de un mes.

Quién cobra y con qué %:
- setters (`SETTERS_CON_COMISION`): la fuente de la agenda que originó la venta, o el campo de la venta;
- closers (`CLOSERS_CON_COMISION`): `resolver_nombre_closer` sobre `email_vendedor`;
- Marlon como Director de Ventas, sobre lo que venden los OTROS closers con comisión, sin
  renovaciones; sus ventas propias las cobra aparte como closer, con su % de closer;
- Fulfillment, por programa y fuente (`fulfillment_commission_service.nomina_por_persona`).
Cada venta cobra con el % del mes en que entró (`comision_tasas_service.por_mes`): un rango puede
cruzar un cambio. Todo sobre el cash NETO (sin la fee de Stripe/Hotmart) de las ventas completadas.
"""
import calendar
from datetime import datetime, time, timedelta

from app.services.commission_service import (
    CLOSERS_CON_COMISION, DIRECTOR_DE_VENTAS, SETTERS_CON_COMISION, cash_neto_de, clave_de_closer)

# Lo que el resto del sistema considera «sin resultado todavía» como fuente de un lead.
_FUENTE_INVALIDA = ('s/f', 'n/a', '')

# De qué es cada venta en la lista de Marlon (`concepto`): sus ventas propias, que cobra con su %
# de closer, o las de otro closer, que cobra con su % de director.
CONCEPTOS = {'closers': 'propia', 'director': 'director'}


def venta_completada(venta):
    """Una venta cuenta si está completada o confirmada (o sin estado, como las viejas)."""
    estado = (venta.estado or '').strip().lower()
    return estado in ('', 'completada', 'confirmada')


def fuente_valida(nombre):
    """La fuente de una agenda dice quién la generó: no vale vacía, «s/f», «n/a» ni una entrevista
    o diagnóstica (esas no son de un setter)."""
    if not nombre or not nombre.strip():
        return False
    minusculas = nombre.lower()
    return minusculas not in _FUENTE_INVALIDA and not any(
        tipo in minusculas for tipo in ('entrevista', 'diagnostica', 'diagnóstica'))


def setter_de_la_venta(venta, agenda):
    """El setter de una venta: la fuente de la agenda que la originó (vía `AttributionService`)
    manda sobre el campo `FinancialSale.setter`; una entrevista o diagnóstica no es un setter."""
    if agenda and fuente_valida(agenda.nombre):
        return agenda.nombre
    setter = venta.setter
    if setter and setter.strip() and setter not in ('Sin Setter', 'Confirmada'):
        return setter
    return 'Sin Setter'


def es_renovacion(tipo_pago):
    """El tipo de pago simple ('RR - Renovación' -> 'Renovación') es una renovación."""
    tipo = (tipo_pago or '').split(' - ', 1)[-1].lower()
    return 'renovacion' in tipo or 'renovación' in tipo


def _inicio(dia):
    return datetime.combine(dia, time.min) if dia else None


def _fin(dia):
    return datetime.combine(dia, time.max) if dia else None


def ventas_del_rango(desde=None, hasta=None):
    """Las ventas entre dos fechas (`date`, ambas inclusive; None = sin límite), completadas o no."""
    from app.models import FinancialSale

    query = FinancialSale.query
    if desde:
        query = query.filter(FinancialSale.date >= _inicio(desde))
    if hasta:
        query = query.filter(FinancialSale.date <= _fin(hasta))
    return query.all()


def comisiones_del_rango(desde=None, hasta=None):
    """La nómina variable entre dos fechas (`date`, ambas inclusive; None = sin límite).

    Devuelve {clave -> {'sales', 'total_recaudado_neto', 'porcentaje_comision', 'comision_total',
    'total_ventas'}} de cada persona con comisión, y 'totales' con el cash del período. Cada venta de
    `sales` trae su `porcentaje` y su `comision`; las sacadas de la nómina se listan pero no suman.
    `porcentaje_comision` es el % de la persona si en el rango hubo uno solo (None si cruzó un
    cambio: cada venta trae el suyo).

    Marlon suma sus dos partidas: cada venta de su lista dice de cuál es (`concepto`: 'propia' o
    'director') y `desglose` trae cada partida con su %, su neto, su comisión y sus ventas."""
    from app.models import FinancialAgenda
    from app.services.attribution_service import AttributionService
    from app.services.closer_name_service import resolver_nombre_closer
    from app.services.comision_tasas_service import por_mes
    from app.services.fulfillment_commission_service import nomina_por_persona

    sales = ventas_del_rango(desde, hasta)
    attribution_map = AttributionService.get_sales_attribution(sales=sales, agendas=FinancialAgenda.query.all())

    tasas_de_mes = por_mes()
    # Cada partida es (persona, grupo de su %). Marlon tiene dos: sus ventas propias, con su % de
    # closer, y su parte de director sobre las de los otros closers (ver `CONCEPTOS`).
    partidas = list(dict.fromkeys(
        [(clave, 'setters') for clave in SETTERS_CON_COMISION.values()]
        + [(clave, 'closers') for clave in CLOSERS_CON_COMISION.values()]
        + [(DIRECTOR_DE_VENTAS, 'director')]))
    claves = list(dict.fromkeys(clave for clave, _ in partidas))
    ventas_de = {clave: [] for clave in claves}
    recaudado = {partida: 0.0 for partida in partidas}
    comision = {partida: 0.0 for partida in partidas}
    contadas = {partida: 0 for partida in partidas}
    porcentajes = {partida: set() for partida in partidas}
    completadas = []  # (venta, sale_data) para la nómina de Fulfillment
    # El cash del período, con o sin comisión de por medio: el contexto de lo que se paga.
    cash = {"neto": 0.0, "bruto": 0.0, "ventas": 0}
    mes_de_cierre = (hasta or datetime.utcnow()).strftime('%Y-%m')

    for s in sales:
        if not venta_completada(s):
            continue
        final_setter = setter_de_la_venta(s, attribution_map.get(s.id))
        final_closer = resolver_nombre_closer(s.email_vendedor)
        monto_original = float(s.monto or 0.0)
        monto_ajustado = cash_neto_de(s.monto, s.metodo_pago)

        sale_data = {
            "id": s.id,
            "date": s.date.isoformat() if s.date else None,
            "nombre_cliente": s.nombre_cliente,
            "instagram": s.instagram,
            "monto_neto": round(monto_ajustado, 2),
            "monto_bruto": round(monto_original, 2),
            "metodo_pago": s.metodo_pago,
            "tipo_pago": s.tipo_pago,
            "closer": final_closer,
            "setter": final_setter,
            "is_excluded_from_payroll": s.is_excluded_from_payroll or False
        }
        completadas.append((s, sale_data))
        excluida = sale_data["is_excluded_from_payroll"]
        cash["neto"] += monto_ajustado
        cash["bruto"] += monto_original
        cash["ventas"] += 1
        tasas = tasas_de_mes(s.date.strftime('%Y-%m') if s.date else mes_de_cierre)

        def sumar(clave, grupo):
            pct = tasas[grupo][clave]
            porcentajes[(clave, grupo)].add(pct)
            fila = {**sale_data, "porcentaje": pct, "comision": round(monto_ajustado * pct / 100, 2)}
            if clave == DIRECTOR_DE_VENTAS:
                fila["concepto"] = CONCEPTOS[grupo]
            ventas_de[clave].append(fila)
            if not excluida:
                recaudado[(clave, grupo)] += monto_ajustado
                comision[(clave, grupo)] += monto_ajustado * pct / 100
                contadas[(clave, grupo)] += 1

        setter_clave = SETTERS_CON_COMISION.get(final_setter.strip().lower())
        if setter_clave:
            sumar(setter_clave, 'setters')

        closer_clave = clave_de_closer(final_closer)
        if closer_clave:
            sumar(closer_clave, 'closers')
            # Marlon cobra su % del cash collect de los OTROS closers, sin renovaciones: las suyas
            # ya le pagan como closer.
            if closer_clave != DIRECTOR_DE_VENTAS and not es_renovacion(s.tipo_pago):
                sumar(DIRECTOR_DE_VENTAS, 'director')

    def porcentaje_de(partida):
        # Un solo % en el rango es el de la persona; si el rango cruza un cambio, no hay uno solo
        # (None, como Fulfillment) y cada venta trae el suyo. Sin ventas, el del último mes.
        usados = porcentajes[partida]
        if not usados:
            clave, grupo = partida
            return tasas_de_mes(mes_de_cierre)[grupo][clave]
        return next(iter(usados)) if len(usados) == 1 else None

    def resumen(clave):
        suyas = [p for p in partidas if p[0] == clave]
        datos = {
            "sales": ventas_de[clave],
            "total_recaudado_neto": round(sum(recaudado[p] for p in suyas), 2),
            # Con dos partidas (Marlon) no hay un % de la persona: cada una trae el suyo en `desglose`.
            "porcentaje_comision": porcentaje_de(suyas[0]) if len(suyas) == 1 else None,
            "comision_total": round(sum(comision[p] for p in suyas), 2),
            "total_ventas": sum(contadas[p] for p in suyas),
        }
        if len(suyas) > 1:
            datos["desglose"] = {CONCEPTOS[grupo]: {
                "porcentaje": porcentaje_de((clave, grupo)),
                "total_recaudado_neto": round(recaudado[(clave, grupo)], 2),
                "comision_total": round(comision[(clave, grupo)], 2),
                "total_ventas": contadas[(clave, grupo)],
            } for _, grupo in suyas}
        return datos

    nomina = {clave: resumen(clave) for clave in claves}
    # Fulfillment: el % cambia venta a venta (programa y fuente), así que cada venta trae el suyo.
    nomina.update(nomina_por_persona(completadas, tasas_de_mes))
    nomina["totales"] = {"cash_neto": round(cash["neto"], 2), "cash_bruto": round(cash["bruto"], 2),
                         "ventas": cash["ventas"]}
    return nomina


# --- El sueldo base (08/10/2026) ------------------------------------------------------------------

# Fragmento del nombre en TeamMember (minúsculas, sin espacios) -> clave de la persona en Payroll,
# para quienes cobran por ventas. Los de Fulfillment se reconocen con
# `fulfillment_commission_service.clave_de_miembro`.
CLAVES_POR_NOMBRE = (
    ('elias', 'elias'),
    ('paula', 'paula'),
    ('jeancarlo', 'jeancarlo'),
    ('facundo', 'facundo'),
    ('nerina', 'nerina'),
    ('gabriel', 'gabriel'),
    ('marlon', 'marlon'),
)


def clave_de_nomina(nombre):
    """La persona de Payroll que es un integrante de Finanzas (por su nombre), o None: Kerwin, por
    ejemplo, cobra sueldo pero no tiene tile en Payroll."""
    from app.services.fulfillment_commission_service import clave_de_miembro

    limpio = (nombre or '').lower().strip().replace(' ', '')
    for fragmento, clave in CLAVES_POR_NOMBRE:
        if fragmento in limpio:
            return clave
    return clave_de_miembro(nombre)


def meses_del_rango(desde, hasta):
    """[(mes 'YYYY-MM', parte del mes)] de cada mes que toca el rango (fechas inclusive): 1 si lo
    cubre entero, y si no los días del rango en ese mes sobre los días del mes."""
    meses = []
    primero = desde.replace(day=1)
    while primero <= hasta:
        dias_del_mes = calendar.monthrange(primero.year, primero.month)[1]
        ultimo = primero.replace(day=dias_del_mes)
        dias = (min(hasta, ultimo) - max(desde, primero)).days + 1
        meses.append((primero.strftime('%Y-%m'), dias / dias_del_mes))
        primero = ultimo + timedelta(days=1)
    return meses


def sueldo_base_del_rango(desde, hasta):
    """{clave de Payroll -> sueldo base del rango}.

    El sueldo de cada mes es el de la fila guardada de la nómina de ese mes o, sin ella, el del
    integrante (los mismos que suma `nomina_del_mes` de Finanzas: un inactivo sin fila no cobra). Un
    mes entero del rango cuenta el sueldo completo; uno a medias, prorrateado por días (base × días
    del rango en ese mes ÷ días del mes). Finanzas usa la misma regla para un rango. Sin las dos
    fechas no hay sueldo que prorratear."""
    from app.models.financial import MonthlyPayroll, TeamMember

    if not desde or not hasta or desde > hasta:
        return {}
    meses = meses_del_rango(desde, hasta)
    guardadas = {(p.member_id, p.month): p for p in
                 MonthlyPayroll.query.filter(MonthlyPayroll.month.in_([mes for mes, _ in meses])).all()}
    sueldos = {}
    for miembro in TeamMember.query.all():
        clave = clave_de_nomina(miembro.name)
        if not clave:
            continue
        for mes, parte in meses:
            fila = guardadas.get((miembro.id, mes))
            if not fila and not miembro.is_active:
                continue
            base = fila.base_salary if fila else miembro.base_salary
            sueldos[clave] = sueldos.get(clave, 0.0) + (base or 0.0) * parte
    return {clave: round(monto, 2) for clave, monto in sueldos.items()}


def payroll_del_rango(desde=None, hasta=None):
    """Lo que muestra la sección Payroll: `comisiones_del_rango` con el sueldo base de cada persona
    (`sueldo_base`) y, en 'totales', el sueldo base y las comisiones de todas.

    Desde el 09/10/2026 cada persona trae también lo que recibió por transferencia de un cliente en
    el rango (`transferencias_recibidas` y la lista `transferencias`, de
    `transferencias_service.recibidas_por_persona`, la misma cuenta que la Nómina de Finanzas) y lo
    que queda por pagarle (`a_pagar` = sueldo base + comisión − transferencias). Es un descuento
    sobre lo que se le paga, no sobre lo que cuesta: la comisión, el sueldo y los totales no cambian.

    Y en 'totales', `transferencias` (pedido del usuario, 09/10/2026: «falta contar lo que ingresó
    por transferencia para que las cuentas cuadren»): cuánto del cash del período entró por
    transferencia y a quién, de TODAS las ventas y no solo de las personas de la nómina
    (`transferencias_service.resumen_del_periodo`, la cuenta del Resumen de Finanzas). Ya está
    dentro del cash: esto dice qué parte no pasó por Stripe ni Hotmart.
    """
    from app.services.transferencias_service import recibidas_por_persona, resumen_del_periodo

    nomina = comisiones_del_rango(desde, hasta)
    sueldos = sueldo_base_del_rango(desde, hasta)
    recibidas = recibidas_por_persona(desde, hasta)
    personas = [clave for clave in nomina if clave != 'totales']
    for clave in personas:
        nomina[clave]['sueldo_base'] = sueldos.get(clave, 0.0)
        transferencias = recibidas.get(clave, {'total': 0.0, 'pagos': []})
        nomina[clave]['transferencias_recibidas'] = transferencias['total']
        nomina[clave]['transferencias'] = transferencias['pagos']
        nomina[clave]['a_pagar'] = round(nomina[clave]['sueldo_base'] + nomina[clave]['comision_total']
                                         - transferencias['total'], 2)
    nomina['totales']['sueldo_base'] = round(sum(nomina[c]['sueldo_base'] for c in personas), 2)
    nomina['totales']['comisiones'] = round(sum(nomina[c]['comision_total'] for c in personas), 2)
    nomina['totales']['transferencias'] = resumen_del_periodo(desde, hasta)
    return nomina
