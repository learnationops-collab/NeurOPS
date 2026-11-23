"""«Ningún horario me sirve» (Marlon, 19/11/2026, ADR-W199): después de agendar, el lead puede avisar que el
horario que tomó no le sirve y qué le quedaría bien. La agenda sigue en pie (la llamada no se pierde) y el
triage ve en la tarjeta que hay que reagendarla. Se guarda en `agenda_payload['sin_horario']`.

La página pública solo conoce la agenda por un token firmado que recibe al reservar: el id solo no alcanza
para escribir en una agenda ajena."""

from datetime import datetime, timezone

from flask import current_app
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.models import Appointment

SAL = 'agendas-sin-horario'
VALIDEZ_S = 30 * 24 * 3600  # un mes: alcanza para la sesión más lejana que se ofrece
MAX_TEXTO = 500


def _firmador():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SAL)


def token_de(appt_id):
    return _firmador().dumps(int(appt_id))


def guardar(token, texto):
    """Marca la agenda del token. Devuelve un código de error o None si quedó guardado."""
    texto = str(texto or '').strip()[:MAX_TEXTO]
    if not texto:
        return 'sin_texto'
    try:
        appt_id = _firmador().loads(str(token or ''), max_age=VALIDEZ_S)
    except BadSignature:
        return 'token'
    appt = db.session.get(Appointment, int(appt_id))
    if not appt:
        return 'token'
    datos = dict(appt.agenda_payload or {})
    datos['sin_horario'] = {'texto': texto, 'en': datetime.now(timezone.utc).isoformat(timespec='seconds')}
    appt.agenda_payload = datos
    flag_modified(appt, 'agenda_payload')
    db.session.commit()
    return None


def de(appt):
    """Lo que dejó el lead ({texto, en}) o None."""
    v = (appt.agenda_payload or {}).get('sin_horario')
    return v if isinstance(v, dict) and v.get('texto') else None
