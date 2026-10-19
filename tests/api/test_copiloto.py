"""Learnito: valida la conversación, llama a Claude por el servicio que registra el uso, ejecuta las
herramientas que pide y corta en el tope mensual de cada persona."""
from datetime import datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.models import AiUsage
from app.services import copiloto_herramientas
from app.services.claude_service import ClaudeService, ClaudeServiceError

URL = '/api/copiloto/mensaje'
USO = '/api/copiloto/uso'
HOLA = {'mensajes': [{'role': 'user', 'content': 'hola'}]}


def _usage():
    return SimpleNamespace(input_tokens=300, output_tokens=20, cache_creation_input_tokens=0, cache_read_input_tokens=0)


def _texto(texto='Hola, ¿en qué te ayudo?', stop_reason='end_turn'):
    return SimpleNamespace(content=[SimpleNamespace(type='text', text=texto)], usage=_usage(),
                           stop_reason=stop_reason, _request_id='req_1')


def _pide(nombre, entrada, id_='tu_1'):
    bloque = SimpleNamespace(type='tool_use', id=id_, name=nombre, input=entrada)
    return SimpleNamespace(content=[bloque], usage=_usage(), stop_reason='tool_use', _request_id='req_t')


@pytest.fixture()
def claude(monkeypatch):
    llamadas = []

    def _instalar(*respuestas):
        cola = list(respuestas) or [_texto()]

        def create(**kwargs):
            llamadas.append({**kwargs, 'messages': list(kwargs['messages'])})
            return cola.pop(0) if len(cola) > 1 else cola[0]
        monkeypatch.setattr(ClaudeService, '_client', SimpleNamespace(messages=SimpleNamespace(create=create)))
        return llamadas
    return _instalar


def _gastar(db, user, monto, cuando=None):
    db.session.add(AiUsage(user_id=user.id, feature='copiloto', model='claude-haiku-5-5', input_tokens=0,
                           output_tokens=0, cache_creation_input_tokens=0, cache_read_input_tokens=0,
                           cost_usd=Decimal(monto), status='ok', created_at=cuando or datetime.utcnow()))
    db.session.commit()


def test_el_closer_conversa_con_herramientas_y_queda_registrado(client, auth_headers, make_user, claude):
    closer = make_user(role='closer')
    llamadas = claude()

    r = client.post(URL, headers=auth_headers(closer), json={'mensajes': [{'role': 'user', 'content': ' hola '}]})

    assert r.status_code == 200 and r.get_json()['texto'] == 'Hola, ¿en qué te ayudo?'
    assert llamadas[0]['model'] == 'claude-haiku-5-5' and llamadas[0]['max_tokens'] == 1024
    assert [h['name'] for h in llamadas[0]['tools']] == ['mis_agendas', 'deuda_de', 'los_que_mas_deben']
    assert llamadas[0]['messages'] == [{'role': 'user', 'content': 'hola'}]
    assert 'Hoy es ' in llamadas[0]['system']
    assert r.get_json()['uso']['tope_usd'] == 8
    fila = AiUsage.query.one()
    assert (fila.user_id, fila.feature) == (closer.id, 'copiloto')


def test_ejecuta_la_herramienta_y_le_devuelve_el_resultado(client, auth_headers, make_user, claude, monkeypatch):
    closer = make_user(role='closer')
    monkeypatch.setattr(copiloto_herramientas, 'mis_agendas', lambda user, fecha=None: f'2 agendas ({user.id})')
    monkeypatch.setitem(copiloto_herramientas._EJECUTORES, 'mis_agendas', copiloto_herramientas.mis_agendas)
    llamadas = claude(_pide('mis_agendas', {}), _texto('Tenés 2 agendas hoy.'))

    r = client.post(URL, headers=auth_headers(closer), json={'mensajes': [{'role': 'user', 'content': 'mis agendas'}]})

    assert r.get_json()['texto'] == 'Tenés 2 agendas hoy.'
    assert len(llamadas) == 2
    resultado = llamadas[1]['messages'][-1]['content'][0]
    assert resultado == {'type': 'tool_result', 'tool_use_id': 'tu_1', 'content': f'2 agendas ({closer.id})'}
    assert AiUsage.query.count() == 2


