"""Qué pasa cuando tocan un botón de una plantilla (`WaRespuestaBoton`, pestaña Plantillas del broadcast).

  · Un botón de la plantilla llega como `type: button` con su texto. La plantilla es la del broadcast que recibió
    ese número (`variables.plantilla`, la marca `entrantes._marcar_envio`).
  · El mensaje que sale puede llevar sus botones (interactivos, hasta 3 de 20 caracteres). Su `id` es
    `WAP|plantilla|botón de la plantilla que sigue|n|botón de origen`: tocarlo sigue la respuesta de ese botón
    (vacío: queda para el setter). Y un botón que abre un link (`url`, mensaje `cta_url`, ADR-W260; con botones de
    respuesta salen en dos mensajes seguidos, ADR-W265),
    que al abrirse puede mandar otro mensaje (`despues`, ver `links.py`, ADR-W261).
  · Además de contestar, asigna la conversación, le pone etiquetas y le saca otras (sueltas, sin grupo; ADR-W265).
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
LINK_BOTON = '__link__'  # la regla del link de un paso de mensaje (`paso:<id>`), para su «al abrir el link» (ADR-W272)
SIGUE_DEBAJO = '👇'  # el texto del segundo mensaje cuando un link va con botones de respuesta (ADR-W265)
MAX_ETIQUETAS = 10


def etiquetas_de(regla):
    """Las que pone la regla (las reglas viejas solo tienen `etiqueta`)."""
    return regla.etiquetas if regla.etiquetas is not None else ([regla.etiqueta] if regla.etiqueta else [])


def _lista_de_etiquetas(valor):
    """Una lista de etiquetas limpia (también acepta «a, b»): sin vacías ni repetidas, hasta MAX_ETIQUETAS."""
    if isinstance(valor, str):
        valor = valor.split(',')
    salida = []
    for e in valor or []:
        e = str(e or '').strip()[:60]
        if e and e.lower() not in {x.lower() for x in salida}:
            salida.append(e)
    if len(salida) > MAX_ETIQUETAS:
        raise ValueError(f'Van hasta {MAX_ETIQUETAS} etiquetas')
    return salida


def _botones_de_respuesta(lista, plantilla, botones_de_la_plantilla, donde=''):
    """Los botones de respuesta [{titulo, va_a}] validados (hasta MAX_BOTONES, de LARGO_BOTON)."""
    salida = []
    for b in lista or []:
        titulo, va_a = ((b or {}).get('titulo') or '').strip(), (b or {}).get('va_a') or None
        if not titulo:
            raise ValueError(f'Hay un botón sin texto{donde}')
        if len(titulo) > LARGO_BOTON:
            raise ValueError(f'«{titulo}» pasa los {LARGO_BOTON} caracteres de WhatsApp')
        if va_a and va_a not in botones_de_la_plantilla:
            raise ValueError(f'«{va_a}» no es un botón de {plantilla}')
        salida.append({'titulo': titulo, 'va_a': va_a})
    if len(salida) > MAX_BOTONES:
        raise ValueError(f'Van hasta {MAX_BOTONES} botones de respuesta{donde} (más el del link)')
    if len({b['titulo'] for b in salida}) != len(salida):
        raise ValueError(f'Hay dos botones iguales{donde}')
    return salida


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
    """`{nombre}` pasa a ser el primer nombre; sin nombre se va con la coma o el espacio de antes. `{{1}}` vale lo
    mismo: en una plantilla es el nombre y se escribe igual en los mensajes que no lo son (ADR-W266)."""
    texto = texto.replace('{{1}}', '{nombre}')
    primero = (nombre or '').strip().split(' ')[0].title()
    if primero:
        return texto.replace('{nombre}', primero)
    # Sin nombre: «{nombre}, en 5 horas…» arranca en «En 5 horas…» y «Hola {nombre}, …» queda «Hola, …».
    texto = re.sub(r'(^|\n)[ \t]*\{nombre\}[ \t]*[,!.]?[ \t]*(\S)', lambda m: m.group(1) + m.group(2).upper(), texto)
    return re.sub(r'[ \t]*\{nombre\}', '', texto)


def _nombre_de(contacto):
    """El de su perfil de WhatsApp y, si no hay, el de la carga (ADR-W271). Sin ninguno, el texto va sin nombre."""
    from app.whatsapp.audiencia import nombre_de
    return nombre_de(contacto)


def _con_link(texto, titulo, url):
    return {'type': 'interactive', 'interactive': {
        'type': 'cta_url', 'body': {'text': texto[:LARGO_TEXTO]},
        'action': {'name': 'cta_url', 'parameters': {'display_text': titulo[:LARGO_BOTON], 'url': url}}}}


def _opciones(regla, botones, origen):
    """Los botones de respuesta, con el `id` que dice qué regla siguen y de qué mensaje salieron."""
    return [(b['titulo'], f"{PREFIJO_ID}{regla.plantilla}|{b.get('va_a') or ''}|{i}|{origen}") for i, b in enumerate(botones)]


def _armar(texto, link, opciones):
    """[(texto, cuerpo)] de lo que sale. WhatsApp no mezcla un botón con link y botones de respuesta en un mensaje
    (ADR-W265): el texto va con el link y los otros botones salen justo debajo, en un segundo mensaje."""
    if link and opciones:
        return [(texto, _con_link(texto, *link)), (SIGUE_DEBAJO, _interactivo(SIGUE_DEBAJO, opciones))]
    if link:
        return [(texto, _con_link(texto, *link))]
    if opciones:
        return [(texto, _interactivo(texto, opciones))]
    return [(texto, {'type': 'text', 'text': {'body': texto, 'preview_url': True}})]


def mensajes_de(regla, texto, contacto_id=None):
    """Lo que sale para esa regla. Un link con «después» pasa por nuestra ruta (`links.py`) para saber cuándo lo abren."""
    botones = regla.botones or []
    con_link = next((b for b in botones if b.get('url')), None)
    link = None
    if con_link:
        url = con_link['url']
        if con_link.get('despues') and contacto_id:
            from app.whatsapp import links
            url = links.url_de(contacto_id, regla.id)
        link = (con_link['titulo'], url)
    return _armar(texto, link, _opciones(regla, [b for b in botones if not b.get('url')], regla.boton))


def partes_de_paso(mensaje, nombre, contacto_id=None):
    """[(texto, cuerpo)] de un paso de mensaje común (ADR-W272): su texto, su link (por la ruta de Work si tiene
    «al abrir el link») y sus botones de respuesta, que siguen las reglas `paso:<id>` como los de una plantilla."""
    texto = con_nombre(mensaje.get('texto') or '', nombre)
    clave = f"paso:{mensaje['paso_id']}" if mensaje.get('paso_id') else None
    link = None
    if mensaje.get('url'):
        url = mensaje['url']
        regla = WaRespuestaBoton.query.filter_by(plantilla=clave, boton=LINK_BOTON).first() if clave else None
        if regla and _despues_de(regla) and contacto_id:
            from app.whatsapp import links
            url = links.url_de(contacto_id, regla.id)
        link = (mensaje.get('titulo') or 'Abrir', url)
    # El origen es el paso (no vacío): la opción única de sus botones no se mezcla con la de la plantilla.
    opciones = ([(b['titulo'], f"{PREFIJO_ID}{clave}|{b['titulo']}|{i}|{clave}")
                 for i, b in enumerate(mensaje.get('botones') or [])] if clave else [])
    return _armar(texto, link, opciones)


def _guardar_saliente(contacto, mid, texto, cuerpo, ahora):
    db.session.add(IgMensaje(contacto_id=contacto.id, mid=mid, direccion=IgMensaje.SALIENTE, origen=IgMensaje.MOTOR,
                             texto=texto, contenido={'whatsapp': cuerpo}, enviado_en=ahora))
    db.session.flush()


def _mandar_partes(contacto, partes, ahora, que):
    """Manda los mensajes en orden; si uno falla, no sigue. True si salieron todos."""
    for texto, cuerpo in partes:
        try:
            mid = ClienteWhatsapp().mandar(telefono_de(contacto.igsid), cuerpo)
        except ErrorDeEnvio as error:
            logger.error(f'[WHATSAPP] {que}: {error}')
            return False
        _guardar_saliente(contacto, mid, texto, cuerpo, ahora)
    return True


def _mandar(contacto, regla, ahora):
    partes = mensajes_de(regla, con_nombre(regla.texto, _nombre_de(contacto)), contacto.id)
    ok = _mandar_partes(contacto, partes, ahora, f'Respuesta al botón «{regla.boton}» de {regla.plantilla}')
    return 'boton_plantilla' if ok else 'boton_plantilla_fallo'


def _despues_de(regla):
    if not regla:
        return None
    return next((b.get('despues') for b in regla.botones or [] if b.get('url')), None)


def _mandar_despues(contacto, regla, ahora):
    """El mensaje que sale al abrir el link de la regla (ADR-W261), con su botón con link y sus botones de respuesta
    (ADR-W265: los de respuesta salen en un segundo mensaje y su origen es «<botón>>link»)."""
    d = _despues_de(regla)
    if not d or not d.get('texto'):
        return 'despues_vacio'
    texto = con_nombre(d['texto'], _nombre_de(contacto))
    link = (d['titulo'], d['url']) if d.get('url') else None
    partes = _armar(texto, link, _opciones(regla, d.get('botones') or [], f'{regla.boton}>link'))
    ok = _mandar_partes(contacto, partes, ahora, f'Mensaje al abrir el link de «{regla.boton}» ({regla.plantilla})')
    return 'despues' if ok else 'despues_fallo'


def programar_despues(contacto, regla, ahora):
    """Al abrir el link: el mensaje de «después» sale ya o queda esperando su demora (como una respuesta)."""
    d = _despues_de(regla) or {}
    demora = int(d.get('demora_segundos') or 0)
    WaRespuestaPendiente.query.filter_by(contacto_id=contacto.id).delete()
    if not demora:
        return _mandar_despues(contacto, regla, ahora)
    db.session.add(WaRespuestaPendiente(contacto_id=contacto.id, regla_id=regla.id, cual='despues',
                                        enviar_en=ahora + timedelta(seconds=demora)))
    if demora <= DEMORA_CORTA:
        _a_su_hora(demora)
    return 'despues_en_espera'


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
    for nombre in regla.quitar or []:
        tags_service.sacar_por_nombre(TARGET_IG_CONTACT, contacto.id, nombre)
    for nombre in etiquetas_de(regla):
        tags_service.poner(TARGET_IG_CONTACT, contacto.id, None, nombre, None)
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
    for pendiente_id, contacto_id, regla_id, cual in (db.session.query(
            WaRespuestaPendiente.id, WaRespuestaPendiente.contacto_id, WaRespuestaPendiente.regla_id,
            WaRespuestaPendiente.cual).filter(WaRespuestaPendiente.enviar_en <= ahora).all()):
        borradas = WaRespuestaPendiente.query.filter_by(id=pendiente_id).delete()
        db.session.commit()
        if not borradas:
            continue
        contacto, regla = db.session.get(IgContacto, contacto_id), db.session.get(WaRespuestaBoton, regla_id)
        if contacto and regla and cual == 'despues':
            salieron += _mandar_despues(contacto, regla, ahora) == 'despues'
        elif contacto and regla and regla.texto:
            salieron += _mandar(contacto, regla, ahora) == 'boton_plantilla'
        db.session.commit()
    return salieron


def _validar_despues(d, plantilla, botones_de_la_plantilla):
    """El mensaje que sale al abrir el link: {texto, titulo?, url?, botones?, demora_segundos}. None si no hay texto."""
    if not isinstance(d, dict) or not (d.get('texto') or '').strip():
        return None
    texto = d['texto'].strip()
    if len(texto) > LARGO_TEXTO:
        raise ValueError(f'El mensaje de después pasa los {LARGO_TEXTO} caracteres')
    titulo, url = (d.get('titulo') or '').strip(), (d.get('url') or '').strip()
    if url and not URL.match(url):
        raise ValueError('El link del mensaje de después tiene que empezar con https://')
    if url and not titulo:
        raise ValueError('El botón del mensaje de después necesita un texto')
    if len(titulo) > LARGO_BOTON:
        raise ValueError(f'«{titulo}» pasa los {LARGO_BOTON} caracteres de WhatsApp')
    demora = d.get('demora_segundos') or 0
    if not isinstance(demora, int) or not 0 <= demora <= MAX_DEMORA:
        raise ValueError('La espera va de 0 segundos a 60 minutos')
    salida = {'texto': texto, 'demora_segundos': demora}
    if url:
        salida.update(titulo=titulo, url=url)
    respuestas = _botones_de_respuesta(d.get('botones'), plantilla, botones_de_la_plantilla, ' en el mensaje de después')
    if respuestas:
        salida['botones'] = respuestas
    return salida


def validar(plantilla, boton, datos, botones_de_la_plantilla):
    """Los campos de una regla, limpios. Lanza ValueError con el motivo."""
    if boton not in botones_de_la_plantilla:
        raise ValueError(f'«{boton}» no es un botón de {plantilla}')
    texto = (datos.get('texto') or '').strip()
    if len(texto) > LARGO_TEXTO:
        raise ValueError(f'El mensaje pasa los {LARGO_TEXTO} caracteres')
    pedidos = [b or {} for b in datos.get('botones') or []]
    links = [b for b in pedidos if (b.get('url') or '').strip()]
    if len(links) > 1:
        raise ValueError('Va un solo botón con link por mensaje')
    botones = []
    for b in links:
        titulo, url = (b.get('titulo') or '').strip(), b['url'].strip()
        if not titulo:
            raise ValueError('El botón del link necesita un texto')
        if len(titulo) > LARGO_BOTON:
            raise ValueError(f'«{titulo}» pasa los {LARGO_BOTON} caracteres de WhatsApp')
        if not URL.match(url):
            raise ValueError(f'El link de «{titulo}» tiene que empezar con https://')
        boton_link = {'titulo': titulo, 'url': url}
        despues = _validar_despues(b.get('despues'), plantilla, botones_de_la_plantilla)
        if despues:
            boton_link['despues'] = despues
        botones.append(boton_link)
    # Con link, los de respuesta salen en un segundo mensaje (ADR-W265): hasta 3 además del link.
    botones += _botones_de_respuesta([b for b in pedidos if b not in links], plantilla, botones_de_la_plantilla)
    if botones and not texto:
        raise ValueError('Los botones necesitan un mensaje')
    if len({b['titulo'] for b in botones}) != len(botones):
        raise ValueError('Hay dos botones iguales')
    etiquetas = _lista_de_etiquetas(datos['etiquetas'] if 'etiquetas' in datos else datos.get('etiqueta'))
    quitar = _lista_de_etiquetas(datos.get('quitar'))
    asignar_a = datos.get('asignar_a') or None
    if asignar_a is not None and not isinstance(asignar_a, int):
        raise ValueError('Elegí a quién asignar')
    demora = datos.get('demora_segundos') or 0
    if not isinstance(demora, int) or not 0 <= demora <= MAX_DEMORA:
        raise ValueError('La espera va de 0 segundos a 60 minutos')
    return {'texto': texto or None, 'botones': botones or None, 'etiqueta': etiquetas[0] if etiquetas else None,
            'etiquetas': etiquetas or None, 'quitar': quitar or None, 'asignar_a': asignar_a,
            'demora_segundos': demora if texto else 0}


def a_json(regla):
    return {'boton': regla.boton, 'texto': regla.texto or '', 'botones': regla.botones or [],
            'etiqueta': regla.etiqueta, 'etiquetas': etiquetas_de(regla), 'quitar': regla.quitar or [],
            'asignar_a': regla.asignar_a, 'demora_segundos': regla.demora_segundos or 0}


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
