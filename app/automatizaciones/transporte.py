"""Cómo salen los mensajes. El motor no sabe si manda de verdad o en simulación.

  · Simulado: no sale a la red; inventa un `mid` y deja registro de lo que habría mandado.
  · Meta: la API de Instagram con el token de la cuenta (IG_ACCESS_TOKEN / IG_USER_ID).
"""
import itertools
import os
import uuid

import requests

API = 'https://graph.instagram.com/v24.0'


class ErrorDeEnvio(Exception):
    """Meta rechazó el mensaje. `ventana_cerrada` si fue por la ventana de 24 h / usuario no disponible."""

    def __init__(self, mensaje, ventana_cerrada=False):
        super().__init__(mensaje)
        self.ventana_cerrada = ventana_cerrada


class TransporteSimulado:
    def __init__(self):
        self.enviados = []
        self._contador = itertools.count(1)

    def enviar(self, destinatario, cuerpo):
        mid = f'sim-{next(self._contador)}-{uuid.uuid4().hex[:8]}'
        self.enviados.append({'destinatario': destinatario, 'cuerpo': cuerpo, 'mid': mid})
        return mid


class TransporteMeta:
    # Códigos de la Send API que significan «a esta persona ya no se le puede escribir».
    VENTANA_CERRADA = {10, 551}

    def __init__(self, token=None, cuenta_id=None, sesion=None):
        self.token = token or os.environ.get('IG_ACCESS_TOKEN')
        self.cuenta_id = cuenta_id or os.environ.get('IG_USER_ID')
        self.sesion = sesion or requests

    def enviar(self, destinatario, cuerpo):
        if not self.token or not self.cuenta_id:
            raise ErrorDeEnvio('Falta IG_ACCESS_TOKEN o IG_USER_ID')
        respuesta = self.sesion.post(
            f'{API}/{self.cuenta_id}/messages', json={'recipient': destinatario, 'message': cuerpo},
            headers={'Authorization': f'Bearer {self.token}'}, timeout=15)
        datos = respuesta.json() if respuesta.content else {}
        if respuesta.status_code >= 400 or 'error' in datos:
            error = datos.get('error') or {}
            raise ErrorDeEnvio(error.get('message') or f'HTTP {respuesta.status_code}',
                               ventana_cerrada=error.get('code') in self.VENTANA_CERRADA)
        return datos.get('message_id')
