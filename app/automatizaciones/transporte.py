"""Cómo salen los mensajes. El motor no sabe si manda de verdad o en simulación.

  · Simulado: no sale a la red; inventa un `mid` y deja registro de lo que habría mandado.
  · Meta: la API de Instagram con el token de la cuenta (IG_ACCESS_TOKEN). IG_USER_ID es opcional:
    sin él manda por /me, que es la cuenta dueña del token.

Control de la conversación: con varias apps en la cuenta (ManyChat, Kommo...), Meta solo deja escribir
a la dueña de cada conversación, por defecto la app predeterminada. El motor toma el control de la
conversación que atrapa un flujo (requiere «Toma el control de las conversaciones» activado para la app
en Mensajería avanzada de la página) y lo libera al terminar, así vuelve a la app predeterminada.
"""
import itertools
import os
import uuid

import requests

API = 'https://graph.instagram.com/v24.0'


class ErrorDeEnvio(Exception):
    """Meta rechazó el mensaje. `ventana_cerrada` si fue por la ventana de 24 h / usuario no disponible."""

    def __init__(self, mensaje, ventana_cerrada=False, sin_control=False):
        super().__init__(mensaje)
        self.ventana_cerrada = ventana_cerrada
        # La conversación es de otra app (p. ej. ManyChat): hay que tomar el control antes de escribir.
        self.sin_control = sin_control


class TransporteSimulado:
    def __init__(self):
        self.enviados = []
        self._contador = itertools.count(1)

    def enviar(self, destinatario, cuerpo):
        mid = f'sim-{next(self._contador)}-{uuid.uuid4().hex[:8]}'
        self.enviados.append({'destinatario': destinatario, 'cuerpo': cuerpo, 'mid': mid})
        return mid

    def tomar_control(self, igsid):
        return True

    def liberar_control(self, igsid):
        return True


class TransporteMeta:
    # Códigos de la Send API que significan «a esta persona ya no se le puede escribir».
    VENTANA_CERRADA = {10, 551}

    def __init__(self, token=None, cuenta_id=None, sesion=None):
        self.token = token or os.environ.get('IG_ACCESS_TOKEN')
        self.cuenta_id = cuenta_id or (os.environ.get('IG_USER_ID') or '').strip() or 'me'
        self.sesion = sesion or requests

    def enviar(self, destinatario, cuerpo):
        datos = self._post('messages', {'recipient': destinatario, 'message': cuerpo})
        return datos.get('message_id')

    def tomar_control(self, igsid):
        """True si la conversación quedó bajo el control de esta app."""
        return bool(self._post('take_thread_control', {'recipient': {'id': igsid}}).get('success'))

    def liberar_control(self, igsid):
        return bool(self._post('release_thread_control', {'recipient': {'id': igsid}}).get('success'))

    def _post(self, ruta, cuerpo):
        if not self.token or not self.cuenta_id:
            raise ErrorDeEnvio('Falta IG_ACCESS_TOKEN')
        respuesta = self.sesion.post(f'{API}/{self.cuenta_id}/{ruta}', json=cuerpo,
                                     headers={'Authorization': f'Bearer {self.token}'}, timeout=15)
        datos = respuesta.json() if respuesta.content else {}
        if respuesta.status_code >= 400 or 'error' in datos:
            error = datos.get('error') or {}
            mensaje = error.get('message') or f'HTTP {respuesta.status_code}'
            raise ErrorDeEnvio(mensaje, ventana_cerrada=error.get('code') in self.VENTANA_CERRADA,
                               sin_control='thread owner' in mensaje.lower())
        return datos
