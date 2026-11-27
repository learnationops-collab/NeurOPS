"""Qué pasa cuando tocan un botón de una plantilla (`WaRespuestaBoton`, pestaña Plantillas del broadcast).

  · Un botón de la plantilla llega como `type: button` con su texto. La plantilla es la del broadcast que recibió
    ese número (`variables.plantilla`, la marca `entrantes._marcar_envio`).
  · El mensaje que sale puede llevar sus botones (interactivos, hasta 3 de 20 caracteres). Su `id` es
    `WAP|plantilla|botón de la plantilla que sigue|n|botón de origen`: tocarlo sigue la respuesta de ese botón
    (vacío: queda para el setter). O un solo botón que abre un link (`url`, mensaje `cta_url`, ADR-W260).
  · Además de contestar, asigna la conversación y le pone la etiqueta (suelta, sin grupo).
  · El mensaje puede esperar `demora_segundos`: queda en `WaRespuestaPendiente`; una espera corta la manda un hilo
    a su hora (el reloj del motor corre una vez por minuto) y, si el proceso se reinicia, la manda el reloj.
  · Con opción única (`WaPlantillaConfig`), un mensaje admite una sola elección por envío: tocar otro de sus botones
    contesta «ya elegiste» y no sigue. La elección queda en `variables.elecciones` ({"lote|origen": botón}).
`{nombre}` en el texto pasa a ser el primer nombre del lead. Sin regla para ese botón el toque queda para el setter.
"""
import logging
import re
import threading
from datetime import datetime, timedelta

from app import db
from app.automatizaciones.modelos import IgContacto, IgMensaje
from app.automatizaciones.transporte import ErrorDeEnvio
from app.models.tag import TARGET_IG_CONTACT
from app.models.user import User
from app.models.whatsapp import WaEnvio, WaPlantillaConfig, WaRespuestaBoton, WaRespuestaPendiente
from app.services import tags_service
from app.whatsapp.cliente import ClienteWhatsapp, telefono_de
from app.whatsapp.transporte import _interactivo

logger = logging.getLogger(__name__)

PREFIJO_ID = 'WAP|'
MAX_BOTONES = 3
LARGO_BOTON = 20
LARGO_TEXTO = 1024
MAX_DEMORA = 3600
DEMORA_CORTA = 90  # hasta acá la manda un hilo a su hora; más larga, el reloj del motor
URL = re.compile(r'^https?://\S+$')
REPETIDA = 'Ya elegiste «{opcion}» 🙌'


def boton_tocado(contacto, mensaje):
    """{plantilla, sigue, origen, elegido} del toque, o None si no es de una plantilla ni de una de sus respuestas.
    `sigue`: el botón de la plantilla cuya regla se aplica (None: queda para el setter). `origen`: el botón cuya
    respuesta trajo este (vacío: la plantilla misma). `elegido`: lo que tocó."""
    if mensaje.get('type') == 'button':
        plantilla = (contacto.variables or {}).get('plantilla')
        texto = (mensaje.get('button') or {}).get('text')
        return {'plantilla': plantilla, 'sigue': texto, 'origen': '', 'elegido': texto} if plantilla and texto else None
    if mensaje.get('type') == 'interactive':
        respuesta = (mensaje.get('interactive') or {}).get('button_reply') or {}
        id_ = respuesta.get('id') or ''
        if id_.startswith(PREFIJO_ID):
            partes = id_.split('|')
            if len(partes) >= 3 and partes[1]:
                return {'plantilla': partes[1], 'sigue': partes[2] or None, 'origen': partes[4] if len(partes) > 4 else '?',
                        'elegido': respuesta.get('title') or (partes[3] if len(partes) > 3 else '')}
    return None


def con_nombre(texto, nombre):
    """`{nombre}` pasa a ser el primer nombre; sin nombre se va con la coma o el espacio de antes."""
    primero = (nombre or '').strip().split(' ')[0].title()
    return texto.replace('{nombre}', primero) if primero else re.sub(r',?\s*\{nombre\}', '', texto)


def _nombre_de(contacto):
    """El nombre del CSV del broadcast (el real) y, si no hay, el de su perfil de WhatsApp."""
    envio = WaEnvio.query.filter_by(contacto_id=contacto.id).order_by(WaEnvio.id.desc()).first()
    return (envio.nombre if envio else None) or contacto.nombre


