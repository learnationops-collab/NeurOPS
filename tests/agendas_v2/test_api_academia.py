"""Thalamus como servicio de agenda para la Academia (app/api/external/agenda.py).

La Academia manda horario, duración y margen en cada pedido; acá no se guarda nada de agenda. Fecha fija:
lunes 5 de octubre de 2026, 12:00 UTC (09:00 en Buenos Aires).
"""

import calendar
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.agendas_v2 import servicio
from app.agendas_v2.modelos import SchedPerfil
from app.models import Appointment, Client, GoogleCalendarToken, User
from app.models.financial import FinancialAgenda
from app.services.google_service import GoogleService

TOKEN = 'token-de-la-academia-para-tests-123'
BASE = '/api/external/academy/agenda'
H = {'Authorization': f'Bearer {TOKEN}'}
BA = 'America/Argentina/Buenos_Aires'
LV10a12 = {str(d): [['10:00', '12:00']] for d in range(1, 6)}  # 0 = domingo
LUNES_10 = calendar.timegm(datetime(2026, 10, 5, 13, 0).timetuple()) * 1000  # 10:00 en Buenos Aires


@pytest.fixture(autouse=True)
def _entorno(monkeypatch):
    monkeypatch.setenv('ACADEMY_INBOUND_API_TOKEN', TOKEN)
    monkeypatch.setenv('ACADEMY_URL', 'https://academy.test')
    with freeze_time('2026-10-05 12:00:00'):
        yield


@pytest.fixture(autouse=True)
def google(monkeypatch):
    llamadas = {'crear': [], 'mover': [], 'borrar': [], 'ocupado': [], 'falla': None}
    servicio._google_cache.clear()

    def crear(user_id, inicio, fin, titulo, descripcion, invitado_email=None, otros_invitados=None):
        if llamadas['falla']:
            raise llamadas['falla']
        llamadas['crear'].append({'user_id': user_id, 'inicio': inicio, 'fin': fin, 'titulo': titulo, 'invitado': invitado_email,
                                  'otros': otros_invitados})
        return 'evt1', 'https://meet.google.com/abc-defg-hij'

    monkeypatch.setattr(GoogleService, 'crear_evento_con_meet', staticmethod(crear))
    monkeypatch.setattr(GoogleService, 'mover_evento', staticmethod(
        lambda user_id, event_id, inicio, fin, calendar_id=None: llamadas['mover'].append((event_id, inicio, fin, calendar_id))))
    monkeypatch.setattr(GoogleService, 'delete_event', staticmethod(
        lambda user_id, event_id, calendar_id=None, avisar=False: llamadas['borrar'].append((event_id, calendar_id, avisar)) or True))
    monkeypatch.setattr(GoogleService, 'list_calendars', staticmethod(lambda user_id, todos=False: [
        {'id': 'team@thelearnation.com', 'summary': 'Team', 'primary': True, 'escribe': True},
        {'id': 'cal-dari', 'summary': 'Dari', 'primary': False, 'escribe': True},
        {'id': 'cal-andy', 'summary': 'Andy', 'primary': False, 'escribe': True},
        {'id': 'feriados', 'summary': 'Feriados', 'primary': False, 'escribe': False},
    ]))
    monkeypatch.setattr(GoogleService, 'crear_calendario', staticmethod(
        lambda user_id, nombre, tz=None: llamadas.setdefault('calendarios', []).append(nombre) or 'cal-nuevo'))
    monkeypatch.setattr(GoogleService, 'franjas_ocupadas', staticmethod(lambda user_id, desde, hasta: list(llamadas['ocupado'])))
    return llamadas


@pytest.fixture(autouse=True)
def whatsapp(monkeypatch):
    from app.services.whatchimp_service import AvisoDeAgenda

    enviados = []
    monkeypatch.setattr(AvisoDeAgenda, 'enviar', staticmethod(lambda numero, **datos: enviados.append({'numero': numero, **datos})))
    monkeypatch.setattr(AvisoDeAgenda, 'prueba', staticmethod(lambda numero, nombre: enviados.append({'numero': numero, 'prueba': True})))
    return enviados


def _alta(client, email='dari@thelearnation.com', telefono='5491122334455'):
    return client.put(f'{BASE}/equipo', json={'email': email, 'nombre': 'Dari', 'tz': BA, 'telefono': telefono}, headers=H)


def _lista(db, email='dari@thelearnation.com', invitar_personal=False):
    """Google conectado (a la cuenta compartida team@), su calendario elegido y el WhatsApp confirmado."""
    u = User.query.filter_by(email=email).first()
    db.session.add(GoogleCalendarToken(user_id=u.id, token_json='{}', google_calendar_id='cal-dari'))
    db.session.add(SchedPerfil(user_id=u.id, datos={'academia': {
        'calendario_elegido': True, 'cuenta': 'team@thelearnation.com', 'invitar_personal': invitar_personal}}))
    u.whatsapp_confirmado_en = datetime(2026, 10, 1)
    db.session.commit()
    return u


