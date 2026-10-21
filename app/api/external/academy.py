from flask import jsonify, request
from sqlalchemy import and_, func, or_

from app import db
from app.models import Client, FinancialSale, Person, SurveyAnswer
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
        "work_uuid": client.person_uuid,
        "full_name": client.full_name,
        "email": client.email,
        "phone": client.phone,
        "instagram": client.instagram,
        "created_at": client.created_at.isoformat() if client.created_at else None,
    }


def _sale_dict(sale, contacto=None):
    """Misma lista blanca que _payments_list, mas los campos de contacto del comprador
    (nombre_cliente/mail_cliente/telefono/instagram) - son los que la Academia necesita para
    cruzar por su cuenta en el endpoint masivo, ver docs/academy_consulta_ventas.md. Salen de su
    persona (`FinancialSale.contacto`); `contacto` ya resuelto evita la consulta en los listados."""
    contacto = contacto or sale.contacto()
    return {
        "id": sale.id,
        "client_id": sale.client_id,
        "work_uuid": sale.person_uuid,
        "fecha": sale.date.isoformat() if sale.date else None,
        "monto": round(float(sale.monto), 2) if sale.monto is not None else None,
        "tipo_pago": sale.tipo_pago,
        "metodo_pago": sale.metodo_pago,
        "estado": sale.estado,
        **contacto,
    }


def _sales_dicts(sales):
    contactos = FinancialSale.contactos(sales)
    return [_sale_dict(s, contactos[s.id]) for s in sales]


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


def _paginated(query, serializer, page, limit, en_lote=None):
    """`en_lote` serializa la página entera de una vez (en vez de `serializer` fila por fila)."""
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    pages = (total + limit - 1) // limit if total else 0
    return {
        "success": True,
        "data": en_lote(items) if en_lote else [serializer(item) for item in items],
        "total": total,
        "page": page,
        "pages": pages,
        "has_more": (page * limit) < total,
    }


def _payments_list(client):
    """Lista blanca explícita de campos - nunca reusar to_dict() de FinancialSale, que trae
    columnas internas (comisiones, email_vendedor, raw_data, etc.) que no le competen a la
    Academia. Ver docs/academy_consulta_ventas.md. Los pagos del cliente con el criterio de todo
    el sistema: los de su persona, los atados a él y, sin persona, los de su correo copiado."""
    from app.services.sales_consistency_service import filtro_de_pagos
    sales = FinancialSale.query.filter(filtro_de_pagos(client)).order_by(FinancialSale.date.asc()).all()

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
        "payments": _payments_list(client),
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
        "payments": _payments_list(client),
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
    return jsonify(_paginated(query, _sale_dict, page, limit, en_lote=_sales_dicts)), 200


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
        # Los pagos de la persona de ese correo; lo copiado en el pago, solo en pagos sin persona.
        from app.services import person_service
        email_norm = _normalize_email(ident)
        person = person_service.buscar(email=email_norm)
        por_copia = and_(FinancialSale.person_uuid.is_(None), func.lower(FinancialSale.mail_cliente) == email_norm)
        matches = FinancialSale.query.filter(
            or_(FinancialSale.person_uuid == person.uuid, por_copia) if person else por_copia) \
            .order_by(FinancialSale.date.asc()).all()
        return jsonify({"success": True, "match_type": "email", "sales": _sales_dicts(matches)}), 200

    if len(ident) < 2:
        return jsonify({"success": False, "error": "La búsqueda por nombre requiere al menos 2 caracteres"}), 400

    term = f"%{ident.lower()}%"
    personas = db.session.query(Person.uuid).filter(func.lower(Person.full_name).like(term),
                                                    Person.merged_into_uuid.is_(None))
    matches = FinancialSale.query.filter(or_(
        FinancialSale.person_uuid.in_(personas),
        and_(FinancialSale.person_uuid.is_(None), func.lower(FinancialSale.nombre_cliente).like(term)))) \
        .order_by(FinancialSale.date.desc()).limit(MAX_SEARCH_MATCHES).all()
    return jsonify({"success": True, "match_type": "name", "sales": _sales_dicts(matches)}), 200


