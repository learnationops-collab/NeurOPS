import logging
import os
import sys

logger = logging.getLogger(__name__)

_scheduler = None

# Cada cuánto se revisa si algún aviso llegó a su hora. Es también el atraso máximo con el que
# puede salir un aviso respecto de la hora que eligió el closer.
CHECK_INTERVAL_MINUTES = 5


def _should_start():
    """Evita arrancar el scheduler donde no corresponde: comandos de Flask CLI (`flask db
    migrate`, `flask shell`, `create-admin`, etc. — no son el servidor web) y, con el reloader de
    debug de Werkzeug (`python run.py` en local), el proceso "watcher" que se descarta antes de
    lanzar el proceso real (evita que corra duplicado)."""
    if os.environ.get('DISABLE_REMINDER_SCHEDULER', '').lower() == 'true':
        return False
    # Freno de emergencia global (`FOLLOWUP_REMINDERS_ENABLED=false`): sin envíos no tiene
    # sentido tickear. El corte de verdad vive en el servicio, así que el endpoint de cron
    # externo queda cubierto igual.
    from app.services.closer_followup_service import reminders_enabled
    if not reminders_enabled():
        return False
    if len(sys.argv) > 1 and sys.argv[1] in ('db', 'shell', 'create-admin', 'routes'):
        return False
    from flask import current_app
    if current_app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return False
    return True


def start_scheduler(app):
    """Arranca (una sola vez por proceso) el job que revisa si algún seguimiento llegó a la hora
    que su closer eligió para el aviso por WhatsApp.

    Corre cada CHECK_INTERVAL_MINUTES. El intervalo ES la precisión del aviso: un seguimiento
    configurado a las 09:07 sale en el primer tick posterior, así que 5 minutos es el techo de
    atraso. Correrlo de más es inofensivo — `send_due_reminders` solo manda lo que ya venció y
    una sola vez por día por cita."""
    global _scheduler
    if _scheduler is not None:
        return

    with app.app_context():
        if not _should_start():
            logger.info("[ReminderScheduler] No se arranca en este proceso (recordatorios desactivados, CLI o proceso watcher del reloader).")
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

    from datetime import datetime
    _scheduler = BackgroundScheduler(daemon=True)
    # next_run_time=ahora: corre una vez apenas arranca el proceso (inofensivo — send_due_reminders
    # solo manda lo que ya llegó a su hora y no repite en el día) para no dejar pasar un intervalo
    # entero sin revisar tras un deploy o reinicio.
    _scheduler.add_job(_tick, 'interval', minutes=CHECK_INTERVAL_MINUTES,
                       id='followup_reminders', next_run_time=datetime.now())
    _scheduler.start()
    logger.info(f"[ReminderScheduler] Scheduler de avisos de seguimiento arrancado (cada {CHECK_INTERVAL_MINUTES} min).")
