"""Programas y segmentos › por programa (Leadership 1395, ADR-W177): AL, RR y SI lado a lado.

No hay cuentas nuevas: cada cifra sale del código que ya la calcula en otra pantalla.

  · **Ventas, New Cash, Cash total, ticket**: las filas de Revisar › Ventas (`ComercialService.ventas`), partidas por
    el programa del tipo de pago («AL - cuota»), igual que el bloque «programas» de Analizar (`bloque_closers`). El
    ticket es el de Analizar (bruto, primeras cuotas incluidas); New Cash y Cash total, netos como en Marketing.
  · **Compradores**: personas distintas con una venta nueva (el denominador del CAC, `marketing_formulas`).
  · **% cobrado de lo acordado**: de las ventas (`Sale`) del período, lo cobrado ÷ lo acordado con `deuda_service`
    (`total_de` y `saldo`: un pago completo declarado cuenta como 100%). Quedan fuera las ventas sin total (las
    renovaciones y los upsells sin `agreed_total`) y las canceladas o reembolsadas.
  · **LTV**: lo cobrado (neto) hasta el fin del período por cliente de cada programa, sobre todas sus ventas hasta
    esa fecha (`financial_sales` unida a `sales` por `sale_id`: desde agosto todos los pagos lo tienen).
  · **CAC y ROAS**: el gasto de las campañas etiquetadas con el programa (`meta_programas_service`). Sin campañas
    etiquetadas con gasto en el período quedan en None.
  · **% de cierre por programa: no existe**. La agenda no sabe qué programa se va a vender.
"""
from app.models import FinancialSale, Person, Sale
from app.services import deuda_service, ficha_de_fila, meta_programas_service
from app.services.closer_service import PROGRAM_LABELS
from app.services.comercial_service import ComercialService
from app.services.comercial_vocabulario import venta_completada
from app.services.commission_service import cash_neto
from app.services.marketing_formulas import dividir
from app.services.ticket_service import pago_de_fila, primeras_cuotas, sin_cuotas, ticket_promedio

PROGRAMAS = meta_programas_service.PROGRAMAS
OTROS = 'otros'
TODOS = 'todos'  # la fila Total: las listas de cobros de todos los programas
CODIGO_DE = {label: codigo for codigo, label in PROGRAM_LABELS.items()}
METRICAS = ('ventas', 'compradores', 'new_cash', 'cash_total', 'cuotas', 'ltv', 'gasto')


def _codigo(fila):
    codigo = CODIGO_DE.get(fila['programa'])
    return codigo if codigo in PROGRAMAS else OTROS


def _comprador(fila):
    return fila['person_uuid'] or (f"c{fila['client_id']}" if fila['client_id'] else f"v{fila['id']}")


def _filas(desde, hasta):
    return [f for f in ComercialService.ventas(desde, hasta) if f.get('completada', True)]


def _ventas_del_periodo(desde, hasta):
    inicio, fin = ComercialService._limites(desde, hasta)
    return Sale.query.filter(Sale.sold_at >= inicio, Sale.sold_at <= fin).all()


def _cuotas(ventas):
    """{programa: {acordado, cobrado, pct, ventas, excluidas}}: lo cobrado de lo acordado en esas ventas."""
    cobrado, completas = deuda_service.cobrado_por_venta(v.id for v in ventas)
    salida = {p: {'acordado': 0.0, 'cobrado': 0.0, 'ventas': 0, 'excluidas': 0} for p in PROGRAMAS}
    for v in ventas:
        if v.program_code not in salida:
            continue
        fila = salida[v.program_code]
        total = deuda_service.total_de(v)
        if not total or v.status != 'active':
            fila['excluidas'] += 1
            continue
        fila['ventas'] += 1
        fila['acordado'] += total
        fila['cobrado'] += total - deuda_service.saldo(v, cobrado.get(v.id, 0.0), completo=v.id in completas)
    for fila in salida.values():
        fila['acordado'], fila['cobrado'] = round(fila['acordado'], 2), round(fila['cobrado'], 2)
        fila['pct'] = dividir(fila['cobrado'] * 100, fila['acordado'], 1)
    return salida


