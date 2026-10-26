"""Las agendas que crea el equipo desde NeurOPS siguen el camino de Thalamus (app/agendas_v2/manual.py).

La hora es libre (decisión del 17/10/2026): solo frena un choque con otra agenda vigente del closer o con
su Google Calendar. Fecha fija: lunes 19 de octubre de 2026, 12:00 UTC.
"""

from datetime import datetime

import pytest
from freezegun import freeze_time

from app.agendas_v2 import servicio
from app.models import Appointment, Client, GoogleCalendarToken
from app.services.closer_service import CloserService
from app.services.google_service import GoogleService

URL = '/api/closer/appointments'
MARTES_15 = datetime(2026, 10, 20, 15, 0)
MS = lambda dt: servicio.dt_a_ms(dt)  # noqa: E731


@pytest.fixture(autouse=True)
def _reloj():
    with freeze_time('2026-10-19 12:00:00'):
        yield


@pytest.fixture(autouse=True)
def whatsapp(monkeypatch):
    from app.services.whatchimp_service import AvisoDeAgenda

    enviados = []
    monkeypatch.setattr(AvisoDeAgenda, 'enviar', staticmethod(lambda numero, **datos: enviados.append({'numero': numero, **datos})))
    return enviados


@pytest.fixture(autouse=True)
def google(monkeypatch):
    llamadas = {'crear': [], 'borrar': [], 'ocupado': {}}
    servicio._google_cache.clear()

    def crear(user_id, inicio, fin, titulo, descripcion, invitado_email=None):
        llamadas['crear'].append({'user_id': user_id, 'inicio': inicio, 'fin': fin, 'titulo': titulo, 'invitado': invitado_email})
        return f'evt{len(llamadas["crear"])}', 'https://meet.google.com/abc-defg-hij'

    monkeypatch.setattr(GoogleService, 'crear_evento_con_meet', staticmethod(crear))
    monkeypatch.setattr(GoogleService, 'delete_event', staticmethod(lambda u, e: llamadas['borrar'].append((u, e)) or True))
    monkeypatch.setattr(GoogleService, 'evento_cancelado', staticmethod(lambda u, e: False))
    monkeypatch.setattr(GoogleService, 'franjas_ocupadas', staticmethod(lambda u, desde, hasta: llamadas['ocupado'].get(u, [])))
    monkeypatch.setattr(GoogleService, '_calendario', staticmethod(lambda u: 'primary'))
    return llamadas


@pytest.fixture()
def ana(db, make_user):
    u = make_user(role='closer', username='ana', email='ana@equipo.com')
    db.session.add(GoogleCalendarToken(user_id=u.id, token_json='{}'))
    u.two_chat_number = '59170000001'
    db.session.commit()
    return u


def _nueva(client, auth_headers, closer, cuando=MARTES_15, **extra):
    cuerpo = {
        'start_time': cuando.isoformat() + 'Z', 'origin': 'Referido',
        'client_data': {'name': 'Carla Mendoza', 'email': 'carla@mail.com', 'phone': '+59171234567', 'instagram': 'carla'},
        **extra,
    }
    return client.post(URL, json=cuerpo, headers=auth_headers(closer))


def test_la_nueva_agenda_del_closer_sigue_el_camino_de_thalamus(client, db, ana, auth_headers, google, whatsapp):
    r = _nueva(client, auth_headers, ana)

    assert r.status_code == 201, r.get_json()
    appt = db.session.get(Appointment, r.get_json()['id'])
    assert appt.origin == 'Referido'
    assert appt.agenda_payload['manual'] == {'por': ana.id, 'via': 'nueva_agenda'}
    assert appt.agenda_payload['lead']['email'] == 'carla@mail.com'
    # Meet con invitación al lead, como una reserva del link.
    assert google['crear'][0]['invitado'] == 'carla@mail.com'
    assert appt.google_event_id == 'evt1'
    assert appt.agenda_payload['meet'].startswith('https://meet.google.com/')
    assert whatsapp and whatsapp[0]['lead'] == 'Carla Mendoza'
    assert r.get_json()['con_evento'] is True


