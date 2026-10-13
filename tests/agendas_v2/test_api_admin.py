"""API de gestion de Agendas 2.0 (/api/agendas-v2): quien entra y que se guarda.

Thalamus es la herramienta del director comercial: un closer no tiene nada que hacer aca (el setter
entra a mirar: test_api_lectura_setter.py), y todo documento que entra se normaliza con el mismo
esquema que el frontend (lo que no cumple se corrige, nunca se guarda tal cual).
"""

import pytest

from app.agendas_v2 import servicio
from app.agendas_v2.modelos import SchedPersona


@pytest.fixture()
def gente(make_user):
    return {
        'director': make_user(role='director_comercial', email='dir@neuro.com'),
        'admin': make_user(role='admin', email='admin@neuro.com'),
        'closer': make_user(role='closer', email='ana@neuro.com'),
        'setter': make_user(role='setter'),
    }


@pytest.fixture()
def dir_h(gente, auth_headers):
    return auth_headers(gente['director'])


def test_sin_sesion_responde_401(client):
    assert client.get('/api/agendas-v2/estado').status_code == 401


def test_el_closer_no_entra(client, gente, auth_headers):
    assert client.get('/api/agendas-v2/estado', headers=auth_headers(gente['closer'])).status_code == 403
    assert (
        client.put('/api/agendas-v2/funnels/f1', json={'nombre': 'X'}, headers=auth_headers(gente['closer'])).status_code
        == 403
    )


@pytest.mark.parametrize('rol', ['director', 'admin'])
def test_la_direccion_y_admin_leen_el_estado(client, gente, auth_headers, rol):
    r = client.get('/api/agendas-v2/estado', headers=auth_headers(gente[rol]))
    assert r.status_code == 200
    cuerpo = r.get_json()
    assert set(cuerpo['cols']) == {'funnels', 'formularios', 'personas', 'grupos', 'eventos', 'roles', 'gracias'}
    assert cuerpo['reservas'] == [] and cuerpo['version'] == 0
    assert cuerpo['integ']['gcal']['activo'] is False
    assert cuerpo['solo_lectura'] is False


def test_put_normaliza_el_documento(client, dir_h):
    r = client.put(
        '/api/agendas-v2/formularios/fo1',
        headers=dir_h,
        json={
            'nombre': 'Calificación',
            'basura': 'no va',
            'preguntas': [
                {
                    'id': 'q1',
                    'tipo': 'opciones',
                    'titulo': 'x' * 400,
                    'peso': 99,
                    'opciones': [{'id': 'a', 'texto': 'A', 'puntos': 50}],
                }
            ],
        },
    )
    assert r.status_code == 200
    doc = r.get_json()['doc']
    assert doc['id'] == 'fo1' and 'basura' not in doc
    q = doc['preguntas'][0]
    assert len(q['titulo']) == 300 and q['peso'] == 5 and q['opciones'][0]['puntos'] == 10
    assert doc['fin']['titulo']  # los campos que faltan toman su valor por defecto


def test_patch_mezcla_campos_y_404_si_no_existe(client, dir_h):
    client.put('/api/agendas-v2/funnels/f1', headers=dir_h, json={'nombre': 'Workshop', 'color': 'rosa'})
    r = client.patch('/api/agendas-v2/funnels/f1', headers=dir_h, json={'activo': False})
    assert r.get_json()['doc']['color'] == 'rosa' and r.get_json()['doc']['activo'] is False
    assert client.patch('/api/agendas-v2/funnels/nada', headers=dir_h, json={'activo': False}).status_code == 404


def test_coleccion_o_id_invalidos_dan_404(client, dir_h):
    assert client.put('/api/agendas-v2/usuarios/u1', headers=dir_h, json={}).status_code == 404
    assert client.put('/api/agendas-v2/funnels/ñ!', headers=dir_h, json={}).status_code == 404


