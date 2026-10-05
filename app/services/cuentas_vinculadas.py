"""Una persona con varios roles: una cuenta por rol, enlazadas por `users.persona_id`.

Cada cuenta conserva su `user.id` y su historial (ventas, agendas, reportes, alias), que se atribuyen
por id y por texto y no se pueden fusionar sin riesgo. Lo que se comparte es la persona: desde
cualquiera de sus cuentas se puede pasar a otra con `POST /auth/switch-role`, sin volver a poner la
clave y sin que cuente como suplantación.
"""
import sqlalchemy as sa

from app import db
from app.models import User


class VinculoInvalido(ValueError):
    """La operación sobre las cuentas vinculadas no se puede hacer (el mensaje se muestra tal cual)."""


def _datos(u, actual_id=None):
    return {'id': u.id, 'username': u.username, 'role': u.role, 'activa': u.id == actual_id}


def cuentas_de(user):
    """Las cuentas ACTIVAS de la persona de `user`, incluida la suya. Vacío si no tiene vínculos."""
    if user is None or user.persona_id is None:
        return []
    filas = db.session.scalars(
        sa.select(User).where(User.persona_id == user.persona_id, User.is_active.is_(True))
        .order_by(User.id)).all()
    # Una persona de una sola cuenta activa no tiene nada que cambiar.
    return [_datos(u, user.id) for u in filas] if len(filas) > 1 else []


def puede_cambiar_a(user, destino):
    """¿`destino` es otra cuenta activa de la misma persona que `user`?"""
    return (user is not None and destino is not None and destino.id != user.id
            and user.persona_id is not None and destino.persona_id == user.persona_id
            and bool(destino.is_active))


def listar_personas():
    """Las personas con varias cuentas, para la pantalla de gestión: [{persona_id, cuentas:[...]}]."""
    filas = db.session.scalars(
        sa.select(User).where(User.persona_id.is_not(None)).order_by(User.persona_id, User.id)).all()
    por_persona = {}
    for u in filas:
        por_persona.setdefault(u.persona_id, []).append(
            {**_datos(u), 'email': u.email, 'is_active': bool(u.is_active)})
    return [{'persona_id': pid, 'cuentas': cuentas} for pid, cuentas in por_persona.items()]


def vincular(ids):
    """Enlaza las cuentas `ids` como una misma persona. Si alguna ya tenía persona, las demás se
    suman a ella; si el pedido junta a dos personas distintas, se unen en una."""
    ids = list(dict.fromkeys(int(i) for i in ids))
    if len(ids) < 2:
        raise VinculoInvalido('Elegí al menos dos cuentas para vincular.')
    cuentas = db.session.scalars(sa.select(User).where(User.id.in_(ids))).all()
    if len(cuentas) != len(ids):
        raise VinculoInvalido('Alguna de las cuentas no existe.')
    existentes = sorted({u.persona_id for u in cuentas if u.persona_id is not None})
    if existentes:
        persona = existentes[0]
        # Si una cuenta traía a otras de su persona vieja, se arrastran todas.
        for u in db.session.scalars(sa.select(User).where(User.persona_id.in_(existentes))).all():
            u.persona_id = persona
    else:
        persona = (db.session.scalar(sa.select(sa.func.max(User.persona_id))) or 0) + 1
    for u in cuentas:
        u.persona_id = persona
    db.session.commit()
    return persona


def desvincular(user_id):
    """Saca una cuenta de su persona. Si la persona queda con una sola cuenta, se deshace."""
    user = db.session.get(User, user_id)
    if user is None:
        raise VinculoInvalido('La cuenta no existe.')
    persona = user.persona_id
    if persona is None:
        raise VinculoInvalido('Esa cuenta no está vinculada.')
    user.persona_id = None
    resto = db.session.scalars(sa.select(User).where(User.persona_id == persona)).all()
    if len(resto) == 1:
        resto[0].persona_id = None
    db.session.commit()
