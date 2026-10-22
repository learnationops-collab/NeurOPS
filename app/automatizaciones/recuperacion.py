"""Recuperar los DMs que Meta no mandó por el webhook (22/10/2026).

Con varias apps en la cuenta (ManyChat, Kommo), Meta a veces no le avisa a esta app de un DM: ni por
`messaging` ni por `standby`. Visto el 21-22/10: leads que tocaron el anuncio y nunca recibieron la
tarjeta. Cada RECUPERAR_CADA se piden a la API las conversaciones recientes y cada DM de un lead que
no esté en `ig_mensajes` se guarda como un evento más del webhook (`tipos='recuperado'`). El motor lo
procesa igual que a los demás; si el webhook llega tarde, el `mid` repetido se ignora (motor.py).

No trae el anuncio de Meta (`referral`): la API de conversaciones no lo da.
"""
import logging
from datetime import datetime, timedelta, timezone

from app import db
from app.automatizaciones.modelos import IgContacto, IgMensaje
from app.models.instagram import InstagramWebhookEvento

logger = logging.getLogger(__name__)

RECUPERAR_CADA = timedelta(seconds=60)
# Solo DMs recientes: más viejos ya no se contestan (ANTIGUEDAD_MAXIMA en servicio.py).
VENTANA = timedelta(minutes=15)
MISMO_MENSAJE = timedelta(seconds=5)

_ultima = None


def _momento(texto):
    """'2026-10-22T13:07:01+0000' → datetime UTC naive. None si no se entiende."""
    try:
        return datetime.strptime(texto, '%Y-%m-%dT%H:%M:%S%z').astimezone(timezone.utc).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def _payload(cuenta, igsid, mid, texto, momento):
    """Un evento con la forma del webhook, para que lo lea `nucleo/eventos.leer` sin casos especiales."""
    ms = int(momento.replace(tzinfo=timezone.utc).timestamp() * 1000)
    return {'object': 'instagram', 'recuperado': True, 'entry': [{
        'id': cuenta, 'time': ms,
        'messaging': [{'sender': {'id': igsid}, 'recipient': {'id': cuenta}, 'timestamp': ms,
                       'message': {'mid': mid, 'text': texto}}],
    }]}


def _ya_esta(igsid, texto, enviado):
    """El mismo texto del mismo contacto, a la misma hora: por si el `mid` de la API no es el del webhook."""
    return (db.session.query(IgMensaje.id).join(IgContacto, IgContacto.id == IgMensaje.contacto_id)
            .filter(IgContacto.igsid == igsid, IgMensaje.direccion == IgMensaje.ENTRANTE, IgMensaje.texto == texto,
                    IgMensaje.enviado_en.between(enviado - MISMO_MENSAJE, enviado + MISMO_MENSAJE))
            .first() is not None)


def recuperar(transporte, momento, forzar=False):
    """Guarda como eventos pendientes los DMs de leads que no llegaron por el webhook. Devuelve cuántos."""
    global _ultima
    if not forzar and _ultima is not None and momento - _ultima < RECUPERAR_CADA:
        return 0
    _ultima = momento
    cuenta = transporte.cuenta_id_ig()
    if not cuenta:
        return 0
    nuevos = 0
    for m in transporte.mensajes_recientes():
        mid, emisor, texto = m.get('id'), (m.get('from') or {}).get('id'), m.get('message')
        enviado = _momento(m.get('created_time'))
        # Solo texto del lead: los ecos de la cuenta pausarían el bot como si escribiera el equipo.
        if not (mid and emisor and texto and enviado) or str(emisor) == cuenta or enviado < momento - VENTANA:
            continue
        if IgMensaje.query.filter_by(mid=mid).first() or _ya_esta(str(emisor), texto, enviado):
            continue
        payload = _payload(cuenta, str(emisor), mid, texto, enviado)
        db.session.add(InstagramWebhookEvento(tipos='recuperado', payload=payload))
        nuevos += 1
    if nuevos:
        db.session.commit()
        logger.warning(f'[MOTOR IG] {nuevos} DM(s) recuperados por la API: el webhook no los trajo')
    return nuevos
