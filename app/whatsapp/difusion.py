"""El broadcast de WhatsApp: una plantilla aprobada a una lista de números, de a poco.

  · Sale en el reloj del motor del Inbox, de a POR_VUELTA por minuto, solo entre HORA_DESDE y HORA_HASTA
    (hora de Argentina) y hasta `tope_diario` por difusión. Mario: empezar con 30 y subir a 60 y 100 si no
    hay errores. Sin verificar el negocio, Meta deja escribirle a 250 personas distintas por día en total.
  · A un número que ya recibió una difusión en los últimos DIAS_ENTRE_DIFUSIONES no se le vuelve a mandar
    (queda «fallo» con el motivo): dos broadcasts seguidos a la misma persona es lo que termina en bloqueo.
  · Las respuestas las toma `entrantes.py` y entran al Inbox de setters.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app import db
from app.automatizaciones.transporte import ErrorDeEnvio
from app.models.whatsapp import WaDifusion, WaDifusionDestino
from app.whatsapp.cliente import ClienteWhatsapp, configurado, normalizar

logger = logging.getLogger(__name__)

ZONA = ZoneInfo('America/Argentina/Buenos_Aires')
HORA_DESDE, HORA_HASTA = 9, 21
POR_VUELTA = 3
DIAS_ENTRE_DIFUSIONES = 7


def inicio_del_dia(ahora):
    """Medianoche de hoy en Argentina, en UTC naive (como se guarda todo)."""
    local = ahora.replace(tzinfo=ZoneInfo('UTC')).astimezone(ZONA)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(ZoneInfo('UTC')).replace(tzinfo=None)


def en_horario(ahora):
    hora = ahora.replace(tzinfo=ZoneInfo('UTC')).astimezone(ZONA).hour
    return HORA_DESDE <= hora < HORA_HASTA


def enviados_hoy(difusion_id, ahora):
    return WaDifusionDestino.query.filter(WaDifusionDestino.difusion_id == difusion_id,
                                          WaDifusionDestino.enviado_en >= inicio_del_dia(ahora)).count()


def cargar(difusion, filas):
    """Suma números a la difusión. `filas`: [{telefono, nombre}]. Devuelve {agregados, repetidos, invalidos}."""
    existentes = {t for (t,) in db.session.query(WaDifusionDestino.telefono).filter_by(difusion_id=difusion.id)}
    resumen = {'agregados': 0, 'repetidos': 0, 'invalidos': 0}
    for fila in filas:
        telefono = normalizar(fila.get('telefono'))
        if not telefono:
            resumen['invalidos'] += 1
            continue
        if telefono in existentes:
            resumen['repetidos'] += 1
            continue
        existentes.add(telefono)
        nombre = (fila.get('nombre') or '').strip()[:150] or None
        db.session.add(WaDifusionDestino(difusion_id=difusion.id, telefono=telefono, nombre=nombre))
        resumen['agregados'] += 1
    return resumen


def _primer_nombre(nombre):
    return (nombre or '').strip().split(' ')[0].title() or 'hola'


def _reciente(destino, ahora):
    return (WaDifusionDestino.query
            .filter(WaDifusionDestino.telefono == destino.telefono, WaDifusionDestino.id != destino.id,
                    WaDifusionDestino.enviado_en >= ahora - timedelta(days=DIAS_ENTRE_DIFUSIONES))
            .first() is not None)


def _mandar_uno(cliente, difusion, destino, ahora):
    if _reciente(destino, ahora):
        destino.estado, destino.error = WaDifusionDestino.FALLO, 'Ya recibió otra difusión esta semana'
        destino.actualizado_en = ahora
        return False
    parametros = [_primer_nombre(destino.nombre)] if difusion.con_nombre else None
    try:
        destino.wamid = cliente.plantilla(destino.telefono, difusion.plantilla, difusion.idioma, parametros)
        destino.estado = WaDifusionDestino.ENVIADO
    except ErrorDeEnvio as error:
        destino.estado, destino.error = WaDifusionDestino.FALLO, str(error)[:300]
    destino.enviado_en = destino.actualizado_en = ahora
    return destino.estado == WaDifusionDestino.ENVIADO


def enviar_tanda(ahora=None, cliente=None):
    """Una vuelta: hasta POR_VUELTA mensajes por difusión activa, respetando horario y tope. Devuelve cuántos salieron."""
    ahora = ahora or datetime.utcnow()
    if not (cliente or configurado()) or not en_horario(ahora):
        return 0
    cliente = cliente or ClienteWhatsapp()
    salieron = 0
    for difusion in WaDifusion.query.filter_by(estado=WaDifusion.ACTIVA).order_by(WaDifusion.id).all():
        cupo = min(POR_VUELTA, difusion.tope_diario - enviados_hoy(difusion.id, ahora))
        if cupo <= 0:
            continue
        pendientes = (WaDifusionDestino.query.filter_by(difusion_id=difusion.id, estado=WaDifusionDestino.PENDIENTE)
                      .order_by(WaDifusionDestino.id).limit(cupo).all())
        if not pendientes:
            difusion.estado = WaDifusion.TERMINADA
            continue
        for destino in pendientes:
            salieron += _mandar_uno(cliente, difusion, destino, ahora)
        db.session.commit()
    db.session.commit()
    return salieron


def resumen(difusion, ahora=None):
    ahora = ahora or datetime.utcnow()
    conteo = dict(db.session.query(WaDifusionDestino.estado, db.func.count(WaDifusionDestino.id))
                  .filter_by(difusion_id=difusion.id).group_by(WaDifusionDestino.estado).all())
    return {
        'id': difusion.id, 'nombre': difusion.nombre, 'plantilla': difusion.plantilla, 'idioma': difusion.idioma,
        'con_nombre': difusion.con_nombre, 'destino': difusion.destino, 'tope_diario': difusion.tope_diario,
        'estado': difusion.estado, 'flujo_id': difusion.flujo_id, 'creado_en': difusion.creado_en.isoformat() + 'Z',
        'total': sum(conteo.values()), 'por_estado': conteo, 'enviados_hoy': enviados_hoy(difusion.id, ahora),
    }
