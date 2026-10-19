"""Cada llamada a Claude queda registrada en `ai_usage`, salga bien o mal, con su costo."""
from decimal import Decimal
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from app.models import AiUsage
from app.services.claude_service import ClaudeService, ClaudeServiceError, calcular_costo

PEDIDO = httpx2.Request('POST', 'https://api.anthropic.com/v1/messages')


class ClienteFalso:
    def __init__(self, respuesta=None, error=None):
        self.llamadas = []
        self._respuesta = respuesta
        self._error = error
        self.messages = self

    def create(self, **kwargs):
        self.llamadas.append(kwargs)
        if self._error:
            raise self._error
        return self._respuesta


def _respuesta(input_tokens=1000, output_tokens=200, cache_creation=0, cache_read=0):
    usage = SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens,
                            cache_creation_input_tokens=cache_creation, cache_read_input_tokens=cache_read)
    return SimpleNamespace(usage=usage, _request_id='req_123', content=[])


@pytest.fixture()
def cliente(monkeypatch):
    def _instalar(**kwargs):
        falso = ClienteFalso(**kwargs)
        monkeypatch.setattr(ClaudeService, '_client', falso)
        return falso
    return _instalar


def test_costo_de_haiku_con_cache():
    # 1000 de entrada a 0.10, 200 de salida a 0.50, 4000 escritos a 0.125 y 4000 leidos a 0.01.
    assert calcular_costo('claude-haiku-5-5', 1000, 200, 4000, 4000) == Decimal('0.000740')


def test_haiku_cobra_el_tramo_largo_pasando_los_100k():
    assert calcular_costo('claude-haiku-5-5', 100_000, 0) == Decimal('0.010000')
    assert calcular_costo('claude-haiku-5-5', 200_000, 0) == Decimal('0.100000')


def test_por_defecto_usa_haiku_y_registra_tokens_costo_y_usuario(db, make_user, cliente):
    closer = make_user(role='closer')
    falso = cliente(respuesta=_respuesta())

    ClaudeService.create_message('copiloto', closer.id, messages=[{'role': 'user', 'content': 'hola'}])

    assert falso.llamadas[0]['model'] == 'claude-haiku-5-5'
    assert falso.llamadas[0]['max_tokens'] == 16000
    fila = AiUsage.query.one()
    assert (fila.user_id, fila.feature, fila.model, fila.status) == (closer.id, 'copiloto', 'claude-haiku-5-5', 'ok')
    assert (fila.input_tokens, fila.output_tokens) == (1000, 200)
    assert fila.cost_usd == Decimal('0.000200')
    assert fila.request_id == 'req_123'


def test_un_error_de_la_api_queda_registrado_y_se_traduce(db, make_user, cliente):
    closer = make_user(role='closer')
    error = anthropic.RateLimitError('rate limited', response=httpx2.Response(429, request=PEDIDO), body=None)
    cliente(error=error)

    with pytest.raises(ClaudeServiceError) as exc:
        ClaudeService.create_message('copiloto', closer.id, messages=[])

    assert exc.value.status_code == 502
    fila = AiUsage.query.one()
    assert fila.status == 'error' and fila.error.startswith('429')
    assert fila.cost_usd == 0


def test_sin_conexion_queda_registrado(db, cliente):
    cliente(error=anthropic.APIConnectionError(request=PEDIDO))

    with pytest.raises(ClaudeServiceError) as exc:
        ClaudeService.create_message('copiloto', None, messages=[])

    assert exc.value.status_code == 504
    assert AiUsage.query.one().status == 'error'


def test_modelo_sin_precio_se_rechaza_sin_llamar(db, cliente):
    falso = cliente(respuesta=_respuesta())

    with pytest.raises(ValueError):
        ClaudeService.create_message('copiloto', None, model='claude-inventado', messages=[])

    assert falso.llamadas == [] and AiUsage.query.count() == 0


def test_sin_clave_falla_cerrado(db, monkeypatch):
    monkeypatch.setattr(ClaudeService, '_client', None)

    with pytest.raises(ClaudeServiceError) as exc:
        ClaudeService.create_message('copiloto', None, messages=[])

    assert exc.value.status_code == 503
