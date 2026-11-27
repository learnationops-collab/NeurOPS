"""Los eventos del webhook de WhatsApp, al Inbox y a las difusiones.

  · Mensaje entrante: el contacto es un `IgContacto` con `igsid = 'wa:<número>'` (así lo ven la bandeja, la
    conversación y el reparto igual que uno de Instagram). Abre la ventana de 24 h y queda como `IgMensaje`
    del lead. Si respondió a un broadcast, su `WaEnvio` pasa a «respondió» (con lo que escribió) y el contacto
    se marca con `variables.origen = 'broadcast'` y la plantilla (para medir de dónde vienen los leads).
  · Si el contacto no tiene setter, se le asigna al setter activo con menos WhatsApp nuevos en 24 h.
  · Estado de un mensaje enviado (sent/delivered/read/failed): actualiza su `WaEnvio`.
  · Con el motor (`motor`, lo pasa el reloj en modo real), el mensaje sigue por `flujos.py`. Sin motor solo se guarda.
"""
import logging
from datetime import datetime, timedelta

from app import db
from app.automatizaciones.modelos import IgContacto, IgMensaje
from app.automatizaciones.reparto import setters_activos
from app.models.tag import TARGET_IG_CONTACT
from app.models.whatsapp import WaEnvio, WhatsappWebhookEvento
from app.models.whatsapp_taller import WaPasoTaller
from app.services import tags_service
from app.whatsapp import audiencia, plantilla_en_chat
from app.whatsapp.cliente import PREFIJO, variantes

logger = logging.getLogger(__name__)

ESTADOS_META = {'sent': WaEnvio.ENVIADO, 'delivered': WaEnvio.ENTREGADO, 'read': WaEnvio.LEIDO, 'failed': WaEnvio.FALLO}
SIN_TEXTO = {'image': '📷 Imagen', 'audio': '🎤 Audio', 'video': '🎬 Video', 'document': '📄 Documento',
             'sticker': 'Sticker', 'location': '📍 Ubicación', 'contacts': '👤 Contacto',
             # Lo que la API no entrega (encuesta, «ver una vez», editado…): se ve solo en el teléfono.
             'unsupported': '⚠️ Mensaje que WhatsApp no deja ver acá: miralo en el teléfono',
             'reaction': '👍 Reacción'}


def texto_de(mensaje):
    tipo = mensaje.get('type')
    if tipo == 'text':
        return (mensaje.get('text') or {}).get('body') or ''
    if tipo == 'button':
        return (mensaje.get('button') or {}).get('text') or ''
    if tipo == 'interactive':
        interactivo = mensaje.get('interactive') or {}
        respuesta = interactivo.get('button_reply') or interactivo.get('list_reply') or {}
        return respuesta.get('title') or ''
    if tipo == 'reaction':
        return (mensaje.get('reaction') or {}).get('emoji') or ''
    leyenda = (mensaje.get(tipo) or {}).get('caption') if isinstance(mensaje.get(tipo), dict) else None
    base = SIN_TEXTO.get(tipo, f'Mensaje de tipo «{tipo}» que no se puede mostrar')
    return f'{base}: {leyenda}' if leyenda else base


def _setter_con_menos_carga(ahora):
    candidatos = setters_activos()
    if not candidatos:
        return None
    filas = (db.session.query(IgContacto.setter_id, db.func.count(IgContacto.id))
             .filter(IgContacto.igsid.like(f'{PREFIJO}%'), IgContacto.asignado_en >= ahora - timedelta(hours=24),
                     IgContacto.setter_id.in_([u.id for u in candidatos]))
             .group_by(IgContacto.setter_id).all())
    carga = dict(filas)
    return min(candidatos, key=lambda u: (carga.get(u.id, 0), u.id))


def _contacto(telefono, nombre, ahora):
    # El broadcast de un taller crea el contacto con el número del CSV (54…, 52…), que puede ser la otra forma
    # del que responde (549…, 521…): se busca por las dos (ADR-W259).
    contacto = audiencia.contacto_wa(telefono, nombre, ahora)
    # El nombre de su perfil de WhatsApp es con el que se le escribe (ADR-W271): se guarda aparte y al día.
    if nombre and (contacto.variables or {}).get('nombre_whatsapp') != nombre:
        contacto.variables = {**(contacto.variables or {}), 'nombre_whatsapp': nombre}
    if contacto.setter_id is None:
        setter = _setter_con_menos_carga(ahora)
        if setter:
            contacto.setter_id, contacto.asignado_en = setter.id, ahora
    return contacto