def _del_lunes(r):
    return [t for t in r.json['slots'] if t < LUNES_10 + 12 * 3600000]


def _horarios(client, **extra):
    cuerpo = {'email': 'dari@thelearnation.com', 'tz': BA, 'horario': LV10a12, 'duracion': 45, 'margen': 15,
              'antel_min': 0, 'dias': 1, **extra}
    return client.post(f'{BASE}/horarios', json=cuerpo, headers=H)


def test_sin_token_no_entra(client):
    assert client.put(f'{BASE}/equipo', json={'email': 'x@y.com'}).status_code == 401


def test_alta_crea_cuenta_fulfillment_sin_clave(client, db):
    r = _alta(client)
    assert r.status_code == 200
    assert r.json == {'email': 'dari@thelearnation.com', 'calendar': 'no', 'calendario_elegido': False,
                      'cuenta': None, 'calendario_nombre': None, 'whatsapp': 'pendiente', 'numero': '5491122334455', 'invitar_personal': False, 'lista': False}
    u = User.query.filter_by(email='dari@thelearnation.com').first()
    assert u.role == 'fulfillment' and u.timezone == BA
    assert not u.check_password('')


def test_alta_de_un_email_con_otro_rol_solo_suma_el_rol(client, db, make_user):
    closer = make_user(role='closer', email='mario@thelearnation.com', two_chat_number='59170000001')
    r = _alta(client, email='mario@thelearnation.com', telefono='5491100000000')
    assert r.status_code == 200
    db.session.refresh(closer)
    assert closer.role == 'closer' and closer.tiene_rol('fulfillment')
    assert closer.two_chat_number == '59170000001'  # su número de ventas no se toca


def test_cambiar_el_numero_pide_confirmarlo_de_nuevo(client, db):
    _alta(client)
    _lista(db)
    _alta(client, telefono='5491199999999')
    assert client.get(f'{BASE}/equipo/dari@thelearnation.com', headers=H).json['whatsapp'] == 'pendiente'


def test_whatsapp_prueba_y_confirmar(client, db, whatsapp):
    _alta(client)
    sin = client.post(f'{BASE}/equipo/dari@thelearnation.com/whatsapp/confirmar', json={'comprobante': 'x'}, headers=H)
    assert sin.status_code == 400
    r = client.post(f'{BASE}/equipo/dari@thelearnation.com/whatsapp/prueba', headers=H)
    assert r.status_code == 200 and whatsapp[-1]['numero'] == '5491122334455'
    ok = client.post(f'{BASE}/equipo/dari@thelearnation.com/whatsapp/confirmar', json=r.json, headers=H)
    assert ok.json['whatsapp'] == 'confirmado'


def test_link_de_google_es_firmado_y_de_un_solo_uso(client, db, monkeypatch):
    _alta(client)
    url = client.post(f'{BASE}/equipo/dari@thelearnation.com/google', json={'volver': '/staff/sesiones'}, headers=H).json['url']
    assert '/google/conectar/' in url and 'token=' not in url

    class Flujo:
        def authorization_url(self, **kw):
            return 'https://accounts.google.com/o/oauth2/auth?x=1', 'estado1'

    monkeypatch.setattr(GoogleService, 'get_flow', staticmethod(lambda uri, **kw: Flujo()))
    monkeypatch.setattr(GoogleService, 'redirect_uri', staticmethod(lambda: 'https://work.test/google/callback'))
    ruta = url[url.index('/google/conectar/'):]
    r = client.get(ruta)
    assert r.status_code == 302 and r.headers['Location'].startswith('https://accounts.google.com')
    with client.session_transaction() as s:
        assert s['google_conectar']['v'] == '/staff/sesiones'

    with freeze_time('2026-10-05 12:01:00'):
        u = User.query.filter_by(email='dari@thelearnation.com').first()
        db.session.add(GoogleCalendarToken(user_id=u.id, token_json='{}'))
        db.session.commit()
    assert client.get(ruta).status_code == 400  # ya se usó
    assert client.get('/google/conectar/firma-falsa').status_code == 400