def test_cada_escritura_sube_la_version(client, dir_h):
    v0 = client.get('/api/agendas-v2/version', headers=dir_h).get_json()['version']
    v1 = client.put('/api/agendas-v2/roles/r1', headers=dir_h, json={'nombre': 'Closer', 'atiende': True}).get_json()[
        'version'
    ]
    v2 = client.delete('/api/agendas-v2/roles/r1', headers=dir_h).get_json()['version']
    assert v0 < v1 < v2
    assert client.get('/api/agendas-v2/estado', headers=dir_h).get_json()['cols']['roles'] == []


def test_una_persona_se_une_a_su_cuenta_por_email(client, dir_h, gente):
    client.put('/api/agendas-v2/personas/p1', headers=dir_h, json={'nombre': 'Ana', 'email': 'ANA@neuro.com'})
    fila = SchedPersona.query.get('p1')
    assert fila.email == 'ana@neuro.com' and fila.user_id == gente['closer'].id


def test_el_perfil_es_de_cada_usuario(client, gente, auth_headers):
    client.put('/api/agendas-v2/perfil', headers=auth_headers(gente['director']), json={'nombre': 'Mario'})
    assert (
        client.get('/api/agendas-v2/estado', headers=auth_headers(gente['director'])).get_json()['perfil']['nombre']
        == 'Mario'
    )
    assert (
        client.get('/api/agendas-v2/estado', headers=auth_headers(gente['admin'])).get_json()['perfil']['nombre'] == ''
    )


def test_integraciones_solo_guardan_ids_numericos(client, dir_h):
    r = client.put(
        '/api/agendas-v2/integraciones', headers=dir_h, json={'pixel': {'activo': True, 'id': '12ab34<script>'}}
    )
    assert r.get_json()['integ']['pixel'] == {
        'activo': True,
        'id': '1234',
        'lead': True,
        'schedule': True,
        'nocalifica': False,
    }


def test_cancelar_desde_thalamus_ya_no_existe(client, db, dir_h):
    # Las cancelaciones y reprogramaciones las hace el closer en NeurOPS, sobre la Appointment.
    assert client.post('/api/agendas-v2/reservas/1/cancelar', headers=dir_h).status_code in (404, 405)


def test_el_servicio_no_toca_la_operacion(client, db, dir_h):
    """Paso 2 del plan: nada de Agendas 2.0 escribe en las tablas de la operacion."""
    from app.models import Appointment, FinancialAgenda

    client.put('/api/agendas-v2/funnels/f1', headers=dir_h, json={'nombre': 'W'})
    servicio.guardar_integraciones({})
    assert Appointment.query.count() == 0 and FinancialAgenda.query.count() == 0


def test_usuarios_lista_los_closers_activos_y_aparte_los_setters(client, gente, dir_h, make_user):
    make_user(role='closer', email='baja@neuro.com', is_active=False)
    r = client.get('/api/agendas-v2/usuarios', headers=dir_h)
    assert r.status_code == 200
    usuarios = r.get_json()['usuarios']
    # Team es de quienes atienden: los setters tienen su link en los funnels de setting, no van en Team.
    assert {u['rol'] for u in usuarios} == {'closer'}
    setters = client.get('/api/agendas-v2/usuarios?rol=setter', headers=dir_h).get_json()['usuarios']
    assert setters and {u['rol'] for u in setters} == {'setter'}
    assert 'baja@neuro.com' not in {u['email'] for u in usuarios}
    assert {'id', 'nombre', 'email', 'rol', 'tz', 'calendar'} <= set(usuarios[0])
    assert not any(u['calendar'] for u in usuarios)


def test_usuarios_dice_quien_conecto_su_calendar(client, gente, dir_h, db):
    from app.models import GoogleCalendarToken

    db.session.add(GoogleCalendarToken(user_id=gente['closer'].id, token_json='{}'))
    db.session.commit()
    usuarios = client.get('/api/agendas-v2/usuarios', headers=dir_h).get_json()['usuarios']
    assert {u['email']: u['calendar'] for u in usuarios}['ana@neuro.com'] is True


def test_usuarios_pide_sesion_y_no_es_para_el_closer(client, gente, auth_headers):
    assert client.get('/api/agendas-v2/usuarios').status_code == 401
    assert client.get('/api/agendas-v2/usuarios', headers=auth_headers(gente['closer'])).status_code == 403


