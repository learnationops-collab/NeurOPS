"""Respuesta pública al comentario que disparó un flujo, como hacía ManyChat: al lead le llega la
notificación y es más probable que abra el DM. Rota entre varias frases para que Instagram no la tome
como spam. Si Meta la rechaza, el flujo sigue igual (solo queda en el log)."""
import logging
import random

import requests

from app.automatizaciones.transporte import ErrorDeEnvio

logger = logging.getLogger(__name__)

FRASES = [
    '¡Te escribí por privado! 📩',
    'Listo, revisá tus mensajes 💌',
    '¡Ya te mandé un mensaje! Fijate en tu bandeja 🙌',
    'Te dejé un mensaje por privado ✨',
    '¡Ahí te escribí! Mirá tus mensajes 👀',
]


def responder(transporte, comentario_id):
    try:
        if not transporte.responder_comentario(comentario_id, random.choice(FRASES)):
            logger.error(f'[MOTOR IG] Respuesta pública al comentario {comentario_id}: Meta no devolvió id')
    except (ErrorDeEnvio, requests.RequestException, ValueError) as error:
        logger.error(f'[MOTOR IG] Respuesta pública al comentario {comentario_id}: {error}')