def test_la_vuelta_de_google_guarda_el_token_de_esa_cuenta_y_vuelve_a_la_academia(client, db, monkeypatch):
    _alta(client)
    u = User.query.filter_by(email='dari@thelearnation.com').first()

    class Flujo:
        credentials = object()

        def fetch_token(self, **kw):
            pass

    guardado = {}
    monkeypatch.setattr(GoogleService, 'get_flow', staticmethod(lambda uri, **kw: Flujo()))
    monkeypatch.setattr(GoogleService, 'save_credentials', staticmethod(lambda uid, creds: guardado.setdefault('uid', uid)))
    with client.session_transaction() as s:
        s['google_oauth_state'] = 'e1'
        s['google_redirect_uri'] = 'https://work.test/google/callback'
        s['google_conectar'] = {'u': u.id, 'v': '/staff/sesiones'}
    r = client.get('/google/callback?state=e1&code=abc')
    assert r.status_code == 302 and r.headers['Location'] == 'https://academy.test/staff/sesiones?google=ok'
    assert guardado['uid'] == u.id


def test_horarios_exigen_google_y_whatsapp(client, db):
    _alta(client)
    r = _horarios(client)
    assert r.status_code == 409 and r.json['error'] == 'no_lista'


def test_horarios_encadenan_sesion_y_margen_y_respetan_lo_ocupado(client, db, google):
    _alta(client)
    _lista(db)
    r = _horarios(client)
    # 10:00, 11:00 (45 + 15); 12:00 ya no entra
    assert r.status_code == 200 and _del_lunes(r) == [LUNES_10, LUNES_10 + 3600000]
    # Lo que la persona tiene en la Academia (10:00-10:30) corre la cadena al primer inicio libre
    r = _horarios(client, ocupado=[{'inicio': LUNES_10, 'fin': LUNES_10 + 1800000}])
    assert _del_lunes(r) == [LUNES_10 + 1800000]
    # Y lo de su Google Calendar también (11:00 a 13:00: queda solo la de las 10, que termina justo a las 11)
    google['ocupado'] = [(LUNES_10 + 3600000, LUNES_10 + 3 * 3600000)]
    assert _del_lunes(_horarios(client, fresco=True)) == [LUNES_10]


def test_horarios_aceptan_la_semana_como_lista(client, db, google):
    """PHP manda {0..6} con claves seguidas como lista."""
    _alta(client)
    _lista(db)
    semana = [LV10a12.get(str(d), []) for d in range(7)]
    assert _del_lunes(_horarios(client, horario=semana)) == [LUNES_10, LUNES_10 + 3600000]


def test_horarios_rechazan_datos_invalidos(client, db):
    _alta(client)
    _lista(db)
    assert _horarios(client, horario={'1': [['12:00', '10:00']]}).status_code == 400
    assert _horarios(client, duracion=0).status_code == 400
    assert _horarios(client, tz='Marte/Olympus').status_code == 400


def test_reservar_crea_el_evento_avisa_y_no_toca_ventas(client, db, google, whatsapp):
    _alta(client)
    _lista(db)
    r = client.post(f'{BASE}/reservas', json={
        'email': 'dari@thelearnation.com', 'tz': BA, 'inicio': LUNES_10, 'duracion': 45, 'titulo': 'Onboarding: Ana y Dari',
        'descripcion': 'Primera sesión', 'invitado': {'nombre': 'Ana', 'email': 'ana@mail.com'},
        'aviso': {'sesion': 'Onboarding', 'alumno': 'Ana'}}, headers=H)
    assert r.status_code == 200
    assert r.json == {'event_id': 'evt1', 'calendar_id': 'cal-dari', 'meet': 'https://meet.google.com/abc-defg-hij'}
    assert google['crear'][0]['otros'] is None  # sin pedirlo, no se invita a su calendario personal
    assert google['crear'][0]['invitado'] == 'ana@mail.com'
    assert google['crear'][0]['fin'] == datetime(2026, 10, 5, 13, 45)
    assert whatsapp[-1]['lead'] == 'Ana' and whatsapp[-1]['hora'] == '10:00 am' and whatsapp[-1]['grupo'] == 'Academia'
    assert Appointment.query.count() == 0 and Client.query.count() == 0 and FinancialAgenda.query.count() == 0


def test_reservar_si_google_falla_responde_502(client, db, google):
    _alta(client)
    _lista(db)
    google['falla'] = RuntimeError('caído')
    r = client.post(f'{BASE}/reservas', json={'email': 'dari@thelearnation.com', 'inicio': LUNES_10, 'duracion': 45}, headers=H)
    assert r.status_code == 502


def test_mover_y_cancelar_usan_el_calendario_donde_se_creo(client, db, google):
    _alta(client)
    _lista(db)
    r = client.patch(f'{BASE}/reservas/evt1', json={'email': 'dari@thelearnation.com', 'calendar_id': 'cal-a',
                                                    'inicio': LUNES_10 + 3600000, 'duracion': 45}, headers=H)
    assert r.status_code == 200 and google['mover'][0][0] == 'evt1' and google['mover'][0][3] == 'cal-a'
    r = client.delete(f'{BASE}/reservas/evt1', json={'email': 'dari@thelearnation.com', 'calendar_id': 'cal-a'}, headers=H)
    assert r.json == {'ok': True} and google['borrar'] == [('evt1', 'cal-a', True)]


