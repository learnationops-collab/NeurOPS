"""Thalamus como servicio de agenda para la Academia (app/api/external/agenda.py).

La Academia manda horario, duración y margen en cada pedido; acá no se guarda nada de agenda. Fecha fija:
lunes 5 de octubre de 2026, 12:00 UTC (09:00 en Buenos Aires).
"""

import calendar
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.agendas_v2 import servicio
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

    def crear(user_id, inicio, fin, titulo, descripcion, invitado_email=None):
        if llamadas['falla']:
            raise llamadas['falla']
        llamadas['crear'].append({'user_id': user_id, 'inicio': inicio, 'fin': fin, 'titulo': titulo, 'invitado': invitado_email})
        return 'evt1', 'https://meet.google.com/abc-defg-hij'

    monkeypatch.setattr(GoogleService, 'crear_evento_con_meet', staticmethod(crear))
    monkeypatch.setattr(GoogleService, 'mover_evento', staticmethod(
        lambda user_id, event_id, inicio, fin, calendar_id=None: llamadas['mover'].append((event_id, inicio, fin, calendar_id))))
    monkeypatch.setattr(GoogleService, 'delete_event', staticmethod(
        lambda user_id, event_id, calendar_id=None, avisar=False: llamadas['borrar'].append((event_id, calendar_id, avisar)) or True))
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


def _lista(db, email='dari@thelearnation.com'):
    u = User.query.filter_by(email=email).first()
    db.session.add(GoogleCalendarToken(user_id=u.id, token_json='{}'))
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
    assert r.json == {'email': 'dari@thelearnation.com', 'calendar': 'no', 'whatsapp': 'pendiente',
                      'numero': '5491122334455', 'lista': False}
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
    assert r.json == {'event_id': 'evt1', 'calendar_id': 'primary', 'meet': 'https://meet.google.com/abc-defg-hij'}
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
