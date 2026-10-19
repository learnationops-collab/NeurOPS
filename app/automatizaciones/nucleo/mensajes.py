"""Del nodo «mensaje» a los cuerpos que acepta la API de Instagram (sin el `recipient`).

Cada contenido sale como un mensaje aparte, en orden. Los botones viajan con el último texto:
  · estilo "botones": plantilla de botones (hasta 3, postback; quedan en el chat).
  · estilo "respuestas_rapidas": quick replies (hasta 13; desaparecen al tocar uno).
El payload de cada botón dice a qué versión, nodo y botón pertenece, así un toque en un mensaje
viejo se puede ubicar aunque el contacto ya esté en otro lado del flujo.
"""
import re

PREFIJO_PAYLOAD = 'AUT'
TIPOS_ADJUNTO = {'imagen': 'image', 'audio': 'audio', 'video': 'video', 'archivo': 'file'}


def payload_boton(version_id, nodo_id, boton_id):
    return f'{PREFIJO_PAYLOAD}:{version_id}:{nodo_id}:{boton_id}'


def leer_payload(payload):
    """(version_id, nodo_id, boton_id) si el payload es de este motor; si no, None (p. ej. de ManyChat)."""
    partes = (payload or '').split(':', 3)
    if len(partes) != 4 or partes[0] != PREFIJO_PAYLOAD or not partes[1].isdigit():
        return None
    return int(partes[1]), partes[2], partes[3]


def completar(texto, variables):
    """Reemplaza {{variable}} por su valor; lo que no existe queda vacío (nunca la llave cruda)."""
    return re.sub(r'\{\{\s*([\w.]+)\s*\}\}', lambda m: str(variables.get(m.group(1), '') or ''), texto or '')


def construir(nodo, variables, version_id):
    """Lista de cuerpos `message` para la API, en el orden en que se mandan."""
    contenido = nodo.get('contenido') or []
    botones = nodo.get('botones') or []
    estilo = nodo.get('estilo_botones', 'botones')
    cuerpos = []
    for i, item in enumerate(contenido):
        ultimo = i == len(contenido) - 1
        if item['tipo'] == 'texto':
            texto = completar(item['texto'], variables)
            if ultimo and botones and estilo == 'botones':
                cuerpos.append({'attachment': {'type': 'template', 'payload': {
                    'template_type': 'button', 'text': texto,
                    'buttons': [{'type': 'postback', 'title': b['titulo'],
                                 'payload': payload_boton(version_id, nodo['id'], b['id'])} for b in botones],
                }}})
            elif ultimo and botones:
                cuerpos.append({'text': texto, 'quick_replies': [
                    {'content_type': 'text', 'title': b['titulo'],
                     'payload': payload_boton(version_id, nodo['id'], b['id'])} for b in botones]})
            else:
                cuerpos.append({'text': texto})
        else:
            cuerpos.append({'attachment': {'type': TIPOS_ADJUNTO[item['tipo']], 'payload': {'url': item['url']}}})
    return cuerpos


def pausas(nodo):
    """Segundos de «escribiendo…» antes de cada cuerpo de `construir` (uno por contenido, en el mismo orden)."""
    return [item.get('escribiendo') or 0 for item in nodo.get('contenido') or []]


def texto_visible(cuerpo):
    """Lo que ve el contacto, para guardarlo en el historial."""
    if 'text' in cuerpo:
        return cuerpo['text']
    adjunto = cuerpo.get('attachment') or {}
    if adjunto.get('type') == 'template':
        return adjunto['payload'].get('text')
    return None
