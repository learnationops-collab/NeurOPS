"""API publica de Agendas 2.0: lo que puede hacer un visitante anonimo desde el link del evento.

El servidor no confia en el navegador: revalida las respuestas contra la version PUBLICADA, elige
el closer el mismo y, antes de insertar, comprueba que siga libre. Ademas nunca expone al equipo.
Fecha fija: lunes 5 de octubre de 2026, 08:00 en La Paz (12:00 UTC).
"""

import calendar
from datetime import datetime, timedelta

import pytest
from freezegun import freeze_time

from app.agendas_v2 import api_publico, servicio
from app.agendas_v2.nucleo.eventos import config_de
from app.models import Appointment, Client, GoogleCalendarToken, Notification
from app.models.financial import FinancialAgenda
from app.services.google_service import GoogleService

LV9a12 = {str(d): [['09:00', '12:00']] for d in range(1, 6)}
URL = '/api/agendas-v2/publico'
LUNES_9 = '2026-10-05T13:00:00.000Z'  # 09:00 en La Paz


@pytest.fixture(autouse=True)
def _reloj_y_limites():
    api_publico._pedidos.clear()
    with freeze_time('2026-10-05 12:00:00'):
        yield
    api_publico._pedidos.clear()


def _publicar(evento_id):
    d = servicio.colecciones()
    e = next(x for x in d['eventos'] if x['id'] == evento_id)
    fo = next((x for x in d['formularios'] if x['id'] == e['formulario']), None)
    servicio.guardar_doc('eventos', evento_id, {'publicado': config_de(e, fo)}, parcial=True)


def _conectar_calendar(db, user):
    db.session.add(GoogleCalendarToken(user_id=user.id, token_json='{}'))
    db.session.commit()


@pytest.fixture(autouse=True)
def google(monkeypatch):
    """Google Calendar simulado: guarda cada evento que se crea o se borra."""
    llamadas = {'crear': [], 'borrar': [], 'falla': None}

    def crear(user_id, inicio, fin, titulo, descripcion, invitado_email=None):
        if llamadas['falla']:
            raise llamadas['falla']
        llamadas['crear'].append(
            {
                'user_id': user_id,
                'inicio': inicio,
                'fin': fin,
                'titulo': titulo,
                'descripcion': descripcion,
                'invitado': invitado_email,
            }
        )
        return f'evt{len(llamadas["crear"])}', 'https://meet.google.com/abc-defg-hij'

    monkeypatch.setattr(GoogleService, 'crear_evento_con_meet', staticmethod(crear))
    monkeypatch.setattr(
        GoogleService, 'delete_event', staticmethod(lambda u, e: llamadas['borrar'].append((u, e)) or True)
    )
    return llamadas


@pytest.fixture()
def cuentas(db, make_user):
    """Las cuentas reales de Ana y Beto, con su Google Calendar conectado (sin eso no son elegibles)."""
    ana = make_user(role='closer', username='ana', email='ana@equipo.com')
    beto = make_user(role='closer', username='beto', email='beto@equipo.com')
    for u in (ana, beto):
        _conectar_calendar(db, u)
    juan = make_user(role='setter', username='juan', email='juan@equipo.com')
    return {'ana': ana, 'beto': beto, 'juan': juan}


