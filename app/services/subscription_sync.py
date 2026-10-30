"""La suscripción de Work, empujada a la Academia cada vez que cambia (fase 4, 20/10/2026).

Work es la fuente de verdad (`subscription_service`): la Academia refleja lo que diga acá, también
cuando acorta (una corrección o un acceso quitado). Cada `otorgar` anota la suscripción tocada en
`session.info`; en `before_commit` se arma el aviso (todavía se puede leer la base) y en
`after_commit` sale en un hilo, como `academy_payment_sync`: lo guardado no espera a la Academia.

Lo que no llega no se pierde: cada suscripción anota hasta cuándo la Academia la tiene al día
(`academy_synced_at`), y el cron de la Academia reenvía las que cambiaron después
(`reenviar_pendientes`), también las que se cambiaron sin `otorgar` y las de un cliente al que se le
vincula la cuenta de la Academia después (`_al_vincular`). El hilo no es daemon: un
script o un worker que termina espera a que salga el aviso en vez de cortarlo.

Apagado salvo `ACADEMY_SUBSCRIPTIONS_PUSH=true`: se enciende cuando la Academia tenga su
`POST /api/v1/subscriptions` en producción.
"""
import logging
import os
import threading
from datetime import datetime

from flask import current_app
from sqlalchemy import event, inspect, or_, update

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
        'work_uuid': sub.person_uuid or client.person_uuid,
        'email': (client.email or '').strip().lower() or None,
        'learnation_user_id': client.learnation_user_id,
        'product_slug': sub.product_slug,
        'starts_at': sub.starts_at.isoformat(),
        'expires_at': sub.expires_at.isoformat(),
        'is_deposit': bool(sub.is_deposit),
        'status': sub.status,
        'event': ultimo.to_dict() if ultimo else None,
    }


def _avisar(sub_id, payload, armado):
    """Manda un aviso y, si la Academia respondió algo definitivo, marca la suscripción como avisada
    hasta `armado`. Un 404 (sin alumno) o un 422 también cuentan: reenviarlo no lo cambia. Una
    caída, un 429 o un 5xx no: lo reintenta el cron."""
    from app.models import Subscription
    from app.services.learnation_service import LearnationAPIError, LearnationService

    try:
        LearnationService.report_subscription(payload)
    except LearnationAPIError as e:
        logger.warning(f"[ACADEMY SUBS] Cliente {payload['work_client_id']}: {e} ({e.status_code})")
        if e.status_code is None or e.status_code == 429 or e.status_code >= 500:
            return False
    except Exception as e:
        logger.error(f"[ACADEMY SUBS] Cliente {payload['work_client_id']}: {e}")
        return False
    db.session.execute(update(Subscription).where(Subscription.id == sub_id)
                       .values(academy_synced_at=armado, updated_at=Subscription.updated_at))
    db.session.commit()
    return True


def _enviar(avisos, armado, app):
    with app.app_context():
        for sub_id, payload in avisos:
            _avisar(sub_id, payload, armado)


def reenviar_pendientes(limite=20):
    """Las suscripciones que cambiaron después del último aviso que la Academia confirmó, de la más
    vieja a la más nueva, hasta `limite` (el tope de 60 peticiones por minuto es compartido). La
    llama el cron de la Academia; sincrónica."""
    from app.models import Subscription

    if not activo():
        return {'pendientes': 0, 'enviadas': 0}
    pendientes = (Subscription.query
                  .filter(or_(Subscription.academy_synced_at.is_(None),
                              Subscription.academy_synced_at < Subscription.updated_at))
                  .order_by(Subscription.updated_at).limit(limite).all())
    enviadas = 0
    for sub in pendientes:
        try:
            armado = datetime.utcnow()
            enviadas += _avisar(sub.id, aviso(sub), armado)
        except Exception as e:
            db.session.rollback()
            logger.error(f'[ACADEMY SUBS] Reenvío de la suscripción {sub.id}: {e}')
    return {'pendientes': len(pendientes), 'enviadas': enviadas}


def al_registrarse(client):
    """El alumno se acaba de registrar en la Academia (`POST /people/resolve`): se le reenvían ya sus
    suscripciones. Las que salieron antes de que tuviera cuenta dieron 404, se dieron por hechas y
    nada las reenviaba (Luis Martínez Cabrera, 29/10/2026: compró Ace Learners y entró con el
    gratuito). En un hilo, después del commit de quien la llama."""
    from app.models import Subscription

    if client is None or not activo():
        return
    filtro = Subscription.client_id == client.id
    if client.person_uuid:
        filtro = or_(filtro, Subscription.person_uuid == client.person_uuid)
    subs = Subscription.query.filter(filtro).order_by(Subscription.updated_at).all()
    if subs:
        threading.Thread(target=_enviar, args=([(s.id, aviso(s)) for s in subs], datetime.utcnow(),
                                               current_app._get_current_object()),
                         daemon=False, name='academy-subs').start()


def _al_vincular(session):
    """Un cliente al que se le vincula el alumno de la Academia o se le cambia el correo: sus
    suscripciones vuelven a quedar pendientes. El aviso que salió antes del vínculo dio 404 y se dio
    por hecho, y nada lo reenviaba (Natalia Melgarejo, 27/10/2026: seña sin acceso)."""
    from app.models import Client, Subscription

    clientes = [c for c in session.dirty if isinstance(c, Client) and c.id is not None
                and (inspect(c).attrs.learnation_user_id.history.has_changes()
                     or inspect(c).attrs.email.history.has_changes())]
    for c in clientes:
        filtro = Subscription.client_id == c.id
        if c.person_uuid:
            filtro = or_(filtro, Subscription.person_uuid == c.person_uuid)
        with session.no_autoflush:
            subs = session.query(Subscription).filter(filtro, Subscription.academy_synced_at.isnot(None)).all()
        for sub in subs:
            sub.academy_synced_at = None


def register_subscription_sync(app):
    @event.listens_for(db.session, 'before_flush')
    def _vincular(session, _contexto, _instancias):
        if activo():
            _al_vincular(session)

    @event.listens_for(db.session, 'before_commit')
    def _armar(session):
        tocadas = session.info.pop(KEY_TOCADAS, [])
        if not tocadas or not activo():
            return
        try:
            session.flush()
            unicas = {id(s): s for s in tocadas if s.id is not None}.values()
            session.info[KEY_AVISOS] = (datetime.utcnow(), [(s.id, aviso(s)) for s in unicas])
        except Exception as e:
            logger.error(f'[ACADEMY SUBS] No se pudo armar el aviso: {e}')

    @event.listens_for(db.session, 'after_commit')
    def _mandar(session):
        armado, avisos = session.info.pop(KEY_AVISOS, (None, []))
        if avisos:
            threading.Thread(target=_enviar, args=(avisos, armado, current_app._get_current_object()),
                             daemon=False, name='academy-subs').start()

    @event.listens_for(db.session, 'after_rollback')
    def _olvidar(session):
        session.info.pop(KEY_TOCADAS, None)
        session.info.pop(KEY_AVISOS, None)
