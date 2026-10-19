"""GET /api/leadership/entrar: la URL de Leadership con el pase firmado (app/api/leadership.py)."""
import base64
import hashlib
import hmac
import json
from urllib.parse import parse_qs, urlparse


def _b64decode(valor):
    return base64.urlsafe_b64decode(valor + '=' * (-len(valor) % 4))


def test_firma_un_pase_que_leadership_puede_verificar(client, make_user, auth_headers, monkeypatch):
    monkeypatch.setenv('LEADERSHIP_HANDOFF_SECRET', 'secreto-de-prueba')
    user = make_user('setter', email='ana@thelearnation.com')

    res = client.get('/api/leadership/entrar', headers=auth_headers(user))

    assert res.status_code == 200
    url = urlparse(res.get_json()['url'])
    assert (url.netloc, url.path) == ('leadership.thelearnation.com', '/auth/handoff')
    cuerpo, firma = parse_qs(url.query)['token'][0].split('.')
    esperada = hmac.new(b'secreto-de-prueba', cuerpo.encode(), hashlib.sha256).digest()
    assert hmac.compare_digest(esperada, _b64decode(firma))
    pase = json.loads(_b64decode(cuerpo))
    assert (pase['iss'], pase['email']) == ('work', 'ana@thelearnation.com')


def test_sin_secreto_falla_cerrada(client, make_user, auth_headers, monkeypatch):
    monkeypatch.delenv('LEADERSHIP_HANDOFF_SECRET', raising=False)

    assert client.get('/api/leadership/entrar', headers=auth_headers(make_user())).status_code == 503


def test_simulando_no_hay_pase(client, make_user, auth_headers, monkeypatch):
    monkeypatch.setenv('LEADERSHIP_HANDOFF_SECRET', 'secreto-de-prueba')
    admin = make_user('admin')
    simulado = make_user('closer')
    cabeceras = auth_headers(simulado, is_impersonating=True, original_user_id=admin.id, original_user_role='admin')

    assert client.get('/api/leadership/entrar', headers=cabeceras).status_code == 403


def test_sin_sesion_no_hay_pase(client):
    assert client.get('/api/leadership/entrar').status_code == 401
