"""La suscripción de Work, empujada a la Academia cada vez que cambia (fase 4, 20/10/2026).

Work es la fuente de verdad (`subscription_service`): la Academia refleja lo que diga acá, también
cuando acorta (una corrección o un acceso quitado). Cada `otorgar` anota la suscripción tocada en
`session.info`; en `before_commit` se arma el aviso (todavía se puede leer la base) y en
`after_commit` sale en un hilo, como `academy_payment_sync`: lo guardado no espera a la Academia, y
si falla queda en el log.

Apagado salvo `ACADEMY_SUBSCRIPTIONS_PUSH=true`: se enciende cuando la Academia tenga su
`POST /api/v1/subscriptions` en producción.
"""
import logging
import os
import threading

from flask import current_app
from sqlalchemy import event

from app import db

logger = logging.getLogger(__name__)

KEY_TOCADAS = 'subs_tocadas'
KEY_AVISOS = 'subs_avisos'


def activo():
    return os.environ.get('ACADEMY_SUBSCRIPTIONS_PUSH', '').strip().lower() == 'true'


def anotar(session, sub):
    """La llama `subscription_service.otorgar` por cada suscripción que cambia."""
    session.info.setdefault(KEY_TOCADAS, []).append(sub)


def aviso(sub):
    """Lo que viaja a la Academia: la suscripción entera y el último cambio, con quién y por qué."""
    client = sub.client
    eventos = sub.events.all()
    ultimo = eventos[-1] if eventos else None
    return {
        'work_client_id': sub.client_id,
        'email': (client.email or '').strip().lower() or None,
        'learnation_user_id': client.learnation_user_id,
        'product_slug': sub.product_slug,
        'starts_at': sub.starts_at.isoformat(),
        'expires_at': sub.expires_at.isoformat(),
        'is_deposit': bool(sub.is_deposit),
        'status': sub.status,
        'event': ultimo.to_dict() if ultimo else None,
    }


def _enviar(avisos, app):
    from app.services.learnation_service import LearnationAPIError, LearnationService

    with app.app_context():
        for payload in avisos:
            try:
                LearnationService.report_subscription(payload)
            except LearnationAPIError as e:
                app.logger.warning(f"[ACADEMY SUBS] Cliente {payload['work_client_id']}: {e} ({e.status_code})")
            except Exception as e:
                app.logger.error(f"[ACADEMY SUBS] Cliente {payload['work_client_id']}: {e}")


def register_subscription_sync(app):
    @event.listens_for(db.session, 'before_commit')
    def _armar(session):
        tocadas = session.info.pop(KEY_TOCADAS, [])
        if not tocadas or not activo():
            return
        try:
            session.flush()
            unicas = {id(s): s for s in tocadas if s.id is not None}.values()
            session.info[KEY_AVISOS] = [aviso(s) for s in unicas]
        except Exception as e:
            logger.error(f'[ACADEMY SUBS] No se pudo armar el aviso: {e}')

    @event.listens_for(db.session, 'after_commit')
    def _mandar(session):
        avisos = session.info.pop(KEY_AVISOS, [])
        if avisos:
            threading.Thread(target=_enviar, args=(avisos, current_app._get_current_object()),
                             daemon=True, name='academy-subs').start()

    @event.listens_for(db.session, 'after_rollback')
    def _olvidar(session):
        session.info.pop(KEY_TOCADAS, None)
        session.info.pop(KEY_AVISOS, None)
