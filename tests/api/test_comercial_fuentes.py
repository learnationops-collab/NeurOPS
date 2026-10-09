"""Analizar › «Ingresos por fuente» (pedido del usuario, 09/10/2026): el Cash collected del período
abierto por la fuente que trajo cada cobro —workshop, setting, VSL, Fulfillment o sin procedencia—
en el dashboard comercial y en «Mis datos» del closer.

Lo que no se negocia, y por eso se prueba acá contra el endpoint y no contra el servicio:

  · cierra con «Cash collected» del MISMO filtro (equipo, una persona, un closer) y con las filas
    de la tabla Ventas;
  · el alcance lo fuerza el backend: un closer recibe lo suyo pida lo que pida, y un closer sin
    ventas recibe ceros, no las del equipo (la fuga del conjunto vacío del 24/09);
  · la clasificación es la de Finanzas › Procedencia, sin copia: un cobro cae en el mismo balde
    para el closer, para el equipo y para Finanzas.

Y desde el mismo día, la faceta y el agrupar «Fuente» de Revisar › Ventas: cada fila de la tabla
lleva la fuente de su cobro, la misma que la cuenta en la tarjeta.
"""
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import FinancialAgenda, FinancialSale

HOY = '2026-09-17 21:30:00'
RESUMEN = '/api/comercial/resumen'
TABLA = '/api/comercial/tabla'
SEPTIEMBRE = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30', 'compare': 'none'}
CONTRA_AGOSTO = {**SEPTIEMBRE, 'compare': 'custom', 'compare_start': '2026-08-01', 'compare_end': '2026-08-31'}

MARLON = 'marlon@thelearnation.com'
NERINA = 'nerina@thelearnation.com'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'admin': make_user(role='admin', username='root', can_view_finance=True),
        'marlon': make_user(role='closer', username='Marlon', email=MARLON),
        'nerina': make_user(role='closer', username='Nerina', email=NERINA),
        # Un closer recién entrado, sin ninguna venta.
        'gabriela': make_user(role='closer', username='Gabriela', email='gabriela@thelearnation.com'),
        'setter': make_user(role='setter', username='Elias'),
    }


@pytest.fixture()
def cobros(db, equipo):
    """Un cobro por fuente, repartidos entre dos closers y uno sin closer, más lo que no suma."""
    def agenda(nombre, ig, dia=datetime(2026, 8, 20)):
        db.session.add(FinancialAgenda(nombre=nombre, instagram=ig, date=dia, created_at=dia))

    def venta(ig, tipo, monto, vendedor, dia=10, mes=9, metodo='zelle', estado='Completada'):
        db.session.add(FinancialSale(instagram=ig, tipo_pago=tipo, monto=monto, metodo_pago=metodo,
                                     email_vendedor=vendedor, estado=estado,
                                     date=datetime(2026, mes, dia, 15)))

    agenda('workshop', 'ana')
    venta('ana', 'RR - Parcial', 1000.0, MARLON, dia=5)
    # La cuota de ana la cobró OTRO closer, y ana volvió a agendar con un setter antes de pagarla.
    # La cuota sigue a la agenda del primer pago (workshop) también en la vista de Nerina, porque la
    # atribución se calcula sobre todo el período: mirando solo los cobros de Nerina, la cuota no
    # tendría primer pago y caería en la agenda más reciente (setting).
    agenda('Elias', 'ana', dia=datetime(2026, 9, 15))
    venta('ana', 'RR - Cuota', 500.0, NERINA, dia=20)
    agenda('Elias', 'caro')
    venta('caro', 'RR - Completo', 2000.0, NERINA, dia=3)
    agenda('vsl', 'fede')
    # Por Stripe: la tarjeta reparte el cash BRUTO, como «Cash collected»; Finanzas, el neto.
    venta('fede', 'RR - Completo', 1500.0, MARLON, dia=8, metodo='Stripe')
    venta('nadie', 'RR - Completo', 250.0, NERINA, dia=12)                 # sin agenda
    venta('dani', 'RR - Renovación', 300.0, None, dia=28)                 # Fulfillment, sin closer
    venta('ana', 'RR - Parcial', 999.0, MARLON, estado='Reembolsada')     # no es cash
    agenda('workshop', 'beto')
    venta('beto', 'AL - Seña', 200.0, MARLON, dia=20, mes=8)              # el período comparado
    db.session.commit()