def test_una_cuenta_fulfillment_no_entra_al_reparto_de_ventas(client, db):
    _alta(client)
    _lista(db)
    assert all(p.get('email') != 'dari@thelearnation.com' for p in servicio.colecciones()['personas'])
    assert User.query.filter(User.role == 'closer', User.email == 'dari@thelearnation.com').count() == 0


def _conectada_sin_elegir(db, email='dari@thelearnation.com'):
    u = User.query.filter_by(email=email).first()
    db.session.add(GoogleCalendarToken(user_id=u.id, token_json='{}'))
    u.whatsapp_confirmado_en = datetime(2026, 10, 1)
    db.session.commit()
    return u


def test_sin_calendario_elegido_no_esta_lista(client, db):
    _alta(client)
    _conectada_sin_elegir(db)
    estado = client.get(f'{BASE}/equipo/dari@thelearnation.com', headers=H).json
    assert estado['calendar'] == 'conectado' and estado['calendario_elegido'] is False and estado['lista'] is False
    assert _horarios(client).status_code == 409


def test_listar_y_crear_su_calendario_en_la_cuenta_compartida(client, db, google):
    _alta(client)
    _conectada_sin_elegir(db)
    r = client.get(f'{BASE}/equipo/dari@thelearnation.com/calendarios', headers=H)
    assert r.json['cuenta'] == 'team@thelearnation.com' and r.json['destino'] is None
    assert [c['id'] for c in r.json['calendarios']] == ['team@thelearnation.com', 'cal-dari', 'cal-andy', 'feriados']

    r = client.post(f'{BASE}/equipo/dari@thelearnation.com/calendarios', json={'nombre': 'Sesiones Dari'}, headers=H)
    assert r.status_code == 200 and google['calendarios'] == ['Sesiones Dari']
    assert r.json['destino'] == 'cal-nuevo' and r.json['conflicto'] == ['cal-nuevo']
    estado = client.get(f'{BASE}/equipo/dari@thelearnation.com', headers=H).json
    assert estado['lista'] is True and estado['cuenta'] == 'team@thelearnation.com'
    assert estado['calendario_nombre'] == 'Sesiones Dari'


def test_elegir_calendario_conflictos_e_invitar_al_personal(client, db, google):
    _alta(client)
    _conectada_sin_elegir(db)
    malo = client.put(f'{BASE}/equipo/dari@thelearnation.com/calendarios', json={'destino': 'feriados'}, headers=H)
    assert malo.status_code == 400  # solo lectura
    r = client.put(f'{BASE}/equipo/dari@thelearnation.com/calendarios', headers=H, json={
        'destino': 'cal-dari', 'conflicto': ['feriados', 'inventado'], 'invitar_personal': True})
    assert r.json['destino'] == 'cal-dari' and r.json['conflicto'] == ['cal-dari', 'feriados']
    assert r.json['invitar_personal'] is True

    client.post(f'{BASE}/reservas', json={'email': 'dari@thelearnation.com', 'inicio': LUNES_10, 'duracion': 45,
                                          'invitado': {'nombre': 'Ana', 'email': 'ana@mail.com'}}, headers=H)
    assert google['crear'][-1]['invitado'] == 'ana@mail.com'
    assert google['crear'][-1]['otros'] == ['dari@thelearnation.com']


def test_si_cambia_la_cuenta_de_google_hay_que_elegir_de_nuevo(client, db, monkeypatch):
    _alta(client)
    u = _lista(db)
    monkeypatch.setattr(GoogleService, 'list_calendars', staticmethod(lambda user_id, todos=False: [
        {'id': 'otra@gmail.com', 'summary': 'Otra', 'primary': True, 'escribe': True}]))
    r = client.get(f'{BASE}/equipo/dari@thelearnation.com/calendarios', headers=H)
    assert r.json['destino'] is None
    assert client.get(f'{BASE}/equipo/dari@thelearnation.com', headers=H).json['lista'] is False
    assert GoogleCalendarToken.query.filter_by(user_id=u.id).first().google_calendar_id == 'primary'


# --- Reuniones de equipo ---------------------------------------------------------------------