def test_usuarios_con_varios_roles_cuentan_como_closer(client, dir_h, make_user, db):
    u = make_user(role='setter', email='dos@neuro.com')
    u.roles_extra = 'closer'
    db.session.commit()
    usuarios = client.get('/api/agendas-v2/usuarios', headers=dir_h).get_json()['usuarios']
    assert {x['email']: x['rol'] for x in usuarios}['dos@neuro.com'] == 'closer'


def test_editar_el_formulario_pone_al_dia_los_links_publicados(client, dir_h):
    """El link en vivo muestra las preguntas nuevas sin volver a publicar, pero lo que se cambió del
    evento y no se publicó sigue sin publicarse."""
    import json

    from app.agendas_v2.nucleo.eventos import config_de

    pregunta = {'id': 'q1', 'tipo': 'opciones', 'titulo': 'Vieja', 'opciones': [{'id': 'a', 'texto': 'A'}]}
    url = '/api/agendas-v2/'
    form = client.put(url + 'formularios/fo1', headers=dir_h, json={'nombre': 'F', 'preguntas': [pregunta]})
    ev = client.put(url + 'eventos/e1', headers=dir_h, json={'nombre': 'Diagnóstico', 'formulario': 'fo1'})
    publicado = config_de(ev.get_json()['doc'], form.get_json()['doc'])
    client.patch(url + 'eventos/e1', headers=dir_h, json={'publicado': publicado})
    client.patch(url + 'eventos/e1', headers=dir_h, json={'nombre': 'Borrador sin publicar'})

    client.patch(url + 'formularios/fo1', headers=dir_h, json={'preguntas': [{**pregunta, 'titulo': 'Nueva'}]})

    eventos = client.get(url + 'estado', headers=dir_h).get_json()['cols']['eventos']
    e = next(x for x in eventos if x['id'] == 'e1')
    pub = json.loads(e['publicado'])
    assert pub['form']['preguntas'][0]['titulo'] == 'Nueva'
    assert pub['ev']['nombre'] == 'Diagnóstico'


# --- Ocupacion en Google para Available -----------------------------------------------------------


@pytest.fixture()
def google_semana(monkeypatch):
    """Lo que responde Google por usuario: lista de eventos (inicio, fin, titulo), o None si falla."""
    from app.services.google_service import GoogleService

    respuestas = {}
    servicio._google_semana_cache.clear()
    def eventos(u, desde, hasta):
        r = respuestas.get(u, [])
        return None if r is None else [{'inicio': a, 'fin': b, 'titulo': t} for a, b, t in r]

    monkeypatch.setattr(GoogleService, 'eventos_ocupados', staticmethod(eventos))
    # Lo que se lee para seguir cada agenda: respuestas['traza'][user_id] = [evento como _traza_de].
    servicio._traza_cache.clear()
    traza = staticmethod(lambda u, desde, hasta: respuestas.get('traza', {}).get(u, []))
    monkeypatch.setattr(GoogleService, 'eventos_para_traza', traza)
    monkeypatch.setattr(GoogleService, 'evento_para_traza', staticmethod(lambda u, cal, ev: 'borrado'))
    return respuestas


def _ocupacion(client, dir_h, desde=0, hasta=7 * 86400000):
    return client.get(f'/api/agendas-v2/ocupacion?desde={desde}&hasta={hasta}', headers=dir_h)


def test_ocupacion_une_lo_que_se_pisa_entre_calendarios(client, db, dir_h, gente, google_semana):
    from app.models import GoogleCalendarToken

    db.session.add(GoogleCalendarToken(user_id=gente['closer'].id, token_json='{}'))
    db.session.commit()
    client.put('/api/agendas-v2/personas/p1', headers=dir_h, json={'nombre': 'Ana', 'email': 'ana@neuro.com'})
    google_semana[gente['closer'].id] = [(100, 200, 'Daily'), (150, 300, 'Médico'), (300, 350, None), (500, 600, 'Gym')]
    r = _ocupacion(client, dir_h)
    assert r.status_code == 200
    ana = r.get_json()['ocupacion']['p1']
    assert ana['estado'] == 'ok' and ana['franjas'] == [[100, 350], [500, 600]]
    # Cada evento viaja con su título (None si es privado) para mostrarlo en el visor.
    assert [e['titulo'] for e in ana['eventos']] == ['Daily', 'Médico', None, 'Gym']


