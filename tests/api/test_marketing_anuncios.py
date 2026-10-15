"""/api/marketing/anuncios: la tabla de anuncios por palabra clave y su conexión con Meta Ads.

Quién puede (admin y dirección de marketing; el cron, con CRON_SECRET) y la forma de lo que devuelve.
Los números se prueban en tests/services/test_anuncios_service.py.
"""
from datetime import date, datetime

import pytest

from app.models import Ad, LeadAnswer, ManychatLead, MetaAnuncio, MetaGastoDiario

URL = '/api/marketing/anuncios'
SECRETO = 'secreto-de-cron-de-prueba-con-mas-de-veinte'


@pytest.fixture()
def con_datos(db):
    lead = ManychatLead(manychat_id='mc-1', name='Ana', ig='ana')
    db.session.add(lead)
    db.session.flush()
    db.session.add(LeadAnswer(lead_id=lead.id, keyword='APLICAR', qualification='true',
                              created_at=datetime(2026, 10, 5), updated_at=datetime(2026, 10, 5)))
    db.session.commit()


@pytest.mark.parametrize('rol, codigo', [('director_marketing', 200), ('admin', 200), ('setter', 403),
                                         ('closer', 403), ('director_comercial', 403), ('operator', 403)])
def test_solo_marketing_y_admin_ven_la_tabla(client, make_user, auth_headers, rol, codigo):
    respuesta = client.get(URL, headers=auth_headers(make_user(role=rol)))

    assert respuesta.status_code == codigo


def test_sin_sesion_es_401(client):
    assert client.get(URL).status_code == 401
    assert client.get(f'{URL}/meta').status_code == 401


def test_la_tabla_del_periodo(client, make_user, auth_headers, con_datos):
    respuesta = client.get(URL, query_string={'desde': '2026-10-01', 'hasta': '2026-10-31'},
                           headers=auth_headers(make_user(role='director_marketing')))

    datos = respuesta.get_json()
    assert respuesta.status_code == 200
    assert (datos['desde'], datos['hasta']) == ('2026-10-01', '2026-10-31')
    assert [(f['clave'], f['entrantes'], f['calificados']) for f in datos['filas']] == [('APLICAR', 1, 1)]
    assert datos['meta'] == {'conectado': False, 'muestra': False, 'ultima_sincronizacion': None}
    assert set(datos['totales']) >= {'entrantes', 'gasto', 'cpl', 'costo_agenda', 'costo_venta', 'roas'}


def test_en_modo_muestra_la_tabla_dice_conectado_y_sincronizar_explica_por_que_no(client, make_user, auth_headers,
                                                                               monkeypatch):
    monkeypatch.setenv('META_ADS_DEMO', 'true')
    cabeceras = auth_headers(make_user(role='director_marketing'))

    assert client.get(URL, headers=cabeceras).get_json()['meta'] == {
        'conectado': True, 'muestra': True, 'ultima_sincronizacion': None}
    respuesta = client.post(f'{URL}/meta/sincronizar', json={}, headers=cabeceras)
    assert respuesta.status_code == 409
    assert 'muestra' in respuesta.get_json()['error']


def test_una_fecha_mal_escrita_es_400(client, make_user, auth_headers):
    respuesta = client.get(URL, query_string={'desde': '01/10/2026'},
                           headers=auth_headers(make_user(role='director_marketing')))

    assert respuesta.status_code == 400


def test_archivar_y_volver_a_mostrar(client, make_user, auth_headers, con_datos):
    cabeceras = auth_headers(make_user(role='director_marketing'))

    client.post(f'{URL}/archivar', json={'clave': 'APLICAR', 'archivado': True}, headers=cabeceras)
    assert Ad.query.one().status == 'archived'
    client.post(f'{URL}/archivar', json={'clave': 'APLICAR', 'archivado': False}, headers=cabeceras)
    assert Ad.query.one().status == 'active'


def test_sincronizar_sin_meta_conectado_avisa(client, make_user, auth_headers):
    respuesta = client.post(f'{URL}/meta/sincronizar', json={'dias': 30},
                            headers=auth_headers(make_user(role='director_marketing')))

    assert respuesta.status_code == 409
    assert 'META_ADS_TOKEN' in respuesta.get_json()['error']


