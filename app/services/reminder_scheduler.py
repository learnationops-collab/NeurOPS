import logging
import os
import sys

logger = logging.getLogger(__name__)

_scheduler = None


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
    """Arranca (una sola vez por proceso) el job que revisa cada 15 minutos si hay seguimientos
    pendientes para avisarle a algún closer por WhatsApp, respetando la hora local de cada uno.
    Dos franjas por día (10am y 4pm, ver CloserFollowUpService.REMINDER_SLOTS) — cada tick
    intenta las dos; cada una tiene su propio gate de hora y su propio campo de "ya enviado hoy",
    así que un closer puede recibir hasta dos avisos por día mientras le queden seguimientos
    pendientes sin resolver."""
    global _scheduler
    if _scheduler is not None:
        return

    with app.app_context():
        if not _should_start():
            logger.info("[ReminderScheduler] No se arranca en este proceso (CLI o proceso watcher del reloader).")
            return

    from apscheduler.schedulers.background import BackgroundScheduler

    def _tick():
        with app.app_context():
            from app.services.closer_followup_service import CloserFollowUpService
            for slot in CloserFollowUpService.REMINDER_SLOTS:
                try:
                    result = CloserFollowUpService.send_due_reminders(slot=slot)
                    if result.get('sent'):
                        logger.info(f"[ReminderScheduler] Recordatorios enviados: {result}")
                except Exception as e:
                    logger.error(f"[ReminderScheduler] Error en el tick (slot {slot}): {e}")

    from datetime import datetime
    _scheduler = BackgroundScheduler(daemon=True)
    # next_run_time=ahora: corre una vez apenas arranca el proceso (inofensivo — el hour_gate de
    # send_due_reminders igual filtra si todavía no son las 10am locales de cada closer) y no
    # deja pasar hasta 15 minutos sin revisar tras un deploy/reinicio.
    _scheduler.add_job(_tick, 'interval', minutes=15, id='followup_reminders', next_run_time=datetime.now())
    _scheduler.start()
    logger.info("[ReminderScheduler] Scheduler de recordatorios de seguimiento arrancado (cada 15 min).")