@pytest.fixture()
def armado(db, cuentas):
    g = servicio.guardar_doc
    g('roles', 'rc', {'nombre': 'Closer', 'atiende': True})
    g(
        'personas',
        'ana',
        {
            'nombre': 'Ana Paz',
            'email': 'ana@equipo.com',
            'rol': 'rc',
            'tz': 'America/La_Paz',
            'horario': LV9a12,
            'orden': 1,
        },
    )
    g(
        'personas',
        'beto',
        {
            'nombre': 'Beto Ruiz',
            'email': 'beto@equipo.com',
            'rol': 'rc',
            'tz': 'America/La_Paz',
            'horario': LV9a12,
            'orden': 2,
        },
    )
    g('personas', 'juan', {'nombre': 'Juan Setter', 'email': 'juan@equipo.com', 'rol': 'setter'})
    g('grupos', 'top', {'nombre': 'Ultra', 'estrategia': 'llenar', 'miembros': ['ana', 'beto'], 'orden': 1})
    g(
        'formularios',
        'fo',
        {
            'nombre': 'Calificación',
            'contacto': {'nombre': True, 'telefono': True, 'email': True, 'instagram': False},  # como lo crea Thalamus
            'preguntas': [
                {
                    'id': 'q1',
                    'tipo': 'opciones',
                    'titulo': '¿Cuánto?',
                    'peso': 1,
                    'opciones': [
                        {'id': 'a', 'texto': 'Mucho', 'puntos': 10},
                        {'id': 'x', 'texto': 'Nada', 'descalifica': True},
                    ],
                }
            ],
            'reglas': [],
            'resto': 'top',
        },
    )
    g('funnels', 'fu', {'nombre': 'Workshop', 'slug': 'workshop', 'origenes': [{'id': 'o1', 'setter': 'juan'}]})
    g(
        'eventos',
        'ev',
        {
            'nombre': 'Llamada',
            'slug': 'llamada',
            'funnel': 'fu',
            'formulario': 'fo',
            'duracion': 45,
            'antel': {'n': 0, 'u': 'h'},
            'paso': {'n': 60, 'u': 'min'},
        },
    )
    _publicar('ev')


def _resp(**extra):
    base = {'c-nombre': 'Lucía Fernández', 'c-telefono': '7123 4567', 'c-email': 'lucia@correo.com', 'q1': 'a'}
    base.update(extra)
    return base


def _reservar(client, inicio=LUNES_9, **extra):
    return client.post(
        URL + '/reservas',
        json={
            'evento_id': 'ev',
            'resp': _resp(**extra),
            'pais': 'BO',
            'tz': 'America/La_Paz',
            'inicio': inicio,
            'origen': 'juan-setter',
        },
    )


def test_el_link_devuelve_la_version_publicada_sin_datos_del_equipo(client, armado):
    r = client.get(URL + '/eventos/workshop/llamada')
    assert r.status_code == 200
    cuerpo = r.get_json()
    assert cuerpo['evento']['id'] == 'ev' and cuerpo['form']['preguntas'][0]['id'] == 'q1'
    assert cuerpo['funnel'] == {'nombre': 'Workshop', 'slug': 'workshop'}
    texto = r.get_data(as_text=True)
    assert 'Ana' not in texto and 'ana@equipo.com' not in texto and 'horario' not in texto


def test_lo_que_no_esta_publicado_no_existe(client, armado):
    servicio.guardar_doc('formularios', 'fo', {'nombre': 'Cambiado sin publicar'}, parcial=True)
    assert client.get(URL + '/eventos/workshop/llamada').get_json()['form']['nombre'] == 'Calificación'
    assert client.get(URL + '/eventos/otro/llamada').status_code == 404
    servicio.guardar_doc('funnels', 'fu', {'activo': False}, parcial=True)
    assert client.get(URL + '/eventos/workshop/llamada').status_code == 404


def test_evento_pausado_no_esta_disponible(client, armado):
    servicio.guardar_doc('eventos', 'ev', {'activo': False}, parcial=True)
    _publicar('ev')
    r = client.get(URL + '/eventos/workshop/llamada')
    assert r.status_code == 404 and r.get_json()['code'] == 'no_disponible'


def test_horarios_sin_closer(client, armado):
    r = client.post(URL + '/eventos/ev/horarios', json={'resp': _resp()})
    slots = r.get_json()['slots']
    assert slots[0] == calendar.timegm((2026, 10, 5, 13, 0, 0)) * 1000  # lunes 09:00 en La Paz
    assert all(isinstance(t, int) for t in slots)
    assert 'ana' not in r.get_data(as_text=True)


