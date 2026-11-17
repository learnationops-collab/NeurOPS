"""Una persona del equipo le escribe al lead desde el Inbox (17/11/2026): lo que hacía en Kommo.

  · Ventana: dentro de las 24 h del último mensaje del lead sale normal; hasta los 7 días sale con la
    etiqueta HUMAN_AGENT (Meta la permite solo a personas, no al bot); después ya no se puede.
  · Control del hilo: si la conversación es de otra app (Kommo, ManyChat), se toma, se manda y se
    devuelve en el acto. Así Kommo puede seguir escribiendo mientras conviven.
  · El bot se pausa como cuando escribe alguien desde Kommo: el eco de este mensaje llega con el mismo
    `mid` y el motor lo reconoce como propio (`_eco`), así que no se pausa dos veces ni se duplica.
  · El mensaje queda con origen OTRO (persona del equipo, el mismo que los ecos) y su `autor_id`.
"""
from datetime import timedelta

from app import db
from app.automatizaciones.acciones import AccionInvalida
from app.automatizaciones.modelos import IgMensaje
from app.automatizaciones.motor import CORTADA_POR_ECO, VENTANA
from app.automatizaciones.transporte import ErrorDeEnvio

VENTANA_HUMANA = timedelta(days=7)
HUMAN_AGENT = 'HUMAN_AGENT'
LARGO_MAXIMO = 1000  # el tope de texto de un mensaje de Instagram


def ventana(contacto, ahora):
    """'abierta' (24 h), 'humana' (hasta 7 días, con HUMAN_AGENT) o 'cerrada'."""
    ultimo = contacto.ultimo_entrante_en
    if not ultimo:
        return 'cerrada'
    pasado = ahora - ultimo
    if pasado < VENTANA:
        return 'abierta'
    return 'humana' if pasado < VENTANA_HUMANA else 'cerrada'


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


def enviar(motor, contacto, autor_id, texto=None, url_audio=None, nombre_audio=None, pausar=True):
    """Manda el mensaje del equipo y lo deja en la conversación. Devuelve el `IgMensaje`. `pausar=False`
    deja al bot seguir (la casilla del chat)."""
    estado = ventana(contacto, motor.ahora)
    if estado == 'cerrada':
        raise AccionInvalida('Pasaron más de 7 días desde el último mensaje del lead: Instagram no deja escribirle '
                             'hasta que vuelva a escribir')
    cuerpo = cuerpo_de(texto, url_audio)
    if pausar:
        motor.pausar(contacto, CORTADA_POR_ECO)
    try:
        mid = _mandar(motor, contacto, cuerpo, HUMAN_AGENT if estado == 'humana' else None)
    except ErrorDeEnvio as error:
        raise AccionInvalida(f'Instagram no lo aceptó: {error}')
    texto_visible = cuerpo.get('text') or f'🎤 {nombre_audio or "Audio"}'
    mensaje = IgMensaje(contacto_id=contacto.id, mid=mid, direccion=IgMensaje.SALIENTE, origen=IgMensaje.OTRO,
                        texto=texto_visible, contenido=cuerpo, enviado_en=motor.ahora, autor_id=autor_id)
    db.session.add(mensaje)
    db.session.flush()
    return mensaje