def test_una_herramienta_desconocida_vuelve_como_error(client, auth_headers, make_user, claude):
    closer = make_user(role='closer')
    llamadas = claude(_pide('borrar_todo', {}), _texto('No puedo.'))

    client.post(URL, headers=auth_headers(closer), json=HOLA)

    assert llamadas[1]['messages'][-1]['content'][0]['is_error'] is True


def test_si_no_termina_de_pedir_herramientas_corta(client, auth_headers, make_user, claude):
    closer = make_user(role='closer')
    llamadas = claude(_pide('borrar_todo', {}))

    r = client.post(URL, headers=auth_headers(closer), json=HOLA)

    assert r.status_code == 502 and len(llamadas) == 4


def test_quien_no_es_closer_conversa_sin_herramientas(client, auth_headers, make_user, claude):
    admin = make_user(role='admin')
    llamadas = claude()

    client.post(URL, headers=auth_headers(admin), json=HOLA)

    assert 'tools' not in llamadas[0]


def test_en_el_tope_mensual_no_llama(client, db, auth_headers, make_user, claude):
    closer = make_user(role='closer')
    _gastar(db, closer, '8')
    llamadas = claude()

    r = client.post(URL, headers=auth_headers(closer), json=HOLA)

    assert r.status_code == 429 and llamadas == []
    assert r.get_json()['uso']['porcentaje'] == 100


def test_uso_del_mes(client, db, auth_headers, make_user):
    closer = make_user(role='closer')
    _gastar(db, closer, '2')
    _gastar(db, closer, '5', cuando=datetime.utcnow().replace(day=1) - timedelta(days=3))

    datos = client.get(USO, headers=auth_headers(closer)).get_json()

    assert (datos['gastado_usd'], datos['tope_usd'], datos['porcentaje']) == (2, 8, 25)
    assert datos['renueva'].endswith('-01')


@pytest.mark.parametrize('mensajes', [
    [],
    [{'role': 'assistant', 'content': 'hola'}],
    [{'role': 'user', 'content': 'a'}, {'role': 'assistant', 'content': 'b'}],
    [{'role': 'user', 'content': '   '}],
    [{'role': 'user', 'content': 'x' * 4001}],
    [{'role': 'user', 'content': 'a'}, {'role': 'user', 'content': 'b'}],
    [{'role': 'user' if i % 2 == 0 else 'assistant', 'content': 'a'} for i in range(11)],
])
def test_conversacion_invalida(client, auth_headers, make_user, claude, mensajes):
    closer = make_user(role='closer')
    llamadas = claude()

    r = client.post(URL, headers=auth_headers(closer), json={'mensajes': mensajes})

    assert r.status_code == 400 and llamadas == []


def test_un_setter_no_entra(client, auth_headers, make_user, claude):
    setter = make_user(role='setter')
    claude()

    assert client.post(URL, headers=auth_headers(setter), json=HOLA).status_code == 403
    assert client.get(USO, headers=auth_headers(setter)).status_code == 403


def test_sin_clave_devuelve_503(client, auth_headers, make_user, monkeypatch):
    closer = make_user(role='closer')
    monkeypatch.setattr(ClaudeService, '_client', None)

    assert client.post(URL, headers=auth_headers(closer), json=HOLA).status_code == 503


def test_un_rechazo_del_modelo_no_llega_vacio(client, auth_headers, make_user, claude):
    closer = make_user(role='closer')
    claude(_texto(texto='', stop_reason='refusal'))

    assert client.post(URL, headers=auth_headers(closer), json=HOLA).status_code == 502


def test_error_del_servicio_conserva_el_status(client, auth_headers, make_user, monkeypatch):
    closer = make_user(role='closer')

    def falla(*args, **kwargs):
        raise ClaudeServiceError('No se pudo conectar con Claude.', status_code=504)
    monkeypatch.setattr(ClaudeService, 'create_message', falla)

    assert client.post(URL, headers=auth_headers(closer), json=HOLA).status_code == 504
