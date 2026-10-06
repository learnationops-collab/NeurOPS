"""El closer carga su disponibilidad en Configuración: es el horario de su persona de Team en
Agendamiento (el mismo que edita la dirección comercial), con su zona horaria. La zona se adivina por
el país de su WhatsApp mientras no elija una."""

import pytest

from app.agendas_v2 import servicio
from app.agendas_v2.nucleo.catalogos import zona_por_telefono

URL = '/api/auth/me/disponibilidad'
LUNES_9_A_13 = {'1': [['09:00', '13:00']]}


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='ana', email='ana@x.com')


@pytest.mark.parametrize('numero, zona', [
    ('5491122334455', 'America/Argentina/Buenos_Aires'),
    ('+591 7123 4567', 'America/La_Paz'),
    ('584241234567', 'America/Caracas'),
    ('595981123456', 'America/Asuncion'),
    ('', None),
    ('999123', None),
])
def test_la_zona_sale_del_codigo_de_pais(numero, zona):
    assert zona_por_telefono(numero) == zona


def test_sin_persona_en_team_la_crea_al_guardar(client, closer, auth_headers, db):
    closer.two_chat_number = '5491122334455'
    db.session.commit()
    h = auth_headers(closer)
    r = client.get(URL, headers=h).get_json()
    assert r['en_team'] is False and r['tz'] == 'America/Argentina/Buenos_Aires'  # por su WhatsApp
    assert all(franjas == [] for franjas in r['horario'].values())

    r = client.put(URL, json={'horario': LUNES_9_A_13, 'tz': 'America/Argentina/Buenos_Aires'}, headers=h)
    assert r.status_code == 200 and r.get_json()['en_team'] is True
    (p,) = servicio.colecciones()['personas']
    assert p['email'] == 'ana@x.com' and p['nombre'] == 'ana' and p['rol'] == 'closer'
    assert p['horario'][1] == [['09:00', '13:00']]
    assert closer.timezone == 'America/Argentina/Buenos_Aires'


def test_edita_la_misma_persona_que_la_direccion(client, closer, auth_headers):
    servicio.guardar_doc('personas', 'p1', {'nombre': 'Ana', 'email': 'ana@x.com', 'nivel': 2, 'tz': 'America/Lima'})
    h = auth_headers(closer)
    assert client.get(URL, headers=h).get_json()['tz'] == 'America/Lima'
    client.put(URL, json={'horario': LUNES_9_A_13, 'tz': 'America/Bogota'}, headers=h)
    (p,) = servicio.colecciones()['personas']
    assert p['id'] == 'p1' and p['nivel'] == 2 and p['tz'] == 'America/Bogota'


def test_zona_invalida_y_solo_closers(client, closer, auth_headers, make_user):
    assert client.put(URL, json={'horario': {}, 'tz': 'Marte/Base'}, headers=auth_headers(closer)).status_code == 400
    assert client.get(URL, headers=auth_headers(make_user(role='setter'))).status_code == 403
    assert client.get(URL).status_code == 401
