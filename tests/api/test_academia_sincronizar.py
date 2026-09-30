"""Quien puede disparar un lote de fotos de la Academia, y por donde.

Cada lote gasta peticiones de un limite (60/min) que la Academia comparte con produccion y con la
ficha de todos los closers. Por eso el boton de Revisar es solo de la direccion y el cron se
identifica con CRON_SECRET; que la ruta del cron falle cerrada sin el secreto lo fija
`tests/security/test_shared_secrets.py` junto con los otros crons.

El lote se reemplaza por un doble: aca se prueba la puerta, no el lote.
"""
import pytest

from app.services import academy_snapshot_service

URL = '/api/comercial/academia/sincronizar'
CRON = '/api/academia/cron/sincronizar'
SECRETO = 'secreto-de-prueba-con-mas-de-veinte-caracteres'


@pytest.fixture()
def lotes(monkeypatch):
    corridas = []

    def lote(presupuesto=None):
        corridas.append(presupuesto)
        return {'procesados': 3, 'peticiones': 6, 'corte': None, 'mensaje': 'Se actualizaron 3 clientes.'}

    monkeypatch.setattr(academy_snapshot_service, 'sincronizar_lote', lote)
    return corridas


@pytest.mark.parametrize('rol', ['director_comercial', 'admin'])
def test_la_direccion_corre_un_lote_y_recibe_el_resumen(client, db, make_user, auth_headers, lotes, rol):
    r = client.post(URL, headers=auth_headers(make_user(role=rol)))

    assert r.status_code == 200
    assert r.get_json()['mensaje'] == 'Se actualizaron 3 clientes.'
    assert len(lotes) == 1


@pytest.mark.parametrize('rol', ['closer', 'setter', 'triage', 'operator'])
def test_el_resto_del_equipo_no_puede_gastar_el_limite_de_la_academia(client, db, make_user, auth_headers,
                                                                      lotes, rol):
    r = client.post(URL, headers=auth_headers(make_user(role=rol)))

    assert r.status_code == 403
    assert lotes == []


def test_un_anonimo_no_corre_nada(client, db, lotes):
    assert client.post(URL).status_code == 401
    assert lotes == []


def test_el_cron_pasa_el_presupuesto_pedido(client, db, lotes, monkeypatch):
    monkeypatch.setenv('CRON_SECRET', SECRETO)

    r = client.get(CRON, query_string={'presupuesto': '12'},
                   headers={'Authorization': f'Bearer {SECRETO}'})

    assert r.status_code == 200
    assert (r.get_json()['status'], lotes) == ('success', ['12'])


def test_sin_lote_real_ni_token_el_boton_explica_que_falta(client, db, make_user, auth_headers):
    """Sin ACADEMY_API_TOKEN el lote no consulta nada y lo dice (los tests nunca tienen el token)."""
    r = client.post(URL, headers=auth_headers(make_user(role='director_comercial')))

    assert r.status_code == 200
    assert (r.get_json()['corte'], r.get_json()['procesados']) == ('sin_token', 0)
    assert 'ACADEMY_API_TOKEN' in r.get_json()['mensaje']
