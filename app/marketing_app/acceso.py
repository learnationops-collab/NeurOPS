"""Quién entra a Learnation Marketing en Work (ADR-W278): Mario, Marlon, Santi y Kerwin, por su mail.

No depende del rol: Marlon y Kerwin no son operadores y la sección vive en /ops/dashboard. Entra la persona
si el mail de su cuenta, o el de cualquiera de sus cuentas vinculadas, está en la lista. `MARKETING_APP_EMAILS`
(separados por coma) suma mails sin deploy. Simulando a otro no se entra: la sección es de la persona real.
"""
import os
from functools import wraps

from flask import jsonify
from flask_login import current_user

EMAILS = frozenset({
    'mario@neurocogniciones.com', 'mario@thelearnation.com',
    'marlon@thelearnation.com', 'marlongarcia27948@gmail.com',
    'santiago@thelearnation.com', 'santi@thelearnation.com',
    'kerwin@thelearnation.com',
})


def _lista():
    extra = {e.strip().lower() for e in (os.environ.get('MARKETING_APP_EMAILS') or '').split(',') if e.strip()}
    return EMAILS | extra


def _emails_de(user):
    from app.models import User
    mails = {(user.email or '').lower()}
    if getattr(user, 'persona_id', None) is not None:
        for u in User.query.filter(User.persona_id == user.persona_id, User.is_active.is_(True)).all():
            mails.add((u.email or '').lower())
    return {m for m in mails if m}


def puede(user=None):
    from app.models import get_impersonation_state
    user = user or current_user
    if not getattr(user, 'is_authenticated', False):
        return False
    if get_impersonation_state()[0]:
        return False
    return bool(_emails_de(user) & _lista())


def requiere_acceso(f):
    @wraps(f)
    def envuelta(*args, **kwargs):
        if not getattr(current_user, 'is_authenticated', False):
            return jsonify({'code': 'not_granted', 'message': 'Iniciá sesión en Work.'}), 401
        if not puede():
            return jsonify({'code': 'not_granted', 'message': 'Tu cuenta no tiene Learnation Marketing.'}), 403
        return f(*args, **kwargs)
    return envuelta