def test_ocupacion_distingue_error_sin_google_y_sin_usuario(client, db, dir_h, gente, google_semana, make_user):
    from app.models import GoogleCalendarToken

    db.session.add(GoogleCalendarToken(user_id=gente['closer'].id, token_json='{}'))
    make_user(role='closer', email='beto@neuro.com')
    db.session.commit()
    client.put('/api/agendas-v2/personas/p1', headers=dir_h, json={'nombre': 'Ana', 'email': 'ana@neuro.com'})
    client.put('/api/agendas-v2/personas/p2', headers=dir_h, json={'nombre': 'Beto', 'email': 'beto@neuro.com'})
    client.put('/api/agendas-v2/personas/p3', headers=dir_h, json={'nombre': 'Caro', 'email': 'caro@otro.com'})
    google_semana[gente['closer'].id] = None
    oc = _ocupacion(client, dir_h).get_json()['ocupacion']
    assert {k: v['estado'] for k, v in oc.items()} == {'p1': 'error', 'p2': 'sin_google', 'p3': 'sin_usuario'}


def test_ocupacion_trae_las_agendas_de_n8n_y_detecta_las_canceladas(client, db, dir_h, gente, google_semana):
    from datetime import datetime

    from app.models import Appointment, Client, GoogleCalendarToken

    db.session.add(GoogleCalendarToken(user_id=gente['closer'].id, token_json='{}'))
    cli = Client(full_name='Lucía', email='lucia@x.com')
    db.session.add(cli)
    db.session.flush()
    hora = lambda h: datetime(1970, 1, 2, h)  # noqa: E731
    for h, res in ((10, 'Confirmado'), (12, 'Pendiente'), (14, 'Cancelado')):
        db.session.add(Appointment(client_id=cli.id, closer_id=gente['closer'].id, start_time=hora(h), result=res))
    db.session.commit()
    client.put('/api/agendas-v2/personas/p1', headers=dir_h, json={'nombre': 'Ana', 'email': 'ana@neuro.com'})
    ms = lambda h: int((86400 + h * 3600) * 1000)  # noqa: E731
    # La de las 10 sigue en su Google (dura lo que su evento); la de las 12 ya no está.
    google_semana[gente['closer'].id] = [(ms(10), ms(10) + 45 * 60000, 'Lucía')]
    ana = _ocupacion(client, dir_h).get_json()['ocupacion']['p1']
    assert [a['estado'] for a in ana['agendas']] == ['vigente', 'sin_evento', 'cancelada']
    assert {a['nombre'] for a in ana['agendas']} == {'Lucía'}
    assert ana['agendas'][0]['fin'] - ana['agendas'][0]['inicio'] == 45 * 60000
    # Sin poder leer su Google no se sabe: la que no está marcada cancelada queda vigente.
    servicio._google_semana_cache.clear()
    google_semana[gente['closer'].id] = None
    ana = _ocupacion(client, dir_h).get_json()['ocupacion']['p1']
    assert [a['estado'] for a in ana['agendas']] == ['vigente', 'vigente', 'cancelada']


def _ev(id_, inicio, invitados=(), estado='confirmed', titulo='', disponible=False, cal='ventas'):
    return {
        'id': id_, 'calendario': cal, 'estado': estado, 'inicio': inicio, 'fin': inicio + 3600000,
        'disponible': disponible,
        'titulo': titulo, 'invitados': [{'email': e, 'respuesta': r, 'propio': False} for e, r in invitados],
    }