def test_no_pisa_el_formulario_del_cliente(client, db, ana, auth_headers):
    cliente = Client(full_name='Carla Mendoza', email='carla@mail.com', formulario_payload={'version': 1, 'respuestas': []})
    db.session.add(cliente)
    db.session.commit()

    _nueva(client, auth_headers, ana)

    assert db.session.get(Client, cliente.id).formulario_payload == {'version': 1, 'respuestas': []}


def test_choca_con_otra_agenda_que_se_cruza_aunque_no_empiece_a_la_misma_hora(client, db, ana, auth_headers, google):
    _nueva(client, auth_headers, ana)
    google['ocupado'][ana.id] = [(MS(MARTES_15), MS(MARTES_15) + 60 * 60000)]  # el evento que se le creó
    otra = {'start_time': '2026-10-20T15:30:00Z', 'client_data': {'name': 'Otro', 'email': 'otro@mail.com'}}

    r = client.post(URL, json=otra, headers=auth_headers(ana))

    assert r.status_code == 409
    assert r.get_json()['codigo'] == 'ocupado'


def test_choca_con_su_google_calendar(client, ana, auth_headers, google):
    google['ocupado'][ana.id] = [(MS(MARTES_15) - 30 * 60000, MS(MARTES_15) + 30 * 60000)]

    r = _nueva(client, auth_headers, ana)

    assert r.status_code == 409
    assert r.get_json()['codigo'] == 'ocupado'
    assert not google['crear']


def test_la_hora_es_libre_fuera_de_la_disponibilidad(client, ana, auth_headers):
    r = _nueva(client, auth_headers, ana, cuando=datetime(2026, 10, 25, 3, 0))  # domingo de madrugada

    assert r.status_code == 201


def test_si_el_lead_ya_tiene_una_agenda_se_pregunta_antes_de_tocar_nada(client, db, ana, auth_headers):
    _nueva(client, auth_headers, ana)

    r = _nueva(client, auth_headers, ana, cuando=datetime(2026, 10, 22, 15, 0))

    assert r.status_code == 409
    assert r.get_json()['codigo'] == 'ya_tiene'
    assert Appointment.query.count() == 1


def test_reprogramar_media_hora_despues_no_choca_consigo_misma(client, db, ana, auth_headers, google):
    _nueva(client, auth_headers, ana)
    google['ocupado'][ana.id] = [(MS(MARTES_15), MS(MARTES_15) + 60 * 60000)]  # su propio evento

    r = _nueva(client, auth_headers, ana, cuando=datetime(2026, 10, 20, 15, 30), si_ya_tiene='reprogramar')

    assert r.status_code == 201, r.get_json()


def test_una_adicional_deja_las_dos(client, ana, auth_headers):
    _nueva(client, auth_headers, ana)

    r = _nueva(client, auth_headers, ana, cuando=datetime(2026, 10, 22, 15, 0), si_ya_tiene='adicional')

    assert r.status_code == 201
    assert Appointment.query.count() == 2


def test_una_llamada_a_mano_no_cuenta_como_conversion_en_stats(client, ana, auth_headers):
    _nueva(client, auth_headers, ana)

    assert servicio.estadisticas(ahora=MS(datetime(2026, 10, 19, 12, 0))) == []