def test_reservar_crea_la_agenda_en_la_operacion(client, armado, cuentas, google):
    r = _reservar(client)
    assert r.status_code == 201
    cuerpo = r.get_json()['reserva']
    assert cuerpo['inicio'] == '2026-10-05T13:00:00.000Z' and cuerpo['fin'] == '2026-10-05T13:45:00.000Z'

    # La Appointment: closer elegido por el servidor ("llenar en orden": Ana), setter del ?o=, payload completo.
    appt = Appointment.query.one()
    assert str(appt.id) == cuerpo['id']
    assert appt.closer_id == cuentas['ana'].id and appt.setter_id == cuentas['juan'].id
    assert appt.start_time == datetime(2026, 10, 5, 13) and appt.origin == 'juan'
    assert appt.client.email == 'lucia@correo.com' and appt.client.phone
    p = appt.agenda_payload
    assert p['respuestas'][0]['respuesta'] == 'Mucho' and p['nota'] == 10 and p['duracion_min'] == 45
    assert p['closer_id'] == 'ana' and p['closer_user_id'] == cuentas['ana'].id and p['origen'] == 'juan-setter'

    # Su espejo en el registro de agendas, con el mismo payload.
    fa = FinancialAgenda.query.one()
    assert fa.closer == 'ana' and fa.nombre == 'juan' and fa.date == datetime(2026, 10, 5, 13)
    assert fa.mail == 'lucia@correo.com' and fa.raw_data['agendas_v2']['nota'] == 10
    # La prioridad que eligio Thalamus queda como `grupo` de la agenda y del cliente.
    assert fa.grupo == 'Ultra' and appt.client.grupo == 'Ultra'

    # El cliente guarda su formulario.
    assert appt.client.formulario_payload['respuestas'][0]['pregunta'] == '¿Cuánto?'

    # El evento en el Calendar de Ana: 45 min, con Meet, invitando al lead.
    (evt,) = google['crear']
    assert evt['user_id'] == cuentas['ana'].id and evt['invitado'] == 'lucia@correo.com'
    assert evt['fin'] - evt['inicio'] == timedelta(minutes=45)
    assert evt['titulo'] == 'Llamada: Lucía Fernández y ana' and '¿Cuánto?: Mucho' in evt['descripcion']
    assert appt.google_event_id == 'evt1' and appt.agenda_payload['meet'] == 'https://meet.google.com/abc-defg-hij'


def test_la_agenda_nueva_ocupa_lo_que_dura_el_evento(client, armado):
    assert _reservar(client).status_code == 201
    slots = _horarios(client)
    # Ana tiene 09:00-09:45; el lead nuevo sigue viendo solo a Ana ("llenar en orden"), desde las 10:00.
    assert LUNES_9_MS not in slots and LUNES_10_MS in slots


def test_si_google_falla_la_agenda_queda_y_se_avisa(client, armado, cuentas, google):
    google['falla'] = RuntimeError('token vencido')
    assert _reservar(client).status_code == 201
    appt = Appointment.query.one()
    assert appt.google_event_id is None and FinancialAgenda.query.count() == 1
    aviso = Notification.query.filter_by(subject='Agenda sin evento de Google Calendar').one()
    assert 'token vencido' in aviso.content and cuentas['ana'].id in aviso.target_users


def test_el_mismo_lead_dos_veces_no_duplica(client, armado, google):
    a, b = _reservar(client), _reservar(client)
    assert b.status_code == 201
    assert a.get_json()['reserva']['id'] == b.get_json()['reserva']['id']
    assert Appointment.query.count() == 1 and FinancialAgenda.query.count() == 1
    assert len(google['crear']) == 1


def test_si_ya_tiene_una_agenda_futura_se_reprograma(client, armado, cuentas, google):
    assert _reservar(client).status_code == 201
    r = _reservar(client, inicio='2026-10-05T14:00:00.000Z')  # el mismo lead elige otra hora
    assert r.status_code == 201
    appt = Appointment.query.one()
    assert str(appt.id) == r.get_json()['reserva']['id']
    assert appt.start_time == datetime(2026, 10, 5, 14) and appt.is_rescheduled
    assert appt.agenda_payload['reprogramada_desde'] == '2026-10-05T13:00:00Z'
    fa = FinancialAgenda.query.one()
    assert fa.date == datetime(2026, 10, 5, 14)
    # El evento viejo se borra del Calendar y se crea uno nuevo.
    assert google['borrar'] == [(cuentas['ana'].id, 'evt1')] and len(google['crear']) == 2
    assert appt.google_event_id == 'evt2'


