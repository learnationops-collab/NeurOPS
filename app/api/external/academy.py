from flask import jsonify, request
from sqlalchemy import func

from app import db
from app.models import Client, FinancialSale, SurveyAnswer
from app.decorators import require_academy_token
from app.api.external import bp

MAX_SEARCH_MATCHES = 50
DEFAULT_PAGE_SIZE = 200
MAX_PAGE_SIZE = 500


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
        "instagram": client.instagram,
        "created_at": client.created_at.isoformat() if client.created_at else None,
    }


def _sale_dict(sale):
    """Misma lista blanca que _payments_list, mas los campos de contacto crudos del
    comprador (nombre_cliente/mail_cliente/telefono/instagram) - son los que la Academia
    necesita para cruzar por su cuenta en el endpoint masivo, ver docs/academy_consulta_ventas.md."""
    return {
        "id": sale.id,
        "client_id": sale.client_id,
        "fecha": sale.date.isoformat() if sale.date else None,
        "monto": round(float(sale.monto), 2) if sale.monto is not None else None,
        "tipo_pago": sale.tipo_pago,
        "metodo_pago": sale.metodo_pago,
        "estado": sale.estado,
        "nombre_cliente": sale.nombre_cliente,
        "mail_cliente": sale.mail_cliente,
        "telefono": sale.telefono,
        "instagram": sale.instagram,
    }


def _form_answer_dict(answer):
    return {
        "id": answer.id,
        "client_id": answer.client_id,
        "question": answer.question.text if answer.question else None,
        "answer": answer.answer,
    }


def _parse_pagination():
    page = request.args.get('page', default=1, type=int) or 1
    limit = request.args.get('limit', default=DEFAULT_PAGE_SIZE, type=int) or DEFAULT_PAGE_SIZE
    page = max(page, 1)
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    return page, limit


