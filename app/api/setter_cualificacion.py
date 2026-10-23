"""Acciones de cualificacion de leads del mazo y asignacion de anuncio a agendas desatribuidas.

Se cuelga del blueprint de `setter.py` (se importa al final de ese archivo).
"""
from flask import request, jsonify
from flask_login import current_user
from app.models import ROLE_SETTER
from app.decorators import role_required
from app.services import conversaciones_service
from app.api.setter import bp


@bp.route('/deck/confirm-qualified/<int:answer_id>', methods=['POST'])
@role_required(ROLE_SETTER)
def confirm_qualified_lead(answer_id):
    from app.models import LeadAnswer, Conversation, Client, Appointment, Ad, Event, User, db
    from app.services.booking_service import BookingService
    from datetime import datetime
    
    la = LeadAnswer.query.get_or_404(answer_id)
    lead = la.conversation
    if not lead:
        return jsonify({"message": "Lead no encontrado"}), 404
        
    # El cliente de su persona; sin persona, el de su Instagram (plan_personas, frente B).
    client = conversaciones_service.cliente_de(lead)
    db.session.commit()
        
    closer_id = None
    ad = Ad.query.get(la.ad_id) if la.ad_id else None
    event = Event.query.get(ad.event_id) if (ad and ad.event_id) else None
    if event and event.closers:
        closer_id = event.closers[0].id
    else:
        default_closer = User.query.filter_by(role='closer', is_active=True).first()
        if default_closer:
            closer_id = default_closer.id
        else:
            any_closer = User.query.filter_by(role='closer').first()
            if any_closer:
                closer_id = any_closer.id
                
    if not closer_id:
        return jsonify({"message": "No hay closers registrados en el sistema para asignar"}), 400
        
    appt = Appointment(
        closer_id=closer_id,
        setter_id=current_user.id,
        client_id=client.id,
        start_time=datetime.utcnow(),
        origin='Instagram',
        result='Cualificado',
        setter_processed=False
    )
    db.session.add(appt)
    db.session.commit()
    
    description = f"Setter {current_user.username} confirmó el lead cualificado de ManyChat."
    BookingService.log_lead_event(appt.id, current_user.id, 'confirm_qualified', description)
    
    return jsonify({"status": "success", "message": "Lead confirmado y pasado a Link de Agenda"}), 200


@bp.route('/deck/disqualify/<int:answer_id>', methods=['POST'])
@role_required(ROLE_SETTER)
def disqualify_lead(answer_id):
    from app.models import LeadAnswer, db
    
    la = LeadAnswer.query.get_or_404(answer_id)
    la.qualification = 'false'
    db.session.commit()
    
    return jsonify({"status": "success", "message": "Lead descalificado correctamente"}), 200


@bp.route('/deck/bulk-update-cualificacion', methods=['POST'])
@role_required(ROLE_SETTER)
def bulk_update_cualificacion():
    from app.models import LeadAnswer, Conversation, Client, Appointment, Ad, Event, User, db
    from datetime import datetime
    
    data = request.get_json() or {}
    answer_ids = data.get('answer_ids', [])
    action = data.get('action')
    
    if not answer_ids or not action:
        return jsonify({"message": "Faltan parámetros"}), 400
        
    processed_count = 0
    
    for ans_id in answer_ids:
        la = LeadAnswer.query.get(ans_id)
        if not la or not la.conversation:
            continue
            
        if action == 'disqualify':
            la.qualification = 'false'
            processed_count += 1
        elif action == 'confirm':
            lead = la.conversation
            # El cliente de su persona; sin persona, el de su Instagram (plan_personas, frente B).
            client = conversaciones_service.cliente_de(lead)
            db.session.commit()
                
            closer_id = None
            ad = Ad.query.get(la.ad_id) if la.ad_id else None
            event = Event.query.get(ad.event_id) if (ad and ad.event_id) else None
            if event and event.closers:
                closer_id = event.closers[0].id
            else:
                default_closer = User.query.filter_by(role='closer', is_active=True).first()
                if default_closer:
                    closer_id = default_closer.id
                else:
                    any_closer = User.query.filter_by(role='closer').first()
                    if any_closer:
                        closer_id = any_closer.id
                        
            if closer_id:
                appt = Appointment(
                    closer_id=closer_id,
                    setter_id=current_user.id,
                    client_id=client.id,
                    start_time=datetime.utcnow(),
                    origin='Instagram',
                    result='Cualificado',
                    setter_processed=False
                )
                db.session.add(appt)
                processed_count += 1
                
    db.session.commit()
    return jsonify({"status": "success", "message": f"{processed_count} leads procesados"}), 200