@pytest.fixture
def reuniones(monkeypatch):
    llamadas = {'crear': [], 'editar': []}

    def crear(user_id, inicio, fin, tz, titulo, descripcion, recurrencia, invitados):
        llamadas['crear'].append({'inicio': inicio, 'fin': fin, 'tz': tz, 'titulo': titulo, 'recurrencia': recurrencia,
                                  'invitados': invitados})
        return 'serie1', 'https://meet.google.com/xyz'

    def editar(user_id, event_id, calendar_id, inicio, fin, tz, titulo, descripcion, recurrencia, invitados):
        llamadas['editar'].append({'event_id': event_id, 'calendar_id': calendar_id, 'recurrencia': recurrencia,
                                   'invitados': invitados})

    monkeypatch.setattr(GoogleService, 'crear_reunion', staticmethod(crear))
    monkeypatch.setattr(GoogleService, 'editar_reunion', staticmethod(editar))
    return llamadas


def _reunion_cuerpo(**extra):
    return {'email': 'dari@thelearnation.com', 'tz': BA, 'fecha': '2026-10-06', 'hora': '09:30', 'duracion': 15,
            'dias': [1, 2, 3, 4, 5], 'titulo': 'Daily con Santi',
            'invitados': ['Santi@thelearnation.com', 'dari@mail.com', 'no-es-mail'],
            **extra}


def test_reunion_crea_una_serie_lunes_a_viernes_e_invita_a_cada_email(client, db, reuniones):
    _alta(client)
    _lista(db)
    r = client.post(f'{BASE}/reuniones', json=_reunion_cuerpo(saltear=['2026-10-12']), headers=H)
    assert r.status_code == 200
    assert r.json == {'event_id': 'serie1', 'calendar_id': 'cal-dari', 'meet': 'https://meet.google.com/xyz'}
    c = reuniones['crear'][0]
    assert c['inicio'] == datetime(2026, 10, 6, 9, 30) and c['fin'] == datetime(2026, 10, 6, 9, 45) and c['tz'] == BA
    assert c['recurrencia'] == ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', f'EXDATE;TZID={BA}:20261012T093000']
    assert c['invitados'] == ['santi@thelearnation.com', 'dari@mail.com']


def test_reunion_sin_calendario_elegido_no_se_crea(client, db, reuniones):
    _alta(client)
    r = client.post(f'{BASE}/reuniones', json=_reunion_cuerpo(), headers=H)
    assert r.status_code == 409 and reuniones['crear'] == []


def test_reunion_rechaza_datos_invalidos(client, db, reuniones):
    _alta(client)
    _lista(db)
    assert client.post(f'{BASE}/reuniones', json=_reunion_cuerpo(dias=[]), headers=H).status_code == 400
    assert client.post(f'{BASE}/reuniones', json=_reunion_cuerpo(hora='9:30'), headers=H).status_code == 400
    assert client.post(f'{BASE}/reuniones', json=_reunion_cuerpo(tz='Marte/Base'), headers=H).status_code == 400


def test_terminar_una_reunion_corta_la_serie_en_utc_y_borrar_la_quita(client, db, reuniones, google):
    _alta(client)
    _lista(db)
    cuerpo = _reunion_cuerpo(calendar_id='cal-dari', hasta='2026-10-20')
    r = client.patch(f'{BASE}/reuniones/serie1', json=cuerpo, headers=H)
    assert r.status_code == 200
    e = reuniones['editar'][0]
    assert e['event_id'] == 'serie1' and e['calendar_id'] == 'cal-dari'
    assert e['recurrencia'] == ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261021T025959Z']
    cuerpo = {'email': 'dari@thelearnation.com', 'calendar_id': 'cal-dari'}
    r = client.delete(f'{BASE}/reuniones/serie1', json=cuerpo, headers=H)
    assert r.json == {'ok': True} and google['borrar'][-1] == ('serie1', 'cal-dari', True)


# --- Momentum con un closer (modo ventas) ------------------------------------------------------


@pytest.fixture
def closer(db, monkeypatch):
    """Un closer con Google conectado (su calendario de ventas) y horario de ventas de 10 a 12."""
    u = User(username='Allan', email='allan@thelearnation.com', role='closer', two_chat_number='5491100001111')
    u.set_unusable_password()
    db.session.add(u)
    db.session.flush()
    db.session.add(GoogleCalendarToken(user_id=u.id, token_json='{}', google_calendar_id='cal-ventas'))
    db.session.commit()
    horario = {d: ([['10:00', '12:00']] if 1 <= d <= 5 else []) for d in range(7)}
    monkeypatch.setattr(servicio, 'disponibilidad_de', lambda user: {'en_team': True, 'horario': horario, 'tz': BA})
    return u


