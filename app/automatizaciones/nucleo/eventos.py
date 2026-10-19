"""Del payload crudo del webhook de Instagram a eventos simples que entiende el motor.

Un payload trae una o varias `entry`, cada una con `messaging` (DMs, botones, ecos, lecturas) o
`changes` (comentarios). Lo que no le importa al motor (lecturas, reacciones) se descarta acá.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone

MENSAJE = 'mensaje'        # el contacto escribió (texto, adjunto o tocó una respuesta rápida)
BOTON = 'boton'            # el contacto tocó un botón de plantilla (postback)
COMENTARIO = 'comentario'  # el contacto comentó una publicación de la cuenta
ECO = 'eco'                # la cuenta mandó algo (este motor, una persona del equipo u otra app)


@dataclass
class Evento:
    tipo: str
    igsid: str                     # el contacto (en un eco, el destinatario)
    momento: datetime
    mid: str = None
    texto: str = None
    payload: str = None            # botón de plantilla o respuesta rápida
    comentario_id: str = None
    publicacion_id: str = None
    username: str = None
    adjuntos: list = field(default_factory=list)
    anuncio_id: str = None         # el anuncio de Meta del que vino el DM (`referral` con source ADS)


def _momento(marca):
    """Meta manda milisegundos en `messaging` y a veces segundos en `entry.time`."""
    try:
        marca = int(marca)
        segundos = marca / 1000 if marca > 10 ** 11 else marca
        return datetime.fromtimestamp(segundos, tz=timezone.utc).replace(tzinfo=None)
    except (TypeError, ValueError, OverflowError, OSError):
        return datetime.now(timezone.utc).replace(tzinfo=None)


def leer(payload):
    """Eventos en el orden en que llegaron. La cuenta propia se reconoce por `entry.id`."""
    eventos = []
    for entry in (payload or {}).get('entry') or []:
        cuenta = str(entry.get('id') or '')
        for m in entry.get('messaging') or []:
            emisor = str((m.get('sender') or {}).get('id') or '')
            receptor = str((m.get('recipient') or {}).get('id') or '')
            momento = _momento(m.get('timestamp'))
            mensaje = m.get('message') or {}
            if 'message' in m and mensaje.get('is_echo'):
                if mensaje.get('is_deleted') or not receptor:
                    continue
                eventos.append(Evento(ECO, receptor, momento, mid=mensaje.get('mid'), texto=mensaje.get('text'),
                                      adjuntos=mensaje.get('attachments') or []))
            elif 'message' in m:
                if mensaje.get('is_deleted') or not emisor or emisor == cuenta:
                    continue
                referral = mensaje.get('referral') or {}
                anuncio_id = str(referral['ad_id'])[:40] if referral.get('source') == 'ADS' and referral.get('ad_id') else None
                eventos.append(Evento(MENSAJE, emisor, momento, mid=mensaje.get('mid'), texto=mensaje.get('text'),
                                      payload=(mensaje.get('quick_reply') or {}).get('payload'),
                                      adjuntos=mensaje.get('attachments') or [], anuncio_id=anuncio_id))
            elif 'postback' in m and emisor and emisor != cuenta:
                pb = m['postback']
                eventos.append(Evento(BOTON, emisor, momento, mid=pb.get('mid'), texto=pb.get('title'),
                                      payload=pb.get('payload')))
        for cambio in entry.get('changes') or []:
            valor = cambio.get('value') or {}
            autor = valor.get('from') or {}
            if cambio.get('field') != 'comments' or not autor.get('id') or str(autor['id']) == cuenta:
                continue
            eventos.append(Evento(COMENTARIO, str(autor['id']), _momento(entry.get('time')),
                                  texto=valor.get('text'), comentario_id=valor.get('id'),
                                  publicacion_id=(valor.get('media') or {}).get('id'), username=autor.get('username')))
    return eventos