def _paginated(query, serializer, page, limit):
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    pages = (total + limit - 1) // limit if total else 0
    return {
        "success": True,
        "data": [serializer(item) for item in items],
        "total": total,
        "page": page,
        "pages": pages,
        "has_more": (page * limit) < total,
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


# ---------------------------------------------------------------------------
# Clientes (users): masivo, búsqueda flexible por id/email/nombre, edición
# ---------------------------------------------------------------------------

@bp.route('/clients', methods=['GET'])
@require_academy_token
def list_clients():
    """Volcado paginado de todos los clientes - pensado para que la Academia haga su propio
    cruce inicial (matching manual) antes de guardar el work_id y dejar de necesitar esto."""
    page, limit = _parse_pagination()
    query = Client.query.order_by(Client.id.asc())
    return jsonify(_paginated(query, _client_dict, page, limit)), 200


@bp.route('/clients/<string:identifier>', methods=['GET'])
@require_academy_token
def find_clients(identifier):
    """Acepta id numérico, email exacto, o nombre parcial (case-insensitive). Id/email
    devuelven un único resultado (404 si no existe); nombre devuelve una lista (puede ser
    vacía - no es un error, es una búsqueda sin resultados)."""
    ident = identifier.strip()

    if ident.isdigit():
        client = Client.query.get(int(ident))
        if not client:
            return jsonify({"success": False, "error": "No existe ningún cliente con ese id"}), 404
        return jsonify({"success": True, "match_type": "id", "clients": [_client_dict(client)]}), 200

    if '@' in ident:
        client = _find_client(_normalize_email(ident))
        if not client:
            return jsonify({"success": False, "error": "No existe ningún cliente con ese email"}), 404
        return jsonify({"success": True, "match_type": "email", "clients": [_client_dict(client)]}), 200

    if len(ident) < 2:
        return jsonify({"success": False, "error": "La búsqueda por nombre requiere al menos 2 caracteres"}), 400

    term = f"%{ident.lower()}%"
    matches = Client.query.filter(func.lower(Client.full_name).like(term)) \
        .order_by(Client.full_name.asc()).limit(MAX_SEARCH_MATCHES).all()
    return jsonify({"success": True, "match_type": "name", "clients": [_client_dict(c) for c in matches]}), 200


@bp.route('/clients/<int:client_id>', methods=['PATCH'])
@require_academy_token
def patch_client(client_id):
    """Corrección de identidad del cliente maestro. Solo estos 4 campos - nunca un
    to_dict()/update genérico, para no abrir edición a columnas internas de operación."""
    client = Client.query.get(client_id)
    if not client:
        return jsonify({"success": False, "error": "No existe ningún cliente con ese id"}), 404

    data = request.get_json(silent=True) or {}
    editable = {'full_name', 'email', 'phone', 'instagram'}
    changes = {k: v for k, v in data.items() if k in editable}
    if not changes:
        return jsonify({
            "success": False,
            "error": "Nada para actualizar - campos válidos: full_name, email, phone, instagram"
        }), 400

    if 'email' in changes:
        new_email = _normalize_email(changes['email'])
        if not new_email or '@' not in new_email:
            return jsonify({"success": False, "error": "Email inválido"}), 422
        existing = Client.query.filter(
            func.lower(Client.email) == new_email, Client.id != client.id
        ).first()
        if existing:
            return jsonify({"success": False, "error": "Ese email ya pertenece a otro cliente"}), 409
        client.email = new_email

    if 'full_name' in changes and str(changes['full_name']).strip():
        client.full_name = str(changes['full_name']).strip()
    if 'phone' in changes:
        client.phone = str(changes['phone']).strip() or None
    if 'instagram' in changes:
        client.instagram = str(changes['instagram']).strip().lstrip('@') or None

    db.session.commit()
    return jsonify({"success": True, "client": _client_dict(client)}), 200


# ---------------------------------------------------------------------------
# Ventas (FinancialSale): masivo, búsqueda flexible, edición con propagación a Sheets
# ---------------------------------------------------------------------------

@bp.route('/sales', methods=['GET'])
@require_academy_token
def list_sales():
    page, limit = _parse_pagination()
    query = FinancialSale.query.order_by(FinancialSale.id.asc())
    return jsonify(_paginated(query, _sale_dict, page, limit)), 200


@bp.route('/sales/<string:identifier>', methods=['GET'])
@require_academy_token
def find_sales(identifier):
    """Id numérico de venta (único resultado), o email/nombre del comprador (lista - una
    persona puede tener varias ventas: seña + cuotas, renovaciones, upsells)."""
    ident = identifier.strip()

    if ident.isdigit():
        sale = FinancialSale.query.get(int(ident))
        if not sale:
            return jsonify({"success": False, "error": "No existe ninguna venta con ese id"}), 404
        return jsonify({"success": True, "match_type": "id", "sales": [_sale_dict(sale)]}), 200

    if '@' in ident:
        email_norm = _normalize_email(ident)
        matches = FinancialSale.query.filter(func.lower(FinancialSale.mail_cliente) == email_norm) \
            .order_by(FinancialSale.date.asc()).all()
        return jsonify({"success": True, "match_type": "email", "sales": [_sale_dict(s) for s in matches]}), 200

    if len(ident) < 2:
        return jsonify({"success": False, "error": "La búsqueda por nombre requiere al menos 2 caracteres"}), 400

    term = f"%{ident.lower()}%"
    matches = FinancialSale.query.filter(func.lower(FinancialSale.nombre_cliente).like(term)) \
        .order_by(FinancialSale.date.desc()).limit(MAX_SEARCH_MATCHES).all()
    return jsonify({"success": True, "match_type": "name", "sales": [_sale_dict(s) for s in matches]}), 200


@bp.route('/sales/<int:sale_id>', methods=['PATCH'])
@require_academy_token
def patch_sale(sale_id):
    """Corrige los datos de contacto del comprador guardados EN ESA VENTA puntual (no toca
    el Client maestro - usar PATCH /clients/<id> para eso). Se propaga a Google Sheets
    (mismo patrón que el PUT interno de administración, ver update_financial_sale en
    app/api/public/financial_sales.py) para que el próximo sync no revierta la corrección."""
    sale = FinancialSale.query.get(sale_id)
    if not sale:
        return jsonify({"success": False, "error": "No existe ninguna venta con ese id"}), 404

    data = request.get_json(silent=True) or {}
    editable = {'nombre_cliente', 'mail_cliente', 'telefono', 'instagram'}
    changes = {k: v for k, v in data.items() if k in editable}
    if not changes:
        return jsonify({
            "success": False,
            "error": "Nada para actualizar - campos válidos: nombre_cliente, mail_cliente, telefono, instagram"
        }), 400

    if 'nombre_cliente' in changes and str(changes['nombre_cliente']).strip():
        sale.nombre_cliente = str(changes['nombre_cliente']).strip()
    if 'mail_cliente' in changes:
        new_email = _normalize_email(changes['mail_cliente'])
        if new_email:
            sale.mail_cliente = new_email
    if 'telefono' in changes:
        sale.telefono = str(changes['telefono']).strip() or None
    if 'instagram' in changes:
        sale.instagram = str(changes['instagram']).strip().lstrip('@') or None

    db.session.commit()

    if sale.marca_temporal:
        try:
            from app.services.sheets_service import SheetsService
            SheetsService.update_in_sheets("Ventas_DB", sale.marca_temporal, {
                "email_vendedor": sale.email_vendedor,
                "nombre_cliente": sale.nombre_cliente,
                "telefono": sale.telefono,
                "mail_cliente": sale.mail_cliente,
                "tipo_pago": sale.tipo_pago,
                "monto": sale.monto,
                "segundo_pago": sale.segundo_pago,
                "metodo_pago": sale.metodo_pago,
                "examen": sale.examen,
                "instagram": sale.instagram,
                "setter": sale.setter,
                "estado": sale.estado,
            })
        except Exception as sheet_err:
            print(f"[ACADEMY PATCH] No se pudo propagar la corrección de la venta {sale.id} a Sheets: {sheet_err}")

    return jsonify({"success": True, "sale": _sale_dict(sale)}), 200


# ---------------------------------------------------------------------------
# Formularios (SurveyAnswer): masivo y búsqueda flexible - solo lectura, no tiene
# sentido "corregir" la respuesta que dio un alumno a una pregunta de calificación.
# ---------------------------------------------------------------------------

@bp.route('/forms', methods=['GET'])
@require_academy_token
def list_forms():
    page, limit = _parse_pagination()
    query = SurveyAnswer.query.order_by(SurveyAnswer.id.asc())
    return jsonify(_paginated(query, _form_answer_dict, page, limit)), 200


@bp.route('/forms/<string:identifier>', methods=['GET'])
@require_academy_token
def find_forms(identifier):
    """Id/email exacto -> las respuestas de ese único cliente. Nombre parcial -> puede
    matchear varios clientes, se devuelven las respuestas de cada uno agrupadas."""
    ident = identifier.strip()

    if ident.isdigit():
        client = Client.query.get(int(ident))
        match_type = 'id'
    elif '@' in ident:
        client = _find_client(_normalize_email(ident))
        match_type = 'email'
    else:
        if len(ident) < 2:
            return jsonify({"success": False, "error": "La búsqueda por nombre requiere al menos 2 caracteres"}), 400
        term = f"%{ident.lower()}%"
        clients = Client.query.filter(func.lower(Client.full_name).like(term)) \
            .order_by(Client.full_name.asc()).limit(MAX_SEARCH_MATCHES).all()
        results = [{
            "client": _client_dict(c),
            "survey_answers": _survey_answers_list(c),
        } for c in clients]
        return jsonify({"success": True, "match_type": "name", "clients": results}), 200

    if not client:
        return jsonify({"success": False, "error": "No existe ningún cliente con ese identificador"}), 404

    return jsonify({
        "success": True,
        "match_type": match_type,
        "client": _client_dict(client),
        "survey_answers": _survey_answers_list(client),
    }), 200
