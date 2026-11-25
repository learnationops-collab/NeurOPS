"""Lo que entra por WhatsApp y le toca al motor de flujos.

WhatsApp no pasa por las campañas ni por la campaña por defecto de Instagram: un «hola» de alguien del
broadcast no arranca la bienvenida. Al motor le llegan tres cosas:

  · Un botón de un mensaje del flujo (el `id` es el payload del motor): sigue ese recorrido.
  · Un botón de la plantilla de la difusión. La plantilla ES el primer mensaje del flujo de la difusión:
    ese nodo no se manda, y sus botones se llaman igual que los de la plantilla. Tocar «Sí, tengo
    conocidos» sigue por el botón del nodo de inicio que tiene ese título.
  · La respuesta escrita a un paso que espera texto (o el título de un botón escrito a mano).

Lo demás (texto libre sin flujo esperando) queda para el setter: es lo que aparece en «Esperan respuesta».
"""
from app import db
from app.automatizaciones.modelos import AutEjecucion, AutFlujo, AutFlujoVersion
from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.nucleo import mensajes
from app.models.whatsapp import WaDifusion


def payload_de(mensaje):
    tipo = mensaje.get('type')
    if tipo == 'button':
        return (mensaje.get('button') or {}).get('payload')
    if tipo == 'interactive':
        interactivo = mensaje.get('interactive') or {}
        return (interactivo.get('button_reply') or interactivo.get('list_reply') or {}).get('id')
    return None


def _boton_de_plantilla(destino, texto):
    """(version_id, nodo_id, boton_id) del botón del nodo de inicio cuyo título es `texto`; si no, None."""
    difusion = db.session.get(WaDifusion, destino.difusion_id) if destino else None
    flujo = db.session.get(AutFlujo, difusion.flujo_id) if difusion and difusion.flujo_id else None
    if flujo is None or flujo.estado != AutFlujo.ACTIVO or flujo.version_publicada is None:
        return None
    version = flujo.version_publicada
    inicio = g.nodos_por_id(version.grafo).get(version.grafo.get('inicio')) or {}
    escrito = g.normalizar_texto(texto)
    boton = next((b for b in inicio.get('botones') or [] if g.normalizar_texto(b.get('titulo')) == escrito), None)
    return (version.id, inicio['id'], boton['id']) if boton else None


def _ya_arranco(contacto, version_id, destino):
    flujo_id = db.session.get(AutFlujoVersion, version_id).flujo_id
    return (AutEjecucion.query.join(AutFlujoVersion, AutFlujoVersion.id == AutEjecucion.version_id)
            .filter(AutEjecucion.contacto_id == contacto.id, AutFlujoVersion.flujo_id == flujo_id,
                    AutEjecucion.iniciada_en >= destino.enviado_en).first() is not None)


def procesar(motor, contacto, entrante, mensaje, destino):
    """Pasa el mensaje por el motor. `entrante`: el `IgMensaje` ya guardado; `destino`: la difusión que le llegó."""
    motor._entrante = entrante
    pausado = bool(contacto.bot_pausado_hasta and contacto.bot_pausado_hasta > motor.ahora)
    datos = mensajes.leer_payload(payload_de(mensaje))
    if datos is None and mensaje.get('type') == 'button':
        datos = _boton_de_plantilla(destino, entrante.texto)
        if datos and _ya_arranco(contacto, datos[0], destino):
            return 'boton_usado'  # los botones de la plantilla valen una vez por envío
    if datos:
        return motor._boton(contacto, *datos, pausado=pausado)
    if pausado:
        return 'bot_pausado'
    abierta = motor._abierta(contacto)
    if abierta and abierta.estado == AutEjecucion.ESPERANDO_RESPUESTA and entrante.texto:
        return motor._respuesta(abierta, _Escrito(entrante.texto))
    return 'para_el_setter'


class _Escrito:
    """Lo único que `Motor._respuesta` lee del evento."""

    def __init__(self, texto):
        self.texto = texto