def test_reagendar_desde_el_mazo_conserva_el_payload_de_thalamus_y_crea_el_meet(client, db, ana, google):
    cliente = Client(full_name='Carla', email='carla@mail.com')
    db.session.add(cliente)
    db.session.flush()
    appt = Appointment(client_id=cliente.id, closer_id=ana.id, start_time=MARTES_15, origin='workshop',
                       agenda_payload={'version': 1, 'evento_id': 'ev1', 'evento_nombre': 'Sesión', 'duracion_min': 45,
                                       'respuestas': [], 'lead': {'nombre': 'Carla', 'email': 'carla@mail.com'}})
    db.session.add(appt)
    db.session.commit()

    CloserService.process_agenda(ana.id, appt.id, {'status': 'Reagendado', 'reschedule_date': '2026-10-22T15:00:00'})

    nueva = Appointment.query.filter(Appointment.id != appt.id).one()
    assert nueva.agenda_payload['evento_id'] == 'ev1'
    assert nueva.agenda_payload['reprogramada_desde'] == '2026-10-20T15:00:00Z'
    assert google['crear'][-1]['invitado'] == 'carla@mail.com'
    assert google['crear'][-1]['fin'] == datetime(2026, 10, 22, 15, 45)
    assert nueva.google_event_id


def test_reagendar_a_un_horario_ocupado_no_mueve_nada(client, db, ana, google):
    cliente = Client(full_name='Carla', email='carla@mail.com')
    db.session.add(cliente)
    db.session.flush()
    appt = Appointment(client_id=cliente.id, closer_id=ana.id, start_time=MARTES_15, origin='workshop')
    db.session.add(appt)
    db.session.commit()
    nuevo = datetime(2026, 10, 22, 15, 0)
    google['ocupado'][ana.id] = [(MS(nuevo), MS(nuevo) + 60 * 60000)]

    with pytest.raises(Exception, match='esa hora'):
        CloserService.process_agenda(ana.id, appt.id, {'status': 'Reagendado', 'reschedule_date': nuevo.isoformat()})

    db.session.rollback()
    assert Appointment.query.count() == 1
    assert db.session.get(Appointment, appt.id).closer_processed is False


def test_la_2da_llamada_conserva_su_tracking_y_suma_el_meet(client, db, ana, google):
    from app.models.financial import FinancialAgenda

    cliente = Client(full_name='Carla', email='carla@mail.com', instagram='carla')
    db.session.add(cliente)
    db.session.flush()
    appt = Appointment(client_id=cliente.id, closer_id=ana.id, start_time=MARTES_15, origin='workshop')
    db.session.add(appt)
    db.session.commit()

    CloserService.process_agenda(ana.id, appt.id, {'status': '2da call', 'reschedule_date': '2026-10-27T15:00:00',
                                                    'note': 'quiere hablarlo con la pareja'})

    nueva = Appointment.query.filter(Appointment.id != appt.id).one()
    assert (appt.closer_result, appt.closer_processed) == ('2da call', True)
    assert (nueva.result, nueva.closer_result) == ('2TH Call', 'Pendiente')
    assert FinancialAgenda.query.filter_by(estado='2TH Call').count() == 1
    assert nueva.agenda_payload['manual']['via'] == '2da_call'
    assert nueva.google_event_id and google['crear'][-1]['invitado'] == 'carla@mail.com'


def test_una_reagenda_desde_neurops_no_cuenta_dos_veces_en_stats(client, db, ana):
    cliente = Client(full_name='Carla', email='carla@mail.com')
    db.session.add(cliente)
    db.session.flush()
    appt = Appointment(client_id=cliente.id, closer_id=ana.id, start_time=MARTES_15, origin='workshop',
                       agenda_payload={'version': 1, 'evento_id': 'ev1', 'respuestas': [], 'lead': {'email': 'carla@mail.com'}})
    db.session.add(appt)
    db.session.commit()

    CloserService.process_agenda(ana.id, appt.id, {'status': 'Reagendado', 'reschedule_date': '2026-10-22T15:00:00'})

    (lead,) = servicio.estadisticas(ahora=MS(datetime(2026, 10, 19, 12, 0)))
    assert lead['inicio'] == MS(datetime(2026, 10, 22, 15, 0)) and not lead['cancelada']