def _clave_de_venta(v):
    return v.person_uuid or (f"c{v.client_id}" if v.client_id else f"s{v.id}")


def _ltv_por_cliente(hasta):
    """{programa: {cliente: {cobrado, ventas: [Sale]}}} con todas las ventas hasta `hasta` y lo cobrado hasta ahí."""
    _inicio, fin = ComercialService._limites(hasta, hasta)
    ventas = Sale.query.filter(Sale.sold_at <= fin, Sale.program_code.in_(PROGRAMAS)).all()
    de_venta = {v.id: v for v in ventas}
    salida = {p: {} for p in PROGRAMAS}
    for v in ventas:
        salida[v.program_code].setdefault(_clave_de_venta(v), {'cobrado': 0.0, 'ventas': []})['ventas'].append(v)
    ids = list(de_venta)
    for i in range(0, len(ids), 500):
        for pago in FinancialSale.query.filter(FinancialSale.sale_id.in_(ids[i:i + 500]), FinancialSale.date <= fin):
            if venta_completada(pago):
                v = de_venta[pago.sale_id]
                salida[v.program_code][_clave_de_venta(v)]['cobrado'] += cash_neto(pago)
    return salida


def _ltv(hasta):
    salida = {}
    for p, clientes in _ltv_por_cliente(hasta).items():
        cobrado = round(sum(c['cobrado'] for c in clientes.values()), 2)
        salida[p] = {'ltv': dividir(cobrado, len(clientes)), 'cobrado': cobrado, 'clientes': len(clientes)}
    return salida


def _sumar(filas, cuotas_primeras):
    ventas = [f for f in filas if f['es_venta']]
    return {
        'ventas': len(ventas),
        'compradores': len({_comprador(f) for f in ventas}),
        'new_cash': round(sum(f['monto_neto'] for f in ventas), 2),
        'cash_total': round(sum(f['monto_neto'] for f in filas), 2),
        'cobros': len(filas),
        # El ticket de Analizar por programa (`bloque_closers`): bruto, con la primera cuota de cada venta.
        'ticket': ticket_promedio(sin_cuotas([pago_de_fila(f) for f in filas]) + cuotas_primeras)[2] if ventas else None,
    }


def resumen(desde, hasta):
    """{filas: [una por programa, y «otros» si cobró algo], total, gasto: {general, sin_etiquetar, etiquetadas}}."""
    filas = _filas(desde, hasta)
    cuotas_primeras = primeras_cuotas(sin_cuotas([pago_de_fila(f) for f in filas]))
    cuotas = _cuotas(_ventas_del_periodo(desde, hasta))
    ltv = _ltv(hasta)
    gasto = meta_programas_service.gasto(desde, hasta)
    salida = []
    for p in PROGRAMAS + (OTROS,):
        propias = [f for f in filas if _codigo(f) == p]
        if p == OTROS and not propias:
            continue
        fila = {'codigo': p, 'label': PROGRAM_LABELS.get(p, 'Otros y sin programa'), **_sumar(propias, cuotas_primeras)}
        if p in PROGRAMAS:
            g = gasto['por_programa'][p]
            fila.update({'cuotas': cuotas[p], 'ltv': ltv[p], 'gasto': g['gasto'] if g['campanas'] else None,
                         'campanas': g['campanas']})
            fila['cac'] = dividir(fila['gasto'], fila['compradores']) if fila['gasto'] else None
            fila['roas_new_cash'] = dividir(fila['new_cash'], fila['gasto']) if fila['gasto'] else None
        salida.append(fila)
    return {'filas': salida, 'total': _sumar(filas, cuotas_primeras),
            'gasto': {'general': gasto['general'], 'sin_etiquetar': gasto['sin_etiquetar'],
                      'etiquetadas': gasto['etiquetadas']}}