def test_cada_agenda_se_vincula_a_su_evento_y_se_sabe_que_paso(client, db, dir_h, gente, google_semana):
    from datetime import datetime

    from app.models import Appointment, Client, GoogleCalendarToken

    db.session.add(GoogleCalendarToken(user_id=gente['closer'].id, token_json='{}'))
    lu = Client(full_name='Lucía Pérez', email='lucia@x.com')
    mo = Client(full_name='Mónica Díaz', email='mo@x.com')
    db.session.add_all([lu, mo])
    db.session.flush()
    hora = lambda h: datetime(1970, 1, 2, h)  # noqa: E731
    ms = lambda h: int((86400 + h * 3600) * 1000)  # noqa: E731
    citas = [Appointment(client_id=c.id, closer_id=gente['closer'].id, start_time=hora(h), result='Confirmado')
             for c, h in ((lu, 9), (mo, 11), (lu, 13), (mo, 15), (lu, 17), (mo, 19))]
    db.session.add_all(citas)
    db.session.commit()
    client.put('/api/agendas-v2/personas/p1', headers=dir_h, json={'nombre': 'Ana', 'email': 'ana@neuro.com'})
    google_semana[gente['closer'].id] = [(ms(9), ms(10), 'Lucía')]
    google_semana['traza'] = {gente['closer'].id: [
        _ev('a', ms(9), [('lucia@x.com', 'accepted')]),                     # la de las 9, por el email
        _ev('b', ms(11), titulo='Llamada con Mónica'),                     # la de las 11, por el nombre
        _ev('c', ms(13), [('lucia@x.com', 'needsAction')], estado='cancelled'),
        _ev('d', ms(15), [('mo@x.com', 'declined')]),
        _ev('e', ms(17), [('lucia@x.com', 'accepted')], disponible=True),
        _ev('x', ms(19), titulo='Otra cosa'),                              # la de las 19 no se vincula
    ]}
    tr = _ocupacion(client, dir_h).get_json()['ocupacion']['p1']['trazas']
    estados = [(tr[str(a.id)]['estado'], tr[str(a.id)]['vinculo']) for a in citas]
    assert estados == [('ok', 'email'), ('ok', 'nombre'), ('cancelado', 'email'), ('rechazado', 'email'),
                       ('disponible', 'email'), ('sin_vincular', None)]
    db.session.expire_all()
    assert db.session.get(Appointment, citas[0].id).calendar_evento_id == 'a'
    assert db.session.get(Appointment, citas[0].id).google_event_id is None  # el de NeurOPS no se toca
    # El evento de las 9 se movió a las 10 y el de las 11 ya no está: se sabe por el vínculo guardado.
    servicio._traza_cache.clear()
    google_semana['traza'] = {gente['closer'].id: [_ev('a', ms(10), [('lucia@x.com', 'accepted')])]}
    tr = _ocupacion(client, dir_h).get_json()['ocupacion']['p1']['trazas']
    assert tr[str(citas[0].id)] == {'estado': 'movido', 'vinculo': 'email', 'inicio_nuevo': ms(10)}
    assert tr[str(citas[1].id)]['estado'] == 'borrado'


def test_ocupacion_exige_un_rango_valido_y_no_es_para_el_closer(client, gente, dir_h, auth_headers, google_semana):
    assert _ocupacion(client, dir_h, 10, 10).status_code == 400
    assert _ocupacion(client, dir_h, 0, 11 * 86400000).status_code == 400
    assert client.get('/api/agendas-v2/ocupacion', headers=dir_h).status_code == 400
    assert _ocupacion(client, auth_headers(gente['closer'])).status_code == 403


def test_el_estado_dice_en_que_zona_mira_cada_uno(client, db, gente, dir_h):
    # Sin WhatsApp ni zona elegida: decide el navegador.
    assert client.get('/api/agendas-v2/estado', headers=dir_h).get_json()['zona'] is None
    # Con WhatsApp de Argentina, la semana del equipo se ve en hora de Buenos Aires.
    gente['director'].two_chat_number = '5491122334455'
    db.session.commit()
    assert client.get('/api/agendas-v2/estado', headers=dir_h).get_json()['zona'] == 'America/Argentina/Buenos_Aires'

