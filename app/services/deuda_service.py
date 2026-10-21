"""La deuda por venta (20/10/2026): cada venta activa debe lo acordado menos lo cobrado.

La venta declara su total (`Sale.agreed_total`); los pagos (`FinancialSale.sale_id`) se comparan
contra él. Una venta nueva vieja sin total acordado usa el precio de lista de su época. Una
renovación o un upsell sin total no deben nada (no hay precio de lista para ellos). Una venta
`cancelled` (o `refunded`) no debe nada: lo cobrado sigue contando como cash, el saldo se va.

Es la transición desde `CloserFollowUpService._client_debt`, que sumaba sobre las inscripciones
(`Enrollment`/`Payment`): un cliente cuya persona todavía no tiene ventas sigue con la cuenta vieja
(devuelve None y quien llama cae a esa).
"""
from datetime import date, datetime

from sqlalchemy import or_

from app.models import FinancialSale, Sale

# Precio de lista de cada programa desde cada fecha (los montos más comunes de los pagos completos
# de cada semestre; el último es el de hoy, `SalesConsistencyService.PROGRAM_DEFAULT_TOTALS`).
PRECIOS_DE_LISTA = {
    'RR': ((date(2000, 1, 1), 1000.0), (date(2025, 7, 1), 1200.0), (date(2026, 1, 1), 1500.0)),
    'AL': ((date(2000, 1, 1), 500.0), (date(2025, 1, 1), 150.0), (date(2025, 7, 1), 250.0),
           (date(2026, 1, 1), 750.0), (date(2026, 7, 1), 1000.0)),
    'SI': ((date(2000, 1, 1), 1500.0), (date(2026, 1, 1), 2000.0)),
}


def precio_de_lista(programa, fecha):
    """El precio de lista de `programa` vigente en `fecha`, o None."""
    tramos = PRECIOS_DE_LISTA.get(programa)
    if not tramos:
        return None
    dia = fecha.date() if isinstance(fecha, datetime) else (fecha or date.today())
    return next((precio for desde, precio in reversed(tramos) if desde <= dia), None)


def total_de(sale):
    """Lo que la venta acordó cobrar, o None si no se sabe."""
    if sale.agreed_total is not None:
        return float(sale.agreed_total)
    if sale.kind == 'new':
        return precio_de_lista(sale.program_code, sale.sold_at)
    return None


def saldo(sale, cobrado):
    if sale.status != 'active':
        return 0.0
    total = total_de(sale)
    if total is None:
        return 0.0
    return max(0.0, total - cobrado)


def deudas(clientes):
    """{client_id: deuda} de los `clientes` cuya persona (o, sin persona, el cliente) tiene ventas.
    Los que no tienen ninguna no aparecen: siguen con la cuenta de las inscripciones."""
    clientes = [c for c in clientes if c is not None]
    if not clientes:
        return {}
    personas = {c.person_uuid for c in clientes if c.person_uuid}
    sueltos = {c.id for c in clientes if not c.person_uuid}
    filtro = []
    if personas:
        filtro.append(Sale.person_uuid.in_(personas))
    if sueltos:
        filtro.append(Sale.client_id.in_(sueltos))
    ventas = Sale.query.filter(or_(*filtro)).all()
    if not ventas:
        return {}
    from app.services.comercial_vocabulario import venta_completada  # importa closer_followup_service
    cobrado = {}
    for fila in FinancialSale.query.filter(FinancialSale.sale_id.in_([v.id for v in ventas])).all():
        if venta_completada(fila):
            cobrado[fila.sale_id] = cobrado.get(fila.sale_id, 0.0) + float(fila.monto or 0)
    por_persona, por_cliente = {}, {}
    for v in ventas:
        deuda = saldo(v, cobrado.get(v.id, 0.0))
        if v.person_uuid in personas:
            por_persona[v.person_uuid] = por_persona.get(v.person_uuid, 0.0) + deuda
        elif v.client_id in sueltos:
            por_cliente[v.client_id] = por_cliente.get(v.client_id, 0.0) + deuda
    resultado = {}
    for c in clientes:
        if c.person_uuid in por_persona:
            resultado[c.id] = round(por_persona[c.person_uuid], 2)
        elif c.id in por_cliente:
            resultado[c.id] = round(por_cliente[c.id], 2)
    return resultado


def deuda_de_cliente(client):
    """La deuda por venta de `client`, o None si su persona todavía no tiene ventas."""
    return deudas([client]).get(client.id) if client else None



def total_acordado(client, programa=None, declarado=False):
    """Lo que `client` acordó pagar: el total de la venta 'new' vigente de su persona (del programa, si se
    sabe), acordado o, si no, el de lista de su época. Con `declarado`, solo el que alguien cargó
    (`agreed_total`, sin el de lista). None si no tiene venta. Reemplaza a `Client.total_amount` (Etapa 2c
    de docs/plan_personas.md)."""
    if client is None:
        return None
    from app.services.sale_service import venta_new_vigente
    venta = venta_new_vigente(client.person_uuid, client.id, programa)
    if venta is None:
        return None
    if declarado:
        return float(venta.agreed_total) if venta.agreed_total is not None else None
    return total_de(venta)