def _momentum(client, **extra):
    cuerpo = {'email': 'allan@thelearnation.com', 'inicio': LUNES_10, 'duracion': 45, 'titulo': 'Momentum Session: Ana y Allan',
              'invitado': {'nombre': 'Ana', 'email': 'Ana@Mail.com'}, 'aviso': {'sesion': 'Momentum Session', 'alumno': 'Ana'},
              'academia': {'reserva_id': 501, 'sesion_id': 770, 'sesion': 'Momentum Session', 'tipo': 'sena', 'alumno_id': 9},
              'ventas': True, **extra}
    return client.post(f'{BASE}/reservas', json=cuerpo, headers=H)


def test_closer_da_la_momentum_con_su_configuracion_de_ventas(client, db, closer):
    # Solo en modo ventas: como fulfillment no existe.
    assert client.get(f'{BASE}/equipo/allan@thelearnation.com', headers=H).status_code == 404
    r = client.get(f'{BASE}/equipo/allan@thelearnation.com?ventas=1', headers=H)
    assert r.json['ventas'] is True and r.json['lista'] is True and r.json['calendario_nombre'] == 'Su calendario de ventas'
    # Sus horarios salen de su horario de ventas, no del que manda la Academia.
    r = _horarios(client, email='allan@thelearnation.com', horario={'0': [['20:00', '21:00']]}, ventas=True)
    assert r.status_code == 200 and _del_lunes(r) == [LUNES_10, LUNES_10 + 3600000]


def test_la_momentum_es_una_llamada_del_closer_en_el_mazo(client, db, closer, google, whatsapp):
    r = _momentum(client)
    assert r.status_code == 200 and r.json['calendar_id'] == 'cal-ventas'
    appt = db.session.get(Appointment, r.json['appointment_id'])
    assert appt.closer_id == closer.id and appt.origin == 'Momentum' and appt.google_event_id == 'evt1'
    assert appt.client.email == 'ana@mail.com' and appt.agenda_payload['academia']['reserva_id'] == 501
    assert google['crear'][0]['user_id'] == closer.id and google['crear'][0]['invitado'] == 'ana@mail.com'
    assert whatsapp[0]['numero'] == '5491100001111' and whatsapp[0]['grupo'] == 'Academia'
    # Sin lead nuevo ni espejo de ventas: no toca su pipeline.
    assert FinancialAgenda.query.count() == 0
    # Mismo horario: no se pisa.
    assert _momentum(client).status_code == 409
    # La Academia la mueve y la cancela.
    nuevo = LUNES_10 + 3600000
    cuerpo = {'email': 'allan@thelearnation.com', 'inicio': nuevo, 'duracion': 45, 'ventas': True}
    assert client.patch(f'{BASE}/reservas/evt1', json=cuerpo, headers=H).status_code == 200
    db.session.refresh(appt)
    assert appt.start_time == servicio.ms_a_dt(nuevo) and appt.is_rescheduled
    cuerpo = {'email': 'allan@thelearnation.com', 'ventas': True}
    assert client.delete(f'{BASE}/reservas/evt1', json=cuerpo, headers=H).status_code == 200
    db.session.refresh(appt)
    assert appt.result == 'Cancelada'


def test_la_momentum_sin_google_no_deja_la_llamada(client, db, closer, google):
    google['falla'] = RuntimeError('google caído')
    assert _momentum(client).status_code == 502
    assert Appointment.query.count() == 0


def test_el_reporte_de_la_ficha_se_traduce_para_la_academia(app):
    from app.services.momentum_academia import traducir

    with app.app_context():
        assert traducir('venta', {}) == {'asistencia': 'asistio', 'resultado': 'pago'}
        no_cerro = {'resultado': 'asistio', 'deck': {'offer_presented': True}, 'objecion': 'Precio'}
        assert traducir('resultado', no_cerro) == {'asistencia': 'asistio', 'resultado': 'pensando', 'motivo': 'Precio'}
        assert traducir('resultado', {'resultado': 'asistio', 'deck': {}}) == {'asistencia': 'asistio', 'resultado': None}
        assert traducir('resultado', {'resultado': 'no_asistio', 'deck': {}}) == {'asistencia': 'no_asistio'}
        assert traducir('resultado', {'contacto_result': 'no_paga', 'deck': {}}) == {'resultado': 'no_sigue'}
        reagenda = {'resultado': 'reagenda', 'deck': {}, 'reagenda': {'start_time': '2026-10-08T15:00:00Z'}}
        assert traducir('resultado', reagenda) == {'asistencia': 'reagenda', 'inicio': '2026-10-08T15:00:00Z'}
        assert traducir('resultado', {'deck': {'closer_notes': 'x'}}) is None
        # El mazo viejo.
        assert traducir('mazo', {'result': 'Show up'}) == {'asistencia': 'asistio', 'resultado': None}
        assert traducir('mazo', {'result': 'Show up', 'fecha_seguimiento': '2026-10-20'}) == {'asistencia': 'asistio', 'resultado': 'pensando'}
        assert traducir('mazo', {'result': 'No Show'}) == {'asistencia': 'no_asistio'}
        assert traducir('mazo', {'result': 'Lead Perdido'}) == {'asistencia': 'asistio', 'resultado': 'no_sigue'}
        assert traducir('mazo', {'contact_result': 'no_paga'}) == {'resultado': 'no_sigue'}
        assert traducir('mazo', {'closer_notes': 'x'}) is None


