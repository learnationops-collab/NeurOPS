"""Lo que WhatsApp manda además del texto, para verlo en el chat del Inbox.

  · Cita: el lead tocó «Responder» sobre un mensaje (`context.id`) o le puso una reacción (`reaction.message_id`).
    Es el `mid` de otro `IgMensaje`; si no está (se mandó desde el teléfono), la cita queda sin texto.
  · Medio: sticker, foto, audio, video o documento. Llega solo el id de Meta; el archivo se baja con el token
    cuando el chat lo pide (`descargar`) y vale 30 días en Meta. Lo último que se bajó queda en memoria.
"""
from collections import OrderedDict

from app.automatizaciones.modelos import IgMensaje
from app.whatsapp.cliente import ClienteWhatsapp

TIPOS = ('sticker', 'image', 'audio', 'video', 'document')
CACHE_MAX = 60
CACHE_BYTES_MAX = 2 * 1024 * 1024  # lo más grande (videos) no se guarda: se baja cada vez
_cache = OrderedDict()


def _whatsapp(mensaje):
    contenido = mensaje.contenido if isinstance(mensaje.contenido, dict) else {}
    original = contenido.get('whatsapp')
    return original if isinstance(original, dict) else {}


def _citado(original):
    if original.get('type') == 'reaction':
        return (original.get('reaction') or {}).get('message_id')
    return (original.get('context') or {}).get('id')


def medio(mensaje):
    """{tipo, media_id, leyenda, nombre} o None."""
    original = _whatsapp(mensaje)
    tipo = original.get('type')
    datos = original.get(tipo) if tipo in TIPOS else None
    if not isinstance(datos, dict) or not datos.get('id'):
        return None
    return {'tipo': tipo, 'media_id': datos['id'], 'leyenda': datos.get('caption'), 'nombre': datos.get('filename')}


def para_chat(mensaje, contacto_id):
    """Lo que ve el chat del medio: sin el id de Meta, con la ruta que lo baja."""
    datos = medio(mensaje)
    if datos is None:
        return None
    return {'tipo': datos['tipo'], 'leyenda': datos['leyenda'], 'nombre': datos['nombre'],
            'url': f'/api/inbox/conversaciones/{contacto_id}/mensajes/{mensaje.id}/medio'}


def citas(mensajes, contacto_id):
    """{id del mensaje: {id, texto, direccion, reaccion}} de los que responden o reaccionan a otro."""
    pedidos = {m.id: _citado(_whatsapp(m)) for m in mensajes}
    pedidos = {k: v for k, v in pedidos.items() if v}
    if not pedidos:
        return {}
    citados = {m.mid: m for m in mensajes if m.mid in pedidos.values()}
    faltan = set(pedidos.values()) - set(citados)
    if faltan:
        citados.update({m.mid: m for m in IgMensaje.query.filter(
            IgMensaje.contacto_id == contacto_id, IgMensaje.mid.in_(faltan)).all()})
    por_id = {m.id: m for m in mensajes}
    salida = {}
    for mensaje_id, mid in pedidos.items():
        citado = citados.get(mid)
        salida[mensaje_id] = {
            'id': citado.id if citado else None,
            'texto': citado.texto if citado else None,
            'direccion': citado.direccion if citado else None,
            'reaccion': _whatsapp(por_id[mensaje_id]).get('type') == 'reaction',
        }
    return salida


def descargar(media_id):
    """(bytes, mime). Lanza ErrorDeEnvio si Meta no lo da (más de 30 días, token vencido)."""
    if media_id in _cache:
        _cache.move_to_end(media_id)
        return _cache[media_id]
    datos = ClienteWhatsapp().medio(media_id)
    if len(datos[0]) <= CACHE_BYTES_MAX:
        _cache[media_id] = datos
        while len(_cache) > CACHE_MAX:
            _cache.popitem(last=False)
    return datos
