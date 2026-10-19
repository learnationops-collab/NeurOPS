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


def _should_start():
    """Evita arrancar el scheduler donde no corresponde: comandos de Flask CLI (`flask db
    migrate`, `flask shell`, `create-admin`, etc. — no son el servidor web) y, con el reloader de
    debug de Werkzeug (`python run.py` en local), el proceso "watcher" que se descarta antes de
    lanzar el proceso real (evita que corra duplicado)."""
    if os.environ.get('DISABLE_REMINDER_SCHEDULER', '').lower() == 'true':
        return False
    if len(sys.argv) > 1 and sys.argv[1] in ('db', 'shell', 'create-admin', 'routes'):
        return False
    from flask import current_app
    if current_app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return False
    return True


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
        from app.services.closer_followup_service import reminders_enabled
        con_avisos = reminders_enabled()
        con_avance = bool(os.environ.get('ACADEMY_API_TOKEN'))
        if not (con_avisos or con_avance):
            logger.info("[ReminderScheduler] No se arranca: sin recordatorios ni Academia configurada.")
            return

    from apscheduler.schedulers.background import BackgroundScheduler

    def _tick():
        with app.app_context():
            from app.services.closer_followup_service import CloserFollowUpService
            try:
                result = CloserFollowUpService.send_due_reminders()
                if result.get('sent'):
                    logger.info(f"[ReminderScheduler] Recordatorios enviados: {result}")
            except Exception as e:
                logger.error(f"[ReminderScheduler] Error en el tick: {e}")

    def _avance():
        with app.app_context():
            from app.services import academy_snapshot_service
            try:
                academy_snapshot_service.sincronizar_avance()
            except Exception as e:
                logger.error(f"[ReminderScheduler] Error trayendo el avance de la Academia: {e}")

    from datetime import datetime, timedelta
    _scheduler = BackgroundScheduler(daemon=True)
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
