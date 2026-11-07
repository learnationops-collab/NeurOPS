"""Finanzas › Profit (07/11/2026): la foto de saldos de las cuentas de cada mes.

GET ?month=YYYY-MM devuelve la foto (o null si nadie la cargó). PUT {month, accounts, ads_spent,
next_income} la reemplaza y la fecha con el momento: desde ahí, lo que se pague del payroll sigue
restando en Profit (ver app/models/liquidez.py).
"""
from datetime import datetime

from flask import jsonify, request
from flask_login import current_user, login_required

from app import db
from app.models import FinanceLiquidity

from . import bp
from .finance import finance_admin_required

MAX_CUENTAS = 12
MAX_PARTES = 6


def _mes_valido(mes):
    return isinstance(mes, str) and len(mes) == 7 and mes[4] == '-' and mes.replace('-', '').isdigit()


def _monto(valor):
    return round(float(valor or 0), 2)


def _cuentas(crudas):
    if not isinstance(crudas, dict) or len(crudas) > MAX_CUENTAS:
        raise ValueError('«accounts» tiene que ser {cuenta: [montos]}')
    limpias = {}
    for cuenta, partes in crudas.items():
        partes = partes if isinstance(partes, list) else [partes]
        limpias[str(cuenta)[:40]] = [_monto(p) for p in partes[:MAX_PARTES]]
    return limpias


@bp.route('/public/finance/liquidez', methods=['GET', 'PUT'])
@login_required
@finance_admin_required
def liquidez_del_mes():
    datos = request.get_json(silent=True) or {}
    mes = request.args.get('month') or datos.get('month')
    if not _mes_valido(mes):
        return jsonify({"error": "Parámetro 'month' (YYYY-MM) es requerido"}), 400
    foto = FinanceLiquidity.query.filter_by(month=mes).first()
    if request.method == 'GET':
        return jsonify(foto.to_dict() if foto else None), 200

    try:
        cuentas = _cuentas(datos.get('accounts') or {})
        siguiente = [_monto(m) for m in (datos.get('next_income') or [])[:MAX_PARTES]]
        anuncios = None if datos.get('ads_spent') in (None, '') else _monto(datos['ads_spent'])
    except (TypeError, ValueError) as e:
        return jsonify({"error": str(e) or 'Montos inválidos'}), 400
    if not foto:
        foto = FinanceLiquidity(month=mes)
        db.session.add(foto)
    foto.accounts, foto.next_income, foto.ads_spent = cuentas, siguiente, anuncios
    foto.taken_at = datetime.utcnow()
    foto.updated_by_id = current_user.id
    db.session.commit()
    return jsonify(foto.to_dict()), 200
