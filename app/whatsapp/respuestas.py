"""Qué pasa cuando tocan un botón de una plantilla (`WaRespuestaBoton`, pestaña Plantillas del broadcast).

  · Un botón de la plantilla llega como `type: button` con su texto. La plantilla es la del broadcast que recibió
    ese número (`variables.plantilla`, la marca `entrantes._marcar_envio`): un número recibe un solo broadcast.
  · El mensaje que sale puede llevar sus botones (interactivos, hasta 3 de 20 caracteres). Su `id` es
    `WAP|plantilla|botón de la plantilla|n`: tocarlo sigue la respuesta de ese botón (vacío: queda para el setter).
  · Además de contestar, asigna la conversación y le pone la etiqueta (suelta, sin grupo).
  · El mensaje puede esperar `demora_segundos` (queda en `WaRespuestaPendiente` y lo manda el reloj del motor);
    `{nombre}` en el texto pasa a ser el primer nombre del lead.
Sin regla para ese botón no hace nada y el toque queda para el setter, como antes (ADR-W229).
"""
import logging
import re
from datetime import timedelta

from app import db
from app.automatizaciones.modelos import IgContacto, IgMensaje
from app.automatizaciones.transporte import ErrorDeEnvio
from app.models.tag import TARGET_IG_CONTACT
from app.models.user import User
from app.models.whatsapp import WaEnvio, WaRespuestaBoton, WaRespuestaPendiente
from app.services import tags_service
from app.whatsapp.cliente import ClienteWhatsapp, telefono_de
from app.whatsapp.transporte import _interactivo

logger = logging.getLogger(__name__)

PREFIJO_ID = 'WAP|'
MAX_BOTONES = 3
LARGO_BOTON = 20
LARGO_TEXTO = 1024
MAX_DEMORA = 3600


def boton_tocado(contacto, mensaje):
    """(plantilla, botón) del toque, o None si no es un botón de plantilla ni de una de sus respuestas."""
    if mensaje.get('type') == 'button':
        plantilla = (contacto.variables or {}).get('plantilla')
        texto = (mensaje.get('button') or {}).get('text')
        return (plantilla, texto) if plantilla and texto else None
    if mensaje.get('type') == 'interactive':
        id_ = ((mensaje.get('interactive') or {}).get('button_reply') or {}).get('id') or ''
        if id_.startswith(PREFIJO_ID):
            partes = id_.split('|')
            if len(partes) >= 3 and partes[1] and partes[2]:
                return partes[1], partes[2]
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
    opciones = [(b['titulo'], f"{PREFIJO_ID}{regla.plantilla}|{b.get('va_a') or ''}|{i}") for i, b in enumerate(botones)]
    return _interactivo(texto, opciones)


def _mandar(contacto, regla, ahora):
    texto = con_nombre(regla.texto, _nombre_de(contacto))
    cuerpo = cuerpo_de(regla, texto)
    try:
        mid = ClienteWhatsapp().mandar(telefono_de(contacto.igsid), cuerpo)
    except ErrorDeEnvio as error:
        logger.error(f'[WHATSAPP] Respuesta al botón «{regla.boton}» de {regla.plantilla}: {error}')
        return 'boton_plantilla_fallo'
    db.session.add(IgMensaje(contacto_id=contacto.id, mid=mid, direccion=IgMensaje.SALIENTE, origen=IgMensaje.MOTOR,
                             texto=texto, contenido={'whatsapp': cuerpo}, enviado_en=ahora))
    db.session.flush()
    return 'boton_plantilla'


def responder(contacto, mensaje, ahora):
    """Aplica la regla del botón tocado. Devuelve el resultado o None si no hay regla."""
    tocado = boton_tocado(contacto, mensaje)
    regla = WaRespuestaBoton.query.filter_by(plantilla=tocado[0], boton=tocado[1]).first() if tocado else None
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
        return 'boton_plantilla_en_espera'
    return _mandar(contacto, regla, ahora)


def mandar_pendientes(ahora):
    """Las respuestas cuya demora ya pasó (las llama el reloj del motor). Devuelve cuántas salieron."""
    salieron = 0
    for pendiente in WaRespuestaPendiente.query.filter(WaRespuestaPendiente.enviar_en <= ahora).all():
        contacto, regla = db.session.get(IgContacto, pendiente.contacto_id), db.session.get(WaRespuestaBoton, pendiente.regla_id)
        db.session.delete(pendiente)
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
        if not titulo:
            raise ValueError('Hay un botón sin texto')
        if len(titulo) > LARGO_BOTON:
            raise ValueError(f'«{titulo}» pasa los {LARGO_BOTON} caracteres de WhatsApp')
        if va_a and va_a not in botones_de_la_plantilla:
            raise ValueError(f'«{va_a}» no es un botón de {plantilla}')
        botones.append({'titulo': titulo, 'va_a': va_a})
    if len(botones) > MAX_BOTONES:
        raise ValueError(f'Van hasta {MAX_BOTONES} botones')
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
        raise ValueError('La espera va de 0 a 60 minutos')
    return {'texto': texto or None, 'botones': botones or None, 'etiqueta': etiqueta, 'asignar_a': asignar_a,
            'demora_segundos': demora if texto else 0}


def a_json(regla):
    return {'boton': regla.boton, 'texto': regla.texto or '', 'botones': regla.botones or [],
            'etiqueta': regla.etiqueta, 'asignar_a': regla.asignar_a, 'demora_segundos': regla.demora_segundos or 0}
