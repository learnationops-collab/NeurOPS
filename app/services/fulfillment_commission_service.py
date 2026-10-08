"""Comisiones de Fulfillment (PDF «Comisiones por programa», de prueba desde septiembre de 2026).

Cada integrante cobra un % sobre CADA ingreso que genera Fulfillment, según el programa (AL / RR /
SI, el prefijo de `FinancialSale.tipo_pago`) y la fuente del ingreso:
- renovación, upsell y cuota: el tipo de pago de la venta;
- conversión: un pago parcial o completo de un cliente que ANTES había dejado una seña (mismo
  Instagram, correo o teléfono — el criterio con el que el dashboard del closer ya cruza las
  señas con sus ventas).
Un pago parcial o completo sin seña previa es una venta nueva del closer, no de Fulfillment.

Se cobra sobre el monto NETO (sin la fee de Stripe/Hotmart), como el resto de la nómina.
"""
from sqlalchemy import or_

from app.services.commission_service import cash_neto_de

DESDE = '2026-09'

FUENTES = ('renovacion', 'upsell', 'conversion', 'cuota')

# Clave de la persona -> programa -> % por fuente (renovación, upsell, conversión, cuota).
TASAS = {
    'andy': {'AL': (2, 2, 2, 1), 'RR': (2, 2, 2, 2), 'SI': (5, 5, 3, 5)},
    'dari': {'AL': (2, 2, 2, 1), 'RR': (2, 2, 2, 1), 'SI': (2, 2, 2, 1)},
    'santi': {'AL': (1, 1, 1, 1), 'RR': (1, 1, 1, 1), 'SI': (1, 1, 1, 1)},
    'belu': {'AL': (0, 1, 1, 0), 'RR': (2, 2, 2, 2), 'SI': (2, 2, 2, 2)},
    'pedro': {'AL': (0, 0, 0, 0), 'RR': (0, 1, 1, 0), 'SI': (0, 1, 1, 0)},
}

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


def recaudado_por_programa(sales):
    """{(programa, fuente) -> monto neto} de los ingresos de Fulfillment entre `sales`
    (ya filtradas por mes y por estado completado)."""
    from app.services.sheets_service import SheetsService

    primera_sena = None
    recaudado = {}
    for s in sales:
        programa, tipo = SheetsService.parse_tipo_pago(s.tipo_pago)
        if programa not in ('AL', 'RR', 'SI'):
            continue
        if tipo in ('parcial', 'completo') and primera_sena is None:
            primera_sena = _primera_sena_por_cliente()
        fuente = fuente_de(s, tipo, primera_sena or {})
        if not fuente:
            continue
        recaudado[(programa, fuente)] = recaudado.get((programa, fuente), 0.0) + cash_neto_de(s.monto, s.metodo_pago)
    return recaudado


def comisiones_del_mes(month_str, sales):
    """{clave de persona -> comisión} del mes. Antes de DESDE no hay comisión de Fulfillment."""
    if month_str < DESDE:
        return {clave: 0.0 for clave in TASAS}
    recaudado = recaudado_por_programa(sales)
    comisiones = {}
    for clave, por_programa in TASAS.items():
        total = 0.0
        for programa, tasas in por_programa.items():
            for fuente, tasa in zip(FUENTES, tasas):
                total += recaudado.get((programa, fuente), 0.0) * tasa / 100
        comisiones[clave] = round(total, 2)
    return comisiones