def _marcar_envio(contacto, telefono, texto, ahora):
    envio = (WaEnvio.query.filter(WaEnvio.telefono.in_(variantes(telefono)), WaEnvio.enviado_en.isnot(None))
             .order_by(WaEnvio.enviado_en.desc()).first())
    if envio is None:
        return
    if envio.estado != WaEnvio.RESPONDIO:
        envio.estado, envio.actualizado_en = WaEnvio.RESPONDIO, ahora
        envio.respuesta = (texto or '')[:200] or None
    envio.contacto_id = contacto.id
    # Un mensaje común de un paso (ADR-W266) ya quedó en el chat al salir, y no es una plantilla: los botones que
    # toque después siguen siendo los de la última plantilla que recibió.
    if envio.plantilla == WaEnvio.MENSAJE:
        return
    plantilla_en_chat.registrar(contacto, envio)
    variables = dict(contacto.variables or {})
    if variables.get('broadcast') != envio.lote:
        # El nombre con que el Inbox agrupa: la etiqueta del taller o «Broadcast» si salió a mano.
        paso = db.session.get(WaPasoTaller, envio.paso_id) if envio.paso_id else None
        variables.update(origen='broadcast', broadcast=envio.lote, plantilla=envio.plantilla,
                         broadcast_nombre=(paso.plan.etiqueta if paso else None) or 'Broadcast')
        contacto.variables = variables


def _entrante(mensaje, nombres, ahora, motor=None):
    wamid = mensaje.get('id')
    if wamid and IgMensaje.query.filter_by(mid=wamid).first():
        return 'repetido'
    telefono = mensaje.get('from')
    contacto = _contacto(telefono, nombres.get(telefono), ahora)
    momento = datetime.utcfromtimestamp(int(mensaje['timestamp'])) if mensaje.get('timestamp') else ahora
    contacto.ultimo_entrante_en = max(contacto.ultimo_entrante_en or momento, momento)
    entrante = IgMensaje(contacto_id=contacto.id, mid=wamid, direccion=IgMensaje.ENTRANTE,
                         origen=IgMensaje.LEAD, texto=texto_de(mensaje), contenido={'whatsapp': mensaje},
                         enviado_en=momento)
    db.session.add(entrante)
    db.session.flush()
    _marcar_envio(contacto, telefono, entrante.texto, ahora)
    if audiencia.es_baja(entrante.texto):
        tags_service.poner(TARGET_IG_CONTACT, contacto.id, None, audiencia.ETIQUETA_BAJA, None)
    if motor is None:
        return 'mensaje'
    from app.whatsapp import flujos
    return flujos.procesar(motor, contacto, entrante, mensaje)


def _estado(estado, ahora):
    envio = WaEnvio.query.filter_by(wamid=estado.get('id')).first()
    if envio is None:
        return 'estado_ajeno'
    nuevo = ESTADOS_META.get(estado.get('status'))
    if nuevo and WaEnvio.ORDEN[nuevo] > WaEnvio.ORDEN[envio.estado]:
        envio.estado, envio.actualizado_en = nuevo, ahora
        if nuevo == WaEnvio.FALLO:
            error = (estado.get('errors') or [{}])[0]
            envio.error = f"{error.get('code')}: {error.get('title') or error.get('message')}"[:300]
    return f"estado_{estado.get('status')}"


def procesar(evento, ahora=None, motor=None):
    """Pasa un `WhatsappWebhookEvento` y lo marca procesado. Un error queda en `resultado` (se puede reprocesar)."""
    ahora = motor.ahora if motor else (ahora or datetime.utcnow())
    resultados = []
    try:
        for entry in evento.payload.get('entry') or []:
            for cambio in entry.get('changes') or []:
                valor = cambio.get('value') or {}
                nombres = {c.get('wa_id'): (c.get('profile') or {}).get('name') for c in valor.get('contacts') or []}
                resultados += [_entrante(m, nombres, ahora, motor) for m in valor.get('messages') or []]
                resultados += [_estado(s, ahora) for s in valor.get('statuses') or []]
        evento.resultado = ','.join(dict.fromkeys(resultados))[:200] or 'sin_eventos'
    except Exception as error:  # el evento queda guardado: se reprocesa después
        db.session.rollback()
        logger.exception('[WHATSAPP] Error procesando el evento %s', evento.id)
        evento = db.session.get(WhatsappWebhookEvento, evento.id)
        evento.resultado = f'error: {error}'[:200]
    evento.procesado_en = ahora
    db.session.commit()


def procesar_pendientes(motor=None, limite=200):
    pendientes = (WhatsappWebhookEvento.query.filter(WhatsappWebhookEvento.procesado_en.is_(None))
                  .order_by(WhatsappWebhookEvento.id).limit(limite).all())
    for evento in pendientes:
        procesar(evento, motor=motor)
    return len(pendientes)
