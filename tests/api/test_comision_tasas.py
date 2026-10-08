"""Los % de comisión editables (08/10/2026): cada juego vale desde un mes, sin tocar los anteriores,
y los cálculos de Finanzas, Payroll y la tarjeta del closer los usan."""
from datetime import datetime

import pytest

from app.api.public.finance import get_commissions_calculated
from app.models import FinancialSale
from app.services import comision_tasas_service as servicio


@pytest.fixture()
def finanzas(make_user, auth_headers):
    return auth_headers(make_user(role='director_comercial', can_view_finance=True))


def venta(db, monto, fecha, setter='Elias', tipo='RR - Cuota', closer=None):
    db.session.add(FinancialSale(monto=monto, metodo_pago='zelle', tipo_pago=tipo, estado='Completada',
                                 setter=setter, email_vendedor=closer, date=fecha))
    db.session.commit()


def test_sin_juegos_guardados_valen_los_de_fabrica(client, db, finanzas):
    datos = client.get('/api/public/finance/comisiones/tasas?mes=2026-09', headers=finanzas).get_json()

    assert datos['vigente_desde'] is None
    assert datos['tasas'] == servicio.TASAS_DE_FABRICA
    assert [p['nombre'] for p in datos['personas']['fulfillment']] == ['Andy', 'Dari', 'Santi', 'Belu', 'Pedro']


def test_un_juego_vale_desde_su_mes_y_no_cambia_los_anteriores(client, db, finanzas):
    tasas = {'setters': {'elias': 12}}
    r = client.put('/api/public/finance/comisiones/tasas', headers=finanzas,
                   json={'vigente_desde': '2026-10', 'tasas': tasas})
    assert r.status_code == 200

    venta(db, 1000.0, datetime(2026, 9, 10))
    venta(db, 1000.0, datetime(2026, 10, 10))

    assert get_commissions_calculated('2026-09')['elias'] == 80.0    # 8%, el de fábrica
    assert get_commissions_calculated('2026-10')['elias'] == 120.0   # 12% desde octubre
    # Lo que no se tocó sigue como estaba.
    assert servicio.vigentes('2026-10')[0]['closers'] == {'jeancarlo': 10, 'facundo': 10}

    # Payroll en un rango que cruza el cambio: cada venta con el % de su mes.
    nomina = client.get('/api/public/financial-sales/payroll?start_date=2026-09-01&end_date=2026-10-31',
                        headers=finanzas).get_json()
    assert sorted(v['porcentaje'] for v in nomina['elias']['sales']) == [8, 12]
    assert nomina['elias']['comision_total'] == 200.0
    assert nomina['elias']['porcentaje_comision'] is None  # dos % distintos en el rango


def test_fulfillment_toma_su_tabla_del_mes(db):
    servicio.guardar('2026-09', {'fulfillment': {'santi': {'RR': [1, 1, 1, 10]}}})
    venta(db, 1000.0, datetime(2026, 9, 10), setter=None, tipo='RR - Cuota')

    assert get_commissions_calculated('2026-09')['fulfillment']['santi'] == 100.0


@pytest.mark.parametrize('cuerpo', [
    {'vigente_desde': '10/2026', 'tasas': {}},
    {'vigente_desde': '2026-10', 'tasas': {'setters': {'elias': 120}}},
    {'vigente_desde': '2026-10', 'tasas': {'setters': {'elias': 'mucho'}}},
    {'vigente_desde': '2026-10', 'tasas': {'fulfillment': {'andy': {'AL': [1, 2]}}}},
])
def test_rechaza_un_juego_invalido(client, db, finanzas, cuerpo):
    assert client.put('/api/public/finance/comisiones/tasas', headers=finanzas, json=cuerpo).status_code == 400


def test_guardar_el_mismo_mes_reemplaza_y_queda_en_el_historial(client, db, make_user, auth_headers):
    mario = make_user(role='admin', username='Mario', can_view_finance=True)
    cabeceras = auth_headers(mario)
    client.put('/api/public/finance/comisiones/tasas', headers=cabeceras,
               json={'vigente_desde': '2026-11', 'tasas': {'director': {'marlon': 6}}})
    r = client.put('/api/public/finance/comisiones/tasas', headers=cabeceras,
                   json={'vigente_desde': '2026-11', 'tasas': {'director': {'marlon': 7}}})

    assert r.get_json()['tasas']['director']['marlon'] == 7
    assert [(h['vigente_desde'], h['editado_por']) for h in r.get_json()['historial']] == [('2026-11', 'Mario')]


def test_solo_quien_ve_finanzas_los_edita(client, db, make_user, auth_headers):
    sin_permiso = auth_headers(make_user(role='director_comercial'))

    assert client.get('/api/public/finance/comisiones/tasas', headers=sin_permiso).status_code == 403
    assert client.put('/api/public/finance/comisiones/tasas', headers=sin_permiso,
                      json={'vigente_desde': '2026-10', 'tasas': {}}).status_code == 403


def test_la_tarjeta_del_closer_usa_su_porcentaje(db, make_user):
    from unittest.mock import patch
    from freezegun import freeze_time

    from app.services.commission_service import CommissionService

    facundo = make_user(role='closer', username='Facundo')
    servicio.guardar('2026-10', {'closers': {'facundo': 15}})
    with freeze_time('2026-10-20 15:00:00'), patch('app.services.closer_service.CloserService.get_comprehensive_stats',
                                                  return_value={'sales': {'totals': {'cash_neto': 1000.0}}}):
        tarjeta = CommissionService.get_closer_commission(facundo)

    assert (tarjeta['rate'], tarjeta['commission']) == (0.15, 150.0)
