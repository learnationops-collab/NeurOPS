"""Lo que llaman el cron y la API: procesar los eventos guardados, despertar esperas, publicar flujos.

IG_MOTOR_MODO decide qué pasa en producción:
  · apagado (por defecto): no procesa nada.
  · simulado: procesa los eventos reales pero no manda nada (modo sombra). No pausa el bot ante
    ecos ajenos: mientras conviva ManyChat, todos sus mensajes serían «ajenos».
  · real: manda por la API de Instagram.

Quién lo corre: el webhook guarda cada evento y despierta al «reloj» del proceso (un hilo que
procesa al instante y, sin avisos, cada INTERVALO para las esperas vencidas). Los eventos se
procesan de a uno y en orden: un candado de Postgres impide que dos procesos corran a la vez, así
el eco de un mensaje recién mandado nunca se lee antes de que el motor registre que lo mandó.
"""
import copy
import logging
import os
import threading
import time
from contextlib import contextmanager
from datetime import timedelta

from sqlalchemy import text

from app import db
from app.automatizaciones import recuperacion
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
INTERVALO = 60  # segundos entre vueltas del reloj cuando no llega nada
CLAVE_DEL_CANDADO = 7_412_031  # pg_advisory_lock: una sola corrida del motor a la vez entre procesos


def modo():
    valor = (os.environ.get('IG_MOTOR_MODO') or APAGADO).strip().lower()
    return valor if valor in (APAGADO, SIMULADO, REAL) else APAGADO


def _motor(transporte, momento):
    actual = modo()
    if transporte is None:
        transporte = TransporteMeta() if actual == REAL else TransporteSimulado()
    return Motor(transporte, momento, pausar_ante_ecos=(actual == REAL))


def procesar_pendientes(momento=None, transporte=None, limite=LOTE):
    """Pasa por el motor los eventos del webhook que todavía no se procesaron, en orden, hasta vaciar la cola."""
    if modo() == APAGADO and transporte is None:
        return {'procesados': 0}
    momento = momento or ahora()
    motor = _motor(transporte, momento)
    pendientes = InstagramWebhookEvento.query.filter(InstagramWebhookEvento.procesado_en.is_(None))
    # Lo acumulado de antes (p. ej. mientras el motor estaba apagado) se marca de una vez: no se contesta.
    antiguos = (pendientes.filter(InstagramWebhookEvento.recibido_en < momento - ANTIGUEDAD_MAXIMA)
                .update({'procesado_en': momento, 'resultado': 'antiguo'}, synchronize_session=False))
    db.session.commit()
    resumen = {'procesados': antiguos}
    while True:
        lote = pendientes.order_by(InstagramWebhookEvento.id).limit(limite).all()
        if not lote:
            return resumen
        for fila in lote:
            _procesar_fila(motor, fila)
            resumen['procesados'] += 1


def _procesar_fila(motor, fila):
    evento_id = fila.id
    try:
        resultados = [motor.procesar(e) for e in ev.leer(fila.payload)] or ['sin_eventos']
        fila.resultado = ','.join(resultados)[:200]
    except Exception as error:  # un evento roto no puede trabar a los que vienen detrás
        db.session.rollback()
        logger.exception('[MOTOR IG] Error procesando el evento %s', evento_id)
        fila = db.session.get(InstagramWebhookEvento, evento_id)
        fila.resultado = f'error: {error}'[:200]
    fila.procesado_en = motor.ahora
    db.session.commit()


def despertar(momento=None, transporte=None):
    if modo() == APAGADO and transporte is None:
        return 0
    cantidad = _motor(transporte, momento or ahora()).despertar_vencidas()
    db.session.commit()
    return cantidad


def tick(momento=None, transporte=None):
    """Lo que corre el cron: primero lo nuevo, después los DMs que el webhook no trajo (solo en real) y
    las esperas vencidas."""
    momento = momento or ahora()
    resumen = procesar_pendientes(momento, transporte)
    if modo() == REAL and transporte is None:
        try:
            resumen['recuperados'] = recuperacion.recuperar(TransporteMeta(), momento)
        except Exception:  # sin recuperación el motor sigue con lo del webhook; no puede frenar las esperas
            db.session.rollback()
            logger.exception('[MOTOR IG] Falló la recuperación de DMs por la API')
            resumen['recuperados'] = 0
        if resumen['recuperados']:
            resumen['procesados'] += procesar_pendientes(momento)['procesados']
    resumen['despertadas'] = despertar(momento, transporte)
    return resumen


