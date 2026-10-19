"""Lo que el motor deja para los tableros de hoy: las mismas filas que el webhook de ManyChat (19/10/2026).

Rendimiento, Entrantes, Conversaciones, «Mis agendas» y los números del setter leen `ManychatLead` y
`LeadAnswer` (ver `app/api/manychat.py`). Para que apagar ManyChat no los deje sin datos, el motor las
escribe con el mismo significado, sin pasar por el webhook ni tocarlo:

  · La persona: un `ManychatLead` con `manychat_id = 'ig:<IGSID>'`, su nombre y su usuario de Instagram
    (por el usuario la encuentra «Mis agendas»).
  · La entrada: al empezar el flujo, una `LeadAnswer` con la palabra clave y su anuncio
    (`anuncio_de_keyword`, como el webhook: si la palabra es nueva crea el anuncio).
  · Cada mensaje del flujo con `registro.mensaje_id` (el id del catálogo de Conversaciones): su envío
    (`id_option = '0'`, `id_option_send = id`). El primero completa la fila de la entrada, como el
    Opening de ManyChat trae la palabra clave. Si el lead lo responde (botón o texto), `id_option = id`.
  · La calificación: `registro.califica` del nodo, la acción «califica», o si no la rama del mensaje
    (`rama_mensajes`, la misma regla que el webhook). La etapa (`registro.etapa` o la acción) va a
    `ManychatLead.last_stage`.

Solo registra lo que entró por una campaña: mientras conviva ManyChat, un flujo con disparador propio
(las pruebas) no cuenta dos veces a la misma persona.
"""
from app import db
from app.models import LeadAnswer, ManychatLead

PREFIJO = 'ig:'


def _activo(ejecucion):
    return ejecucion.campana_id is not None


def _lead(contacto):
    manychat_id = f'{PREFIJO}{contacto.igsid}'
    lead = ManychatLead.query.filter_by(manychat_id=manychat_id).first()
    if lead is None:
        lead = ManychatLead(manychat_id=manychat_id, follower=False)
        db.session.add(lead)
    if contacto.nombre:
        lead.name = contacto.nombre[:150]
    if contacto.username:
        lead.ig = contacto.username[:100]
    db.session.flush()
    return lead


def _filas(ejecucion, lead):
    """Las filas de esta ejecución: las de la persona desde que empezó, la más nueva primero."""
    return (LeadAnswer.query.filter(LeadAnswer.lead_id == lead.id, LeadAnswer.created_at >= ejecucion.iniciada_en)
            .order_by(LeadAnswer.created_at.desc(), LeadAnswer.id.desc()))


def _mensaje_id(nodo):
    valor = ((nodo or {}).get('registro') or {}).get('mensaje_id')
    return str(valor).strip()[:100] if valor not in (None, '') else None


def _etapa(lead, valor):
    try:
        lead.last_stage = int(valor)
    except (TypeError, ValueError):
        pass


def entrada(ejecucion, momento):
    """La fila con la que la persona cuenta como entrante de esa palabra clave."""
    if not _activo(ejecucion):
        return
    from app.services.anuncios_service import anuncio_de_keyword

    lead = _lead(ejecucion.contacto)
    anuncio = anuncio_de_keyword(ejecucion.clave)
    db.session.add(LeadAnswer(lead_id=lead.id, ad_id=anuncio.id if anuncio else None, keyword=ejecucion.clave,
                              qualification='null', created_at=momento, updated_at=momento))
    db.session.flush()


def envio(ejecucion, nodo, momento):
    """El envío de un mensaje registrado del flujo."""
    mensaje_id = _mensaje_id(nodo)
    if not (_activo(ejecucion) and mensaje_id):
        return
    from app.services import rama_mensajes

    lead = _lead(ejecucion.contacto)
    ultima = _filas(ejecucion, lead).first()
    if ultima is not None and not ultima.id_option_send:
        fila = ultima
    else:
        fila = LeadAnswer(lead_id=lead.id, ad_id=ultima.ad_id if ultima else None, keyword=ejecucion.clave,
                          qualification='null', created_at=momento)
        db.session.add(fila)
    fila.id_option, fila.id_option_send, fila.updated_at = '0', mensaje_id, momento
    registro = nodo.get('registro') or {}
    if isinstance(registro.get('califica'), bool):
        fila.qualification = 'true' if registro['califica'] else 'false'
    if registro.get('etapa') is not None:
        _etapa(lead, registro['etapa'])
    db.session.flush()
    if fila.qualification not in rama_mensajes.CON_DATO:
        rama_mensajes.aplicar_a(fila)
    if fila.qualification in rama_mensajes.CON_DATO:
        ejecucion.califica = fila.qualification == 'true'


def respuesta(ejecucion, nodo, momento):
    """La persona respondió el mensaje registrado del nodo (tocó un botón o escribió)."""
    mensaje_id = _mensaje_id(nodo)
    if not (_activo(ejecucion) and mensaje_id):
        return
    lead = _lead(ejecucion.contacto)
    fila = _filas(ejecucion, lead).filter(LeadAnswer.id_option_send == mensaje_id).first()
    if fila is not None:
        fila.id_option, fila.updated_at = mensaje_id, momento


def calificar(ejecucion, califica, momento):
    """La acción «califica» del flujo: manda sobre la rama, como el sí o no de ManyChat."""
    if not _activo(ejecucion):
        return
    ejecucion.califica = bool(califica)
    fila = _filas(ejecucion, _lead(ejecucion.contacto)).first()
    if fila is not None:
        fila.qualification = 'true' if califica else 'false'
        fila.calificacion_por_rama, fila.updated_at = False, momento


def etapa(ejecucion, valor):
    if _activo(ejecucion):
        _etapa(_lead(ejecucion.contacto), valor)
