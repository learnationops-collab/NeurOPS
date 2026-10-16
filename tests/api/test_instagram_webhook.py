"""/api/webhooks/instagram: el webhook de la app propia de Meta para Instagram.

Por ahora solo escucha: verifica la suscripción (GET), comprueba la firma X-Hub-Signature-256 y
guarda cada evento (POST). Sin sus variables de entorno la ruta queda CERRADA.
"""
import hashlib
import hmac
import json

import pytest

from app.models import InstagramWebhookEvento

URL = '/api/webhooks/instagram'
VERIFY_TOKEN = 'token-de-verificacion-de-prueba-1234'
APP_SECRET = 'clave-secreta-de-la-app-de-instagram-1234'

# Formato de la documentación de Meta (Instagram API con inicio de sesión de Instagram).
DM = {'object': 'instagram', 'entry': [{'id': '17841400000000000', 'time': 1760400000, 'messaging': [
    {'sender': {'id': '1234567890'}, 'recipient': {'id': '17841400000000000'}, 'timestamp': 1760400000,
     'message': {'mid': 'aWdfZAG1faXRlbToxOk', 'text': 'Hola, quiero info'}}]}]}
ECO = {'object': 'instagram', 'entry': [{'id': '17841400000000000', 'time': 1760400000, 'messaging': [
    {'sender': {'id': '17841400000000000'}, 'recipient': {'id': '1234567890'}, 'timestamp': 1760400000,
     'message': {'mid': 'aWdfZAG1faXRlbToxOm', 'text': 'Te paso el link', 'is_echo': True}}]}]}
COMENTARIO = {'object': 'instagram', 'entry': [{'id': '17841400000000000', 'time': 1760400000, 'changes': [
    {'field': 'comments', 'value': {'id': '17865799348089039', 'text': 'INFO',
                                    'from': {'id': '1234567890', 'username': 'ana'}, 'media': {'id': '1790000'}}}]}]}


@pytest.fixture()
def configurado(monkeypatch):
    monkeypatch.setenv('IG_WEBHOOK_VERIFY_TOKEN', VERIFY_TOKEN)
    monkeypatch.setenv('IG_APP_SECRET', APP_SECRET)


def firmar(cuerpo, secreto=APP_SECRET):
    return 'sha256=' + hmac.new(secreto.encode(), cuerpo, hashlib.sha256).hexdigest()


def enviar(client, payload, firma=None):
    cuerpo = json.dumps(payload).encode()
    return client.post(URL, data=cuerpo, content_type='application/json',
                       headers={'X-Hub-Signature-256': firmar(cuerpo) if firma is None else firma})


def verificar(client, token=VERIFY_TOKEN, modo='subscribe'):
    return client.get(URL, query_string={'hub.mode': modo, 'hub.verify_token': token, 'hub.challenge': '1158201444'})


# --- Verificación de la suscripción (GET) -------------------------------------------------------

def test_con_el_token_correcto_devuelve_el_challenge_en_texto_plano(client, configurado):
    respuesta = verificar(client)

    assert respuesta.status_code == 200
    assert respuesta.get_data(as_text=True) == '1158201444'
    assert respuesta.content_type.startswith('text/plain')


@pytest.mark.parametrize('token', ['', 'otro', VERIFY_TOKEN[:-1], VERIFY_TOKEN + 'x', 'tokén'])
def test_con_otro_token_rechaza_la_verificacion(client, configurado, token):
    assert verificar(client, token=token).status_code == 403


def test_un_modo_distinto_de_subscribe_se_rechaza(client, configurado):
    assert verificar(client, modo='unsubscribe').status_code == 403


@pytest.mark.parametrize('valor', [None, 'corto'])
def test_sin_token_de_verificacion_configurado_la_ruta_queda_cerrada(client, monkeypatch, valor):
    if valor:
        monkeypatch.setenv('IG_WEBHOOK_VERIFY_TOKEN', valor)

    respuesta = verificar(client, token=valor or '')

    assert respuesta.status_code == 503
    assert 'IG_WEBHOOK_VERIFY_TOKEN' in respuesta.get_json()['error']


# --- Recepción de eventos (POST) --------------------------------------------------------------