def test_una_agenda_de_n8n_futura_tambien_se_reprograma(client, armado, cuentas, db):
    lucia = Client(full_name='Lucía Fernández', email='lucia@correo.com')
    db.session.add(lucia)
    db.session.commit()
    db.session.add(Appointment(closer_id=cuentas['beto'].id, client_id=lucia.id, start_time=datetime(2026, 10, 6, 15)))
    db.session.commit()
    assert _reservar(client).status_code == 201
    appt = Appointment.query.one()
    assert appt.start_time == datetime(2026, 10, 5, 13) and appt.closer_id == cuentas['ana'].id


def test_un_horario_tomado_da_409(client, armado):
    assert _reservar(client).status_code == 201
    r = _reservar(client, **{'c-email': 'otro@correo.com', 'c-telefono': '7999 9999', 'c-nombre': 'Otra Persona'})
    # Ana ya tiene las 09:00 y con "llenar en orden" el lead solo ve la agenda de Ana.
    assert r.status_code == 409 and r.get_json()['code'] == 'ocupado'


def test_un_horario_inventado_da_409(client, armado):
    assert _reservar(client, inicio='2026-10-05T03:00:00.000Z').status_code == 409


def test_dos_leads_a_la_vez_el_bloqueo_frena_al_segundo(client, armado, monkeypatch):
    """Simula la carrera: el segundo calcula su asignacion antes de que exista la primera reserva."""
    assert _reservar(client).status_code == 201
    monkeypatch.setattr(
        servicio,
        '_ocupacion',
        lambda ahora, elegibles=None: {'ahora': ahora, 'ocupado': lambda *a: False, 'carga_de': lambda pid: 0},
    )
    r = _reservar(client, **{'c-email': 'otro@correo.com', 'c-telefono': '7999 9999', 'c-nombre': 'Otra Persona'})
    assert r.status_code == 409
    assert Appointment.query.count() == 1


def test_respuestas_invalidas_dan_400(client, armado):
    r = _reservar(client, **{'c-email': 'no-es-correo'})
    assert r.status_code == 400 and 'c-email' in r.get_json()['errores']
    r = _reservar(client, q1='opcion-que-no-existe')
    assert r.status_code == 400 and 'q1' in r.get_json()['errores']
    assert Appointment.query.count() == 0 and Client.query.count() == 0


def test_el_descalificado_queda_como_cliente_sin_agenda(client, armado, google):
    r = _reservar(client, inicio=None, q1='x')
    assert r.status_code == 201 and r.get_json() == {'descalificada': True}
    cliente = Client.query.one()
    assert cliente.email == 'lucia@correo.com'
    assert cliente.formulario_payload['descalificada'] is True and cliente.formulario_payload['inicio'] is None
    assert Appointment.query.count() == 0 and FinancialAgenda.query.count() == 0 and google['crear'] == []


def test_un_descalificado_no_puede_forzar_un_horario(client, armado):
    _reservar(client, q1='x')
    assert Appointment.query.count() == 0 and Client.query.one().formulario_payload['descalificada'] is True


def test_si_el_cliente_ya_existe_se_reusa(client, armado, db):
    db.session.add(Client(full_name='Lucía F.', email='lucia@correo.com'))
    db.session.commit()
    assert _reservar(client).status_code == 201
    assert Client.query.count() == 1 and Appointment.query.one().client.formulario_payload['nota'] == 10


def test_limite_por_ip(client, armado):
    for _ in range(10):
        _reservar(client, inicio=None, q1='x')
    r = _reservar(client, inicio=None, q1='x')
    assert r.status_code == 429 and r.get_json()['code'] == 'demasiados'


# --- Etapa 1: disponibilidad real -----------------------------------------------------------------


def _agenda_de_operacion(db, user, inicio, **campos):
    cliente = Client(full_name='Cliente viejo', email=f'viejo{Client.query.count()}@x.com')
    db.session.add(cliente)
    db.session.commit()
    db.session.add(Appointment(closer_id=user.id, client_id=cliente.id, start_time=inicio, **campos))
    db.session.commit()


def _horarios(client):
    return client.post(URL + '/eventos/ev/horarios', json={'resp': _resp()}).get_json()['slots']


LUNES_9_MS = calendar.timegm((2026, 10, 5, 13, 0, 0)) * 1000
LUNES_10_MS = calendar.timegm((2026, 10, 5, 14, 0, 0)) * 1000


