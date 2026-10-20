"""Ticket promedio: lo que vale UNA venta nueva (19/10/2026).

Un cliente que paga una parte y al poco tiempo paga el resto hizo una sola inscripción: contada
como dos ventas chicas bajaba el ticket. Por eso, para el ticket (definido por Kerwin el 19/10):
  · los pagos de venta nueva (completo o split pay) del mismo cliente en el mismo mes calendario,
    o a pocos días uno del otro aunque cambie el mes (`VENTANA_DIAS`), son UNA venta;
  · la PRIMERA cuota de esa venta suma a su monto si llega a menos de un mes del pago.

Solo cambia el ticket. La cantidad de ventas del close rate y lo cobrado siguen contando filas.
"""
from datetime import date, datetime

from dateutil.relativedelta import relativedelta

# Dos pagos de venta nueva del mismo cliente en meses distintos siguen siendo la misma venta si los
# separan a lo sumo estos días (un pago el 29/09 y el resto el 02/10).
VENTANA_DIAS = 7
# La primera cuota que llega a menos de un mes del pago de venta nueva suma a esa venta.
SUMAR_PRIMERA_CUOTA = True
# Si la seña del cliente, en la misma ventana, se suma a su venta. Sin definir: hoy no.
SUMAR_SENAS = False

VENTA, CUOTA, SENA = 'venta', 'cuota', 'sena'


def _dia(fecha):
    if isinstance(fecha, datetime):
        return fecha.date()
    if isinstance(fecha, date):
        return fecha
    if isinstance(fecha, str) and fecha:
        return datetime.fromisoformat(fecha[:10]).date()
    return None


def _misma_venta(anterior, actual):
    if anterior is None or actual is None:
        return False
    if (anterior.year, anterior.month) == (actual.year, actual.month):
        return True
    return 0 <= (actual - anterior).days <= VENTANA_DIAS


def _entra(clase):
    return clase == VENTA or (clase == SENA and SUMAR_SENAS) or (clase == CUOTA and SUMAR_PRIMERA_CUOTA)


def _unir_clientes(claves_por_pago):
    """Pagos que comparten cualquier clave (ficha, mail, instagram) son del mismo cliente aunque
    a uno le falte la ficha y al otro el mail. Devuelve un representante por pago."""
    padre = {}

    def raiz(x):
        while padre.setdefault(x, x) != x:
            padre[x] = padre[padre[x]]
            x = padre[x]
        return x

    for claves in claves_por_pago:
        for otra in claves[1:]:
            padre[raiz(otra)] = raiz(claves[0])
    return [raiz(claves[0]) if claves else None for claves in claves_por_pago]


def _grupos_del_cliente(lista):
    """Las ventas de un cliente: [monto, fecha del último pago de venta nueva] por cada una."""
    pagos = sorted((p for p in lista if p[2] != CUOTA), key=lambda p: (p[0] is None, p[0] or date.min))
    grupos, grupo, ultimo = [], None, None
    for dia, monto, clase in pagos:
        if grupo is not None and _misma_venta(ultimo, dia):
            grupo[0] += monto
        else:
            grupo = [monto, None]
            grupos.append(grupo)
        if clase == VENTA:
            grupo[1] = dia or grupo[1] or date.min
        ultimo = dia
    return [g for g in grupos if g[1] is not None]


def _sumar_primera_cuota(grupos, lista):
    """Cada venta suma su primera cuota posterior si llega antes de cumplirse un mes."""
    cuotas = sorted((p for p in lista if p[2] == CUOTA and p[0]), key=lambda p: p[0])
    usadas = set()
    for grupo in grupos:
        if grupo[1] in (None, date.min):
            continue
        siguiente = next((i for i, c in enumerate(cuotas) if i not in usadas and c[0] >= grupo[1]), None)
        if siguiente is not None and cuotas[siguiente][0] < grupo[1] + relativedelta(months=1):
            usadas.add(siguiente)
            grupo[0] += cuotas[siguiente][1]


def agrupar_ventas(pagos):
    """`pagos`: tuplas (claves, fecha, monto, clase), con `claves` de `claves_de_cliente`. Sin
    claves no se sabe quién es, y ese pago queda como una venta suelta. Devuelve el monto de cada
    venta agrupada; las cuotas y señas solas no son una venta y no se devuelven."""
    pagos = [p for p in pagos if _entra(p[3])]
    clientes = _unir_clientes([tuple(p[0] or ()) for p in pagos])
    sueltos, por_cliente = [], {}
    for cliente, (_claves, fecha, monto, clase) in zip(clientes, pagos):
        if cliente is None:
            if clase == VENTA:
                sueltos.append(float(monto or 0.0))
            continue
        por_cliente.setdefault(cliente, []).append((_dia(fecha), float(monto or 0.0), clase))

    ventas = list(sueltos)
    for lista in por_cliente.values():
        grupos = _grupos_del_cliente(lista)
        if SUMAR_PRIMERA_CUOTA:
            _sumar_primera_cuota(grupos, lista)
        ventas.extend(g[0] for g in grupos)
    return ventas