def _resumen(client, headers, **extra):
    return client.get(RESUMEN, headers=headers, query_string={**SEPTIEMBRE, **extra}).get_json()


def _montos(fuentes):
    return {p['key']: p['monto'] for p in fuentes['procedencias'] if p['cantidad']}


# --- Cierra con el Cash collected --------------------------------------------------------------

@freeze_time(HOY)
@pytest.mark.parametrize('quien, miembro', [
    ('director', None), ('director', 'marlon'), ('director', 'nerina'), ('director', 'gabriela'),
    ('admin', None), ('marlon', None), ('nerina', None), ('gabriela', None),
])
def test_la_suma_por_fuente_es_el_cash_collected_del_mismo_filtro(client, equipo, cobros, auth_headers,
                                                                   quien, miembro):
    headers = auth_headers(equipo[quien])
    extra = {'miembro_id': equipo[miembro].id} if miembro else {}
    datos = _resumen(client, headers, **extra)
    ventas = client.get(TABLA, headers=headers, query_string={**SEPTIEMBRE, **extra, 'tabla': 'ventas'}).get_json()
    fuentes = datos['fuentes']

    assert fuentes['base'] == 'bruto'
    assert fuentes['total'] == datos['actual']['cash'] == ventas['totales']['cash']
    assert round(sum(p['monto'] for p in fuentes['procedencias']), 2) == fuentes['total']
    assert sum(p['cantidad'] for p in fuentes['procedencias']) == fuentes['cantidad'] == len(ventas['filas'])
    for p in fuentes['procedencias']:
        if p['detalle']:
            assert round(sum(d['monto'] for d in p['detalle']), 2) == p['monto'], p['key']


# --- Alcance -----------------------------------------------------------------------------------

@freeze_time(HOY)
def test_el_director_ve_al_equipo_y_puede_acotar_a_una_persona(client, equipo, cobros, auth_headers):
    headers = auth_headers(equipo['director'])

    equipo_entero = _resumen(client, headers)['fuentes']
    de_nerina = _resumen(client, headers, miembro_id=equipo['nerina'].id)['fuentes']

    assert _montos(equipo_entero) == {'workshop': 1500.0, 'setting': 2000.0, 'vsl': 1500.0,
                                      'fulfillment': 300.0, 'sin_procedencia': 250.0}
    assert equipo_entero['total'] == 5550.0
    # La cuota que cobró Nerina de un cliente que entró por el workshop es workshop para ella también.
    assert _montos(de_nerina) == {'workshop': 500.0, 'setting': 2000.0, 'sin_procedencia': 250.0}
    setting = next(p for p in de_nerina['procedencias'] if p['key'] == 'setting')
    assert [(d['label'], d['monto'], d['cantidad']) for d in setting['detalle']] == [('Elias', 2000.0, 1)]


@freeze_time(HOY)
@pytest.mark.parametrize('pedido', [
    {'miembro_id': 'otro'}, {'miembro_id': 'all'}, {'rol': 'setters'}, {'rol': 'setters', 'miembro_id': 'all'},
])
def test_un_closer_ve_solo_sus_fuentes_pida_lo_que_pida(client, equipo, cobros, auth_headers, pedido):
    if pedido.get('miembro_id') == 'otro':
        pedido = {**pedido, 'miembro_id': equipo['nerina'].id}

    datos = _resumen(client, auth_headers(equipo['marlon']), **pedido)

    assert datos['rol'] == 'closers'
    assert _montos(datos['fuentes']) == {'workshop': 1000.0, 'vsl': 1500.0}
    assert (datos['fuentes']['total'], datos['fuentes']['cantidad']) == (2500.0, 2)


