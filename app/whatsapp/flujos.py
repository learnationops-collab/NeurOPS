"""Lo que entra por WhatsApp y le toca al motor de flujos.

WhatsApp no pasa por las campañas ni por la campaña por defecto de Instagram: un «hola» de alguien del
broadcast no arranca la bienvenida. Al motor le llegan dos cosas:

  · Un botón de un mensaje del flujo (el `id` es el payload del motor): sigue ese recorrido.
  · La respuesta escrita a un paso que espera texto (o el título de un botón escrito a mano).

Un botón de una plantilla del broadcast con respuesta configurada sale solo (`respuestas.py`). Lo demás queda
para el setter (ADR-W229: el setting sigue a mano): es lo que aparece en «Esperan respuesta».
"""
from app.automatizaciones.modelos import AutEjecucion
from app.automatizaciones.nucleo import mensajes


def payload_de(mensaje):
    tipo = mensaje.get('type')
    if tipo == 'button':
        return (mensaje.get('button') or {}).get('payload')
    if tipo == 'interactive':
        interactivo = mensaje.get('interactive') or {}
        return (interactivo.get('button_reply') or interactivo.get('list_reply') or {}).get('id')
    return None


def procesar(motor, contacto, entrante, mensaje):
    """Pasa el mensaje por el motor. `entrante`: el `IgMensaje` ya guardado."""
    motor._entrante = entrante
    pausado = bool(contacto.bot_pausado_hasta and contacto.bot_pausado_hasta > motor.ahora)
    datos = mensajes.leer_payload(payload_de(mensaje))
    if datos:
        return motor._boton(contacto, *datos, pausado=pausado)
    if pausado:
        return 'bot_pausado'
    abierta = motor._abierta(contacto)
    if abierta and abierta.estado == AutEjecucion.ESPERANDO_RESPUESTA and entrante.texto:
        return motor._respuesta(abierta, _Escrito(entrante.texto))
    from app.whatsapp import respuestas
    return respuestas.responder(contacto, mensaje, motor.ahora) or 'para_el_setter'


class _Escrito:
    """Lo único que `Motor._respuesta` lee del evento."""

    def __init__(self, texto):
        self.texto = texto
