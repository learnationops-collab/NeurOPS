"""El broadcast de WhatsApp a mano (ADR-W229): la herramienta «Broadcast de WhatsApp» carga un CSV, elige una
plantilla aprobada y manda a los próximos N. Todo queda en `WaEnvio` (una fila por número).

  · «Enviar» deja las filas en «pendiente» con un `lote` y el reloj del motor las manda de a POR_VUELTA por
    vuelta (una por minuto). «Frenar» borra las pendientes del lote: no salieron, vuelven con el mismo CSV.
  · TOPE_DIARIO es del número y cuenta PERSONAS distintas en las últimas 24 h, como Meta (ADR-W259): el segundo
    recordatorio del día a la misma persona no suma. Una fila pendiente de una persona nueva espera si el tope
    está lleno; si tiene `vence_en` (los pasos de un taller) y vence, no sale.
  · Un número va una sola vez: si ya tiene una fila que no falló, el CSV lo saltea. Los alumnos con suscripción
    vigente también se saltean, salvo que se pida incluirlos (p. ej. el broadcast de referidos).
  · Con varias plantillas, cada número recibe una al azar, en partes iguales: así se comparan entre sí.
"""
import logging
import random
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app import db
from app.automatizaciones.transporte import ErrorDeEnvio
from app.models.whatsapp import WaEnvio
from app.whatsapp.cliente import ClienteWhatsapp, configurado, normalizar, variantes

logger = logging.getLogger(__name__)

ZONA = ZoneInfo('America/Argentina/Buenos_Aires')
POR_VUELTA = 40  # un recordatorio de 10 minutos antes no puede tardar media hora en salir
TOPE_DIARIO = 200  # Meta permite 250 personas en 24 h en este nivel; dejamos margen
VENTANA = timedelta(hours=24)


class EnvioInvalido(ValueError):
    pass


def inicio_del_dia(ahora):
    """Medianoche de hoy en Argentina, en UTC naive (como se guarda todo)."""
    local = ahora.replace(tzinfo=ZoneInfo('UTC')).astimezone(ZONA)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(ZoneInfo('UTC')).replace(tzinfo=None)


def personas_24h(ahora):
    """Los teléfonos que ya recibieron algo en las últimas 24 h (lo que falló no llegó: no cuenta)."""
    filas = (db.session.query(WaEnvio.telefono).filter(WaEnvio.enviado_en >= ahora - VENTANA,
                                                       WaEnvio.estado != WaEnvio.FALLO).distinct())
    return {t for (t,) in filas}


def usados_hoy(ahora):
    """Lo que ocupa el tope: las personas de las últimas 24 h más las pendientes nuevas (sin vencer)."""
    ya = personas_24h(ahora)
    pendientes = (db.session.query(WaEnvio.telefono).filter(
        WaEnvio.estado == WaEnvio.PENDIENTE, db.or_(WaEnvio.vence_en.is_(None), WaEnvio.vence_en >= ahora)).distinct())
    return len(ya | {t for (t,) in pendientes})


def alumnos_activos():
    """Los teléfonos de quienes tienen una suscripción vigente, por sus últimos 8 dígitos (como `PersonIdentity`)."""
    from app.models.person import Person, PersonIdentity
    from app.models.subscription import Subscription
    vigentes = (db.session.query(Subscription.person_uuid)
                .filter(Subscription.status == 'active', Subscription.expires_at >= datetime.utcnow().date()))
    principales = db.session.query(Person.phone).filter(Person.uuid.in_(vigentes), Person.phone.isnot(None))
    otros = db.session.query(PersonIdentity.value).filter(PersonIdentity.person_uuid.in_(vigentes),
                                                          PersonIdentity.kind == 'phone')
    digitos = [normalizar(t) for (t,) in principales] + [v for (v,) in otros]
    return {d[-8:] for d in digitos if d and len(d) >= 8}


def revisar(filas, sin_alumnos=True):
    """Qué pasa con el CSV: {total, para_mandar: [{telefono, nombre}], ya_recibieron, invalidos, repetidos, alumnos}.
    `alumnos` cuenta a los que tienen una suscripción vigente; con `sin_alumnos` se saltean (un broadcast de
    captación no le llega a quien ya compró)."""
    # Un envío que falló (p. ej. Meta sin método de pago) no le llegó: ese número puede volver a recibir.
    # 54… y 549… (52… y 521…) son el mismo celular: cuentan como uno.
    # Los recordatorios de un taller (paso_id) no cuentan: esa persona puede recibir otro broadcast a mano.
    ya = {v for (t,) in db.session.query(WaEnvio.telefono).filter(WaEnvio.estado != WaEnvio.FALLO,
                                                                  WaEnvio.paso_id.is_(None)).distinct()
          for v in variantes(t)}
    alumnos = alumnos_activos()
    vistos, para, resumen = set(), [], {'ya_recibieron': 0, 'invalidos': 0, 'repetidos': 0, 'alumnos': 0}
    for fila in filas:
        telefono = normalizar(fila.get('telefono'))
        es_alumno = bool(telefono) and telefono[-8:] in alumnos
        if not telefono:
            resumen['invalidos'] += 1
        elif telefono in vistos:
            resumen['repetidos'] += 1
        elif telefono in ya:
            resumen['ya_recibieron'] += 1
        elif es_alumno and sin_alumnos:
            resumen['alumnos'] += 1
        else:
            resumen['alumnos'] += es_alumno
            vistos.update(variantes(telefono))
            para.append({'telefono': telefono, 'nombre': (fila.get('nombre') or '').strip()[:150] or None})
    return {'total': len(filas), 'para_mandar': para, **resumen}


