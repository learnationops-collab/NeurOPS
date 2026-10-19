"""Copiloto: valida la conversación, llama a Claude por el servicio que registra el uso y devuelve el texto."""
from types import SimpleNamespace

import pytest

from app.models import AiUsage
from app.services.claude_service import ClaudeService, ClaudeServiceError

URL = '/api/copiloto/mensaje'


def _respuesta(texto='Hola, ¿en qué te ayudo?', stop_reason='end_turn'):
    usage = SimpleNamespace(input_tokens=300, output_tokens=20, cache_creation_input_tokens=0,
                            cache_read_input_tokens=0)
    return SimpleNamespace(content=[SimpleNamespace(type='text', text=texto)], usage=usage,
                           stop_reason=stop_reason, _request_id='req_1')


@pytest.fixture()
def claude(monkeypatch):
    llamadas = []

    def _instalar(respuesta=None):
        def create(**kwargs):
            llamadas.append(kwargs)
            return respuesta or _respuesta()
        monkeypatch.setattr(ClaudeService, '_client', SimpleNamespace(messages=SimpleNamespace(create=create)))
        return llamadas
    return _instalar


def test_el_closer_conversa_y_queda_registrado(client, auth_headers, make_user, claude):
    closer = make_user(role='closer')
    llamadas = claude()

    r = client.post(URL, headers=auth_headers(closer), json={'mensajes': [{'role': 'user', 'content': ' hola '}]})

    assert r.status_code == 200 and r.get_json()['texto'] == 'Hola, ¿en qué te ayudo?'
    assert llamadas[0]['model'] == 'claude-haiku-5-5'
    assert llamadas[0]['messages'] == [{'role': 'user', 'content': 'hola'}]
    fila = AiUsage.query.one()
    assert (fila.user_id, fila.feature) == (closer.id, 'copiloto')


@pytest.mark.parametrize('mensajes', [
    [],
    [{'role': 'assistant', 'content': 'hola'}],
    [{'role': 'user', 'content': 'a'}, {'role': 'assistant', 'content': 'b'}],
    [{'role': 'user', 'content': '   '}],
    [{'role': 'user', 'content': 'x' * 4001}],
    [{'role': 'user', 'content': 'a'}, {'role': 'user', 'content': 'b'}],
])
def test_conversacion_invalida(client, auth_headers, make_user, claude, mensajes):
    closer = make_user(role='closer')
    llamadas = claude()

    r = client.post(URL, headers=auth_headers(closer), json={'mensajes': mensajes})

    assert r.status_code == 400 and llamadas == []


def test_un_setter_no_entra(client, auth_headers, make_user, claude):
    setter = make_user(role='setter')
    claude()

    r = client.post(URL, headers=auth_headers(setter), json={'mensajes': [{'role': 'user', 'content': 'hola'}]})

    assert r.status_code == 403


def test_sin_clave_devuelve_503(client, auth_headers, make_user, monkeypatch):
    closer = make_user(role='closer')
    monkeypatch.setattr(ClaudeService, '_client', None)

    r = client.post(URL, headers=auth_headers(closer), json={'mensajes': [{'role': 'user', 'content': 'hola'}]})

    assert r.status_code == 503


def test_un_rechazo_del_modelo_no_llega_vacio(client, auth_headers, make_user, claude):
    closer = make_user(role='closer')
    claude(_respuesta(texto='', stop_reason='refusal'))

    r = client.post(URL, headers=auth_headers(closer), json={'mensajes': [{'role': 'user', 'content': 'hola'}]})

    assert r.status_code == 502


def test_error_del_servicio_conserva_el_status(client, auth_headers, make_user, monkeypatch):
    closer = make_user(role='closer')

    def falla(*args, **kwargs):
        raise ClaudeServiceError('No se pudo conectar con Claude.', status_code=504)
    monkeypatch.setattr(ClaudeService, 'create_message', falla)

    r = client.post(URL, headers=auth_headers(closer), json={'mensajes': [{'role': 'user', 'content': 'hola'}]})

    assert r.status_code == 504
