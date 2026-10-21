"""Leads, etapas, links de agendamiento, comision y links de Agendas 2.0 del setter.

Se cuelga del blueprint de `setter.py` (se importa al final de ese archivo).
"""
from flask import request, jsonify
from flask_login import current_user
from app.models import ROLE_SETTER
from app.decorators import role_required
from app.api.setter import bp


@bp.route('/leads', methods=['GET'])
@role_required(ROLE_SETTER)
def get_leads():
    from app.models import Lead, PipelineStage
    
    stage_id = request.args.get('stage_id')
    
    query = Lead.query
    
    if stage_id:
        query = query.filter_by(stage_id=stage_id)
        
    leads = query.order_by(Lead.created_at.desc()).all()
    
    return jsonify([{
        "id": l.id,
        "name": l.name,
        "email": l.email,
        "instagram_username": l.instagram_username,
        "person_uuid": l.person_uuid,
        "stage_id": l.stage_id,
        "ad_source": l.ad_source,
        "tags": l.tags,
        "notes": l.notes,
        "created_at": l.created_at.isoformat()
    } for l in leads]), 200

@bp.route('/stages', methods=['GET'])
@role_required(ROLE_SETTER)
def get_stages():
    from app.models import Pipeline, PipelineStage
    
    # Fetch 'setter_default' pipeline
    pipeline = Pipeline.query.filter_by(name='setter_default').first()
    if not pipeline:
        return jsonify([]), 200
        
    stages = PipelineStage.query.filter_by(pipeline_id=pipeline.id, is_active=True).order_by(PipelineStage.order).all()
    
    return jsonify([{
        "id": s.id, 
        "name": s.name,
        "order_index": s.order
    } for s in stages]), 200

# GET /agendas y la bandeja de agendas sin dueño viven en app/api/setter_agendas.py:
# el criterio dejo de ser `Appointment.setter_id` (que tambien llenan las
# cualificaciones de ManyChat) y paso a ser la FUENTE de la agenda.

@bp.route('/booking-link', methods=['GET'])
@role_required(ROLE_SETTER)
def get_booking_links_hierarchical():
    """
    Returns booking links in a hierarchical structure (EventGroup -> Events)
    compatible with the BookingLinkModal component.
    """
    from app.models import EventGroup, Event
    groups = EventGroup.query.all()
    base_url = request.host_url.rstrip('/')
    
    result = []
    for g in groups:
        # Only include groups that have active events assigned to this setter
        active_events = [e for e in g.events if e.is_active and e.setter_id == current_user.id]
        if not active_events:
            continue
            
        group_data = {
            "id": g.id,
            "name": g.name,
            "links": []
        }
        
        for event in active_events:
            group_data["links"].append({
                "id": event.id,
                "name": event.name,
                "url": f"{base_url}/book/{event.utm_source}",
                "slug": event.utm_source
            })
            
        result.append(group_data)
    
    return jsonify(result), 200

@bp.route('/links', methods=['GET'])
@role_required(ROLE_SETTER)
def get_available_links():
    from app.models import Event, User
    
    events = Event.query.filter_by(is_active=True, setter_id=current_user.id).all()
    closers = User.query.filter_by(role='closer', is_active=True).all()
    
    return jsonify({
        "events": [{
            "id": e.id,
            "name": e.name,
            "slug": e.utm_source # Using utm_source as slug for now based on public.py logic
        } for e in events],
        "closers": [{
            "id": c.id,
            "username": c.username
        } for c in closers]
    }), 200


@bp.route('/commission', methods=['GET'])
@role_required(ROLE_SETTER)
def get_setter_commission():
    """Comisión del mes en curso para el espacio de trabajo del setter (pedido del usuario,
    10/sep/2026): 8% del cash collected neto de las ventas que se originaron en sus agendas."""
    from app.services.commission_service import CommissionService
    return jsonify(CommissionService.get_setter_commission(current_user)), 200






@bp.route('/agendas-links', methods=['GET'])
@role_required(ROLE_SETTER)
def mis_links_de_agendamiento():
    """Los links de agendamiento del setter (Agendas 2.0): uno por evento de cada funnel de setting. Lo
    que entra por su link queda a su nombre (Fuente) y aparece en sus agendas como con Calendly."""
    from app.agendas_v2.servicio import links_de_setter
    return jsonify({'links': links_de_setter(current_user)}), 200
