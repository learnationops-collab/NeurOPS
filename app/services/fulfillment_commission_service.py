"""Comisiones de Fulfillment (PDF «Comisiones por programa», de prueba desde septiembre de 2026).

Cada integrante cobra un % sobre CADA ingreso que genera Fulfillment, según el programa (AL / RR /
SI, el prefijo de `FinancialSale.tipo_pago`) y la fuente del ingreso:
- renovación, upsell y cuota: el tipo de pago de la venta;
- conversión: un pago parcial o completo de un cliente que ANTES había dejado una seña (mismo
  Instagram, correo o teléfono — el criterio con el que el dashboard del closer ya cruza las
  señas con sus ventas).
Un pago parcial o completo sin seña previa es una venta nueva del closer, no de Fulfillment.

Se cobra sobre el monto NETO (sin la fee de Stripe/Hotmart), como el resto de la nómina.

Los % son editables desde el 08/10/2026 (`comision_tasas_service`): cada función recibe la tabla de
Fulfillment del mes que corresponde (`tasas['fulfillment']`) y, sin ella, usa la de fábrica.
"""
from datetime import datetime

from sqlalchemy import or_

from app.services.comision_tasas_service import FUENTES, TASAS_DE_FABRICA
from app.services.commission_service import cash_neto_de

DESDE = '2026-09'

# Clave de la persona -> programa -> % por fuente (renovación, upsell, conversión, cuota): los de
# fábrica. Los vigentes de cada mes los da `comision_tasas_service.vigentes`.
TASAS = TASAS_DE_FABRICA['fulfillment']

# Fragmento del nombre en TeamMember (minúsculas, sin espacios) -> clave de la persona.
NOMBRES = (
    ('andres', 'andy'), ('andy', 'andy'),
    ('darian', 'dari'), ('dari', 'dari'),
    ('santiago', 'santi'), ('santi', 'santi'),
    ('belu', 'belu'),
    ('pedro', 'pedro'),
)


def clave_de_miembro(nombre):
    nombre = (nombre or '').lower().strip().replace(' ', '')
    for fragmento, clave in NOMBRES:
        if fragmento in nombre:
            return clave
    return None


def _claves_cliente(venta):
    """Las formas de reconocer al cliente de una venta: Instagram, correo y teléfono."""
    claves = set()
    ig = (venta.instagram or '').strip().lstrip('@').lower()
    if len(ig) > 2 and ig != 'n/a':
        claves.add(('ig', ig))
    mail = (venta.mail_cliente or '').strip().lower()
    if len(mail) > 2 and mail != 'n/a':
        claves.add(('mail', mail))
    tel = (venta.telefono or '').strip()
    if len(tel) > 4 and tel != 'n/a':
        claves.add(('tel', tel))
    return claves


def _primera_sena_por_cliente():
    """{clave de cliente -> fecha de su primera seña}, sobre todo el historial."""
    from app.models import FinancialSale
    from app.services.sheets_service import SheetsService

    senas = FinancialSale.query.filter(or_(
        FinancialSale.tipo_pago.ilike('%seña%'), FinancialSale.tipo_pago.ilike('%sena%'),
        FinancialSale.tipo_pago.ilike('%deposit%'),
    )).all()
    primera = {}
    for s in senas:
        if SheetsService.parse_tipo_pago(s.tipo_pago)[1] != 'seña' or not s.date:
            continue
        for clave in _claves_cliente(s):
            if clave not in primera or s.date < primera[clave]:
                primera[clave] = s.date
    return primera


def fuente_de(venta, tipo, primera_sena):
    """La fuente de Fulfillment de una venta, o None si no es un ingreso de Fulfillment."""
    if tipo in ('renovacion', 'upsell', 'cuota'):
        return tipo
    if tipo in ('parcial', 'completo') and venta.date:
        if any(primera_sena.get(c) and primera_sena[c] <= venta.date for c in _claves_cliente(venta)):
            return 'conversion'
    return None


def tasa_de(clave, programa, fuente, tasas=None):
    """El % que cobra una persona sobre un ingreso de ese programa y esa fuente."""
    return (tasas or TASAS)[clave][programa][FUENTES.index(fuente)]


