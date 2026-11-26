"""«Activo / Inactivo» del setter en el Inbox (ADR-W245): cada vez que lo prende se abre un rato y al apagarlo se
cierra. Un rato que quedó abierto más de MAX_HORAS (se olvidó de apagarlo) se cierra solo en ese tope."""
from datetime import timedelta

from app import db
from app.automatizaciones.modelos import SetterActividad, ahora

MAX_HORAS = 12


def _abierto(user_id):
    rato = (SetterActividad.query.filter_by(user_id=user_id, hasta=None)
            .order_by(SetterActividad.desde.desc()).first())
    if rato and ahora() - rato.desde > timedelta(hours=MAX_HORAS):
        rato.hasta = rato.desde + timedelta(hours=MAX_HORAS)
        db.session.commit()
        return None
    return rato


def periodos(user_ids, desde, hasta):
    """{user_id: [(inicio, fin)]} de los ratos activos que tocan [desde, hasta], recortados a ese tramo."""
    filas = SetterActividad.query.filter(
        SetterActividad.user_id.in_(list(user_ids)), SetterActividad.desde < hasta,
        db.or_(SetterActividad.hasta.is_(None), SetterActividad.hasta > desde)).all()
    salida = {}
    for r in filas:
        fin = r.hasta or min(hasta, r.desde + timedelta(hours=MAX_HORAS))
        salida.setdefault(r.user_id, []).append((max(r.desde, desde), min(fin, hasta)))
    return salida


def activo_en(rangos, momento):
    return any(a <= momento <= b for a, b in rangos)


def estado(user_id):
    """{activo, desde, segundos_24h}: si está activo ahora y cuánto estuvo activo en las últimas 24 h."""
    rato = _abierto(user_id)
    fin = ahora()
    total = sum((b - a).total_seconds() for a, b in periodos([user_id], fin - timedelta(hours=24), fin).get(user_id, []))
    return {'activo': rato is not None, 'desde': rato.desde.isoformat() + 'Z' if rato else None,
            'segundos_24h': round(total)}


def cambiar(user_id, activo):
    rato = _abierto(user_id)
    if activo and rato is None:
        db.session.add(SetterActividad(user_id=user_id, desde=ahora()))
    elif not activo and rato is not None:
        rato.hasta = ahora()
    db.session.commit()
    return estado(user_id)