# --- Las listas detrás de cada cifra --------------------------------------------------------------

_COLUMNAS_COBROS = [
    {'key': 'fecha', 'header': 'Fecha', 'tipo': 'fecha', 'ancho': '120px'},
    {'key': 'cliente', 'header': 'Cliente', 'tipo': 'texto', 'ancho': 'minmax(160px,1.6fr)'},
    {'key': 'monto', 'header': 'Neto', 'tipo': 'dinero', 'ancho': '110px'},
    {'key': 'bruto', 'header': 'Bruto', 'tipo': 'dinero', 'ancho': '110px', 'oculta': True},
    {'key': 'tipo', 'header': 'Tipo', 'tipo': 'texto', 'ancho': '120px'},
    {'key': 'closer', 'header': 'Closer', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)'},
]
_COLUMNAS_CUOTAS = [
    {'key': 'fecha', 'header': 'Venta', 'tipo': 'fecha', 'ancho': '120px'},
    {'key': 'cliente', 'header': 'Cliente', 'tipo': 'texto', 'ancho': 'minmax(160px,1.6fr)'},
    {'key': 'tipo', 'header': 'Tipo', 'tipo': 'texto', 'ancho': '110px'},
    {'key': 'acordado', 'header': 'Acordado', 'tipo': 'dinero', 'ancho': '110px'},
    {'key': 'cobrado', 'header': 'Cobrado', 'tipo': 'dinero', 'ancho': '110px'},
    {'key': 'saldo', 'header': 'Saldo', 'tipo': 'dinero', 'ancho': '110px'},
    {'key': 'cuenta', 'header': '¿Cuenta?', 'tipo': 'texto', 'ancho': 'minmax(160px,1fr)'},
]
_COLUMNAS_LTV = [
    {'key': 'cliente', 'header': 'Cliente', 'tipo': 'texto', 'ancho': 'minmax(160px,1.6fr)'},
    {'key': 'ventas', 'header': 'Ventas del programa', 'tipo': 'numero', 'ancho': '150px'},
    {'key': 'primera', 'header': 'Primera venta', 'tipo': 'fecha', 'ancho': '130px'},
    {'key': 'cobrado', 'header': 'Cobrado (neto)', 'tipo': 'dinero', 'ancho': '130px'},
]
_TIPO_VENTA = {'new': 'Nueva', 'renewal': 'Renovación', 'upsell': 'Upsell'}
_ESTADO = {'cancelled': 'cancelada', 'refunded': 'reembolsada'}


def _nombres(ventas):
    uuids = sorted({v.person_uuid for v in ventas if v.person_uuid})
    nombres = {}
    for i in range(0, len(uuids), 500):
        nombres.update(dict(Person.query.with_entities(Person.uuid, Person.full_name)
                            .filter(Person.uuid.in_(uuids[i:i + 500]))))
    return lambda v: nombres.get(v.person_uuid) or (v.client.full_name if v.client else None) or 'Sin nombre'


def _lista_cobros(desde, hasta, programa, metrica):
    filas = [f for f in _filas(desde, hasta)
             if programa in (TODOS, _codigo(f)) and (metrica == 'cash_total' or f['es_venta'])]
    con_cliente = ficha_de_fila.personas_con_cliente(f['person_uuid'] for f in filas)
    salida = [{'id': f['id'], 'fecha': f['fecha'], 'cliente': f['cliente'], 'monto': f['monto_neto'], 'bruto': f['monto'],
               'tipo': f['tipo_pago'].get('label') or f['tipo_pago_raw'], 'closer': f['closer'] or '—',
               'ficha': ficha_de_fila.ficha_de(client_id=f['client_id'], person_uuid=f['person_uuid'], con_cliente=con_cliente)}
              for f in filas]
    if metrica == 'compradores':
        unicos = {}
        for f, fila in zip(filas, salida):
            unicos.setdefault(_comprador(f), fila)
        salida = list(unicos.values())
        resumen = f"{len(salida)} compradores"
    else:
        resumen = f"{len(salida)} {'cobros' if metrica == 'cash_total' else 'ventas nuevas'} · ${sum(f['monto'] for f in salida):,.2f} neto"
    return _COLUMNAS_COBROS, salida, resumen


