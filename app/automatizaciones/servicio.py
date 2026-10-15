"""Lo que llaman el cron y la API: procesar los eventos guardados, despertar esperas, publicar flujos.

IG_MOTOR_MODO decide qué pasa en producción:
  · apagado (por defecto): no procesa nada.
  · simulado: procesa los eventos reales pero no manda nada (modo sombra). No pausa el bot ante
    ecos ajenos: mientras conviva ManyChat, todos sus mensajes serían «ajenos».
  · real: manda por la API de Instagram.
"""
import copy
import logging
import os
from datetime import timedelta

from app import db
from app.automatizaciones.modelos import AutFlujo, AutFlujoVersion, ahora
from app.automatizaciones.motor import Motor
from app.automatizaciones.nucleo import eventos as ev
from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.transporte import TransporteMeta, TransporteSimulado
from app.models.instagram import InstagramWebhookEvento

logger = logging.getLogger(__name__)

APAGADO, SIMULADO, REAL = 'apagado', 'simulado', 'real'
# Un evento que lleva más que esto sin procesar (p. ej. al encender el motor) no se contesta:
# responderle a alguien que escribió hace horas como si fuera recién es peor que no responder.
ANTIGUEDAD_MAXIMA = timedelta(minutes=60)
LOTE = 200


def modo():
    valor = (os.environ.get('IG_MOTOR_MODO') or APAGADO).strip().lower()
    return valor if valor in (APAGADO, SIMULADO, REAL) else APAGADO


def _motor(transporte, momento):
    actual = modo()
    if transporte is None:
        transporte = TransporteMeta() if actual == REAL else TransporteSimulado()
    return Motor(transporte, momento, pausar_ante_ecos=(actual == REAL))


def procesar_pendientes(momento=None, transporte=None, limite=LOTE):
    """Pasa por el motor los eventos del webhook que todavía no se procesaron, en orden."""
    if modo() == APAGADO and transporte is None:
        return {'procesados': 0}
    momento = momento or ahora()
    motor = _motor(transporte, momento)
    pendientes = (InstagramWebhookEvento.query.filter(InstagramWebhookEvento.procesado_en.is_(None))
                  .order_by(InstagramWebhookEvento.id).limit(limite).all())
    resumen = {'procesados': 0}
    for fila in pendientes:
        evento_id = fila.id
        try:
            if momento - fila.recibido_en > ANTIGUEDAD_MAXIMA:
                resultados = ['antiguo']
            else:
                resultados = [motor.procesar(e) for e in ev.leer(fila.payload)] or ['sin_eventos']
            fila.resultado = ','.join(resultados)[:200]
        except Exception as error:  # un evento roto no puede trabar a los que vienen detrás
            db.session.rollback()
            logger.exception('[MOTOR IG] Error procesando el evento %s', evento_id)
            fila = db.session.get(InstagramWebhookEvento, evento_id)
            fila.resultado = f'error: {error}'[:200]
        fila.procesado_en = momento
        db.session.commit()
        resumen['procesados'] += 1
    return resumen


def despertar(momento=None, transporte=None):
    if modo() == APAGADO and transporte is None:
        return 0
    cantidad = _motor(transporte, momento or ahora()).despertar_vencidas()
    db.session.commit()
    return cantidad


def tick(momento=None, transporte=None):
    """Lo que corre el cron: primero lo nuevo, después las esperas vencidas."""
    momento = momento or ahora()
    resumen = procesar_pendientes(momento, transporte)
    resumen['despertadas'] = despertar(momento, transporte)
    return resumen


def publicar(flujo):
    """Congela el borrador como una versión nueva y la deja activa. Devuelve los errores si no se puede."""
    errores = g.validar(flujo.grafo)
    if errores:
        return errores
    ultimo = (db.session.query(db.func.max(AutFlujoVersion.numero)).filter_by(flujo_id=flujo.id).scalar() or 0)
    version = AutFlujoVersion(flujo_id=flujo.id, numero=ultimo + 1, grafo=copy.deepcopy(flujo.grafo), publicada_en=ahora())
    db.session.add(version)
    db.session.flush()
    flujo.version_publicada_id = version.id
    flujo.estado = AutFlujo.ACTIVO
    db.session.commit()
    return []
