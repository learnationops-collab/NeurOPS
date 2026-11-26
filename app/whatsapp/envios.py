"""El broadcast de WhatsApp a mano (ADR-W229): la herramienta «Broadcast de WhatsApp» carga un CSV, elige una
plantilla aprobada y manda a los próximos N. Todo queda en `WaEnvio` (una fila por número).

  · «Enviar» deja las filas en «pendiente» con un `lote` y el reloj del motor las manda de a POR_VUELTA por
    vuelta (una por minuto). «Frenar» borra las pendientes del lote: no salieron, vuelven con el mismo CSV.
  · TOPE_DIARIO es del número, sumando plantillas (lo enviado hoy en Argentina más lo pendiente).
  · Un número va una sola vez: si ya tiene una fila que no falló, el CSV lo saltea. Los alumnos con suscripción
    vigente también se saltean, salvo que se pida incluirlos (p. ej. el broadcast de referidos).
  · Con varias plantillas, cada número recibe una al azar, en partes iguales: así se comparan entre sí.
"""
import logging
import random
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from app import db
from app.automatizaciones.transporte import ErrorDeEnvio
from app.models.whatsapp import WaEnvio
from app.whatsapp.cliente import ClienteWhatsapp, configurado, normalizar, variantes

logger = logging.getLogger(__name__)

ZONA = ZoneInfo('America/Argentina/Buenos_Aires')
POR_VUELTA = 10
TOPE_DIARIO = 200  # Meta permite 250 personas por día en este nivel; dejamos margen


class EnvioInvalido(ValueError):
    pass


def inicio_del_dia(ahora):
    """Medianoche de hoy en Argentina, en UTC naive (como se guarda todo)."""
    local = ahora.replace(tzinfo=ZoneInfo('UTC')).astimezone(ZONA)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(ZoneInfo('UTC')).replace(tzinfo=None)


def usados_hoy(ahora):
    """Lo que ya ocupa el tope de hoy: lo enviado desde la medianoche y lo pendiente. Lo que falló no llegó: no cuenta."""
    return WaEnvio.query.filter(db.or_(WaEnvio.enviado_en >= inicio_del_dia(ahora),
                                       WaEnvio.estado == WaEnvio.PENDIENTE),
                                WaEnvio.estado != WaEnvio.FALLO).count()


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
    ya = {v for (t,) in db.session.query(WaEnvio.telefono).filter(WaEnvio.estado != WaEnvio.FALLO).distinct()
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


def _primer_nombre(nombre):
    return (nombre or '').strip().split(' ')[0].title() or 'hola'


def _mandar_uno(cliente, envio, ahora):
    parametros = [_primer_nombre(envio.nombre)] if envio.con_nombre else None
    try:
        envio.wamid = cliente.plantilla(envio.telefono, envio.plantilla, envio.idioma, parametros)
        envio.estado = WaEnvio.ENVIADO
    except ErrorDeEnvio as error:
        envio.estado, envio.error = WaEnvio.FALLO, str(error)[:300]
    envio.enviado_en = envio.actualizado_en = ahora
    return envio.estado == WaEnvio.ENVIADO


def enviar_tanda(ahora=None, cliente=None):
    """Una vuelta del reloj: hasta POR_VUELTA pendientes, los más viejos primero. Devuelve cuántos salieron."""
    ahora = ahora or datetime.utcnow()
    if not (cliente or configurado()):
        return 0
    pendientes = (WaEnvio.query.filter_by(estado=WaEnvio.PENDIENTE).order_by(WaEnvio.id).limit(POR_VUELTA).all())
    if not pendientes:
        return 0
    cliente = cliente or ClienteWhatsapp()
    salieron = sum(_mandar_uno(cliente, e, ahora) for e in pendientes)
    db.session.commit()
    return salieron
