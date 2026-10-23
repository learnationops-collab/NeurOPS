"""Acciones sobre las cartas del mazo: procesar, bulk, busqueda, carta suelta y comentarios.

Se cuelga del blueprint de `setter.py` (se importa al final de ese archivo).
"""
from flask import request, jsonify
from flask_login import current_user
from app import db
from app.models import ROLE_SETTER, Client, Appointment
from app.decorators import role_required
from sqlalchemy import or_
from app.api.setter import bp


@bp.route('/deck/<int:appt_id>', methods=['POST'])
@role_required(ROLE_SETTER)
def process_setter_card(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    if current_user.role != 'admin' and appt.setter_id != current_user.id:
        return jsonify({"message": "Forbidden"}), 403
        
    data = request.get_json() or {}
    
    # 1. Actualizar datos del Cliente
    if appt.client:
        if 'instagram' in data:
            appt.client.instagram = data['instagram']
            
    # 2. Actualizar la Agenda
    if 'ig_chat_link' in data:
        appt.ig_chat_link = data['ig_chat_link']
    if 'keyword' in data:
        appt.keyword = data['keyword']
    if 'setter_notes' in data:
        appt.setter_notes = data['setter_notes']
    if 'result' in data:
        appt.result = data['result']
        
    appt.setter_processed = True
    
    from app.services.booking_service import BookingService
    description = f"Setter {current_user.username} precalificó la carta. Notas: \"{data.get('setter_notes', '')}\""
    BookingService.log_lead_event(appt.id, current_user.id, 'setter_notes', description)
    
    # Sincronizar de vuelta a FinancialAgenda
    try:
        BookingService.sync_appointment_to_financial_agenda(appt)
    except Exception as sync_err:
        pass
        
    try:
        db.session.commit()
        return jsonify({"message": "Carta procesada con éxito", "id": appt.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar: {str(e)}"}), 500


@bp.route('/deck/bulk-update', methods=['POST'])
@role_required(ROLE_SETTER)
def bulk_update_setter_cards():
    data = request.get_json() or {}
    appt_ids = data.get('appt_ids', [])
    result = data.get('result')
    keyword = data.get('keyword')
    
    if not appt_ids:
        return jsonify({"message": "No se proporcionaron IDs de citas"}), 400
        
    appointments = Appointment.query.filter(Appointment.id.in_(appt_ids)).all()
    
    from app.services.booking_service import BookingService
    
    for appt in appointments:
        if current_user.role != 'admin' and appt.setter_id != current_user.id:
            continue  # Evitar modificar lo que no pertenece al setter
            
        if result:
            appt.result = result
            description = f"Setter {current_user.username} actualizó estado masivamente a: {result}"
            BookingService.log_lead_event(appt.id, current_user.id, 'status_change', description)
            # Sincronizar de vuelta a FinancialAgenda
            try:
                BookingService.sync_appointment_to_financial_agenda(appt)
            except Exception as sync_err:
                pass
            
        if keyword:
            appt.keyword = keyword
            description = f"Setter {current_user.username} actualizó anuncio asociado masivamente a: {keyword}"
            BookingService.log_lead_event(appt.id, current_user.id, 'keyword_change', description)
            
    try:
        db.session.commit()
        return jsonify({"message": f"Se actualizaron {len(appointments)} citas con éxito"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al actualizar en masa: {str(e)}"}), 500


@bp.route('/deck/search', methods=['GET'])
@role_required(ROLE_SETTER)
def search_deck_leads():
    query_str = request.args.get('q', '')
    if len(query_str) < 2:
        return jsonify([]), 200
    
    term = f"%{query_str}%"
    query = Appointment.query.join(Client)
    if current_user.role != 'admin':
        query = query.filter(Appointment.setter_id == current_user.id)
        
    appointments = query.filter(
        or_(
            Client.full_name.ilike(term),
            Client.email.ilike(term),
            Client.instagram.ilike(term),
            Client.phone.ilike(term)
        )
    ).order_by(Appointment.start_time.desc()).limit(20).all()
    
    return jsonify([{
        "id": a.id,
        "lead_name": a.client.full_name or a.client.email if a.client else "Unknown",
        "start_time": a.start_time.isoformat(),
        "setter_processed": a.setter_processed,
        "closer_processed": a.closer_processed
    } for a in appointments]), 200


@bp.route('/deck/card/<int:appt_id>', methods=['GET'])
@role_required(ROLE_SETTER)
def get_deck_card(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    if current_user.role != 'admin' and appt.setter_id != current_user.id:
        if appt.origin == 'Instagram' or not appt.setter_id:
            appt.setter_id = current_user.id
            db.session.commit()
        else:
            return jsonify({"message": "Forbidden"}), 403
        
    return jsonify({
        "id": appt.id,
        "lead_name": appt.client.full_name or "Sin Nombre" if appt.client else "Sin Cliente",
        "email": appt.client.email if appt.client else "",
        "phone": appt.client.phone if appt.client else "",
        "instagram": appt.client.instagram if appt.client else "",
        "start_time": appt.start_time.isoformat(),
        "origin": appt.origin,
        "result": appt.result or "Pendiente",
        "ig_chat_link": appt.ig_chat_link or "",
        "keyword": appt.keyword or "",
        "setter_notes": appt.setter_notes or "",
        "setter_processed": appt.setter_processed
    }), 200


@bp.route('/deck/comments/<int:appt_id>', methods=['GET'])
@role_required(ROLE_SETTER)
def get_setter_deck_comments(appt_id):
    from app.models import Comment
    comments = Comment.query.filter_by(associated_id=appt_id, comment_type='appointment').order_by(Comment.created_at.asc()).all()
    return jsonify([c.to_dict() for c in comments]), 200


@bp.route('/deck/comments/<int:appt_id>', methods=['POST'])
@role_required(ROLE_SETTER)
def post_setter_deck_comment(appt_id):
    from app.models import Comment, Appointment, Notification
    
    appt = Appointment.query.get_or_404(appt_id)
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    parent_id = data.get('parent_id')
    
    if not text:
        return jsonify({"message": "El texto del comentario es requerido"}), 400
        
    comment = Comment(
        author_id=current_user.id,
        text=text,
        comment_type='appointment',
        associated_id=appt_id,
        parent_id=parent_id
    )
    db.session.add(comment)
    
    from app.services.booking_service import BookingService
    description = f"Setter {current_user.username} comentó: \"{text[:60]}...\""
    BookingService.log_lead_event(appt.id, current_user.id, 'comment', description)
    
    # Notificación cruzada al Closer (dirigida al rol si es Manychat)
    lead_name = appt.client.full_name if appt.client else "Sin Nombre"
    subject = f"💬 Lead: {lead_name}"
    content = f"\"{text}\" - de Setter {current_user.username}"
    
    target_users = "role:closer"
    if appt.origin != 'Instagram' and appt.closer_id:
        target_users = [appt.closer_id]
        
    notif = Notification(
        subject=subject,
        content=content,
        associated_id=appt_id,
        associated_type='deck_comment',
        target_users=target_users
    )
    db.session.add(notif)
        
    try:
        db.session.commit()
        return jsonify(comment.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar comentario: {str(e)}"}), 500
