"""Cuanto se usa la IA y quien la usa: el resumen del registro `AiUsage` (ver `claude_service`).

Solo admin y operator. Por defecto, el mes en curso; `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` cambia el
rango (ambos incluidos).
"""
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.decorators import admin_required
from app.models import AiUsage, User

bp = Blueprint('ai_usage_api', __name__)


def _rango():
    """(desde, hasta_exclusivo) como datetime. ValueError si una fecha no es AAAA-MM-DD."""
    hoy = date.today()
    desde = request.args.get('desde')
    hasta = request.args.get('hasta')
    desde = date.fromisoformat(desde) if desde else hoy.replace(day=1)
    hasta = date.fromisoformat(hasta) if hasta else hoy
    if hasta < desde:
        raise ValueError('hasta es anterior a desde.')
    medianoche = datetime.min.time()
    return datetime.combine(desde, medianoche), datetime.combine(hasta + timedelta(days=1), medianoche)


def _totales(query):
    return query.with_entities(
        func.count(AiUsage.id),
        func.coalesce(func.sum(AiUsage.input_tokens), 0),
        func.coalesce(func.sum(AiUsage.output_tokens), 0),
        func.coalesce(func.sum(AiUsage.cost_usd), 0),
    )


def _fila(llamadas, entrada, salida, costo):
    return {'llamadas': llamadas, 'input_tokens': int(entrada), 'output_tokens': int(salida),
            'cost_usd': round(float(costo), 6)}


@bp.route('/resumen', methods=['GET'])
@admin_required
def resumen():
    try:
        desde, hasta = _rango()
    except ValueError as e:
        return jsonify({'error': f'Rango inválido: {e}'}), 400

    base = AiUsage.query.filter(AiUsage.created_at >= desde, AiUsage.created_at < hasta)
    errores = base.filter(AiUsage.status == AiUsage.ERROR).count()

    por_usuario = (_totales(base).add_columns(AiUsage.user_id, User.username)
                   .outerjoin(User, User.id == AiUsage.user_id)
                   .group_by(AiUsage.user_id, User.username)
                   .order_by(func.sum(AiUsage.cost_usd).desc()).all())
    por_funcion = (_totales(base).add_columns(AiUsage.feature).group_by(AiUsage.feature)
                   .order_by(func.sum(AiUsage.cost_usd).desc()).all())
    por_modelo = (_totales(base).add_columns(AiUsage.model).group_by(AiUsage.model)
                  .order_by(func.sum(AiUsage.cost_usd).desc()).all())

    return jsonify({
        'desde': desde.date().isoformat(),
        'hasta': (hasta - timedelta(days=1)).date().isoformat(),
        'total': {**_fila(*_totales(base).one()), 'errores': errores},
        'por_usuario': [{'user_id': uid, 'usuario': nombre, **_fila(*t)} for *t, uid, nombre in por_usuario],
        'por_funcion': [{'feature': f, **_fila(*t)} for *t, f in por_funcion],
        'por_modelo': [{'model': m, **_fila(*t)} for *t, m in por_modelo],
    }), 200


@bp.route('/llamadas', methods=['GET'])
@admin_required
def llamadas():
    """Las ultimas llamadas del rango (hasta 200), para revisar una puntual o un error."""
    try:
        desde, hasta = _rango()
    except ValueError as e:
        return jsonify({'error': f'Rango inválido: {e}'}), 400
    query = AiUsage.query.filter(AiUsage.created_at >= desde, AiUsage.created_at < hasta)
    if request.args.get('user_id', type=int):
        query = query.filter(AiUsage.user_id == request.args.get('user_id', type=int))
    if request.args.get('feature'):
        query = query.filter(AiUsage.feature == request.args['feature'])
    filas = query.order_by(AiUsage.created_at.desc()).limit(200).all()
    return jsonify([f.to_dict() for f in filas]), 200