def crear_lote(filas, plantillas, cantidad, usuario_id, ahora, sin_alumnos=True):
    """Deja los próximos `cantidad` del CSV en pendiente. `plantillas`: [(nombre, idioma, con_nombre)]; con más
    de una, se reparten al azar en partes iguales. Devuelve el lote y cuántos van."""
    libres = TOPE_DIARIO - usados_hoy(ahora)
    if cantidad < 1:
        raise EnvioInvalido('Elegí cuántos mandar')
    if libres <= 0:
        raise EnvioInvalido(f'Ya se usó el tope de hoy ({TOPE_DIARIO})')
    if cantidad > libres:
        raise EnvioInvalido(f'Quedan {libres} para hoy')
    proximos = revisar(filas, sin_alumnos)['para_mandar'][:cantidad]
    if not proximos:
        raise EnvioInvalido('No queda nadie para mandar en esta lista')
    lote = str(uuid.uuid4())
    turnos = [plantillas[i % len(plantillas)] for i in range(len(proximos))]
    random.shuffle(turnos)
    for f, (plantilla, idioma, con_nombre) in zip(proximos, turnos):
        db.session.add(WaEnvio(lote=lote, plantilla=plantilla, idioma=idioma, con_nombre=con_nombre,
                               telefono=f['telefono'], nombre=f['nombre'], enviado_por_id=usuario_id, creado_en=ahora))
    db.session.commit()
    return lote, len(proximos)


def frenar(lote):
    borrados = WaEnvio.query.filter_by(lote=lote, estado=WaEnvio.PENDIENTE).delete()
    db.session.commit()
    return borrados


SIN_NOMBRE = '👋'  # una plantilla no acepta una variable vacía: «Hola {{1}},» sale «Hola 👋,» (ADR-W271)


def _primer_nombre(nombre):
    return (nombre or '').strip().split(' ')[0].title() or SIN_NOMBRE


def _parametros(envio):
    if envio.parametros:
        return [_primer_nombre(envio.nombre) if p == '{nombre}' else p for p in envio.parametros]
    return [_primer_nombre(envio.nombre)] if envio.con_nombre else None


def _mandar_uno(cliente, envio, ahora):
    try:
        if envio.mensaje:
            # Un paso de mensaje común (ADR-W266): texto, link y botones (ADR-W272). Link y botones de respuesta
            # salen en dos mensajes seguidos; el wamid que queda es el del primero.
            from app.whatsapp.respuestas import partes_de_paso
            for k, (texto, cuerpo) in enumerate(partes_de_paso(envio.mensaje, envio.nombre, envio.contacto_id)):
                mid = cliente.mandar(envio.telefono, cuerpo)
                if k == 0:
                    envio.wamid = mid
                _al_chat(envio, texto, cuerpo, ahora, mid)
        else:
            envio.wamid = cliente.plantilla(envio.telefono, envio.plantilla, envio.idioma, _parametros(envio))
        envio.estado = WaEnvio.ENVIADO
    except ErrorDeEnvio as error:
        motivo = 'Ventana de 24 h cerrada' if getattr(error, 'ventana_cerrada', False) else str(error)
        envio.estado, envio.error = WaEnvio.FALLO, motivo[:300]
    envio.enviado_en = envio.actualizado_en = ahora
    return envio.estado == WaEnvio.ENVIADO


def _al_chat(envio, texto, cuerpo, ahora, mid=None):
    """El mensaje común queda en la conversación del Inbox, como lo que manda el motor."""
    from app.automatizaciones.modelos import IgMensaje
    if envio.contacto_id:
        db.session.add(IgMensaje(contacto_id=envio.contacto_id, mid=mid or envio.wamid, direccion=IgMensaje.SALIENTE,
                                 origen=IgMensaje.MOTOR, texto=texto, contenido={'whatsapp': cuerpo}, enviado_en=ahora))


def enviar_tanda(ahora=None, cliente=None):
    """Una vuelta del reloj: hasta POR_VUELTA pendientes, los que vencen antes primero y después los más viejos.
    Lo vencido no sale; una persona nueva espera si el tope de 24 h está lleno. Devuelve cuántos salieron."""
    ahora = ahora or datetime.utcnow()
    if not (cliente or configurado()):
        return 0
    vencidos = WaEnvio.query.filter(WaEnvio.estado == WaEnvio.PENDIENTE, WaEnvio.vence_en < ahora).all()
    for e in vencidos:
        e.estado, e.error, e.actualizado_en = WaEnvio.FALLO, 'No salió a tiempo (tope del día o reloj parado)', ahora
    pendientes = (WaEnvio.query.filter_by(estado=WaEnvio.PENDIENTE)
                  .order_by(WaEnvio.vence_en.is_(None), WaEnvio.vence_en, WaEnvio.id).limit(POR_VUELTA * 10).all())
    if not pendientes:
        db.session.commit()
        return 0
    cliente = cliente or ClienteWhatsapp()
    ya = {v for t in personas_24h(ahora) for v in variantes(t)}
    personas = len(personas_24h(ahora))
    salieron = 0
    for e in pendientes:
        if salieron >= POR_VUELTA:
            break
        nueva = e.telefono not in ya
        if nueva and personas >= TOPE_DIARIO:
            continue
        if _mandar_uno(cliente, e, ahora) and nueva:
            ya.update(variantes(e.telefono))
            personas += 1
        salieron += 1
    db.session.commit()
    return salieron
