"""Procedencia de los ingresos en Finanzas › Resumen (08/10/2026): el ingreso del período abierto por
workshop, setting, VSL, Fulfillment y sin procedencia, con la misma atribución que la columna Fuente
del listado de ventas y la nómina. Lo que no se negocia: los baldes suman el ingreso del Resumen."""
from types import SimpleNamespace

import pytest

from app.services.procedencia_ingresos_service import clasificar_pago


@pytest.fixture()
def finanzas(make_user, auth_headers):
    return auth_headers(make_user(role='admin', can_view_finance=True))


def _por_balde(datos):
    return {p['key']: (p['monto'], p['cantidad'], [(d['label'], d['monto'], d['cantidad']) for d in p['detalle']])
            for p in datos['procedencias']}


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
