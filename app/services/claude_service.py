"""Unica puerta de NeurOPS a la API de Claude: cada llamada queda registrada en `AiUsage`.

Nadie llama al SDK de Anthropic por su cuenta: asi el registro de quien usa la IA y cuanto gasta
no depende de que cada funcion se acuerde de anotarlo, y el tope mensual (cuando se decida) se
aplica en un solo lugar.

- Modelo por defecto: Haiku 5.5, el mas barato. Se puede pedir otro de `PRECIOS`; uno que no
  este ahi se rechaza antes de llamar, porque no habria como calcular su costo.
- Clave: `ANTHROPIC_API_KEY`, solo del lado del servidor. Sin ella falla cerrado (503).
- Una llamada que falla tambien queda registrada (`status='error'`), con el usuario y la funcion:
  sirve para ver errores repetidos sin entrar a los logs.
"""
import logging
import os
import time
from datetime import datetime
from decimal import Decimal

import anthropic
from sqlalchemy import func

from app import db
from app.models import AiUsage

logger = logging.getLogger(__name__)

MODELO_POR_DEFECTO = 'claude-haiku-5-5'
MAX_TOKENS_POR_DEFECTO = 16000

# USD por millon de tokens (platform.claude.com/docs/en/about-claude/pricing, 2026-10-19):
# entrada, salida, escritura en cache (5 min) y lectura de cache.
PRECIOS = {
    'claude-haiku-5-5': {'input': '0.10', 'output': '0.50', 'cache_write': '0.125', 'cache_read': '0.01'},
    'claude-sonnet-5-5': {'input': '2', 'output': '10', 'cache_write': '2.50', 'cache_read': '0.20'},
    'claude-opus-5-5': {'input': '4', 'output': '20', 'cache_write': '5', 'cache_read': '0.20'},
}
# Haiku 5.5 cobra mas caro los prompts de mas de 100k tokens (entrada 0.50, salida 2.50). Las
# tarifas de cache de ese tramo se derivan con la misma proporcion que el tramo normal.
HAIKU_TRAMO_LARGO_DESDE = 100_000
HAIKU_TRAMO_LARGO = {'input': '0.50', 'output': '2.50', 'cache_write': '0.625', 'cache_read': '0.05'}

_MILLON = Decimal(1_000_000)


def inicio_del_mes(ahora=None):
    """El primer instante del mes en curso (UTC, como `AiUsage.created_at`)."""
    ahora = ahora or datetime.utcnow()
    return ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def gasto_del_mes(user_id, feature=None, desde=None):
    """Lo que gastó un usuario en el mes en curso, en USD (todas las funciones, o una). `desde`
    (UTC naive) acota a partir de otro instante: el inicio del día, para el uso de hoy."""
    query = db.session.query(func.coalesce(func.sum(AiUsage.cost_usd), 0)).filter(
        AiUsage.user_id == user_id, AiUsage.created_at >= (desde or inicio_del_mes()))
    if feature:
        query = query.filter(AiUsage.feature == feature)
    return Decimal(str(query.scalar() or 0))


class ClaudeServiceError(Exception):
    """Error al llamar a Claude, con el status HTTP pensado para devolverlo tal cual."""

    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = status_code


def calcular_costo(model, input_tokens, output_tokens, cache_creation_input_tokens=0,
                   cache_read_input_tokens=0):
    """Costo en USD de una llamada, con los tokens que informa la respuesta. Funcion pura."""
    precios = PRECIOS[model]
    prompt = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
    if model == 'claude-haiku-5-5' and prompt > HAIKU_TRAMO_LARGO_DESDE:
        precios = HAIKU_TRAMO_LARGO
    total = (Decimal(input_tokens) * Decimal(precios['input'])
             + Decimal(output_tokens) * Decimal(precios['output'])
             + Decimal(cache_creation_input_tokens) * Decimal(precios['cache_write'])
             + Decimal(cache_read_input_tokens) * Decimal(precios['cache_read']))
    return (total / _MILLON).quantize(Decimal('0.000001'))


class ClaudeService:
    _client = None

    @classmethod
    def _cliente(cls):
        if cls._client is None:
            api_key = os.environ.get('ANTHROPIC_API_KEY')
            if not api_key:
                raise ClaudeServiceError('ANTHROPIC_API_KEY no está configurada.', status_code=503)
            cls._client = anthropic.Anthropic(api_key=api_key, timeout=60.0)
        return cls._client

    @classmethod
    def create_message(cls, feature, user_id, model=MODELO_POR_DEFECTO, **params):
        """`messages.create` registrando la llamada. `params` va tal cual al SDK (messages, system,
        tools, max_tokens...). Devuelve el `Message`; si falla, lanza `ClaudeServiceError`."""
        if not feature:
            raise ValueError('feature es obligatorio: es lo que agrupa el gasto.')
        if model not in PRECIOS:
            raise ValueError(f'Modelo sin precio cargado: {model}.')
        params.setdefault('max_tokens', MAX_TOKENS_POR_DEFECTO)

        client = cls._cliente()
        inicio = time.monotonic()
        try:
            response = client.messages.create(model=model, **params)
        except anthropic.APIStatusError as e:
            cls._registrar(feature, user_id, model, inicio, error=f'{e.status_code}: {e.message}',
                           request_id=getattr(e, 'request_id', None))
            raise ClaudeServiceError('Claude respondió con un error.', status_code=502) from e
        except anthropic.APIConnectionError as e:
            cls._registrar(feature, user_id, model, inicio, error=f'conexión: {e}')
            raise ClaudeServiceError('No se pudo conectar con Claude.', status_code=504) from e

        cls._registrar(feature, user_id, model, inicio, response=response)
        return response

    @staticmethod
    def _registrar(feature, user_id, model, inicio, response=None, error=None, request_id=None):
        """Guarda la fila de uso. Si el guardado falla, la respuesta igual se devuelve."""
        usage = getattr(response, 'usage', None)
        tokens = {
            'input_tokens': getattr(usage, 'input_tokens', 0) or 0,
            'output_tokens': getattr(usage, 'output_tokens', 0) or 0,
            'cache_creation_input_tokens': getattr(usage, 'cache_creation_input_tokens', 0) or 0,
            'cache_read_input_tokens': getattr(usage, 'cache_read_input_tokens', 0) or 0,
        }
        fila = AiUsage(
            user_id=user_id, feature=feature, model=model, **tokens,
            cost_usd=calcular_costo(model, **tokens),
            status=AiUsage.ERROR if error else AiUsage.OK,
            error=error[:255] if error else None,
            request_id=getattr(response, '_request_id', None) if response is not None else request_id,
            duration_ms=int((time.monotonic() - inicio) * 1000),
        )
        try:
            db.session.add(fila)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f'[AI USAGE] no se pudo registrar ({feature}, {model}): {e}')
