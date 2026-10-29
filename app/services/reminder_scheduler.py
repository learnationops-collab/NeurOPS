import logging
import os
import sys

logger = logging.getLogger(__name__)

_scheduler = None

# Cada cuánto se revisa si algún aviso llegó a su hora. Es también el atraso máximo con el que
# puede salir un aviso respecto de la hora que eligió el closer.
CHECK_INTERVAL_MINUTES = 5

# Cada cuánto se trae de la Academia el avance de todos los alumnos (`sincronizar_avance`, una o
# dos peticiones). La cartera del closer muestra la etapa y el atraso con, a lo sumo, este retraso.
AVANCE_INTERVAL_MINUTES = 60

# pg_advisory_lock: con varios workers de gunicorn, solo el que lo tiene corre los jobs (candado_pg).
CLAVE_DEL_SCHEDULER = 7_412_032


def _should_start():
    """Evita arrancar el scheduler donde no corresponde: comandos de Flask CLI (`flask db
    migrate`, `flask shell`, `create-admin`, etc. — no son el servidor web) y, con el reloader de
    debug de Werkzeug (`python run.py` en local), el proceso "watcher" que se descarta antes de
    lanzar el proceso real (evita que corra duplicado)."""
    if len(sys.argv) > 1 and sys.argv[1] in ('db', 'shell', 'create-admin', 'routes'):
        return False
    from flask import current_app
    if current_app.config.get('TESTING'):
        return False
    if current_app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return False
    return True


def _apagado(variable):
    return os.environ.get(variable, '').lower() == 'true'


def start_scheduler(app):
    """Arranca (una sola vez por proceso) los jobs de fondo: el que revisa si algún seguimiento
    llegó a la hora que su closer eligió para el aviso por WhatsApp y, cada hora, el que trae de la
    Academia el avance de los alumnos (`academy_snapshot_service.sincronizar_avance`).

    Corre cada CHECK_INTERVAL_MINUTES. El intervalo ES la precisión del aviso: un seguimiento
    configurado a las 09:07 sale en el primer tick posterior, así que 5 minutos es el techo de
    atraso. Correrlo de más es inofensivo — `send_due_reminders` solo manda lo que ya venció y
    una sola vez por día por cita."""
    global _scheduler
    if _scheduler is not None:
        return

    with app.app_context():
        if not _should_start():
            logger.info("[ReminderScheduler] No se arranca en este proceso (desactivado, CLI o proceso watcher del reloader).")
            return
        # Freno de emergencia global (`FOLLOWUP_REMINDERS_ENABLED=false`): sin envíos no tiene
        # sentido tickear los avisos. El corte de verdad vive en el servicio, así que el endpoint
        # de cron externo queda cubierto igual.
        # `DISABLE_REMINDER_SCHEDULER=true` apaga solo los avisos en proceso (en producción los
        # manda el cron externo); el avance tiene su propio interruptor.
        from app.services.closer_followup_service import reminders_enabled
        con_avisos = reminders_enabled() and not _apagado('DISABLE_REMINDER_SCHEDULER')
        con_avance = bool(os.environ.get('ACADEMY_API_TOKEN')) and not _apagado('DISABLE_ACADEMY_PROGRESS_SYNC')
        if not (con_avisos or con_avance):
            logger.info("[ReminderScheduler] No se arranca: sin recordatorios ni Academia configurada.")
            return

    from apscheduler.schedulers.background import BackgroundScheduler

    from app.services.candado_pg import soy_lider

    def _tick():
        with app.app_context():
            from app.services.closer_followup_service import CloserFollowUpService
            try:
                if not soy_lider(CLAVE_DEL_SCHEDULER):
                    return
                result = CloserFollowUpService.send_due_reminders()
                if result.get('sent'):
                    logger.info(f"[ReminderScheduler] Recordatorios enviados: {result}")
            except Exception as e:
                logger.error(f"[ReminderScheduler] Error en el tick: {e}")

    def _avance():
        with app.app_context():
            from app.services import academy_payment_status, academy_snapshot_service
            try:
                if not soy_lider(CLAVE_DEL_SCHEDULER):
                    return
                academy_snapshot_service.sincronizar_avance()
            except Exception as e:
                logger.error(f"[ReminderScheduler] Error trayendo el avance de la Academia: {e}")
            # Una vez por día: el estado de pago de quienes tienen una cuota que entra en "por vencer" o "vencida".
            academy_payment_status.avisar_cambios_por_fecha()

    def _senas():
        with app.app_context():
            from app.services import sale_service
            try:
                marcadas = sale_service.marcar_senas_sin_seguir()
                if marcadas:
                    logger.info(f"[ReminderScheduler] Señas sin seguir marcadas para revisar: {marcadas}")
            except Exception as e:
                logger.error(f"[ReminderScheduler] Error marcando señas sin seguir: {e}")

    def _movidas():
        with app.app_context():
            from app.agendas_v2.movidas import sincronizar_movidas
            try:
                if not soy_lider(CLAVE_DEL_SCHEDULER):
                    return
                n = sincronizar_movidas()
                if n:
                    logger.info(f"[ReminderScheduler] Agendas movidas o canceladas en Google seguidas en Work: {n}")
            except Exception as e:
                logger.error(f"[ReminderScheduler] Error siguiendo las agendas movidas en Google: {e}")

    def _abandonos():
        with app.app_context():
            from app.agendas_v2.abandonos import avisar_abandonos
            try:
                if not soy_lider(CLAVE_DEL_SCHEDULER):
                    return
                n = avisar_abandonos()
                if n:
                    logger.info(f"[ReminderScheduler] Leads que no terminaron de agendar avisados en Discord: {n}")
            except Exception as e:
                logger.error(f"[ReminderScheduler] Error avisando leads que no terminaron de agendar: {e}")

    from datetime import datetime, timedelta

    from app.agendas_v2.movidas import MINUTOS as MOVIDAS_MINUTOS
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(_movidas, 'interval', minutes=MOVIDAS_MINUTOS,
                       id='agendas_movidas_en_google', next_run_time=datetime.now() + timedelta(minutes=4))
    _scheduler.add_job(_abandonos, 'interval', minutes=1,
                       id='agendas_abandonos', next_run_time=datetime.now() + timedelta(minutes=2))
    _scheduler.add_job(_senas, 'interval', minutes=AVANCE_INTERVAL_MINUTES,
                       id='senas_sin_seguir', next_run_time=datetime.now() + timedelta(minutes=3))
    if con_avisos:
        # next_run_time=ahora: corre una vez apenas arranca el proceso (inofensivo —
        # send_due_reminders solo manda lo que ya llegó a su hora y no repite en el día) para no
        # dejar pasar un intervalo entero sin revisar tras un deploy o reinicio.
        _scheduler.add_job(_tick, 'interval', minutes=CHECK_INTERVAL_MINUTES,
                           id='followup_reminders', next_run_time=datetime.now())
    if con_avance:
        # El primero a los 2 minutos: no compite con el arranque del deploy.
        _scheduler.add_job(_avance, 'interval', minutes=AVANCE_INTERVAL_MINUTES,
                           id='academy_progress', next_run_time=datetime.now() + timedelta(minutes=2))
    _scheduler.start()
    logger.info(f"[ReminderScheduler] Scheduler arrancado (avisos: {con_avisos}, avance de la Academia cada {AVANCE_INTERVAL_MINUTES} min: {con_avance}).")