def test_marcar_una_campana_de_workshop(client, db, make_user, auth_headers):
    db.session.add(MetaAnuncio(meta_ad_id='1', nombre='Ad 4', campana='WORKSHOP FUNNEL | TESTING ADS', campana_id='99'))
    db.session.add(MetaGastoDiario(meta_ad_id='1', fecha=date.today(), gasto=12.5, moneda='USD'))
    db.session.commit()
    cabeceras = auth_headers(make_user(role='director_marketing'))

    assert client.put(f'{URL}/meta/campanas/99', json={'workshop': 'si'}, headers=cabeceras).status_code == 400
    assert client.put(f'{URL}/meta/campanas/99', json={'workshop': True}, headers=cabeceras).status_code == 200
    assert client.put(f'{URL}/meta/campanas/77', json={'workshop': True}, headers=cabeceras).status_code == 404

    [campana] = client.get(f'{URL}/meta', headers=cabeceras).get_json()['campanas']
    assert (campana['campana_id'], campana['workshop'], campana['gasto']) == ('99', True, 12.5)
    setter = auth_headers(make_user(role='setter', username='s1', email='s1@x.com'))
    assert client.put(f'{URL}/meta/campanas/99', json={'workshop': False}, headers=setter).status_code == 403


def test_sincronizar_un_tramo_que_termina_en_hasta(client, make_user, auth_headers, monkeypatch):
    pedidos = []
    monkeypatch.setattr('app.services.meta_ads_service.sincronizar',
                        lambda desde, hasta: pedidos.append((desde, hasta)) or {'desde': str(desde), 'hasta': str(hasta)})
    cabeceras = auth_headers(make_user(role='director_marketing'))

    respuesta = client.post(f'{URL}/meta/sincronizar', json={'dias': 30, 'hasta': '2026-09-15'}, headers=cabeceras)

    assert respuesta.status_code == 200
    assert pedidos == [(date(2026, 8, 17), date(2026, 9, 15))]
    # Una fecha futura se corta en hoy; una mal escrita es 400.
    client.post(f'{URL}/meta/sincronizar', json={'dias': 1, 'hasta': '2999-01-01'}, headers=cabeceras)
    assert pedidos[-1] == (date.today(), date.today())
    assert client.post(f'{URL}/meta/sincronizar', json={'hasta': '15/09/2026'}, headers=cabeceras).status_code == 400


def test_elegir_a_mano_la_palabra_clave_de_un_anuncio_de_meta(client, db, make_user, auth_headers, con_datos):
    db.session.add(MetaAnuncio(meta_ad_id='120248557648530532', nombre='LP-TA -PSI-US'))
    # La pestaña lista los que gastaron en el período (por defecto, los últimos 30 días).
    db.session.add(MetaGastoDiario(meta_ad_id='120248557648530532', fecha=date.today(), gasto=5.0, moneda='USD'))
    db.session.commit()
    cabeceras = auth_headers(make_user(role='director_marketing'))

    respuesta = client.put(f'{URL}/meta/120248557648530532', json={'clave': 'APLICAR'}, headers=cabeceras)

    assert respuesta.get_json() == {'meta_ad_id': '120248557648530532', 'clave': 'APLICAR', 'mapeo': 'manual'}
    listado = client.get(f'{URL}/meta', headers=cabeceras).get_json()
    assert listado['claves'] == ['APLICAR']
    assert [(a['meta_ad_id'], a['clave']) for a in listado['anuncios']] == [('120248557648530532', 'APLICAR')]
    assert client.put(f'{URL}/meta/999', json={'clave': 'APLICAR'}, headers=cabeceras).status_code == 404


def test_el_cron_exige_su_secreto(client, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)

    assert client.get(f'{URL}/cron/meta').status_code == 401
    sin_meta = client.get(f'{URL}/cron/meta', headers={'Authorization': f'Bearer {SECRETO}'})
    assert sin_meta.status_code == 503
    assert 'META_ADS_TOKEN' in sin_meta.get_json()['message']


def test_elegir_campana_y_conjunto_a_mano(client, make_user, auth_headers, con_datos):
    cabeceras = auth_headers(make_user(role='director_marketing'))

    respuesta = client.post(f'{URL}/agrupar', json={'clave': 'APLICAR', 'campana': 'DM Funnel', 'conjunto': 'Broad'},
                            headers=cabeceras)

    assert respuesta.get_json() == {'clave': 'APLICAR', 'campana': 'DM Funnel', 'conjunto': 'Broad'}
    tabla = client.get(URL, query_string={'desde': '2026-10-01', 'hasta': '2026-10-31'}, headers=cabeceras).get_json()
    assert [(f['campana'], f['conjunto'], f['agrupacion']) for f in tabla['filas']] == [('DM Funnel', 'Broad', 'manual')]
    assert client.post(f'{URL}/agrupar', json={'clave': 'APLICAR', 'campana': 5}, headers=cabeceras).status_code == 400
    assert client.post(f'{URL}/agrupar', json={'clave': 'APLICAR'},
                       headers=auth_headers(make_user(role='setter'))).status_code == 403