@bp.route('/deck/update-qualified/<int:answer_id>', methods=['POST'])
@role_required(ROLE_SETTER)
def update_qualified_lead(answer_id):
    from app.models import LeadAnswer, Conversation, Client, Appointment, Ad, Event, User, db
    from app.services.booking_service import BookingService
    from datetime import datetime
    
    la = LeadAnswer.query.get_or_404(answer_id)
    lead = la.conversation
    if not lead:
        return jsonify({"message": "Lead no encontrado"}), 404
        
    data = request.get_json() or {}
    
    # 1. Buscar o crear cliente
    # El cliente de su persona; sin persona, el de su Instagram (plan_personas, frente B).
    client = conversaciones_service.cliente_de(lead)
    db.session.commit()
        
    # 2. Guardar observación del setter y publicarla como nota visible
    setter_note = data.get('setter_note', '').strip()
    if setter_note:
        from app.models import Comment
        comment = Comment(
            text=setter_note,
            comment_type='client',
            associated_id=client.id,
            author_id=current_user.id
        )
        db.session.add(comment)
        
    # 3. Guardar anuncio de origen en LeadAnswer
    if 'keyword' in data:
        la.keyword = data['keyword']
        ad = Ad.query.filter_by(keyword=data['keyword']).first()
        if not ad:
            event = Event.query.filter_by(utm_source=data['keyword']).first()
            if event:
                ad = Ad.query.filter_by(event_id=event.id).first()
        if ad:
            la.ad_id = ad.id
            
    # 4. Guardar calificación
    qual = data.get('qualification')
    if qual == 'true':
        la.qualification = 'true'
        appt = Appointment.query.filter_by(client_id=client.id, setter_id=current_user.id).first()
        if not appt:
            closer_id = None
            ad = Ad.query.get(la.ad_id) if la.ad_id else None
            event = Event.query.get(ad.event_id) if (ad and ad.event_id) else None
            if event and event.closers:
                closer_id = event.closers[0].id
            else:
                default_closer = User.query.filter_by(role='closer', is_active=True).first()
                if default_closer:
                    closer_id = default_closer.id
                else:
                    any_closer = User.query.filter_by(role='closer').first()
                    if any_closer:
                        closer_id = any_closer.id
            
            if not closer_id:
                return jsonify({"message": "No hay closers registrados en el sistema para asignar"}), 400
                
            appt = Appointment(
                closer_id=closer_id,
                setter_id=current_user.id,
                client_id=client.id,
                start_time=datetime.utcnow(),
                origin='Instagram',
                result='Cualificado',
                setter_processed=False
            )
            db.session.add(appt)
            db.session.commit()
            
            description = f"Setter {current_user.username} calificó el lead e ingresó dolores/notas."
            BookingService.log_lead_event(appt.id, current_user.id, 'confirm_qualified', description)
    elif qual == 'false':
        la.qualification = 'false'
        
    db.session.commit()
    return jsonify({"status": "success", "message": "Lead actualizado correctamente"}), 200


@bp.route('/deck/assign-unattributed-ad', methods=['POST'])
@role_required(ROLE_SETTER)
def assign_unattributed_ad_setter():
    """Asigna un anuncio a una agenda desatribuida desde el mazo del setter."""
    from app.api.public.marketing import force_manual_attribution_agenda
    return force_manual_attribution_agenda()
