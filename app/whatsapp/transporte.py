"""El motor de flujos hablando por WhatsApp: traduce los cuerpos que arma `nucleo/mensajes.py` (formato Instagram).

  · Texto → texto. Botones (plantilla de botones o respuestas rápidas) → mensaje interactivo: hasta 3 como
    botones; más, como lista (hasta 10). El `id` de cada opción es el payload del motor, así un toque vuelve
    al nodo y botón exactos.
  · Imagen, audio, video y archivo → el mismo tipo de WhatsApp por link.
  · Lo que es solo de Instagram (control del hilo, perfil, recuperar DMs) acá no hace nada.

`TransporteMixto` le da al motor un solo transporte: lo de un contacto `wa:` sale por acá, lo demás por Instagram.
"""
import time

from app.automatizaciones.transporte import ErrorDeEnvio
from app.whatsapp.cliente import ClienteWhatsapp, es_whatsapp, telefono_de

MAX_BOTONES = 3
MAX_FILAS = 10
LARGO_BOTON = 20
LARGO_FILA = 24
LARGO_INTERACTIVO = 1024
MEDIOS = {'image': 'image', 'audio': 'audio', 'video': 'video', 'file': 'document'}
ESPERA_MAXIMA = 5  # segundos de «escribiendo»: WhatsApp no muestra el indicador sin un mensaje que marcar leído


def _interactivo(texto, opciones):
    """opciones: [(titulo, payload)]."""
    texto = (texto or ' ')[:LARGO_INTERACTIVO]
    if len(opciones) <= MAX_BOTONES:
        accion = {'buttons': [{'type': 'reply', 'reply': {'id': p, 'title': t[:LARGO_BOTON]}} for t, p in opciones]}
        return {'type': 'interactive', 'interactive': {'type': 'button', 'body': {'text': texto}, 'action': accion}}
    if len(opciones) > MAX_FILAS:
        raise ErrorDeEnvio(f'WhatsApp acepta hasta {MAX_FILAS} opciones por mensaje')
    filas = [{'id': p, 'title': t[:LARGO_FILA]} for t, p in opciones]
    accion = {'button': 'Ver opciones', 'sections': [{'title': 'Opciones', 'rows': filas}]}
    return {'type': 'interactive', 'interactive': {'type': 'list', 'body': {'text': texto}, 'action': accion}}


def traducir(cuerpo):
    """El cuerpo del motor (formato Instagram) al de la Cloud API (sin `to` ni `messaging_product`)."""
    if cuerpo.get('quick_replies'):
        return _interactivo(cuerpo.get('text'), [(q['title'], q['payload']) for q in cuerpo['quick_replies']])
    if 'text' in cuerpo:
        return {'type': 'text', 'text': {'body': cuerpo['text'], 'preview_url': True}}
    adjunto = cuerpo.get('attachment') or {}
    payload = adjunto.get('payload') or {}
    if adjunto.get('type') == 'template':
        return _interactivo(payload.get('text'), [(b['title'], b['payload']) for b in payload.get('buttons') or []])
    tipo = MEDIOS.get(adjunto.get('type'))
    if tipo is None or not payload.get('url'):
        raise ErrorDeEnvio(f'WhatsApp no sabe mandar «{adjunto.get("type")}»')
    return {'type': tipo, tipo: {'link': payload['url']}}


class TransporteWhatsapp:
    def __init__(self, cliente=None):
        self.cliente = cliente or ClienteWhatsapp()

    def enviar(self, destinatario, cuerpo, etiqueta=None):
        telefono = telefono_de(destinatario.get('id'))
        if not telefono:
            raise ErrorDeEnvio('WhatsApp solo escribe a un número (no responde comentarios)')
        return self.cliente.mandar(telefono, traducir(cuerpo))

    def escribiendo(self, igsid, segundos):
        time.sleep(min(segundos, ESPERA_MAXIMA))

    def perfil(self, igsid):
        return {}

    def tomar_control(self, igsid):
        return False

    def liberar_control(self, igsid):
        return True


class TransporteMixto:
    """Instagram por defecto; WhatsApp para los contactos `wa:`. El resto de los métodos va a Instagram."""

    def __init__(self, instagram, whatsapp=None):
        self.instagram = instagram
        self._whatsapp = whatsapp

    @property
    def whatsapp(self):
        if self._whatsapp is None:
            self._whatsapp = TransporteWhatsapp()
        return self._whatsapp

    def _de(self, igsid):
        return self.whatsapp if es_whatsapp(igsid) else self.instagram

    def enviar(self, destinatario, cuerpo, etiqueta=None):
        return self._de(destinatario.get('id')).enviar(destinatario, cuerpo, etiqueta=etiqueta)

    def escribiendo(self, igsid, segundos):
        return self._de(igsid).escribiendo(igsid, segundos)

    def perfil(self, igsid):
        return self._de(igsid).perfil(igsid)

    def tomar_control(self, igsid):
        return self._de(igsid).tomar_control(igsid)

    def liberar_control(self, igsid):
        return self._de(igsid).liberar_control(igsid)

    def __getattr__(self, nombre):
        return getattr(self.instagram, nombre)