@freeze_time(HOY)
@pytest.mark.parametrize('pedido', [{}, {'miembro_id': 'all'}, {'miembro_id': 'otro'}])
def test_un_closer_sin_ventas_ve_ceros_y_no_las_del_equipo(client, equipo, cobros, auth_headers, pedido):
    if pedido.get('miembro_id') == 'otro':
        pedido = {'miembro_id': equipo['marlon'].id}

    fuentes = _resumen(client, auth_headers(equipo['gabriela']), **pedido)['fuentes']

    assert (fuentes['total'], fuentes['cantidad']) == (0.0, 0)
    assert [(p['key'], p['monto'], p['cantidad'], p['detalle']) for p in fuentes['procedencias']] == [
        ('workshop', 0.0, 0, []), ('setting', 0.0, 0, []), ('vsl', 0.0, 0, []),
        ('fulfillment', 0.0, 0, []), ('sin_procedencia', 0.0, 0, []),
    ]


@freeze_time(HOY)
def test_el_tablero_de_setters_no_trae_plata(client, equipo, cobros, auth_headers):
    """El tablero de setters no muestra cash: ni el setter en «Mis datos» (aunque pida closers) ni la
    dirección con el switch en Setters reciben fuentes."""
    del_setter = _resumen(client, auth_headers(equipo['setter']), rol='closers')
    direccion = _resumen(client, auth_headers(equipo['director']), rol='setters')

    assert del_setter['rol'] == direccion['rol'] == 'setters'
    assert 'fuentes' not in del_setter and 'fuentes' not in direccion


# --- Una sola clasificación --------------------------------------------------------------------

@freeze_time(HOY)
def test_el_equipo_reparte_como_finanzas_con_el_cash_bruto(client, equipo, cobros, auth_headers):
    """Los mismos cobros en los mismos baldes que Finanzas › Procedencia; cambia solo la base: el
    cobro por Stripe de la VSL entra entero (bruto) y en Finanzas sin la fee (neto)."""
    finanzas = client.get('/api/public/finance/procedencia?month=2026-09',
                          headers=auth_headers(equipo['admin'])).get_json()
    fuentes = _resumen(client, auth_headers(equipo['director']))['fuentes']

    def forma(datos):
        return [(p['key'], p['cantidad'], [(d['key'], d['cantidad']) for d in p['detalle']])
                for p in datos['procedencias']]

    assert forma(fuentes) == forma(finanzas)
    assert next(p['monto'] for p in fuentes['procedencias'] if p['key'] == 'vsl') == 1500.0
    assert next(p['monto'] for p in finanzas['procedencias'] if p['key'] == 'vsl') == 1434.0


# --- Comparación -------------------------------------------------------------------------------

@freeze_time(HOY)
def test_con_comparacion_trae_lo_del_periodo_anterior_y_el_delta(client, equipo, cobros, auth_headers):
    datos = client.get(RESUMEN, headers=auth_headers(equipo['marlon']), query_string=CONTRA_AGOSTO).get_json()
    fuentes = datos['fuentes']
    por_key = {p['key']: p for p in fuentes['procedencias']}

    assert (fuentes['previo'], fuentes['delta']) == (200.0, {'valor': 1150.0, 'modo': 'pct'})
    # El total compara igual que el KPI de cash.
    assert fuentes['delta'] == datos['deltas']['cash']
    assert (por_key['workshop']['previo'], por_key['workshop']['delta']) == (200.0, {'valor': 400.0, 'modo': 'pct'})
    # Sin nada en agosto no hay porcentaje que calcular: sin delta, no un infinito.
    assert (por_key['vsl']['previo'], por_key['vsl']['delta']) == (0.0, None)


