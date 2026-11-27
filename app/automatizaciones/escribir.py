"""Una persona del equipo le escribe al lead desde el Inbox (17/11/2026): lo que hacía en Kommo.

  · Ventana: dentro de las 24 h del último mensaje del lead sale normal; hasta los 7 días sale con la
    etiqueta HUMAN_AGENT (Meta la permite solo a personas, no al bot, y solo si aprobó la función en la App
    Review: `IG_HUMAN_AGENT`, ADR-W281); después ya no se puede.
  · Control del hilo: si la conversación es de otra app (Kommo, ManyChat), se toma, se manda y se
    devuelve en el acto. Así Kommo puede seguir escribiendo mientras conviven.
  · El bot se pausa como cuando escribe alguien desde Kommo: el eco de este mensaje llega con el mismo
    `mid` y el motor lo reconoce como propio (`_eco`), así que no se pausa dos veces ni se duplica.
  · El mensaje queda con origen OTRO (persona del equipo, el mismo que los ecos) y su `autor_id`.
"""
import os
from datetime import timedelta

from app import db
from app.automatizaciones.acciones import AccionInvalida
from app.automatizaciones.modelos import IgMensaje
from app.automatizaciones.motor import CORTADA_POR_ECO, VENTANA
from app.automatizaciones.transporte import ErrorDeEnvio

VENTANA_HUMANA = timedelta(days=7)
HUMAN_AGENT = 'HUMAN_AGENT'
LARGO_MAXIMO = 1000  # el tope de texto de un mensaje de Instagram
YA_ENTREGADO = timedelta(minutes=2)


SOLO_INSTAGRAM = ('Pasaron más de 24 h desde el último mensaje del lead: desde Work ya no sale. Mandalo desde '
                  'Instagram y marcalo como seguimiento')
# Un seguimiento programado sale solo: HUMAN_AGENT es para una persona que manda en el momento (ADR-W282).
PROGRAMADO_FUERA = ('Un seguimiento programado sale solo y pasadas las 24 h desde su último mensaje solo puede '
                    'escribirle una persona en el momento: elegí antes o escribile vos cuando toque')


def human_agent_aprobado():
    """Meta solo acepta HUMAN_AGENT si aprobó la función en la App Review (ADR-W281). Hasta entonces
    IG_HUMAN_AGENT queda apagada y la ventana de Work es de 24 h."""
    return (os.environ.get('IG_HUMAN_AGENT') or '').strip().lower() in ('1', 'true', 'si', 'sí')


def ventana(contacto, ahora):
    """'abierta' (24 h), 'humana' (hasta 7 días, con HUMAN_AGENT), 'instagram' (Work no puede, la app de
    Instagram sí: falta la aprobación de HUMAN_AGENT) o 'cerrada'."""
    ultimo = contacto.ultimo_entrante_en
    if not ultimo:
        return 'cerrada'
    pasado = ahora - ultimo
    if pasado < VENTANA:
        return 'abierta'
    if pasado >= VENTANA_HUMANA:
        return 'cerrada'
    return 'humana' if human_agent_aprobado() else 'instagram'


def cuerpo_de(texto=None, url_audio=None):
    if url_audio:
        return {'attachment': {'type': 'audio', 'payload': {'url': url_audio}}}
    texto = (texto or '').strip()
    if not texto:
        raise AccionInvalida('Escribí un mensaje')
    if len(texto) > LARGO_MAXIMO:
        raise AccionInvalida(f'El mensaje pasa de {LARGO_MAXIMO} caracteres')
    return {'text': texto}


def _mandar(motor, contacto, cuerpo, etiqueta):
    """Manda; si el hilo es de otra app, toma el control, manda y lo devuelve."""
    transporte = motor.transporte
    destinatario = {'id': contacto.igsid}
    try:
        return transporte.enviar(destinatario, cuerpo, etiqueta=etiqueta)
    except ErrorDeEnvio as error:
        if not error.sin_control or not transporte.tomar_control(contacto.igsid):
            raise
    try:
        return transporte.enviar(destinatario, cuerpo, etiqueta=etiqueta)
    finally:
        transporte.liberar_control(contacto.igsid)