@pytest.mark.parametrize('payload, tipos', [(DM, 'messages'), (ECO, 'echo'), (COMENTARIO, 'comments')])
def test_un_evento_firmado_se_guarda_tal_cual_llego(client, configurado, payload, tipos):
    respuesta = enviar(client, payload)

    assert respuesta.status_code == 200
    assert respuesta.get_data(as_text=True) == 'EVENT_RECEIVED'
    evento = InstagramWebhookEvento.query.one()
    assert evento.payload == payload
    assert evento.tipos == tipos


def test_tambien_vale_la_firma_con_la_clave_de_la_app_de_meta(client, monkeypatch):
    clave_meta = 'clave-secreta-de-la-app-de-meta-1234'
    monkeypatch.setenv('META_APP_SECRET', clave_meta)
    cuerpo = json.dumps(DM).encode()

    respuesta = client.post(URL, data=cuerpo, content_type='application/json',
                            headers={'X-Hub-Signature-256': firmar(cuerpo, clave_meta)})

    assert respuesta.status_code == 200
    assert InstagramWebhookEvento.query.count() == 1


@pytest.mark.parametrize('firma', ['', 'sha256=', 'sha256=abc', firmar(b'otro cuerpo'),
                                   firmar(json.dumps(DM).encode(), 'otra-clave-secreta-cualquiera-1234'),
                                   firmar(json.dumps(DM).encode()).replace('sha256=', 'sha1=')])
def test_sin_firma_valida_no_guarda_nada(client, configurado, firma):
    assert enviar(client, DM, firma=firma).status_code == 401
    assert InstagramWebhookEvento.query.count() == 0


def test_sin_clave_secreta_configurada_la_ruta_queda_cerrada(client):
    respuesta = enviar(client, DM)

    assert respuesta.status_code == 503
    assert InstagramWebhookEvento.query.count() == 0


def test_un_cuerpo_firmado_que_no_es_un_objeto_json_es_400(client, configurado):
    cuerpo = b'[1, 2]'
    respuesta = client.post(URL, data=cuerpo, content_type='application/json',
                            headers={'X-Hub-Signature-256': firmar(cuerpo)})

    assert respuesta.status_code == 400
    assert InstagramWebhookEvento.query.count() == 0


def test_guardado_el_evento_despierta_al_motor(client, configurado, monkeypatch):
    avisos = []
    monkeypatch.setattr('app.automatizaciones.servicio.avisar', lambda app: avisos.append(app))

    assert enviar(client, DM).status_code == 200
    assert len(avisos) == 1


def test_si_el_motor_no_despierta_el_evento_igual_queda_guardado(client, configurado, monkeypatch):
    def falla(app):
        raise RuntimeError('boom')
    monkeypatch.setattr('app.automatizaciones.servicio.avisar', falla)

    assert enviar(client, DM).status_code == 200
    assert InstagramWebhookEvento.query.count() == 1


# --- Listado para revisar la prueba -----------------------------------------------------------

def test_el_admin_ve_los_ultimos_eventos_primero(client, configurado, make_user, auth_headers):
    enviar(client, DM)
    enviar(client, COMENTARIO)

    respuesta = client.get(f'{URL}/eventos', headers=auth_headers(make_user(role='admin')))

    assert respuesta.status_code == 200
    assert [e['tipos'] for e in respuesta.get_json()['eventos']] == ['comments', 'messages']


def test_el_listado_respeta_el_limite(client, configurado, make_user, auth_headers):
    for _ in range(3):
        enviar(client, DM)

    respuesta = client.get(f'{URL}/eventos', query_string={'limite': 2}, headers=auth_headers(make_user(role='admin')))

    assert len(respuesta.get_json()['eventos']) == 2


@pytest.mark.parametrize('rol, codigo', [(None, 401), ('closer', 403), ('setter', 403)])
def test_solo_el_admin_ve_los_eventos(client, configurado, make_user, auth_headers, rol, codigo):
    enviar(client, DM)
    cabeceras = auth_headers(make_user(role=rol)) if rol else {}

    assert client.get(f'{URL}/eventos', headers=cabeceras).status_code == codigo