@freeze_time(HOY)
def test_sin_comparacion_no_hay_delta(client, equipo, cobros, auth_headers):
    fuentes = _resumen(client, auth_headers(equipo['director']))['fuentes']

    assert (fuentes['previo'], fuentes['delta']) == (None, None)
    assert {(p['previo'], p['delta']) for p in fuentes['procedencias']} == {(None, None)}


# --- Revisar › Ventas: la faceta y el agrupar «Fuente» ------------------------------------------
# Revisar filtra y agrupa del lado del cliente, sobre las filas de la tabla: lo que se prueba acá
# es que cada fila llegue con su fuente y que sea la de la tarjeta. Filtrar por una fuente es
# quedarse con las filas de ese balde; agrupar, repartirlas por él.

def _tabla_ventas(client, headers, **extra):
    return client.get(TABLA, headers=headers, query_string={**SEPTIEMBRE, **extra, 'tabla': 'ventas'}).get_json()


def _por_fuente(filas):
    """{balde: (monto, cobros)} y {(balde, detalle): (monto, cobros)} de las filas: agrupar por la
    fuente, como Revisar."""
    baldes, detalles = {}, {}
    for f in filas:
        clave = f['procedencia']['key']
        monto, n = baldes.get(clave, (0.0, 0))
        baldes[clave] = (round(monto + f['monto'], 2), n + 1)
        if f['procedencia_detalle']:
            sub = (clave, f['procedencia_detalle']['label'])
            monto, n = detalles.get(sub, (0.0, 0))
            detalles[sub] = (round(monto + f['monto'], 2), n + 1)
    return baldes, detalles


@freeze_time(HOY)
def test_cada_cobro_de_la_tabla_lleva_la_fuente_que_lo_trajo(client, equipo, cobros, auth_headers):
    filas = _tabla_ventas(client, auth_headers(equipo['director']))['filas']

    def fuente(f):
        detalle = f['procedencia_detalle']
        return (f['procedencia']['label'], detalle and detalle['label'])

    assert sorted((f['ig'], f['tipo_pago_raw'], fuente(f)) for f in filas) == sorted([
        ('ana', 'RR - Parcial', ('Workshop', 'En vivo')),
        # La cuota sigue a la agenda del primer pago, aunque ana haya vuelto a agendar con un setter.
        ('ana', 'RR - Cuota', ('Workshop', 'En vivo')),
        ('caro', 'RR - Completo', ('Setting', 'Elias')),
        ('fede', 'RR - Completo', ('VSL', None)),          # la VSL no se abre en detalle
        ('nadie', 'RR - Completo', ('Sin procedencia', 'Sin agenda')),
        ('dani', 'RR - Renovación', ('Fulfillment', 'Renovaciones')),
    ])
    # El balde viaja con su clave y su tono, los de la tarjeta.
    assert {f['procedencia']['key']: f['procedencia']['tone'] for f in filas} == {
        'workshop': 'cat-4', 'setting': 'cat-2', 'vsl': 'cat-1', 'fulfillment': 'cat-3', 'sin_procedencia': 'idle'}


@freeze_time(HOY)
@pytest.mark.parametrize('quien, miembro', [
    ('director', None), ('director', 'marlon'), ('director', 'nerina'), ('director', 'gabriela'),
    ('marlon', None), ('nerina', None), ('gabriela', None),
])
def test_filtrar_o_agrupar_por_fuente_da_lo_mismo_que_la_tarjeta(client, equipo, cobros, auth_headers,
                                                                  quien, miembro):
    """Cada fuente de la tarjeta (y cada renglón de su detalle) son exactamente las filas de la tabla
    con esa fuente, con el mismo filtro: el mismo monto bruto y los mismos cobros. Es lo que deja
    que tocar una fila de la tarjeta abra Revisar filtrado y la tira de totales diga su número."""
    headers = auth_headers(equipo[quien])
    extra = {'miembro_id': equipo[miembro].id} if miembro else {}
    fuentes = _resumen(client, headers, **extra)['fuentes']
    tabla = _tabla_ventas(client, headers, **extra)

    baldes, detalles = _por_fuente(tabla['filas'])
    assert baldes == {p['key']: (p['monto'], p['cantidad']) for p in fuentes['procedencias'] if p['cantidad']}
    assert detalles == {(p['key'], d['label']): (d['monto'], d['cantidad'])
                        for p in fuentes['procedencias'] for d in p['detalle']}


