from flask import Blueprint, request, jsonify
from app import db
from app.models import WorkshopTemplate, WorkshopButton, WorkshopTemplateSent, WorkshopInteraction, WorkshopEvent
from app.decorators import admin_required
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('workshop', __name__)


@bp.route('/plantilla-sent', methods=['POST'])
def register_template_sent():
    """Registra que una plantilla ha sido enviada (Contador)"""
    data = request.get_json(silent=True) or {}
    print(f"[WORKSHOP DEBUG] Recibido plantilla-sent: {data}")
    template_id_external = data.get('template_id')

    if not template_id_external:
        print("[WORKSHOP DEBUG] Error: template_id no encontrado en la petición")
        return jsonify({"status": "error", "message": "template_id es obligatorio"}), 400

    try:
        # 1. Buscar o crear la plantilla
        template = WorkshopTemplate.query.filter_by(external_id=str(template_id_external)).first()
        if not template:
            print(f"[WORKSHOP DEBUG] Creando nueva plantilla: {template_id_external}")
            template = WorkshopTemplate(
                external_id=str(template_id_external),
                name=f"Plantilla {template_id_external}"
            )
            db.session.add(template)
            db.session.flush()

        # 2. Incrementar contador diario
        today = datetime.utcnow().date()
        sent_record = WorkshopTemplateSent.query.filter_by(template_id=template.id, date=today).first()
        if not sent_record:
            print(f"[WORKSHOP DEBUG] Primer registro del día para {template_id_external}")
            sent_record = WorkshopTemplateSent(template_id=template.id, date=today, count=1)
            db.session.add(sent_record)
        else:
            sent_record.count += 1
            print(f"[WORKSHOP DEBUG] Incremementando contador a {sent_record.count} para {template_id_external}")
        
        db.session.commit()
        return jsonify({"status": "success", "template": template.name, "count": sent_record.count}), 200

    except Exception as e:
        db.session.rollback()
        print(f"[WORKSHOP ERROR] Exception: {str(e)}")
        logger.error(f"[WORKSHOP] Error en plantilla-sent: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@bp.route('/interaction', methods=['POST'])
def register_interaction():
    """Registra una interacción con un botón de una plantilla"""
    data = request.get_json(silent=True) or {}
    print(f"[WORKSHOP DEBUG] Recibido interaction: {data}")
    template_id_external = data.get('template_id')
    button_id_external = data.get('button_id')

    if not template_id_external or not button_id_external:
        print("[WORKSHOP DEBUG] Error: Datos incompletos en interaction")
        return jsonify({"status": "error", "message": "template_id y button_id son obligatorios"}), 400

    try:
        # 1. Buscar plantilla
        template = WorkshopTemplate.query.filter_by(external_id=str(template_id_external)).first()
        if not template:
            print(f"[WORKSHOP DEBUG] Creando plantilla desde interacción: {template_id_external}")
            # Si no existe, la creamos (fallback)
            template = WorkshopTemplate(
                external_id=str(template_id_external),
                name=f"Plantilla {template_id_external}"
            )
            db.session.add(template)
            db.session.flush()

        # 2. Buscar/Crear el botón
        button = WorkshopButton.query.filter_by(template_id=template.id, identifier=str(button_id_external)).first()
        if not button:
            print(f"[WORKSHOP DEBUG] Creando botón: {button_id_external}")
            button = WorkshopButton(
                template_id=template.id,
                identifier=str(button_id_external),
                label=f"Botón {button_id_external}"
            )
            db.session.add(button)
            db.session.flush()

        # 3. Registrar la interacción (Anónima)
        print(f"[WORKSHOP DEBUG] Registrando click en {button_id_external}")
        interaction = WorkshopInteraction(button_id=button.id)
        db.session.add(interaction)
        
        db.session.commit()
        return jsonify({"status": "success", "button": button.label}), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"[WORKSHOP] Error en interaction: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@bp.route('/stats/summary', methods=['GET'])
def get_workshop_stats_summary():
    """Retorna resumen de efectividad por plantilla"""
    from sqlalchemy import func
    
    stats = []
    templates = WorkshopTemplate.query.all()
    
    for t in templates:
        # Total enviados (Suma de todos los días)
        total_sent = db.session.query(func.sum(WorkshopTemplateSent.count)).filter_by(template_id=t.id).scalar() or 0
        
        # Breakdown por botón
        buttons_data = []
        for b in t.buttons:
            click_count = WorkshopInteraction.query.filter_by(button_id=b.id).count()
            pct = round((click_count / total_sent) * 100, 2) if total_sent > 0 else 0
            buttons_data.append({
                "button": b.label,
                "identifier": b.identifier,
                "clicks": click_count,
                "ctr": pct
            })
            
        stats.append({
            "template_id": t.external_id,
            "template_name": t.name,
            "total_sent": total_sent,
            "buttons": buttons_data
        })
        
    return jsonify(stats), 200

@bp.route('/events', methods=['GET'])
@admin_required
def get_workshop_events():
    events = WorkshopEvent.query.order_by(WorkshopEvent.date.desc()).all()
    return jsonify([e.to_dict() for e in events]), 200

@bp.route('/events/<int:event_id>', methods=['GET'])
@admin_required
def get_workshop_event(event_id):
    event = WorkshopEvent.query.get_or_404(event_id)
    return jsonify(event.to_dict()), 200

@bp.route('/events', methods=['POST'])
@admin_required
def create_workshop_event():
    data = request.get_json() or {}
    date_str = data.get('date')
    name = data.get('name')
    
    if not date_str or not name:
        return jsonify({"error": "La fecha y el nombre son obligatorios"}), 400
        
    try:
        event_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Formato de fecha inválido, debe ser YYYY-MM-DD"}), 400
        
    existing = WorkshopEvent.query.filter_by(date=event_date).first()
    if existing:
        return jsonify({"error": f"Ya existe un evento de workshop registrado para la fecha {date_str}"}), 400

    # Crear evento
    event = WorkshopEvent(
        date=event_date,
        name=name,
        inversion=float(data.get('inversion', 0.0)),
        cpm=float(data.get('cpm', 0.0)),
        cpc=float(data.get('cpc', 0.0)),
        clics=int(data.get('clics', 0)),
        leads=int(data.get('leads', 0)),
        whatsapp_leads=int(data.get('whatsapp_leads', 0)),
        show_up=int(data.get('show_up', 0)),
        pitch_leads=int(data.get('pitch_leads', 0)),
        pitch_final_leads=int(data.get('pitch_final_leads', 0)),
        aplicaciones_form=int(data.get('aplicaciones_form', 0)),
        agendas_exitosas=int(data.get('agendas_exitosas', 0)),
        show_up_sales_call=int(data.get('show_up_sales_call', 0)),
        sales=int(data.get('sales', 0)),
        cash_collected=float(data.get('cash_collected', 0.0))
    )
    
    try:
        db.session.add(event)
        db.session.commit()
        return jsonify(event.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al guardar en base de datos: {str(e)}"}), 500

@bp.route('/events/<int:event_id>', methods=['PUT'])
@admin_required
def update_workshop_event(event_id):
    event = WorkshopEvent.query.get_or_404(event_id)
    data = request.get_json() or {}
    
    if 'name' in data:
        event.name = data['name']
    if 'inversion' in data:
        event.inversion = float(data['inversion'])
    if 'cpm' in data:
        event.cpm = float(data['cpm'])
    if 'cpc' in data:
        event.cpc = float(data['cpc'])
    if 'clics' in data:
        event.clics = int(data['clics'])
    if 'leads' in data:
        event.leads = int(data['leads'])
    if 'whatsapp_leads' in data:
        event.whatsapp_leads = int(data['whatsapp_leads'])
    if 'show_up' in data:
        event.show_up = int(data['show_up'])
    if 'pitch_leads' in data:
        event.pitch_leads = int(data['pitch_leads'])
    if 'pitch_final_leads' in data:
        event.pitch_final_leads = int(data['pitch_final_leads'])
    if 'aplicaciones_form' in data:
        event.aplicaciones_form = int(data['aplicaciones_form'])
    if 'agendas_exitosas' in data:
        event.agendas_exitosas = int(data['agendas_exitosas'])
    if 'show_up_sales_call' in data:
        event.show_up_sales_call = int(data['show_up_sales_call'])
    if 'sales' in data:
        event.sales = int(data['sales'])
    if 'cash_collected' in data:
        event.cash_collected = float(data['cash_collected'])
        
    try:
        db.session.commit()
        return jsonify(event.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al actualizar la base de datos: {str(e)}"}), 500

@bp.route('/events/<int:event_id>', methods=['DELETE'])
@admin_required
def delete_workshop_event(event_id):
    event = WorkshopEvent.query.get_or_404(event_id)
    try:
        db.session.delete(event)
        db.session.commit()
        return jsonify({"message": "Evento eliminado con éxito"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al eliminar de la base de datos: {str(e)}"}), 500

@bp.route('/prefill', methods=['GET'])
@admin_required
def prefill_workshop_metrics():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "El parámetro date es obligatorio"}), 400
        
    from datetime import datetime, time
    from app.models import Client, FinancialAgenda, FinancialSale, Appointment
    from sqlalchemy import or_, func
    
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Formato de fecha inválido, debe ser YYYY-MM-DD"}), 400
        
    import pytz
    la_paz_tz = pytz.timezone('America/La_Paz')
    start_local = datetime.combine(dt, time.min)
    end_local = datetime.combine(dt, time.max)
    
    # created_at en la base de datos está guardado en UTC, por lo que convertimos los límites locales a UTC
    utc_start = la_paz_tz.localize(start_local).astimezone(pytz.UTC).replace(tzinfo=None)
    utc_end = la_paz_tz.localize(end_local).astimezone(pytz.UTC).replace(tzinfo=None)
    
    # 1. Aplicaciones Form Calendly
    clients = Client.query.filter(Client.created_at >= utc_start, Client.created_at <= utc_end).all()
    aplicaciones_count = 0
    for c in clients:
        fd = c.form_data or {}
        fuente = fd.get('fuente_form') or fd.get('fuente') or ''
        if 'workshop' in str(fuente).lower():
            aplicaciones_count += 1
            
    # 2. Agendas Exitosas
    agendas = FinancialAgenda.query.filter(
        or_(
            (FinancialAgenda.created_at >= utc_start) & (FinancialAgenda.created_at <= utc_end),
            FinancialAgenda.registro.like(f"{date_str}%")
        )
    ).all()
    
    workshop_agendas = []
    for a in agendas:
        fuente = a.nombre or ''
        if 'workshop' in str(fuente).lower():
            workshop_agendas.append(a)
            
    agendas_count = len(workshop_agendas)
    
    def get_agenda_closer_status(agenda):
        display_estado = agenda.estado or "Pendiente"
        has_closer = agenda.closer and agenda.closer.strip() and agenda.closer.strip().lower() != 'sin asignar'
        if has_closer:
            ig_clean = agenda.instagram.strip().replace('@', '').lower() if agenda.instagram and agenda.instagram.lower() not in ('n/a', '') else None
            mail_clean = agenda.mail.strip().lower() if agenda.mail and agenda.mail.lower() not in ('n/a', '') else None
            
            client_filters = []
            if ig_clean:
                client_filters.append(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean)
            if mail_clean:
                client_filters.append(func.lower(Client.email) == mail_clean)
                
            client = None
            if client_filters:
                client = Client.query.filter(or_(*client_filters)).first()
                
            if client and agenda.date:
                s_day = datetime.combine(agenda.date.date(), time.min)
                e_day = datetime.combine(agenda.date.date(), time.max)
                
                appt = Appointment.query.filter(
                    Appointment.client_id == client.id,
                    Appointment.start_time >= s_day,
                    Appointment.start_time <= e_day
                ).first()
                
                if appt and appt.closer_result:
                    closer_res = appt.closer_result
                    if closer_res == 'Show up':
                        return 'Show Up'
                    elif closer_res == 'No Show':
                        return 'No Show'
                    elif closer_res == 'Cancelado':
                        return 'Cancelada'
                    elif closer_res == 'Reagendado':
                        return 'Reagendada'
                    elif closer_res == '2da call':
                        return '2TH Call'
                    else:
                        return closer_res
        return display_estado

    # 3. Show Up en Sales Call & Breakdown
    show_up_count = 0
    breakdown = {
        "Show Up": 0,
        "No Show": 0,
        "Cancelada": 0,
        "Reagendada": 0,
        "Pendiente": 0,
        "Otros": 0
    }
    
    for a in workshop_agendas:
        status = get_agenda_closer_status(a)
        if status in ['Show Up', 'Show up', 'Asistió']:
            show_up_count += 1
            breakdown["Show Up"] += 1
        elif status in ['No Show', 'no show', 'Inasistencia']:
            breakdown["No Show"] += 1
        elif status in ['Cancelado', 'Cancelada']:
            breakdown["Cancelada"] += 1
        elif status in ['Reagendado', 'Reagendada']:
            breakdown["Reagendada"] += 1
        elif status in ['Pendiente']:
            breakdown["Pendiente"] += 1
        else:
            breakdown["Otros"] += 1
            
    # 4. Sales & Cash Collected
    matched_sales = set()
    for a in workshop_agendas:
        ig_clean = a.instagram.strip().replace('@', '').lower() if a.instagram and a.instagram.lower() not in ('n/a', '') else None
        mail_clean = a.mail.strip().lower() if a.mail and a.mail.lower() not in ('n/a', '') else None
        
        filters = []
        if ig_clean:
            filters.append(FinancialSale.instagram.ilike(f"%{ig_clean}%"))
        if mail_clean:
            filters.append(FinancialSale.mail_cliente.ilike(mail_clean))
            
        if filters:
            sales = FinancialSale.query.filter(or_(*filters)).all()
            for s in sales:
                matched_sales.add(s)
                
    sales_count = len(matched_sales)
    cash_collected = sum(s.monto or 0.0 for s in matched_sales)
    
    return jsonify({
        "aplicaciones_form": aplicaciones_count,
        "agendas_exitosas": agendas_count,
        "show_up_sales_call": show_up_count,
        "sales": sales_count,
        "cash_collected": cash_collected,
        "agendas_breakdown": breakdown
    }), 200

