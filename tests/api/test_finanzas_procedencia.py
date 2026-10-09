"""Procedencia de los ingresos en Finanzas › Resumen (08/10/2026): el ingreso del período abierto por
workshop, setting, VSL, Fulfillment y sin procedencia, con la misma atribución que la columna Fuente
del listado de ventas y la nómina. Lo que no se negocia: los baldes suman el ingreso del Resumen."""
from datetime import datetime
from types import SimpleNamespace

import pytest

from app.models import FinancialAgenda, FinancialSale
from app.services.procedencia_ingresos_service import clasificar_pago


@pytest.fixture()
def finanzas(make_user, auth_headers):
    return auth_headers(make_user(role='admin', can_view_finance=True))


@pytest.fixture()
def septiembre(db, make_user):
    """Un pago por cada camino de la clasificación, más lo que no suma (otro estado, otro mes)."""
    # Un setter que no está en la lista fija de `fuente_service`: entra por su rol.
    make_user(role='setter', username='Ramiro')

    def agenda(nombre, ig):
        db.session.add(FinancialAgenda(nombre=nombre, instagram=ig, date=datetime(2026, 8, 20),
                                       created_at=datetime(2026, 8, 18)))

    def venta(ig, tipo, monto, dia=10, metodo='zelle', setter=None, estado='Completada', mes=9):
        db.session.add(FinancialSale(instagram=ig, tipo_pago=tipo, monto=monto, metodo_pago=metodo,
                                     setter=setter, estado=estado, date=datetime(2026, mes, dia, 15)))

    agenda('workshop', 'ana')
    venta('ana', 'RR - Parcial', 1000.0, dia=5)
    venta('ana', 'RR - Cuota', 500.0, dia=20, metodo='Stripe')        # sigue a la agenda: workshop
    venta('ana', 'RR - Parcial', 999.0, estado='Reembolsada')          # no suma al ingreso
    agenda('workshop_landing', 'beto')
    venta('beto', 'AL - Seña', 200.0, metodo='Hotmart')
    agenda('Elias', 'caro')
    venta('caro', 'RR - Completo', 2000.0, dia=3)
    venta('caro', 'AL - Upsell', 700.0, dia=25)                        # Fulfillment, no Elias
    venta('caro', 'RR - Completo', 5000.0, dia=1, mes=10)              # otro mes
    agenda('Paula', 'dani')
    venta('dani', 'RR - Parcial', 800.0, dia=4)
    venta('dani', 'RR - Renovación', 300.0, dia=28)                   # Fulfillment, no Paula
    agenda('setting', 'eli')
    venta('eli', 'SI - Completo', 600.0)
    agenda('vsl', 'fede')
    venta('fede', 'RR - Completo', 1500.0, metodo='stripe')
    agenda('Entrevista diagnóstica', 'gabi')                           # no es fuente: manda la venta
    venta('gabi', 'RR - Seña', 100.0, setter='Ivan')
    venta('nadie', 'RR - Completo', 250.0, setter='Sin Setter')        # sin agenda
    venta('otra', 'RR - Seña', 50.0, setter='Paula')                   # sin agenda, setter en la venta
    agenda('Venta histórica sin agenda', 'hugo')
    venta('hugo', 'RR - Completo', 400.0)
    agenda('Sin asignar', 'ines')
    venta('ines', 'RR - Seña', 120.0)
    agenda('Fulfilment', 'juan')
    venta('juan', 'RR - Cuota', 90.0)
    agenda('Ramiro', 'kari')
    venta('kari', 'RR - Seña', 75.0)
    db.session.commit()


def _por_balde(datos):
    return {p['key']: (p['monto'], p['cantidad'], [(d['label'], d['monto'], d['cantidad']) for d in p['detalle']])
            for p in datos['procedencias']}


def test_reparte_el_ingreso_del_mes_por_procedencia(client, finanzas, septiembre):
    r = client.get('/api/public/finance/procedencia?start_date=2026-09-01&end_date=2026-09-30', headers=finanzas)

    assert r.status_code == 200
    datos = r.get_json()
    assert (datos['desde'], datos['hasta'], datos['cantidad']) == ('2026-09-01', '2026-09-30', 16)
    assert _por_balde(datos) == {
        'workshop': (1661.6, 3, [('En vivo', 1478.0, 2), ('Grabación', 183.6, 1)]),
        'setting': (3625.0, 6, [('Elias', 2000.0, 1), ('Paula', 850.0, 2), ('Sin identificar', 600.0, 1),
                                ('Ivan', 100.0, 1), ('Ramiro', 75.0, 1)]),
        'vsl': (1434.0, 1, []),
        'fulfillment': (1090.0, 3, [('Upsells', 700.0, 1), ('Renovaciones', 300.0, 1), ('Otros pagos', 90.0, 1)]),
        'sin_procedencia': (770.0, 3, [('Sin agenda', 650.0, 2), ('Otra fuente', 120.0, 1)]),
    }
    assert [p['pct'] for p in datos['procedencias']] == [19.4, 42.2, 16.7, 12.7, 9.0]