def test_el_closer_de_cada_alumno_sale_de_su_venta_mas_reciente(client, db, closer):
    from app.models.financial import FinancialSale

    ana = Client(full_name='Ana', email='ana@mail.com')
    beto = Client(full_name='Beto', email='beto@mail.com')
    db.session.add_all([ana, beto])
    db.session.flush()
    db.session.add_all([
        FinancialSale(client_id=ana.id, email_vendedor='otro@x.com', date=datetime(2026, 9, 1)),
        FinancialSale(client_id=ana.id, email_vendedor='Allan@TheLearnation.com', date=datetime(2026, 10, 1)),
        FinancialSale(client_id=beto.id, email_vendedor=None, date=datetime(2026, 10, 1)),
    ])
    db.session.commit()
    alumnos = [{'email': 'x@x.com', 'work_client_id': ana.id}, {'email': 'Beto@mail.com'}, {'email': 'nadie@mail.com'}]
    r = client.post(f'{BASE}/closers', json={'alumnos': alumnos}, headers=H)
    assert r.status_code == 200
    a, b, c = r.json['closers']
    assert a['cliente_id'] == ana.id and a['closer'] == {'email': 'allan@thelearnation.com', 'nombre': 'Allan', 'activo': True, 'rol': 'closer'}
    assert b['cliente_id'] == beto.id and b['closer'] is None
    assert c['cliente_id'] is None and c['closer'] is None
    assert client.post(f'{BASE}/closers', json={'alumnos': 'x'}, headers=H).status_code == 400


def test_el_mazo_viejo_tambien_avisa_la_momentum(client, db, make_user, auth_headers):
    from unittest.mock import patch

    from app.services import momentum_academia

    closer = make_user(role='closer', username='mazo', email='mazo@neuro.com')
    cliente = Client(full_name='Alumna', email='alumna@x.com')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=datetime(2026, 10, 1, 15), origin='Momentum',
                       agenda_payload={'academia': {'reserva_id': 77}})
    db.session.add(appt)
    db.session.commit()

    with patch.object(momentum_academia, 'avisar') as avisar:
        r = client.post(f'/api/closer/deck/{appt.id}', json={'result': 'No Show'}, headers=auth_headers(closer))

    assert r.status_code == 200, r.get_json()
    assert avisar.call_args.args[1:3] == ('mazo', {'result': 'No Show'})


# --- Su Google Calendar en la Agenda de la Academia ---------------------------------------------


class _Pedido:
    def __init__(self, respuesta):
        self.respuesta = respuesta

    def execute(self):
        if isinstance(self.respuesta, Exception):
            raise self.respuesta
        return self.respuesta


class _Eventos:
    """El events() de Google: list por calendario, get y patch de un evento."""

    def __init__(self, por_calendario, evento=None):
        self.por_calendario, self.evento, self.parches = por_calendario, evento or {}, []

    def list(self, calendarId, **kw):
        return _Pedido(self.por_calendario.get(calendarId, RuntimeError('sin acceso')))

    def get(self, calendarId, eventId):
        return _Pedido(self.evento)

    def patch(self, calendarId, eventId, body, **kw):
        self.parches.append({'calendar_id': calendarId, 'event_id': eventId, 'body': body, **kw})
        return _Pedido({**self.evento, 'hangoutLink': self.evento.get('hangoutLink') or 'https://meet.google.com/nuevo'})


class _Servicio:
    def __init__(self, eventos):
        self._eventos = eventos

    def events(self):
        return self._eventos


def _evento(id_, inicio, fin, titulo='Llamada', **extra):
    return {'id': id_, 'summary': titulo, 'start': {'dateTime': inicio}, 'end': {'dateTime': fin}, 'status': 'confirmed', **extra}


