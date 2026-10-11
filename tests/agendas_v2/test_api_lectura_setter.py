"""El setter en Thalamus (10/10/2026): entra a mirar y no cambia nada.

Ve funnels, formularios, equipo, la ocupacion y Stats (para copiar su link y probar el agendamiento),
pero lo que se configura es de todos y queda para la direccion: cada escritura le da 403 y no toca
nada. Tampoco le llegan los datos personales de otros: el contacto y las respuestas de cada lead, el
email de cada persona del equipo ni el titulo de los eventos del calendario de un closer.
"""

from datetime import datetime, timedelta

import pytest

from app.agendas_v2 import servicio

URL = '/api/agendas-v2'


@pytest.fixture()
def gente(make_user):
    return {
        'director': make_user(role='director_comercial', email='dir@neuro.com'),
        'closer': make_user(role='closer', email='ana@neuro.com'),
        'setter': make_user(role='setter', email='seba@neuro.com'),
    }


@pytest.fixture()
def dir_h(gente, auth_headers):
    return auth_headers(gente['director'])


@pytest.fixture()
def setter_h(gente, auth_headers):
    return auth_headers(gente['setter'])


@pytest.fixture()
def agenda(db, gente):
    """Una agenda tomada por Agendas 2.0, con el lead y sus respuestas en el payload."""
    from app.models import Appointment, Client

    cliente = Client(full_name='Lucia Paz', email='lucia@lead.com')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(
        closer_id=gente['closer'].id, client_id=cliente.id, start_time=datetime.utcnow() + timedelta(days=1),
        agenda_payload={
            'evento_id': 'e1', 'funnel_id': 'f1', 'closer_id': 'p1', 'duracion_min': 45, 'margen_min': 15,
            'meet': 'https://meet.google.com/abc-defg-hij',
            'lead': {'nombre': 'Lucia Paz', 'email': 'lucia@lead.com', 'telefono': '+59170000000', 'instagram': 'lu'},
            'respuestas': [{'pregunta': '¿Cuánto ganás?', 'respuesta': 'Mucho'}],
        },
    )
    db.session.add(appt)
    db.session.commit()
    return appt


def _con_ana_en_team(client, dir_h):
    client.put(f'{URL}/personas/p1', headers=dir_h, json={'nombre': 'Ana', 'email': 'ana@neuro.com'})


def test_el_setter_lee_el_estado_en_solo_lectura(client, dir_h, setter_h, agenda):
    _con_ana_en_team(client, dir_h)

    r = client.get(f'{URL}/estado', headers=setter_h)

    assert r.status_code == 200
    cuerpo = r.get_json()
    assert cuerpo['solo_lectura'] is True
    assert [p['nombre'] for p in cuerpo['cols']['personas']] == ['Ana']
    assert cuerpo['cols']['personas'][0]['email'] == ''
    reserva = cuerpo['reservas'][0]
    # Lo que dibuja la ocupacion del closer, nada del lead ni el link de la llamada.
    assert reserva['closer_id'] == 'p1' and reserva['estado'] == 'agendada' and reserva['margen_min'] == 15
    assert not {'lead', 'respuestas', 'meet'} & set(reserva)
    assert 'lucia' not in r.get_data(as_text=True).lower()


def test_la_direccion_sigue_recibiendo_todo(client, dir_h, agenda):
    _con_ana_en_team(client, dir_h)

    cuerpo = client.get(f'{URL}/estado', headers=dir_h).get_json()

    assert cuerpo['solo_lectura'] is False
    assert cuerpo['cols']['personas'][0]['email'] == 'ana@neuro.com'
    assert cuerpo['reservas'][0]['lead']['email'] == 'lucia@lead.com'


@pytest.mark.parametrize('ruta', ['/estadisticas', '/version', '/usuarios', '/usuarios?rol=setter'])
def test_el_setter_lee_stats_version_y_el_equipo(client, gente, setter_h, ruta):
    assert client.get(URL + ruta, headers=setter_h).status_code == 200


@pytest.mark.parametrize('rol', ['closer', 'setter'])
def test_el_setter_ve_al_equipo_sin_emails(client, gente, setter_h, rol):
    usuarios = client.get(f'{URL}/usuarios?rol={rol}', headers=setter_h).get_json()['usuarios']

    assert [u['nombre'] for u in usuarios] == [gente[rol].username]
    assert {u['email'] for u in usuarios} == {''}


