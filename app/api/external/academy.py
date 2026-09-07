from flask import jsonify
from sqlalchemy import func

from app.models import Client, FinancialSale
from app.decorators import require_academy_token
from app.api.external import bp


def _normalize_email(email):
    return (email or '').strip().lower()


def _find_client(email_norm):
    return Client.query.filter(func.lower(Client.email) == email_norm).first()


def _client_dict(client):
    return {
        "id": client.id,
        "full_name": client.full_name,
        "email": client.email,
        "phone": client.phone,
    }


def _payments_list(email_norm):
    """Lista blanca explícita de campos - nunca reusar to_dict() de FinancialSale, que trae
    columnas internas (comisiones, email_vendedor, raw_data, etc.) que no le competen a la
    Academia. Ver docs/academy_consulta_ventas.md."""
    sales = FinancialSale.query.filter(
        func.lower(FinancialSale.mail_cliente) == email_norm
    ).order_by(FinancialSale.date.asc()).all()

    return [{
        "fecha": s.date.isoformat() if s.date else None,
        "monto": round(float(s.monto), 2) if s.monto is not None else None,
        "tipo_pago": s.tipo_pago,
        "metodo_pago": s.metodo_pago,
        "estado": s.estado,
    } for s in sales]


def _survey_answers_list(client):
    return [{
        "question": sa.question.text if sa.question else None,
        "answer": sa.answer,
    } for sa in client.survey_answers]


@bp.route('/students/<string:email>', methods=['GET'])
@require_academy_token
def get_student_summary(email):
    """Ficha consolidada: cliente + pagos + respuestas de formulario. Ver §4.3 de
    docs/integracion_learnation_api.md (endpoint recomendado, un solo request)."""
    email_norm = _normalize_email(email)
    client = _find_client(email_norm)
    if not client:
        return jsonify({"success": False, "error": "No existe ningún cliente con ese email"}), 404

    return jsonify({
        "success": True,
        "client": _client_dict(client),
        "payments": _payments_list(email_norm),
        "survey_answers": _survey_answers_list(client),
    }), 200


@bp.route('/students/<string:email>/payments', methods=['GET'])
@require_academy_token
def get_student_payments(email):
    email_norm = _normalize_email(email)
    client = _find_client(email_norm)
    if not client:
        return jsonify({"success": False, "error": "No existe ningún cliente con ese email"}), 404

    return jsonify({
        "success": True,
        "client": _client_dict(client),
        "payments": _payments_list(email_norm),
    }), 200


@bp.route('/students/<string:email>/survey', methods=['GET'])
@require_academy_token
def get_student_survey(email):
    email_norm = _normalize_email(email)
    client = _find_client(email_norm)
    if not client:
        return jsonify({"success": False, "error": "No existe ningún cliente con ese email"}), 404

    return jsonify({
        "success": True,
        "client": _client_dict(client),
        "survey_answers": _survey_answers_list(client),
    }), 200