def test_eventos_de_su_calendario_para_la_agenda(client, db, monkeypatch):
    _alta(client)
    _lista(db)
    eventos = _Eventos({
        'cal-dari': {'timeZone': BA, 'accessRole': 'owner', 'items': [
            _evento('a1', '2026-10-06T13:00:00Z', '2026-10-06T14:00:00Z', 'Sesión con Juan'),
            _evento('a2', '2026-10-06T15:00:00Z', '2026-10-06T16:00:00Z', 'Médico', visibility='private'),
            _evento('a3', '2026-10-06T17:00:00Z', '2026-10-06T18:00:00Z', 'Libre', transparency='transparent'),
            _evento('a4', '2026-10-06T19:00:00Z', '2026-10-06T20:00:00Z', 'No voy',
                    attendees=[{'self': True, 'responseStatus': 'declined'}]),
            _evento('a5_20261007', '2026-10-07T13:00:00Z', '2026-10-07T13:30:00Z', 'Daily', recurringEventId='a5',
                    hangoutLink='https://meet.google.com/daily'),
        ]},
    })
    monkeypatch.setattr(GoogleService, 'get_service', staticmethod(lambda user_id: _Servicio(eventos)))
    desde = calendar.timegm(datetime(2026, 10, 5).timetuple()) * 1000
    r = client.get(f'{BASE}/equipo/dari@thelearnation.com/eventos?desde={desde}&hasta={desde + 7 * 86400000}', headers=H)
    assert r.status_code == 200
    ids = [e['id'] for e in r.json['eventos']]
    assert ids == ['a1', 'a2', 'a5_20261007']
    a1, a2, daily = r.json['eventos']
    assert a1['titulo'] == 'Sesión con Juan' and a1['calendar_id'] == 'cal-dari' and a1['escribe'] is True
    assert a1['inicio'] == calendar.timegm(datetime(2026, 10, 6, 13).timetuple()) * 1000
    assert a2['titulo'] is None  # privado
    assert daily['serie'] == 'a5' and daily['meet'] == 'https://meet.google.com/daily'


def test_eventos_piden_calendario_elegido_y_rango_corto(client, db):
    _alta(client)
    r = client.get(f'{BASE}/equipo/dari@thelearnation.com/eventos?desde=0&hasta=1', headers=H)
    assert r.status_code == 409
    _lista(db)
    r = client.get(f'{BASE}/equipo/dari@thelearnation.com/eventos?desde=0&hasta={11 * 86400000}', headers=H)
    assert r.status_code == 400


def test_estado_de_un_evento_movido_o_borrado(client, db, monkeypatch):
    _alta(client)
    _lista(db)
    monkeypatch.setattr(GoogleService, 'evento_para_traza', staticmethod(
        lambda user_id, cal, eid: 'borrado' if eid == 'x' else {'estado': 'confirmed', 'inicio': 1, 'fin': 2}))
    r = client.get(f'{BASE}/equipo/dari@thelearnation.com/eventos/x?calendar_id=cal-dari', headers=H)
    assert r.json == {'estado': 'borrado', 'inicio': None, 'fin': None}
    r = client.get(f'{BASE}/equipo/dari@thelearnation.com/eventos/a1?calendar_id=cal-dari', headers=H)
    assert r.json == {'estado': 'confirmed', 'inicio': 1, 'fin': 2}


def test_vincular_invita_al_alumno_y_agrega_meet(client, db, monkeypatch):
    _alta(client)
    _lista(db)
    eventos = _Eventos({}, evento=_evento('a1', '2026-10-06T13:00:00Z', '2026-10-06T14:00:00Z',
                                          attendees=[{'email': 'otro@x.com'}]))
    monkeypatch.setattr(GoogleService, 'get_service', staticmethod(lambda user_id: _Servicio(eventos)))
    r = client.post(f'{BASE}/equipo/dari@thelearnation.com/eventos/a1/vincular',
                    json={'calendar_id': 'cal-dari', 'invitado': {'email': 'Alumno@x.com'}}, headers=H)
    assert r.status_code == 200 and r.json == {'meet': 'https://meet.google.com/nuevo'}
    (p,) = eventos.parches
    assert p['calendar_id'] == 'cal-dari' and p['sendUpdates'] == 'all' and p['conferenceDataVersion'] == 1
    assert [a['email'] for a in p['body']['attendees']] == ['otro@x.com', 'alumno@x.com']
    assert 'conferenceData' in p['body'] and 'start' not in p['body']


def test_vincular_un_evento_que_ya_tiene_todo_no_lo_toca(client, db, monkeypatch):
    _alta(client)
    _lista(db)
    eventos = _Eventos({}, evento=_evento('a1', '2026-10-06T13:00:00Z', '2026-10-06T14:00:00Z',
                                          attendees=[{'email': 'alumno@x.com'}], hangoutLink='https://meet.google.com/ya'))
    monkeypatch.setattr(GoogleService, 'get_service', staticmethod(lambda user_id: _Servicio(eventos)))
    r = client.post(f'{BASE}/equipo/dari@thelearnation.com/eventos/a1/vincular',
                    json={'calendar_id': 'cal-dari', 'invitado': {'email': 'alumno@x.com'}}, headers=H)
    assert r.json == {'meet': 'https://meet.google.com/ya'} and eventos.parches == []