def test_el_setter_se_reconoce_en_la_lista_para_ver_solo_su_link(client, gente, make_user, setter_h):
    otro = make_user(role='setter', email='otro@neuro.com')

    usuarios = client.get(f'{URL}/usuarios?rol=setter', headers=setter_h).get_json()['usuarios']

    assert {u['id']: u['yo'] for u in usuarios} == {gente['setter'].id: True, otro.id: False}


def test_el_setter_ve_lo_ocupado_de_cada_closer_sin_titulos(client, db, monkeypatch, gente, dir_h, setter_h):
    from app.models import GoogleCalendarToken
    from app.services.google_service import GoogleService

    db.session.add(GoogleCalendarToken(user_id=gente['closer'].id, token_json='{}'))
    db.session.commit()
    _con_ana_en_team(client, dir_h)
    servicio._google_semana_cache.clear()
    monkeypatch.setattr(GoogleService, 'eventos_ocupados', staticmethod(
        lambda u, desde, hasta: [{'inicio': 100, 'fin': 200, 'titulo': 'Llamada con Lucia Paz'}]))
    ruta = f'{URL}/ocupacion?desde=0&hasta={86400000}'

    del_setter = client.get(ruta, headers=setter_h).get_json()['ocupacion']['p1']
    de_la_direccion = client.get(ruta, headers=dir_h).get_json()['ocupacion']['p1']

    assert del_setter['franjas'] == [[100, 200]]
    assert del_setter['eventos'] == [{'inicio': 100, 'fin': 200, 'titulo': None}]
    assert de_la_direccion['eventos'][0]['titulo'] == 'Llamada con Lucia Paz'


ESCRITURAS = [
    ('PUT', '/funnels/f1', {'nombre': 'Nuevo'}),
    ('PATCH', '/eventos/e1', {'activo': False}),
    ('DELETE', '/eventos/e1', None),
    ('PUT', '/formularios/fo1', {'nombre': 'Otro'}),
    ('DELETE', '/personas/p1', None),
    ('PUT', '/grupos/g1', {'nombre': 'Top'}),
    ('PUT', '/roles/r1', {'nombre': 'Setter'}),
    ('PUT', '/perfil', {'nombre': 'Seba'}),
    ('PUT', '/integraciones', {'pixel': {'activo': True, 'id': '123'}}),
    ('GET', '/paquete/prompt', None),
    ('POST', '/paquete', {'paquete': {}, 'simular': True}),
]


@pytest.mark.parametrize('metodo,ruta,cuerpo', ESCRITURAS)
def test_el_setter_no_configura_nada(client, dir_h, setter_h, metodo, ruta, cuerpo):
    client.put(f'{URL}/eventos/e1', headers=dir_h, json={'nombre': 'Diagnóstico'})
    _con_ana_en_team(client, dir_h)
    antes = client.get(f'{URL}/estado', headers=dir_h).get_json()

    r = client.open(URL + ruta, method=metodo, json=cuerpo, headers=setter_h)

    assert r.status_code == 403
    despues = client.get(f'{URL}/estado', headers=dir_h).get_json()
    assert despues['cols'] == antes['cols'] and despues['version'] == antes['version']
    assert despues['integ'] == antes['integ']


def test_un_closer_sigue_sin_entrar(client, gente, auth_headers):
    assert client.get(f'{URL}/estado', headers=auth_headers(gente['closer'])).status_code == 403
    assert client.get(f'{URL}/version', headers=auth_headers(gente['closer'])).status_code == 403


def test_vale_el_rol_activo_de_una_cuenta_con_varios(client, db, make_user, auth_headers):
    """La direccion que tambien es setter: pasada a setter mira; como direccion, configura."""
    marlon = make_user(role='director_comercial', email='marlon@neuro.com')
    marlon.roles_extra = 'setter'
    db.session.commit()
    como_setter = auth_headers(marlon, active_role='setter')
    como_direccion = auth_headers(marlon, active_role='director_comercial')

    assert client.get(f'{URL}/estado', headers=como_setter).get_json()['solo_lectura'] is True
    assert client.put(f'{URL}/funnels/f1', headers=como_setter, json={'nombre': 'X'}).status_code == 403
    assert client.get(f'{URL}/estado', headers=como_direccion).get_json()['solo_lectura'] is False
    assert client.put(f'{URL}/funnels/f1', headers=como_direccion, json={'nombre': 'X'}).status_code == 200