def ticket_promedio(pagos):
    """(cash de las ventas agrupadas, cuántas son, ticket o None si no hay ventas)."""
    ventas = agrupar_ventas(pagos)
    cash = sum(ventas)
    return round(cash, 2), len(ventas), (round(cash / len(ventas), 2) if ventas else None)


def primeras_cuotas(pagos):
    """Las cuotas completadas que pueden sumar a las ventas nuevas de `pagos`: las de esos clientes
    en el mes que sigue a cada venta, de cualquier closer y aunque caigan fuera del período que se
    mira. La cuota es de la venta, no de quien la cargó ni del mes en que se mira. Una consulta."""
    ventas = [(p[0], _dia(p[1])) for p in pagos if p[3] == VENTA and p[0] and _dia(p[1])]
    if not SUMAR_PRIMERA_CUOTA or not ventas:
        return []
    from app.models import FinancialSale
    from app.services.sheets_service import SheetsService

    claves = {c for cs, _ in ventas for c in cs}
    desde = datetime.combine(min(d for _, d in ventas), datetime.min.time())
    hasta = datetime.combine(max(d for _, d in ventas) + relativedelta(months=1), datetime.min.time())
    filas = FinancialSale.query.filter(FinancialSale.date >= desde, FinancialSale.date < hasta,
                                       FinancialSale.tipo_pago.ilike('%cuota%')).all()
    cuotas = []
    for s in filas:
        if (s.estado or '').strip().lower() not in ('', 'completada', 'confirmada'):
            continue
        if clase_de_tipo(SheetsService.parse_tipo_pago(s.tipo_pago)[1]) != CUOTA:
            continue
        cs = claves_de_venta(s)
        if claves.intersection(cs):
            cuotas.append((cs, s.date, s.monto, CUOTA))
    return cuotas


def sin_cuotas(pagos):
    """Los pagos sin las cuotas del período: las que cuentan las trae `primeras_cuotas`."""
    return [p for p in pagos if p[3] != CUOTA]


def ticket_de(pagos):
    """`ticket_promedio` de los pagos de un período, con la primera cuota de cada venta buscada
    en la base (`primeras_cuotas`)."""
    pagos = sin_cuotas(pagos)
    return ticket_promedio(pagos + primeras_cuotas(pagos))


def _limpio(valor):
    valor = (valor or '').strip().lower().replace('@', '')
    return valor if valor and valor not in ('n/a', 'na', 'no', '-', 'sin nombre', 'no tengo') else None


def claves_de_cliente(client_id=None, email=None, instagram=None, nombre=None):
    """Con qué se reconoce al mismo cliente entre dos pagos: su ficha, su mail y su instagram.
    El nombre solo cuando no hay ninguna de las otras (dos personas pueden llamarse igual)."""
    claves = [f'id:{client_id}'] if client_id else []
    for prefijo, valor in (('mail', email), ('ig', instagram)):
        if _limpio(valor):
            claves.append(f'{prefijo}:{_limpio(valor)}')
    if not claves and _limpio(nombre):
        claves.append(f'nombre:{_limpio(nombre)}')
    return tuple(claves)


def claves_de_venta(venta):
    """Las claves de una fila de `FinancialSale`."""
    return claves_de_cliente(venta.client_id, venta.mail_cliente, venta.instagram, venta.nombre_cliente)


def clase_de_tipo(tipo):
    """VENTA, CUOTA o SENA según el tipo canónico de `SheetsService.parse_tipo_pago`; None para
    renovaciones, upsells y lo que no se reconoce, que nunca entran al ticket."""
    if tipo in ('completo', 'parcial'):
        return VENTA
    if tipo == 'cuota':
        return CUOTA
    if tipo in ('seña', 'sena'):
        return SENA
    return None


def pago_de_venta(venta, tipo):
    """El pago de una fila de `FinancialSale`, con su `tipo` canónico ya parseado."""
    return claves_de_venta(venta), venta.date, venta.monto, clase_de_tipo(tipo)


def pago_de_fila(fila):
    """El pago de una fila de la tabla Ventas (`ComercialService._fila_venta`)."""
    return (claves_de_cliente(fila.get('client_id'), fila.get('email'), fila.get('ig'), fila.get('cliente')),
            fila.get('fecha'), fila.get('monto'), clase_de_tipo((fila.get('tipo_pago') or {}).get('key')))
