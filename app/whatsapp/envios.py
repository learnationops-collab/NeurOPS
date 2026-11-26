"""El broadcast de WhatsApp a mano (ADR-W229): la herramienta «Broadcast de WhatsApp» carga un CSV, elige una
plantilla aprobada y manda a los próximos N. Todo queda en `WaEnvio` (una fila por número).

  · «Enviar» deja las filas en «pendiente» con un `lote` y el reloj del motor las manda de a POR_VUELTA por
    vuelta (una por minuto). «Frenar» borra las pendientes del lote: no salieron, vuelven con el mismo CSV.
  · TOPE_DIARIO es del número, sumando plantillas (lo enviado hoy en Argentina más lo pendiente).
  · Un número va una sola vez: si ya tiene una fila que no falló, el CSV lo saltea.
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
TOPE_DIARIO = 100


class EnvioInvalido(ValueError):
    pass


def inicio_del_dia(ahora):
    """Medianoche de hoy en Argentina, en UTC naive (como se guarda todo)."""
    local = ahora.replace(tzinfo=ZoneInfo('UTC')).astimezone(ZONA)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(ZoneInfo('UTC')).replace(tzinfo=None)


def usados_hoy(ahora):
    """Lo que ya ocupa el tope de hoy: lo enviado desde la medianoche y lo pendiente."""
    return WaEnvio.query.filter(db.or_(WaEnvio.enviado_en >= inicio_del_dia(ahora),
                                       WaEnvio.estado == WaEnvio.PENDIENTE)).count()


def revisar(filas):
    """Qué pasa con el CSV: {total, para_mandar: [{telefono, nombre}], ya_recibieron, invalidos, repetidos}."""
    # Un envío que falló (p. ej. Meta sin método de pago) no le llegó: ese número puede volver a recibir.
    # 54… y 549… (52… y 521…) son el mismo celular: cuentan como uno.
    ya = {v for (t,) in db.session.query(WaEnvio.telefono).filter(WaEnvio.estado != WaEnvio.FALLO).distinct()
          for v in variantes(t)}
    vistos, para, resumen = set(), [], {'ya_recibieron': 0, 'invalidos': 0, 'repetidos': 0}
    for fila in filas:
        telefono = normalizar(fila.get('telefono'))
        if not telefono:
            resumen['invalidos'] += 1
        elif telefono in vistos:
            resumen['repetidos'] += 1
        elif telefono in ya:
            resumen['ya_recibieron'] += 1
        else:
            vistos.update(variantes(telefono))
            para.append({'telefono': telefono, 'nombre': (fila.get('nombre') or '').strip()[:150] or None})
    return {'total': len(filas), 'para_mandar': para, **resumen}


def crear_lote(filas, plantillas, cantidad, usuario_id, ahora):
    """Deja los próximos `cantidad` del CSV en pendiente. `plantillas`: [(nombre, idioma, con_nombre)]; con más
    de una, se reparten al azar en partes iguales. Devuelve el lote y cuántos van."""
    libres = TOPE_DIARIO - usados_hoy(ahora)
    if cantidad < 1:
        raise EnvioInvalido('Elegí cuántos mandar')
    if libres <= 0:
        raise EnvioInvalido(f'Ya se usó el tope de hoy ({TOPE_DIARIO})')
    if cantidad > libres:
        raise EnvioInvalido(f'Quedan {libres} para hoy')
    proximos = revisar(filas)['para_mandar'][:cantidad]
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