def test_los_baldes_suman_el_ingreso_del_resumen(client, finanzas, septiembre):
    resumen = client.get('/api/public/finance/summary?month=2026-09', headers=finanzas).get_json()
    datos = client.get('/api/public/finance/procedencia?month=2026-09', headers=finanzas).get_json()

    assert datos['total'] == resumen['kpis']['total_income'] == 8580.6
    assert round(sum(p['monto'] for p in datos['procedencias']), 2) == datos['total']
    assert sum(p['cantidad'] for p in datos['procedencias']) == datos['cantidad']
    assert round(sum(p['pct'] for p in datos['procedencias']), 1) == 100.0
    # Y el detalle de cada balde suma su balde.
    for p in datos['procedencias']:
        if p['detalle']:
            assert round(sum(d['monto'] for d in p['detalle']), 2) == p['monto'], p['key']


def test_el_redondeo_al_centavo_no_rompe_la_suma(client, db, finanzas):
    """Tres cobros de $75 por Stripe son $71.625 cada uno: redondeados por separado no dan el total."""
    for nombre, ig in (('workshop', 'a'), ('vsl', 'b'), ('Elias', 'c')):
        db.session.add(FinancialAgenda(nombre=nombre, instagram=ig, date=datetime(2026, 9, 1)))
        db.session.add(FinancialSale(instagram=ig, tipo_pago='RR - Seña', monto=75.0, metodo_pago='Stripe',
                                     estado='', date=datetime(2026, 9, 2)))
    db.session.commit()

    resumen = client.get('/api/public/finance/summary?month=2026-09', headers=finanzas).get_json()
    datos = client.get('/api/public/finance/procedencia?month=2026-09', headers=finanzas).get_json()

    assert round(sum(p['monto'] for p in datos['procedencias']), 2) == resumen['kpis']['total_income']


def test_un_rango_que_no_es_un_mes(client, finanzas, septiembre):
    datos = client.get('/api/public/finance/procedencia?start_date=2026-09-20&end_date=2026-09-30',
                       headers=finanzas).get_json()

    # La cuota de ana (Stripe), el upsell de caro y la renovación de dani.
    assert datos['total'] == 1478.0
    assert {p['key']: p['monto'] for p in datos['procedencias'] if p['monto']} == {'workshop': 478.0, 'fulfillment': 1000.0}


def test_un_periodo_sin_ventas_trae_los_cinco_baldes_en_cero(client, finanzas):
    datos = client.get('/api/public/finance/procedencia?month=2026-01', headers=finanzas).get_json()

    assert datos['total'] == 0 and datos['cantidad'] == 0
    assert [(p['key'], p['monto'], p['pct'], p['detalle']) for p in datos['procedencias']] == [
        ('workshop', 0.0, None, []), ('setting', 0.0, None, []), ('vsl', 0.0, None, []),
        ('fulfillment', 0.0, None, []), ('sin_procedencia', 0.0, None, []),
    ]


@pytest.mark.parametrize('consulta', [
    '', 'month=2026-13', 'month=septiembre', 'start_date=2026-09-01', 'end_date=2026-09-30',
    'start_date=2026-09-30&end_date=2026-09-01', 'start_date=01/09/2026&end_date=30/09/2026',
])
def test_pide_un_periodo_valido(client, finanzas, consulta):
    assert client.get(f'/api/public/finance/procedencia?{consulta}', headers=finanzas).status_code == 400


@pytest.mark.parametrize('rol,permiso,codigo', [
    ('admin', True, 200), ('director_comercial', True, 200),
    ('admin', False, 403), ('director_comercial', False, 403), ('closer', True, 403),
])
def test_la_ven_quienes_ven_finanzas(client, db, make_user, auth_headers, rol, permiso, codigo):
    cabeceras = auth_headers(make_user(role=rol, can_view_finance=permiso))

    assert client.get('/api/public/finance/procedencia?month=2026-09', headers=cabeceras).status_code == codigo


def test_sin_sesion_no_entra(client):
    assert client.get('/api/public/finance/procedencia?month=2026-09').status_code == 401


SETTERS = {'elias': 'Elias', 'paula': 'Paula', 'ivan': 'Ivan'}


@pytest.mark.parametrize('nombre,tipo,esperado', [
    ('Worshop', 'RR - Parcial', ('workshop', 'vivo')),               # el typo que llega del webhook
    ('Workshop Landing', 'RR - Cuota', ('workshop', 'grabacion')),
    ('worshop_landing', 'RR - Seña', ('workshop', 'grabacion')),
    ('VSL', 'RR - Completo', ('vsl', None)),
    (' Elías ', 'RR - Completo', ('setting', 'elias')),
    ('Setting', 'RR - Completo', ('setting', 'sin_identificar')),
    ('workshop', 'RR - Renovacion', ('fulfillment', 'renovacion')),  # el tipo manda sobre la agenda
    ('Fullfilment', 'RR - Completo', ('fulfillment', 'agenda_fulfillment')),
    ('Jean Carlo', 'RR - Completo', ('sin_procedencia', 'otra')),
    ('S/F', 'RR - Completo', ('sin_procedencia', 'sin_agenda')),
])
def test_clasificar_pago(nombre, tipo, esperado):
    venta = SimpleNamespace(tipo_pago=tipo, setter=None)

    assert clasificar_pago(venta, SimpleNamespace(nombre=nombre), SETTERS)[:2] == esperado