def _por_whatsapp(contacto, cuerpo, ahora):
    """WhatsApp no tiene HUMAN_AGENT: fuera de las 24 h solo se puede con una plantilla."""
    from app.whatsapp.cliente import ClienteWhatsapp, telefono_de
    if ventana(contacto, ahora) != 'abierta':
        raise AccionInvalida('Pasaron más de 24 h desde el último mensaje del lead: WhatsApp solo deja escribirle '
                             'con una plantilla aprobada')
    cliente, telefono = ClienteWhatsapp(), telefono_de(contacto.igsid)
    try:
        if 'attachment' in cuerpo:
            return cliente.audio(telefono, cuerpo['attachment']['payload']['url'])
        return cliente.texto(telefono, cuerpo['text'])
    except ErrorDeEnvio as error:
        raise AccionInvalida(f'WhatsApp no lo aceptó: {error}')


def enviar(motor, contacto, autor_id, texto=None, url_audio=None, nombre_audio=None, pausar=True, guia=None,
           a_mano=True):
    """Manda el mensaje del equipo y lo deja en la conversación. Devuelve el `IgMensaje`. `pausar=False`
    deja al bot seguir (la casilla del chat). `guia`: el paso de la Guía que se mandó (ADR-W197).
    `a_mano=False` (un seguimiento programado): nunca con HUMAN_AGENT."""
    from app.whatsapp.cliente import es_whatsapp
    if es_whatsapp(contacto.igsid):
        cuerpo = cuerpo_de(texto, url_audio)
        mid = _por_whatsapp(contacto, cuerpo, motor.ahora)
        if pausar:  # WhatsApp no manda ecos: la pausa va acá, una vez que salió
            motor.pausar(contacto, CORTADA_POR_ECO)
        return _guardar(contacto, mid, cuerpo, autor_id, nombre_audio, guia, motor.ahora)
    estado = ventana(contacto, motor.ahora)
    if estado == 'cerrada':
        raise AccionInvalida('Pasaron más de 7 días desde el último mensaje del lead: Instagram no deja escribirle '
                             'hasta que vuelva a escribir')
    if estado != 'abierta' and not a_mano:
        raise AccionInvalida(PROGRAMADO_FUERA)
    if estado == 'instagram':
        raise AccionInvalida(SOLO_INSTAGRAM)
    cuerpo = cuerpo_de(texto, url_audio)
    if pausar:
        motor.pausar(contacto, CORTADA_POR_ECO)
    ya = _ya_entregado(contacto, cuerpo, motor.ahora)
    if ya:
        ya.autor_id, ya.guia = autor_id, guia
        db.session.flush()
        return ya
    try:
        mid = _mandar(motor, contacto, cuerpo, HUMAN_AGENT if estado == 'humana' else None)
    except ErrorDeEnvio as error:
        if estado == 'humana' and 'tag' in str(error).lower():  # IG_HUMAN_AGENT prendida sin la aprobación de Meta
            raise AccionInvalida(SOLO_INSTAGRAM)
        raise AccionInvalida(f'Instagram no lo aceptó: {error}')
    return _guardar(contacto, mid, cuerpo, autor_id, nombre_audio, guia, motor.ahora)


def _ya_entregado(contacto, cuerpo, ahora):
    """El mismo texto que Instagram ya entregó hace un momento y quedó sin autor (llegó solo su eco). Pasa cuando
    Meta devuelve error pero el mensaje sale igual (conversación de otra app): reintentar lo mandaba dos veces."""
    texto = cuerpo.get('text')
    if not texto:
        return None
    return IgMensaje.query.filter(
        IgMensaje.contacto_id == contacto.id, IgMensaje.direccion == IgMensaje.SALIENTE,
        IgMensaje.origen == IgMensaje.OTRO, IgMensaje.autor_id.is_(None), IgMensaje.texto == texto,
        IgMensaje.enviado_en >= ahora - YA_ENTREGADO,
    ).order_by(IgMensaje.enviado_en.desc()).first()


def _guardar(contacto, mid, cuerpo, autor_id, nombre_audio, guia, ahora):
    texto_visible = cuerpo.get('text') or f'🎤 {nombre_audio or "Audio"}'
    mensaje = IgMensaje(contacto_id=contacto.id, mid=mid, direccion=IgMensaje.SALIENTE, origen=IgMensaje.OTRO,
                        texto=texto_visible, contenido=cuerpo, enviado_en=ahora, autor_id=autor_id,
                        guia=guia)
    db.session.add(mensaje)
    db.session.flush()
    return mensaje
