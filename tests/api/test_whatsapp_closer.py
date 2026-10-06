"""El closer confirma su WhatsApp en Configuración: guarda el número, se manda una prueba y confirma
que le llegó. Cambiar el número (él o un admin) obliga a confirmarlo de nuevo."""

import pytest

from app.models import User
from app.services.whatchimp_service import AvisoDeAgenda

URL = '/api/auth/me/whatsapp'


@pytest.fixture()
def pruebas(monkeypatch):
    enviadas = []
    monkeypatch.setattr(AvisoDeAgenda, 'prueba', staticmethod(lambda numero, nombre: enviadas.append(numero)))
    return enviadas


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='ana')


def test_guardar_probar_y_confirmar(client, closer, auth_headers, pruebas):
    h = auth_headers(closer)
    assert client.put(URL, json={'numero': '+54 9 11 2233-4455'}, headers=h).get_json() == {'numero': '5491122334455', 'confirmado': False}
    assert client.post(URL + '/confirmar', headers=h).status_code == 400  # sin prueba no se confirma
    assert client.post(URL + '/prueba', headers=h).status_code == 200 and pruebas == ['5491122334455']
    assert client.post(URL + '/confirmar', headers=h).get_json()['confirmado'] is True
    assert client.get(URL, headers=h).get_json()['confirmado'] is True


def test_cambiar_el_numero_pide_confirmar_de_nuevo(client, closer, auth_headers, pruebas, db, make_user):
    h = auth_headers(closer)
    client.put(URL, json={'numero': '5491122334455'}, headers=h)
    client.post(URL + '/prueba', headers=h)
    client.post(URL + '/confirmar', headers=h)
    assert client.put(URL, json={'numero': '5491199998888'}, headers=h).get_json()['confirmado'] is False
    # Un admin que le cambia el número también lo deja sin confirmar.
    client.post(URL + '/prueba', headers=h)
    client.post(URL + '/confirmar', headers=h)
    admin = make_user(role='admin')
    client.put(f'/api/admin/users/{closer.id}', json={'two_chat_number': '5491100001111'}, headers=auth_headers(admin))
    assert User.query.get(closer.id).whatsapp_confirmado_en is None


def test_numero_invalido_y_prueba_que_falla(client, closer, auth_headers, monkeypatch):
    h = auth_headers(closer)
    assert client.put(URL, json={'numero': '123'}, headers=h).status_code == 400
    client.put(URL, json={'numero': '5491122334455'}, headers=h)

    def falla(numero, nombre):
        raise RuntimeError('whatchimp caído')

    monkeypatch.setattr(AvisoDeAgenda, 'prueba', staticmethod(falla))
    assert client.post(URL + '/prueba', headers=h).status_code == 502
    assert client.post(URL + '/confirmar', headers=h).status_code == 400