def cuerpo_de(regla, texto=None):
    """Lo que sale para esa regla, en el formato de la Cloud API (sin `to`)."""
    texto = texto or regla.texto
    botones = regla.botones or []
    if not botones:
        return {'type': 'text', 'text': {'body': texto, 'preview_url': True}}
    if botones[0].get('url'):
        return {'type': 'interactive', 'interactive': {
            'type': 'cta_url', 'body': {'text': texto[:LARGO_TEXTO]},
            'action': {'name': 'cta_url', 'parameters': {'display_text': botones[0]['titulo'][:LARGO_BOTON],
                                                         'url': botones[0]['url']}}}}
    opciones = [(b['titulo'], f"{PREFIJO_ID}{regla.plantilla}|{b.get('va_a') or ''}|{i}|{regla.boton}")
                for i, b in enumerate(botones)]
    return _interactivo(texto, opciones)


def _guardar_saliente(contacto, mid, texto, cuerpo, ahora):
    db.session.add(IgMensaje(contacto_id=contacto.id, mid=mid, direccion=IgMensaje.SALIENTE, origen=IgMensaje.MOTOR,
                             texto=texto, contenido={'whatsapp': cuerpo}, enviado_en=ahora))
    db.session.flush()


def _mandar(contacto, regla, ahora):
    texto = con_nombre(regla.texto, _nombre_de(contacto))
    cuerpo = cuerpo_de(regla, texto)
    try:
        mid = ClienteWhatsapp().mandar(telefono_de(contacto.igsid), cuerpo)
    except ErrorDeEnvio as error:
        logger.error(f'[WHATSAPP] Respuesta al botón «{regla.boton}» de {regla.plantilla}: {error}')
        return 'boton_plantilla_fallo'
    _guardar_saliente(contacto, mid, texto, cuerpo, ahora)
    return 'boton_plantilla'


def _ya_eligio(contacto, tocado, ahora):
    """Con opción única: el texto «ya elegiste» si en ese mensaje ya eligió otra cosa; si no, anota la elección."""
    config = WaPlantillaConfig.query.filter_by(plantilla=tocado['plantilla']).first()
    if not (config and config.opcion_unica):
        return None
    variables = dict(contacto.variables or {})
    clave = f"{variables.get('broadcast') or ''}|{tocado['origen']}"
    elecciones = dict(variables.get('elecciones') or {})
    previa = elecciones.get(clave)
    if previa and previa != tocado['elegido']:
        return (config.texto_repetida or REPETIDA).replace('{opcion}', previa)
    if previa is None:
        elecciones[clave] = tocado['elegido']
        variables['elecciones'] = elecciones
        contacto.variables = variables
    return None


def _contestar_repetida(contacto, texto, ahora):
    texto = con_nombre(texto, _nombre_de(contacto))
    cuerpo = {'type': 'text', 'text': {'body': texto, 'preview_url': True}}
    try:
        mid = ClienteWhatsapp().mandar(telefono_de(contacto.igsid), cuerpo)
    except ErrorDeEnvio as error:
        logger.error(f'[WHATSAPP] «Ya elegiste» a {contacto.id}: {error}')
        return 'opcion_repetida_fallo'
    _guardar_saliente(contacto, mid, texto, cuerpo, ahora)
    return 'opcion_repetida'


def responder(contacto, mensaje, ahora):
    """Aplica la regla del botón tocado. Devuelve el resultado o None si queda para el setter."""
    tocado = boton_tocado(contacto, mensaje)
    if tocado is None:
        return None
    repetida = _ya_eligio(contacto, tocado, ahora)
    if repetida:
        return _contestar_repetida(contacto, repetida, ahora)
    regla = (WaRespuestaBoton.query.filter_by(plantilla=tocado['plantilla'], boton=tocado['sigue']).first()
             if tocado['sigue'] else None)
    if regla is None:
        return None
    if regla.asignar_a:
        usuario = db.session.get(User, regla.asignar_a)
        if usuario and usuario.is_active:
            contacto.setter_id, contacto.asignado_en = usuario.id, ahora
    if regla.etiqueta:
        tags_service.poner(TARGET_IG_CONTACT, contacto.id, None, regla.etiqueta, None)
    WaRespuestaPendiente.query.filter_by(contacto_id=contacto.id).delete()
    if not regla.texto:
        return 'boton_plantilla'
    if regla.demora_segundos:
        db.session.add(WaRespuestaPendiente(contacto_id=contacto.id, regla_id=regla.id,
                                            enviar_en=ahora + timedelta(seconds=regla.demora_segundos)))
        if regla.demora_segundos <= DEMORA_CORTA:
            _a_su_hora(regla.demora_segundos)
        return 'boton_plantilla_en_espera'
    return _mandar(contacto, regla, ahora)


def _a_su_hora(segundos):
    """Un hilo que manda lo vencido a su hora (la fila pendiente se guarda cuando termina la vuelta del webhook)."""
    try:
        from flask import current_app
        app = current_app._get_current_object()
    except RuntimeError:
        return

    def correr():
        with app.app_context():
            try:
                mandar_pendientes(datetime.utcnow())
            except Exception as error:  # la fila sigue: la manda el reloj del motor
                db.session.rollback()
                logger.error(f'[WHATSAPP] Respuesta en espera: {error}')
            finally:
                db.session.remove()

    hilo = threading.Timer(segundos + 0.5, correr)
    hilo.daemon = True
    hilo.start()