@freeze_time(HOY)
@pytest.mark.parametrize('pedido', [{}, {'miembro_id': 'otro'}, {'miembro_id': 'all'}, {'rol': 'setters'}])
def test_un_closer_filtra_por_fuente_solo_lo_suyo(client, equipo, cobros, auth_headers, pedido):
    """Nerina, pida lo que pida, recibe sus cobros y nada más. La fuente se calcula con todo el
    período (la cuota de ana es workshop porque el primer pago lo cobró Marlon), pero ese contexto
    no le agrega ninguna fila: el workshop de Marlon no aparece en su lista."""
    if pedido.get('miembro_id') == 'otro':
        pedido = {'miembro_id': equipo['marlon'].id}

    filas = _tabla_ventas(client, auth_headers(equipo['nerina']), **pedido)['filas']

    assert {f['closer'] for f in filas} == {'Nerina'}
    assert sorted((f['ig'], f['procedencia']['key']) for f in filas) == [
        ('ana', 'workshop'), ('caro', 'setting'), ('nadie', 'sin_procedencia')]


@freeze_time(HOY)
def test_un_closer_sin_ventas_no_recibe_fuentes_de_nadie(client, equipo, cobros, auth_headers):
    for pedido in ({}, {'miembro_id': equipo['marlon'].id}, {'miembro_id': 'all'}):
        assert _tabla_ventas(client, auth_headers(equipo['gabriela']), **pedido)['filas'] == []


@freeze_time(HOY)
def test_la_fuente_se_calcula_una_vez_por_pedido_y_solo_en_la_tabla(client, equipo, cobros, auth_headers,
                                                                     monkeypatch):
    """La atribución recorre todas las agendas: la tabla la corre UNA vez por pedido, tenga las filas
    que tenga, y filtrar o agrupar después no vuelve al servidor. Las demás que leen las ventas —el
    bloque de Analizar, Comparativas por persona y período, Variabilidad— no la pagan."""
    from app.services import procedencia_ingresos_service as servicio
    from app.services.attribution_service import AttributionService
    from app.services.comercial_service import ComercialService

    llamadas = []
    original = AttributionService.get_sales_attribution

    def contada(*args, **kwargs):
        llamadas.append(1)
        return original(*args, **kwargs)

    monkeypatch.setattr(servicio.AttributionService, 'get_sales_attribution', staticmethod(contada))

    filas = _tabla_ventas(client, auth_headers(equipo['director']))['filas']
    assert len(filas) == 6 and len(llamadas) == 1

    llamadas.clear()
    sin_fuente = ComercialService.ventas(datetime(2026, 9, 1).date(), datetime(2026, 9, 30).date())
    assert llamadas == [] and all('procedencia' not in f for f in sin_fuente)


def test_acotar_a_un_nombre_vacio_es_acotar_a_nadie(db):
    """None es todo el equipo; un nombre, aunque esté vacío, acota. Escrito como `if closer_nombre`,
    un closer sin nombre veía la plata del equipo: la fuga del conjunto vacío, en otro lugar."""
    from app.services.comercial_service import ComercialService

    assert ComercialService.vendio('Marlon', None) is True
    assert ComercialService.vendio('Marlon', 'marlon') is True
    assert ComercialService.vendio('Marlon', 'Nerina') is False
    assert ComercialService.vendio('Sin Closer', '') is False