def ingresos_de_fulfillment(sales):
    """[(venta, programa, fuente)] de las ventas de `sales` (ya filtradas por estado completado)
    que son ingresos de Fulfillment."""
    from app.services.sheets_service import SheetsService

    primera_sena = None
    ingresos = []
    for s in sales:
        programa, tipo = SheetsService.parse_tipo_pago(s.tipo_pago)
        if programa not in ('AL', 'RR', 'SI'):
            continue
        if tipo in ('parcial', 'completo') and primera_sena is None:
            primera_sena = _primera_sena_por_cliente()
        fuente = fuente_de(s, tipo, primera_sena or {})
        if fuente:
            ingresos.append((s, programa, fuente))
    return ingresos


def recaudado_por_programa(sales):
    """{(programa, fuente) -> monto neto} de los ingresos de Fulfillment entre `sales`
    (ya filtradas por mes y por estado completado)."""
    recaudado = {}
    for s, programa, fuente in ingresos_de_fulfillment(sales):
        recaudado[(programa, fuente)] = recaudado.get((programa, fuente), 0.0) + cash_neto_de(s.monto, s.metodo_pago)
    return recaudado


def comisiones_del_mes(month_str, sales, tasas=None):
    """{clave de persona -> comisión} del mes. Antes de DESDE no hay comisión de Fulfillment."""
    tasas = tasas or TASAS
    if month_str < DESDE:
        return {clave: 0.0 for clave in tasas}
    recaudado = recaudado_por_programa(sales)
    comisiones = {}
    for clave, por_programa in tasas.items():
        total = 0.0
        for programa, tasas in por_programa.items():
            for fuente, tasa in zip(FUENTES, tasas):
                total += recaudado.get((programa, fuente), 0.0) * tasa / 100
        comisiones[clave] = round(total, 2)
    return comisiones


# Para el Consolidado de Nómina, que filtra por un rango de fechas libre: el primer día con comisión.
DESDE_FECHA = datetime(int(DESDE[:4]), int(DESDE[5:]), 1)


def nomina_por_persona(ventas, tasas_de_mes=None):
    """El Consolidado de Nómina de Fulfillment: {clave -> {'sales', 'total_recaudado_neto',
    'comision_total', 'total_ventas', ...}}, con la misma forma que el resto de las personas.
    `ventas` son pares (venta completada, dict de la venta que arma el endpoint, con
    `is_excluded_from_payroll`). Cada venta lleva su programa, su fuente, el % de esa persona y su
    comisión, porque el % cambia venta a venta. Una venta que a esa persona no le paga nada (0%)
    no se lista. `tasas_de_mes(mes)` da el juego de % de cada mes (un rango puede cruzar un cambio);
    sin él, los de fábrica."""
    datos_de = {id(v): d for v, d in ventas}
    vigentes = [v for v, _ in ventas if v.date and v.date >= DESDE_FECHA]
    ingresos = ingresos_de_fulfillment(vigentes)

    nomina = {}
    def tabla_de(venta):
        return tasas_de_mes(venta.date.strftime('%Y-%m'))['fulfillment'] if tasas_de_mes else TASAS

    for clave in TASAS:
        filas, neto, comision = [], 0.0, 0.0
        for venta, programa, fuente in ingresos:
            tasa = tasa_de(clave, programa, fuente, tabla_de(venta))
            if not tasa:
                continue
            datos = datos_de[id(venta)]
            monto_neto = cash_neto_de(venta.monto, venta.metodo_pago)
            fila = {**datos, 'programa': programa, 'fuente': fuente, 'porcentaje': tasa,
                    'comision': round(monto_neto * tasa / 100, 2)}
            filas.append(fila)
            if not datos['is_excluded_from_payroll']:
                neto += monto_neto
                comision += monto_neto * tasa / 100
        nomina[clave] = {
            'sales': filas,
            'total_recaudado_neto': round(neto, 2),
            'porcentaje_comision': None,
            'comision_total': round(comision, 2),
            'total_ventas': len([f for f in filas if not f['is_excluded_from_payroll']]),
        }
    return nomina