def mandar_pendientes(ahora):
    """Las respuestas cuya demora ya pasó (las llama el reloj del motor y el hilo de una espera corta). Cada una se
    borra antes de mandarla y solo la manda quien la borró: el hilo y el reloj no la mandan dos veces."""
    salieron = 0
    for pendiente_id, contacto_id, regla_id in (db.session.query(WaRespuestaPendiente.id, WaRespuestaPendiente.contacto_id,
                                                                 WaRespuestaPendiente.regla_id)
                                                .filter(WaRespuestaPendiente.enviar_en <= ahora).all()):
        borradas = WaRespuestaPendiente.query.filter_by(id=pendiente_id).delete()
        db.session.commit()
        if not borradas:
            continue
        contacto, regla = db.session.get(IgContacto, contacto_id), db.session.get(WaRespuestaBoton, regla_id)
        if contacto and regla and regla.texto:
            salieron += _mandar(contacto, regla, ahora) == 'boton_plantilla'
        db.session.commit()
    return salieron


def validar(plantilla, boton, datos, botones_de_la_plantilla):
    """Los campos de una regla, limpios. Lanza ValueError con el motivo."""
    if boton not in botones_de_la_plantilla:
        raise ValueError(f'«{boton}» no es un botón de {plantilla}')
    texto = (datos.get('texto') or '').strip()
    if len(texto) > LARGO_TEXTO:
        raise ValueError(f'El mensaje pasa los {LARGO_TEXTO} caracteres')
    botones = []
    for b in datos.get('botones') or []:
        titulo = ((b or {}).get('titulo') or '').strip()
        va_a = (b or {}).get('va_a') or None
        url = ((b or {}).get('url') or '').strip() or None
        if not titulo:
            raise ValueError('Hay un botón sin texto')
        if len(titulo) > LARGO_BOTON:
            raise ValueError(f'«{titulo}» pasa los {LARGO_BOTON} caracteres de WhatsApp')
        if url and not URL.match(url):
            raise ValueError(f'El link de «{titulo}» tiene que empezar con https://')
        if va_a and va_a not in botones_de_la_plantilla:
            raise ValueError(f'«{va_a}» no es un botón de {plantilla}')
        botones.append({'titulo': titulo, 'url': url} if url else {'titulo': titulo, 'va_a': va_a})
    if len(botones) > MAX_BOTONES:
        raise ValueError(f'Van hasta {MAX_BOTONES} botones')
    if any(b.get('url') for b in botones) and len(botones) > 1:
        raise ValueError('Un botón con link va solo: WhatsApp no lo mezcla con otros botones')
    if botones and not texto:
        raise ValueError('Los botones necesitan un mensaje')
    if len({b['titulo'] for b in botones}) != len(botones):
        raise ValueError('Hay dos botones iguales')
    etiqueta = (datos.get('etiqueta') or '').strip()[:60] or None
    asignar_a = datos.get('asignar_a') or None
    if asignar_a is not None and not isinstance(asignar_a, int):
        raise ValueError('Elegí a quién asignar')
    demora = datos.get('demora_segundos') or 0
    if not isinstance(demora, int) or not 0 <= demora <= MAX_DEMORA:
        raise ValueError('La espera va de 0 segundos a 60 minutos')
    return {'texto': texto or None, 'botones': botones or None, 'etiqueta': etiqueta, 'asignar_a': asignar_a,
            'demora_segundos': demora if texto else 0}


def a_json(regla):
    return {'boton': regla.boton, 'texto': regla.texto or '', 'botones': regla.botones or [],
            'etiqueta': regla.etiqueta, 'asignar_a': regla.asignar_a, 'demora_segundos': regla.demora_segundos or 0}


def config_json(plantilla):
    c = WaPlantillaConfig.query.filter_by(plantilla=plantilla).first()
    return {'opcion_unica': bool(c and c.opcion_unica), 'texto_repetida': (c.texto_repetida if c else None) or REPETIDA}


def guardar_config(plantilla, datos):
    texto = (datos.get('texto_repetida') or '').strip()
    if len(texto) > LARGO_TEXTO:
        raise ValueError(f'El mensaje pasa los {LARGO_TEXTO} caracteres')
    c = WaPlantillaConfig.query.filter_by(plantilla=plantilla).first()
    if c is None:
        c = WaPlantillaConfig(plantilla=plantilla)
        db.session.add(c)
    c.opcion_unica = bool(datos.get('opcion_unica'))
    c.texto_repetida = texto or None
    db.session.commit()
    return config_json(plantilla)