def _lista_cuotas(desde, hasta, programa):
    ventas = [v for v in _ventas_del_periodo(desde, hasta) if v.program_code == programa]
    cobrado, completas = deuda_service.cobrado_por_venta(v.id for v in ventas)
    nombre = _nombres(ventas)
    salida = []
    for v in ventas:
        total = deuda_service.total_de(v)
        saldo = deuda_service.saldo(v, cobrado.get(v.id, 0.0), completo=v.id in completas)
        cuenta = 'Sí' if total and v.status == 'active' else (
            'No: sin total acordado' if not total else f"No: {_ESTADO.get(v.status, v.status)}")
        salida.append({'id': v.id, 'fecha': v.sold_at.isoformat() if v.sold_at else None, 'cliente': nombre(v),
                       'tipo': _TIPO_VENTA.get(v.kind, v.kind), 'acordado': round(total or 0, 2),
                       'cobrado': round(cobrado.get(v.id, 0.0), 2), 'saldo': round(saldo, 2), 'cuenta': cuenta,
                       'ficha': ficha_de_fila.ficha_de(client_id=v.client_id)})
    cuentan = [f for f in salida if f['cuenta'] == 'Sí']
    resumen = (f"{len(cuentan)} ventas cuentan · ${sum(f['acordado'] - f['saldo'] for f in cuentan):,.2f} cobrado de "
               f"${sum(f['acordado'] for f in cuentan):,.2f} acordado · {len(salida) - len(cuentan)} fuera")
    return _COLUMNAS_CUOTAS, salida, resumen


def _lista_ltv(hasta, programa):
    clientes = _ltv_por_cliente(hasta)[programa]
    nombre = _nombres([v for c in clientes.values() for v in c['ventas']])
    salida = []
    for clave, c in clientes.items():
        primera = min(c['ventas'], key=lambda v: v.sold_at)
        salida.append({'id': clave, 'cliente': nombre(primera), 'ventas': len(c['ventas']),
                       'primera': primera.sold_at.isoformat() if primera.sold_at else None,
                       'cobrado': round(c['cobrado'], 2), 'ficha': ficha_de_fila.ficha_de(client_id=primera.client_id)})
    salida.sort(key=lambda f: -f['cobrado'])
    total = sum(f['cobrado'] for f in salida)
    return _COLUMNAS_LTV, salida, f"{len(salida)} clientes · ${total:,.2f} cobrado hasta {hasta.strftime('%d/%m/%Y')}"


def registros(desde, hasta, metrica, programa):
    """{columnas, filas, resumen} de lo que suma `metrica` en `programa` (AL, RR, SI; `otros` y `todos` solo en los cobros;
    `sin` = el gasto sin etiquetar). Sale de las mismas funciones que la cifra."""
    if metrica not in METRICAS:
        raise ValueError('Esa cifra todavía no tiene lista.')
    if metrica == 'gasto':
        if programa not in PROGRAMAS + ('sin', meta_programas_service.GENERAL):
            raise ValueError('Programa desconocido.')
        return meta_programas_service.registros(desde, hasta, programa)
    if programa not in PROGRAMAS + ((OTROS, TODOS) if metrica in ('ventas', 'compradores', 'new_cash', 'cash_total') else ()):
        raise ValueError('Programa desconocido.')
    if metrica == 'cuotas':
        columnas, filas, resumen = _lista_cuotas(desde, hasta, programa)
    elif metrica == 'ltv':
        columnas, filas, resumen = _lista_ltv(hasta, programa)
    else:
        columnas, filas, resumen = _lista_cobros(desde, hasta, programa, metrica)
    return {'columnas': columnas, 'filas': filas, 'resumen': resumen}
