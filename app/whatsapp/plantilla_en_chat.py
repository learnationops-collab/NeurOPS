"""El mensaje del broadcast en el chat: cuando el lead responde, la plantilla que recibió queda como primer
mensaje saliente (con su nombre y los botones al pie), para que el setter vea a qué está respondiendo.

El texto de la plantilla sale de Meta (una vez por proceso; una plantilla nueva fuerza otra lectura). Su `mid`
es el `wamid` del envío: se agrega una sola vez.
"""
import logging

from app import db
from app.automatizaciones.modelos import IgMensaje
from app.automatizaciones.transporte import ErrorDeEnvio
from app.whatsapp.cliente import ClienteWhatsapp

logger = logging.getLogger(__name__)

_PLANTILLAS = {}  # nombre -> (cuerpo, botones)


def _leer_plantillas():
    try:
        plantillas = ClienteWhatsapp().plantillas()
    except ErrorDeEnvio as error:
        logger.error(f'[WHATSAPP] No se pudieron leer las plantillas: {error}')
        return
    for p in plantillas:
        componentes = p.get('components') or []
        cuerpo = next((c.get('text') or '' for c in componentes if c.get('type') == 'BODY'), '')
        botones = [b.get('text') for c in componentes if c.get('type') == 'BUTTONS' for b in c.get('buttons') or []]
        _PLANTILLAS[p['name']] = (cuerpo, [b for b in botones if b])


def texto(envio):
    """El mensaje como lo vio el lead, o None si la plantilla ya no está en Meta."""
    if envio.plantilla not in _PLANTILLAS:
        _leer_plantillas()
    if envio.plantilla not in _PLANTILLAS:
        return None
    from app.whatsapp.envios import _primer_nombre
    cuerpo, botones = _PLANTILLAS[envio.plantilla]
    if envio.con_nombre:
        cuerpo = cuerpo.replace('{{1}}', _primer_nombre(envio.nombre))
    pie = '  '.join(f'[{b}]' for b in botones)
    return f'{cuerpo}\n\n{pie}' if pie else cuerpo


def registrar(contacto, envio):
    """Agrega el mensaje del broadcast al chat del contacto, si todavía no está."""
    if not envio.wamid or not envio.enviado_en or IgMensaje.query.filter_by(mid=envio.wamid).first():
        return
    contenido = texto(envio)
    if contenido is None:
        return
    db.session.add(IgMensaje(contacto_id=contacto.id, mid=envio.wamid, direccion=IgMensaje.SALIENTE,
                             origen=IgMensaje.OTRO, texto=contenido, autor_id=envio.enviado_por_id,
                             contenido={'broadcast': {'lote': envio.lote, 'plantilla': envio.plantilla}},
                             enviado_en=envio.enviado_en))