# --- El reloj del proceso ------------------------------------------------------------------------

@contextmanager
def candado():
    """True si este proceso puede correr el motor ahora; False si otro ya lo está corriendo."""
    if db.engine.dialect.name != 'postgresql':
        yield True
        return
    with db.engine.connect() as conexion:
        tengo = conexion.execute(text('SELECT pg_try_advisory_lock(:k)'), {'k': CLAVE_DEL_CANDADO}).scalar()
        conexion.commit()
        try:
            yield bool(tengo)
        finally:
            if tengo:
                conexion.execute(text('SELECT pg_advisory_unlock(:k)'), {'k': CLAVE_DEL_CANDADO})
                conexion.commit()


class MotorOcupado(Exception):
    """El reloj tiene el candado y no lo soltó a tiempo: la acción se puede volver a intentar."""


class MotorApagado(Exception):
    """Con el motor apagado no se mueve a nadie: el recorrido no avanzaría."""


@contextmanager
def con_motor(momento=None, intentos=6, espera=0.5):
    """El motor para una acción de la bandeja (`acciones.py`), con el candado tomado para no pisarse
    con el reloj. Guarda al salir; si algo falla, no guarda nada."""
    if modo() == APAGADO:
        raise MotorApagado()
    for _ in range(intentos):
        with candado() as tengo:
            if not tengo:
                time.sleep(espera)
                continue
            try:
                yield _motor(None, momento or ahora())
                db.session.commit()
            except Exception:
                db.session.rollback()
                raise
            return
    raise MotorOcupado()


def correr_una_vuelta():
    """Una vuelta del reloj: lo nuevo y las esperas vencidas, si nadie más lo está corriendo."""
    if modo() == APAGADO:
        return None
    with candado() as tengo:
        return tick() if tengo else None


_aviso = threading.Event()
_reloj = None
_reloj_lock = threading.Lock()


def avisar(app):
    """Lo llama el webhook al guardar un evento: arranca el reloj del proceso si hace falta y lo despierta."""
    global _reloj
    if modo() == APAGADO:
        return
    with _reloj_lock:
        if _reloj is None or not _reloj.is_alive():
            _reloj = threading.Thread(target=_bucle, args=(app,), daemon=True, name='motor-instagram')
            _reloj.start()
    _aviso.set()


def _bucle(app):
    while True:
        _aviso.wait(timeout=INTERVALO)
        _aviso.clear()
        with app.app_context():
            try:
                correr_una_vuelta()
            except Exception:
                logger.exception('[MOTOR IG] Falló una vuelta del reloj')
            finally:
                db.session.remove()


# --- Flujos -------------------------------------------------------------------------------------

def publicar(flujo, momento=None, grafo=None, activar=True):
    """Congela el borrador como una versión nueva y la deja activa. Devuelve los errores si no se puede.
    `grafo`: publicar ese en lugar del borrador (el setter que cambia textos parte de lo publicado, no del
    borrador a medio hacer). `activar=False`: no toca el estado (un flujo pausado sigue pausado)."""
    grafo = flujo.grafo if grafo is None else grafo
    errores = g.validar(grafo)
    if errores:
        return errores
    momento = momento or ahora()
    ultimo = (db.session.query(db.func.max(AutFlujoVersion.numero)).filter_by(flujo_id=flujo.id).scalar() or 0)
    version = AutFlujoVersion(flujo_id=flujo.id, numero=ultimo + 1, grafo=copy.deepcopy(grafo), publicada_en=momento)
    db.session.add(version)
    db.session.flush()
    flujo.version_publicada_id = version.id
    if activar:
        _activar(flujo, momento)
    db.session.commit()
    return []


def activar(flujo, momento=None):
    _activar(flujo, momento or ahora())
    db.session.commit()


def _activar(flujo, momento):
    """Republicar un flujo que ya estaba activo no le cambia el inicio; reactivarlo sí (hacia adelante)."""
    if flujo.estado != AutFlujo.ACTIVO:
        flujo.activo_desde = momento
    flujo.estado = AutFlujo.ACTIVO