@bp.route('/sales/<int:sale_id>', methods=['PATCH'])
@require_academy_token
def patch_sale(sale_id):
    """Corrige los datos de contacto del comprador de ESA VENTA (no toca el Client maestro - usar
    PATCH /clients/<id> para eso). Si la venta tiene persona, se corrige la persona, que es de
    donde se leen; un dato que ya es de otra persona devuelve 409. `modo: 'pago'` suma el mail como
    su mail de pago sin cambiar el principal. Se propaga a Google Sheets
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
    # Con persona, lo que se lee es la persona: la corrección va ahí (`modo: 'pago'` suma el mail
    # como su mail de pago sin cambiar el principal).
    try:
        corregir_persona_de_venta(sale, changes, modo='pago' if data.get('modo') == 'pago' else 'corregir')
    except DatoDeOtraPersona as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 409

    db.session.commit()

    if sale.marca_temporal:
        try:
            from app.services.sheets_service import SheetsService
            contacto = sale.contacto()  # el que se lee: el de la persona
            SheetsService.update_in_sheets("Ventas_DB", sale.marca_temporal, {
                "email_vendedor": sale.email_vendedor,
                "nombre_cliente": contacto['nombre_cliente'],
                "telefono": contacto['telefono'],
                "mail_cliente": contacto['mail_cliente'],
                "tipo_pago": sale.tipo_pago,
                "monto": sale.monto,
                "segundo_pago": sale.segundo_pago,
                "metodo_pago": sale.metodo_pago,
                "examen": sale.examen,
                "instagram": contacto['instagram'],
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


# --- Estado de pago y baja (pedido del 19/10/2026, docs/academy_consulta_ventas.md §9) ----------

@bp.route('/payment-status', methods=['GET'])
@require_academy_token
def list_payment_status():
    """El estado de pago de todos los clientes con venta, plan o baja, paginado. Es la carga inicial
    y el arreglo: el día a día lo empuja Work cuando algo cambia (`academy_payment_status`)."""
    from app.services import academy_payment_status

    page, limit = _parse_pagination()
    return jsonify(_paginated(academy_payment_status.clientes_con_estado(),
                              academy_payment_status.estado, page, limit)), 200


@bp.route('/clients/baja', methods=['POST'])
@require_academy_token
def academy_baja():
    """La Academia dio de baja del proceso a un alumno (o lo volvió a sumar): queda igual acá, con
    el mismo motivo, para que su deuda salga de lo que queda por cobrar.

    Cuerpo: `work_uuid`, `work_client_id` o `email`, `motivo` y `revertir` (true para deshacerla). No se le
    devuelve el aviso a la Academia: el cambio salió de allá.
    """
    from app.services import baja_service

    data = request.get_json(silent=True) or {}
    cliente = cliente_del_alumno(data)
    if not cliente:
        return jsonify({"success": False, "error": "No existe ningún cliente con ese uuid, id o email"}), 404

    if data.get('revertir'):
        cambio = baja_service.revertir(cliente) is not None
    else:
        motivo = str(data.get('motivo') or '').strip()
        cambio = baja_service.dar_de_baja(cliente, f'Academia: {motivo}' if motivo else 'Academia', None)
    # Lo anotado para avisarle a la Academia no corre: la baja salió de allá.
    baja_service.bajas_sin_avisar_academia()
    db.session.commit()
    return jsonify({"success": True, "changed": bool(cambio),
                    "baja": baja_service.descriptor(cliente)}), 200


@bp.route('/subscriptions/prorroga', methods=['POST'])
@require_academy_token
def academy_prorroga():
    """La Academia le da a un alumno una prórroga gratuita de su suscripción (20/10/2026): queda en
    el historial de la suscripción en Work, con el motivo y quién la dio. Solo extiende.

    Cuerpo: `work_uuid`, `work_client_id` o `email`; `dias` (más de cero) o `expires_at` (YYYY-MM-DD);
    `motivo`; `actor_email` (quién la dio en la Academia); `product_slug` opcional (sin él, la
    suscripción que vence más tarde).
    """
    from datetime import date

    from app.services import subscription_service

    data = request.get_json(silent=True) or {}
    cliente = cliente_del_alumno(data)
    if not cliente:
        return jsonify({"success": False, "error": "No existe ningún cliente con ese uuid, id o email"}), 404
    motivo = str(data.get('motivo') or '').strip()
    if not motivo:
        return jsonify({"success": False, "error": "Falta el motivo de la prórroga"}), 422
    try:
        hasta = date.fromisoformat(str(data['expires_at'])[:10]) if data.get('expires_at') else None
        sub = subscription_service.prorrogar(
            cliente, slug=data.get('product_slug') or None, dias=data.get('dias'), hasta=hasta,
            reason=f'Prórroga: {motivo}', actor_email=(data.get('actor_email') or '').strip().lower() or None)
    except LookupError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except (TypeError, ValueError) as e:
        return jsonify({"success": False, "error": str(e)}), 422
    db.session.commit()
    return jsonify({"success": True, "subscription": sub.to_dict(with_events=True)}), 200


# Las rutas por `work_uuid` (plan_personas, frente G), sobre el mismo blueprint.
from app.api.external.academy_personas import (  # noqa: E402
    cliente_del_alumno, corregir_persona_de_venta, DatoDeOtraPersona)