def test_una_agenda_de_la_operacion_ocupa_60_minutos(client, armado, cuentas, db):
    # Ana tiene una agenda de Calendly el lunes a las 09:00 (La Paz): con "llenar en orden" el lead
    # sigue viendo solo a Ana, pero sin las 09:00. Las 10:00 siguen libres (60 min, no mas).
    _agenda_de_operacion(db, cuentas['ana'], datetime(2026, 10, 5, 13))
    slots = _horarios(client)
    assert LUNES_9_MS not in slots and LUNES_10_MS in slots
    r = _reservar(client)
    assert r.status_code == 409 and r.get_json()['code'] == 'ocupado'


def test_las_agendas_canceladas_o_procesadas_no_ocupan(client, armado, cuentas, db):
    _agenda_de_operacion(db, cuentas['ana'], datetime(2026, 10, 5, 13), result='Cancelada')
    _agenda_de_operacion(db, cuentas['ana'], datetime(2026, 10, 5, 13), result='Reprogramada')
    _agenda_de_operacion(db, cuentas['ana'], datetime(2026, 10, 5, 13), closer_processed=True)
    assert LUNES_9_MS in _horarios(client)
    assert _reservar(client).status_code == 201


def test_sin_calendar_conectado_un_closer_no_recibe_agendas(client, armado, cuentas, db):
    GoogleCalendarToken.query.filter_by(user_id=cuentas['ana'].id).delete()
    db.session.commit()
    r = _reservar(client)
    assert r.status_code == 201
    assert Appointment.query.one().closer_id == cuentas['beto'].id  # Ana se saltea; Beto, de la misma prioridad


def test_una_persona_sin_usuario_real_no_recibe_agendas(client, armado, cuentas, db):
    cuentas['ana'].is_active = False
    cuentas['beto'].is_active = False
    db.session.commit()
    assert _horarios(client) == []
    assert _reservar(client).status_code == 409


def test_si_ninguno_tiene_calendar_no_hay_horarios(client, armado, db):
    GoogleCalendarToken.query.delete()
    db.session.commit()
    assert _horarios(client) == []


# --- Discord ----------------------------------------------------------------------------------------


@pytest.fixture()
def discord(monkeypatch):
    enviados = []

    class Respuesta:
        status_code = 204

    def post(url, json=None, timeout=None):
        enviados.append({'url': url, 'json': json})
        return Respuesta()

    monkeypatch.setenv('DISCORD_AGENDAS_WEBHOOK', 'https://discord.test/webhook')
    monkeypatch.setattr('app.agendas_v2.operacion.requests.post', post)
    return enviados


def test_cada_agenda_avisa_a_discord(client, armado, discord):
    assert _reservar(client).status_code == 201
    (msg,) = discord
    assert msg['url'] == 'https://discord.test/webhook'
    embed = msg['json']['embeds'][0]
    assert embed['title'] == '📅 Nueva agenda: Llamada'
    campos = {c['name']: c['value'] for c in embed['fields']}
    assert campos['Lead'] == 'Lucía Fernández' and campos['Closer'] == 'ana'
    assert campos['Horario (Bolivia)'] == '05/10/2026 09:00' and campos['Setter / origen'] == 'juan'
    assert campos['Prioridad'] == 'Ultra' and '¿Cuánto?**: Mucho' in campos['Formulario']
    assert campos['Meet'] == 'https://meet.google.com/abc-defg-hij'


def test_la_reprogramacion_avisa_distinto_y_el_descalificado_no_avisa(client, armado, discord):
    _reservar(client, inicio=None, q1='x', **{'c-email': 'otra@correo.com'})
    assert discord == []
    _reservar(client)
    _reservar(client, inicio='2026-10-05T14:00:00.000Z')
    titulos = [m['json']['embeds'][0]['title'] for m in discord]
    assert titulos == ['📅 Nueva agenda: Llamada', '🔁 Agenda reprogramada: Llamada']


def test_si_discord_falla_la_agenda_queda(client, armado, monkeypatch):
    def roto(*a, **k):
        raise ConnectionError('discord caido')

    monkeypatch.setenv('DISCORD_AGENDAS_WEBHOOK', 'https://discord.test/webhook')
    monkeypatch.setattr('app.agendas_v2.operacion.requests.post', roto)
    assert _reservar(client).status_code == 201
    assert Appointment.query.count() == 1
