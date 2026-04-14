from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import DailyReportQuestion, DailyReportAnswer, SetterDailyStats, ROLE_SETTER, User, Client, Appointment, Event, EventGroup
from app.decorators import role_required
from datetime import datetime
from sqlalchemy import or_, and_, desc

bp = Blueprint('setter', __name__)

@bp.route('/questions', methods=['GET'])
@role_required(ROLE_SETTER)
def get_setter_questions():
    try:
        questions = DailyReportQuestion.query.filter_by(role='setter', is_active=True).order_by(DailyReportQuestion.order).all()
        return jsonify([{"id": q.id, "text": q.text, "type": q.question_type} for q in questions]), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"message": str(e), "trace": traceback.format_exc()}), 500

def _get_setter_stages_ordered():
    from app.models import Pipeline, PipelineStage
    pipeline = Pipeline.query.filter_by(name='setter_default').first()
    if not pipeline:
        return []
    return PipelineStage.query.filter_by(pipeline_id=pipeline.id, is_active=True).order_by(PipelineStage.order).all()

def _trigger_setter_report_webhook(stat):
    """
    Triggers the Discord webhook with a generated image of the setter report.
    """
    try:
        import requests
        import json
        from app.services.image_service import ImageService
        
        # Webhook URL provided by user
        url = "https://discord.com/api/webhooks/1482070325641347288/fFK0OKoDIRngTIzh1kl81_Um8GrtFg62Z3TK4Rq0qgjQtU3jNqlOOLZ4lw1c_0qV0drX"
        
        # 1. Prepare Data for Image
        setter_name = stat.setter.username if stat.setter else "Setter"
        
        # 2. Qualitative Data
        from app.models import DailyReportQuestion
        qualitative_callouts = []
        if stat.answers:
            questions = {q.id: q.text for q in DailyReportQuestion.query.filter_by(role='setter', is_active=True).all()}
            for q_id, answer in stat.answers.items():
                q_id_int = int(q_id)
                if q_id_int in questions and answer and answer.strip():
                    qualitative_callouts.append({
                        "question": questions[q_id_int],
                        "answer": answer
                    })

        # Calculate percentages
        def safe_percent(part, total):
            try:
                if total > 0:
                    return round((part / total) * 100)
            except:
                pass
            return 0

        inbox_entrantes = stat.inbox_entrantes or 0
        not_lead = stat.not_lead or 0
        inabribles = stat.inbox_inabribles or 0
        opened = stat.opening_submitted or 0
        op_resp = stat.opening_responded or 0
        qual = stat.funnel_qualification or 0
        pain = stat.funnel_pain or 0
        offer = stat.funnel_offer or 0
        link = stat.funnel_link or 0
        agenda = stat.funnel_agenda or 0
        fu_qual = stat.qualification_fu or 0
        fur_qual = stat.qualification_fur or 0
        fu_pain = stat.pain_fu or 0
        fur_pain = stat.pain_fur or 0
        fu_offer = stat.offer_fu or 0
        fur_offer = stat.offer_fur or 0
        fu_link = stat.link_fu or 0
        fur_link = stat.link_fur or 0
        fu_agenda = stat.agenda_fu or 0
        fur_agenda = stat.agenda_fur or 0

        # OPENINGS
        q_op_sub = stat.qualification_opening_submitted or 0
        q_op_res = stat.qualification_opening_responded or 0
        p_op_sub = stat.pain_opening_submitted or 0
        p_op_res = stat.pain_opening_responded or 0

        # 2b. Calculate 7-day Averages
        last_reports = SetterDailyStats.query.filter(
            SetterDailyStats.setter_id == stat.setter_id,
            SetterDailyStats.date <= stat.date
        ).order_by(SetterDailyStats.date.desc()).limit(7).all()
        
        avg_metrics = {
            "entrantes": 0,
            "openings": 0,
            "agendas": 0,
            "conversion": 0
        }
        
        if last_reports:
            r_count = len(last_reports)
            t_entrantes = sum(r.inbox_entrantes or 0 for r in last_reports)
            # Sum granular openings if available, else legacy
            t_openings = sum(
                ((r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0)) 
                if ((r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0)) > 0 
                else (r.opening_submitted or 0) 
                for r in last_reports
            )
            t_agendas = sum(r.funnel_agenda or 0 for r in last_reports)
            t_net_leads = sum(r.inbox_leads or 0 for r in last_reports)
            
            avg_metrics = {
                "entrantes": round(t_entrantes / r_count, 1),
                "openings": round(t_openings / r_count, 1),
                "agendas": round(t_agendas / r_count, 1),
                "conversion": safe_percent(t_agendas, t_net_leads)
            }

        # 3. Prepare Stats Structure for the new template layout
        img_data = {
            "setter_name": setter_name,
            "date_str": stat.date.strftime('%d/%m/%Y'),
            
            # INBOX
            "inbox": {
                "entrantes": inbox_entrantes,
                "not_lead": not_lead,
                "inabribles": inabribles,
                "leads": stat.inbox_leads or 0,
                "no_lead_pct": safe_percent(not_lead, inbox_entrantes),
                "inabribles_pct": safe_percent(inabribles, inbox_entrantes)
            },
            
            # OPENING (NEW GRANULAR)
            "openings": {
                "qualification": {"submitted": q_op_sub, "responded": q_op_res, "pct": safe_percent(q_op_res, q_op_sub)},
                "pain": {"submitted": p_op_sub, "responded": p_op_res, "pct": safe_percent(p_op_res, p_op_sub)},
                "legacy": {"submitted": opened, "responded": op_resp, "pct": safe_percent(op_resp, opened)}
            },
            
            # FUNNEL
            "funnel": {
                "qualification": qual,
                "pain": pain,
                "offer": offer,
                "link": link,
                "agenda": agenda,
                "qual_to_pain": safe_percent(pain, qual),
                "pain_to_offer": safe_percent(offer, pain),
                "offer_to_link": safe_percent(link, offer),
                "link_to_agenda": safe_percent(agenda, link),
                "conversion_leads_pct": safe_percent(agenda, stat.inbox_leads or 0)
            },
            
            # FOLLOW UPS
            "follow_up": {
                "qualification": fu_qual,
                "qualification_fur": fur_qual,
                "pain": fu_pain,
                "pain_fur": fur_pain,
                "offer": fu_offer,
                "offer_fur": fur_offer,
                "link": fu_link,
                "link_fur": fur_link,
                "agenda": fu_agenda,
                "agenda_fur": fur_agenda,
                "total_fu": fu_qual + fu_pain + fu_offer + fu_link + fu_agenda,
                "total_fur": fur_qual + fur_pain + fur_offer + fur_link + fur_agenda,
                "response_pct": safe_percent(fur_qual + fur_pain + fur_offer + fur_link + fur_agenda, fu_qual + fu_pain + fu_offer + fu_link + fu_agenda)
            },
            
            "averages": avg_metrics,
            "qualitative": qualitative_callouts
        }

        # 4. Generate Image
        img_buffer = ImageService.generate_setter_report_card(img_data)
        
        # 5. Discord Metadata (Improved format)
        resumen_str = f"{stat.inbox_entrantes} Entrantes | {stat.funnel_agenda} Agendas"
        
        content = (
            f"🚀 **REPORTE DIARIO DE SETTER**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 **Setter:** `{setter_name}`\n"
            f"📅 **Fecha:** `{stat.date.strftime('%d/%m/%Y')}`\n"
            f"📊 **Resumen:** `{resumen_str}`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"@everyone"
        )
        
        json_payload = {
            "content": content,
            "embeds": [{
                "color": 4521291, # #2DD4BF Teal color
                "image": {
                    "url": "attachment://setter_report.png"
                },
                "footer": {
                    "text": "NeurOPS Performance System • " + datetime.now().strftime('%H:%M')
                }
            }]
        }
        
        files = {
            'file': ('setter_report.png', img_buffer, 'image/png')
        }
        
        # 6. Send
        res = requests.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=10)
        print(f"[Discord Setter] Status: {res.status_code}")
        
    except Exception as e:
        print(f"[Discord Setter Error] {e}")
        import traceback
        traceback.print_exc()

@bp.route('/daily-report', methods=['POST', 'GET'])
@role_required(ROLE_SETTER)
def submit_daily_report():
    if request.method == 'GET':
        date_str = request.args.get('date')
        if not date_str:
            return jsonify({"message": "Fecha requerida"}), 400
        
        try:
            report_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"message": "Formato de fecha inválido"}), 400

        stat = SetterDailyStats.query.filter_by(setter_id=current_user.id, date=report_date).first()
        
        if not stat:
            return jsonify(None), 200 # Return null if no report exists
            
        # Map fixed columns back to stage_id for frontend compatibility
        stages = _get_setter_stages_ordered()
        stage_metrics = {}
        
        # Mapping logic: index 0 -> stage_1_value, index 1 -> stage_2_value, etc.
        if len(stages) > 0: stage_metrics[stages[0].id] = stat.stage_1_value
        if len(stages) > 1: stage_metrics[stages[1].id] = stat.stage_2_value
        if len(stages) > 2: stage_metrics[stages[2].id] = stat.stage_3_value
        if len(stages) > 3: stage_metrics[stages[3].id] = stat.stage_4_value
        if len(stages) > 4: stage_metrics[stages[4].id] = stat.stage_5_value

        answers = stat.answers or {}
        
        return jsonify({
            "id": stat.id,
            "date": stat.date.isoformat(),
            "fixed_stats": {
                "not_lead": stat.not_lead,
                "inbox_entrantes": stat.inbox_entrantes,
                "inbox_inabribles": stat.inbox_inabribles,
                "inbox_leads": stat.inbox_leads,
                "opening_submitted": stat.opening_submitted,
                "opening_responded": stat.opening_responded,
                "funnel_qualification": stat.funnel_qualification,
                "funnel_pain": stat.funnel_pain,
                "funnel_offer": stat.funnel_offer,
                "funnel_link": stat.funnel_link,
                "funnel_agenda": stat.funnel_agenda,
                "qualification_fu": stat.qualification_fu,
                "pain_fu": stat.pain_fu,
                "offer_fu": stat.offer_fu,
                "agenda_fu": stat.agenda_fu,
                "link_fu": stat.link_fu,
                "link_fur": stat.link_fur,
                "qualification_fur": stat.qualification_fur,
                "pain_fur": stat.pain_fur,
                "offer_fur": stat.offer_fur,
                "agenda_fur": stat.agenda_fur,
                "qualification_opening_submitted": stat.qualification_opening_submitted,
                "qualification_opening_responded": stat.qualification_opening_responded,
                "pain_opening_submitted": stat.pain_opening_submitted,
                "pain_opening_responded": stat.pain_opening_responded
            },
            "funnel_stats": stage_metrics,
            "answers": answers
        }), 200

    # POST Logic
    data = request.get_json() or {}
    
    from app.models import DailyReportAnswer

    # Datos fijos obligatorios
    report_date_str = data.get('date')
    if not report_date_str:
        return jsonify({"message": "La fecha es obligatoria"}), 400
    
    report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    
    # Verificar si ya existe un reporte para este setter en esta fecha
    stat = SetterDailyStats.query.filter_by(setter_id=current_user.id, date=report_date).first()
    
    if stat:
        # Update existing
        stat.not_lead = int(data.get('not_lead') or 0)
        stat.inbox_entrantes = int(data.get('inbox_entrantes') or 0)
        stat.inbox_inabribles = int(data.get('inbox_inabribles') or 0)
        stat.inbox_leads = int(data.get('inbox_leads') or 0)
        stat.opening_submitted = int(data.get('opening_submitted') or 0)
        stat.opening_responded = int(data.get('opening_responded') or 0)
        stat.funnel_qualification = int(data.get('funnel_qualification') or 0)
        stat.funnel_pain = int(data.get('funnel_pain') or 0)
        stat.funnel_offer = int(data.get('funnel_offer') or 0)
        stat.funnel_link = int(data.get('funnel_link') or 0)
        stat.funnel_agenda = int(data.get('funnel_agenda') or 0)
        stat.qualification_fu = int(data.get('qualification_fu') or 0)
        stat.pain_fu = int(data.get('pain_fu') or 0)
        stat.offer_fu = int(data.get('offer_fu') or 0)
        stat.link_fu = int(data.get('link_fu') or 0)
        stat.agenda_fu = int(data.get('agenda_fu') or 0)
        stat.qualification_fur = int(data.get('qualification_fur') or 0)
        stat.pain_fur = int(data.get('pain_fur') or 0)
        stat.offer_fur = int(data.get('offer_fur') or 0)
        stat.link_fur = int(data.get('link_fur') or 0)
        stat.agenda_fur = int(data.get('agenda_fur') or 0)
        stat.qualification_opening_submitted = int(data.get('qualification_opening_submitted') or 0)
        stat.qualification_opening_responded = int(data.get('qualification_opening_responded') or 0)
        stat.pain_opening_submitted = int(data.get('pain_opening_submitted') or 0)
        stat.pain_opening_responded = int(data.get('pain_opening_responded') or 0)
        
    else:
        # Create new
        stat = SetterDailyStats(
            setter_id=current_user.id,
            date=report_date,
            not_lead=int(data.get('not_lead') or 0),
            inbox_entrantes=int(data.get('inbox_entrantes') or 0),
            inbox_inabribles=int(data.get('inbox_inabribles') or 0),
            inbox_leads=int(data.get('inbox_leads') or 0),
            opening_submitted=int(data.get('opening_submitted') or 0),
            opening_responded=int(data.get('opening_responded') or 0),
            funnel_qualification=int(data.get('funnel_qualification') or 0),
            funnel_pain=int(data.get('funnel_pain') or 0),
            funnel_offer=int(data.get('funnel_offer') or 0),
            funnel_link=int(data.get('funnel_link') or 0),
            funnel_agenda=int(data.get('funnel_agenda') or 0),
            qualification_fu=int(data.get('qualification_fu') or 0),
            pain_fu=int(data.get('pain_fu') or 0),
            offer_fu=int(data.get('offer_fu') or 0),
            link_fu=int(data.get('link_fu') or 0),
            agenda_fu=int(data.get('agenda_fu') or 0),
            qualification_fur=int(data.get('qualification_fur') or 0),
            pain_fur=int(data.get('pain_fur') or 0),
            offer_fur=int(data.get('offer_fur') or 0),
            link_fur=int(data.get('link_fur') or 0),
            agenda_fur=int(data.get('agenda_fur') or 0),
            qualification_opening_submitted=int(data.get('qualification_opening_submitted') or 0),
            qualification_opening_responded=int(data.get('qualification_opening_responded') or 0),
            pain_opening_submitted=int(data.get('pain_opening_submitted') or 0),
            pain_opening_responded=int(data.get('pain_opening_responded') or 0)
        )
        db.session.add(stat)
    
    # Process Funnel Metrics -> Map to stage_X_value
    funnel_metrics = data.get('funnel_metrics', [])
    stages = _get_setter_stages_ordered()
    stage_id_to_index = {s.id: i for i, s in enumerate(stages)}
    
    # Reset stage values
    stat.stage_1_value = 0
    stat.stage_2_value = 0
    stat.stage_3_value = 0
    stat.stage_4_value = 0
    stat.stage_5_value = 0

    for metric in funnel_metrics:
        stage_id = metric.get('stage_id')
        value = int(metric.get('value', 0))
        
        if stage_id in stage_id_to_index:
            idx = stage_id_to_index[stage_id]
            if idx == 0: stat.stage_1_value = value
            elif idx == 1: stat.stage_2_value = value
            elif idx == 2: stat.stage_3_value = value
            elif idx == 3: stat.stage_4_value = value
            elif idx == 4: stat.stage_5_value = value
    
    # Process dynamic questions (Qualitative feedback) -> Store in JSON
    answers_data = data.get('answers', [])
    answers_json = {}
    for ans in answers_data:
        question_id = str(ans.get('question_id'))
        answer_text = str(ans.get('answer', ''))
        if question_id:
            answers_json[question_id] = answer_text
            
    # Include frequent questions feedback if present
    freq_q = data.get('frequent_questions')
    if freq_q is not None:
        answers_json['frequent_questions'] = freq_q
    
    stat.answers = answers_json
            
    try:
        db.session.commit()
        # Trigger Webhook after successful commit
        _trigger_setter_report_webhook(stat)
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar el reporte: {str(e)}"}), 500
        
    return jsonify({"message": "Reporte enviado con éxito", "id": stat.id}), 201

@bp.route('/stats/summary', methods=['GET'])
@role_required(ROLE_SETTER)
def get_stats_summary():
    from sqlalchemy import func
    from datetime import date, timedelta

    
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    # 1. Fetch Fixed Stats
    query_fixed = db.session.query(
        func.sum(SetterDailyStats.not_lead).label('total_not_lead'),
        func.sum(SetterDailyStats.stage_1_value).label('total_stage_1'),
        func.sum(SetterDailyStats.stage_2_value).label('total_stage_2'),
        func.sum(SetterDailyStats.stage_3_value).label('total_stage_3'),
        func.sum(SetterDailyStats.stage_4_value).label('total_stage_4'),
        func.sum(SetterDailyStats.stage_5_value).label('total_stage_5')
    ).filter_by(setter_id=current_user.id)
    
    if start_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        query_fixed = query_fixed.filter(SetterDailyStats.date >= start_date)
        
    if end_date_str:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        query_fixed = query_fixed.filter(SetterDailyStats.date <= end_date)
        
    fixed_stats = query_fixed.first()
    
    # Map back to stage_id with names
    stages_ordered = _get_setter_stages_ordered()
    stage_data = []
    if fixed_stats:
        vals = [fixed_stats.total_stage_1, fixed_stats.total_stage_2, fixed_stats.total_stage_3, fixed_stats.total_stage_4, fixed_stats.total_stage_5]
        for i, s in enumerate(stages_ordered[:5]):
            stage_data.append({
                "id": s.id,
                "name": s.name,
                "value": int(vals[i] or 0)
            })
    
    # Fetch pending agendas (appointments booked by this setter with no result)
    from app.models import Appointment
    from sqlalchemy import or_
    
    pending_agendas = Appointment.query.filter(
        Appointment.setter_id == current_user.id,
        or_(Appointment.result == None, Appointment.result == '')
    ).order_by(Appointment.start_time.desc()).limit(50).all()
    
    return jsonify({
        "total_not_lead": int(fixed_stats.total_not_lead or 0) if fixed_stats else 0,
        "total_leads": int(fixed_stats.total_stage_1 or 0) if fixed_stats else 0,
        "stage_metrics": stage_data,
        "pending_agendas": [{
            "id": a.id,
            "lead_name": a.client.full_name or a.client.email if a.client else "Unknown",
            "closer_name": a.closer.username if a.closer else "Unassigned",
            "start_time": a.start_time.isoformat(),
            "origin": a.origin,
            "client_id": a.client_id,
            "phone": a.client.phone if a.client else "",
            "last_stage": a.last_stage,
            "type": a.origin or 'Manual'
        } for a in pending_agendas]
    }), 200

@bp.route('/my-reports', methods=['GET'])
@role_required(ROLE_SETTER)
def get_my_reports():
    # Fetch last 30 reports
    reports = SetterDailyStats.query.filter_by(setter_id=current_user.id)\
        .order_by(SetterDailyStats.date.desc())\
        .limit(30).all()
        
    result = []
    
    # Pre-fetch stages to avoid query in loop if possible, but simplest is to reuse helper
    stages = _get_setter_stages_ordered()
    
    for r in reports:
        # Get dynamic metrics for this report
        stage_metrics = {}
        if len(stages) > 0: stage_metrics[stages[0].id] = r.stage_1_value
        if len(stages) > 1: stage_metrics[stages[1].id] = r.stage_2_value
        if len(stages) > 2: stage_metrics[stages[2].id] = r.stage_3_value
        if len(stages) > 3: stage_metrics[stages[3].id] = r.stage_4_value
        if len(stages) > 4: stage_metrics[stages[4].id] = r.stage_5_value
        
        # Get answers from JSON column
        answers = r.answers or {}
        
        result.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "fixed_stats": {
                "not_lead": r.not_lead,
                "qualification_fu": r.qualification_fu,
                "pain_fu": r.pain_fu,
                "offer_fu": r.offer_fu,
                "agenda_fu": r.agenda_fu,
                "link_fu": r.link_fu,
                "link_fur": r.link_fur,
                "qualification_fur": r.qualification_fur,
                "pain_fur": r.pain_fur,
                "offer_fur": r.offer_fur,
                "agenda_fur": r.agenda_fur,
                "qualification_opening_submitted": r.qualification_opening_submitted,
                "qualification_opening_responded": r.qualification_opening_responded,
                "pain_opening_submitted": r.pain_opening_submitted,
                "pain_opening_responded": r.pain_opening_responded
            },
            "funnel_stats": stage_metrics,
            "answers": answers
        })
        
    return jsonify(result), 200

@bp.route('/daily-report/<int:report_id>', methods=['DELETE'])
@role_required(ROLE_SETTER)
def delete_daily_report(report_id):
    report = SetterDailyStats.query.filter_by(id=report_id, setter_id=current_user.id).first()
    if not report:
        return jsonify({"message": "Reporte no encontrado"}), 404
        
    try:
        # Delete related data first
        DailyReportAnswer.query.filter_by(setter_stats_id=report.id).delete()

        
        # Delete report
        db.session.delete(report)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al eliminar: {str(e)}"}), 500

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

@bp.route('/agendas', methods=['GET'])
@role_required(ROLE_SETTER)
def get_setter_agendas():
    """
    Returns all appointments generated by this setter.
    Supports filtering by status (?status=pending|completed|all)
    """
    from app.models import Appointment
    from sqlalchemy import or_
    
    status_filter = request.args.get('status', 'all')
    
    query = Appointment.query.filter(Appointment.setter_id == current_user.id)
    
    if status_filter == 'pending':
        query = query.filter(or_(Appointment.result == None, Appointment.result == ''))
    elif status_filter == 'completed':
        query = query.filter(Appointment.result != None, Appointment.result != '')
        
    # Order by start_time descending (newest first)
    appointments = query.order_by(Appointment.start_time.desc()).all()
    
    return jsonify([{
        "id": a.id,
        "lead_name": a.client.full_name or a.client.email if a.client else "Unknown",
        "closer_name": a.closer.username if a.closer else "Unassigned",
        "start_time": a.start_time.isoformat(),
        "origin": a.origin,
        "client_id": a.client_id,
        "phone": a.client.phone if a.client else "",
        "last_stage": a.last_stage,
        "result": a.result,
        "type": a.origin or 'Manual'
    } for a in appointments]), 200

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

@bp.route('/notifications', methods=['GET'])
@role_required(ROLE_SETTER)
def get_notifications():
    from app.models import Notification
    
    # Fetch last 50 notifications
    all_notifs = Notification.query.order_by(Notification.created_at.desc()).limit(50).all()
    
    relevant = []
    # Simple Python-side filtering for JSON compatibility
    for n in all_notifs:
        is_target = False
        
        # Check target
        if n.target_users == "all":
            is_target = True
        elif isinstance(n.target_users, str) and (n.target_users == f"role:{ROLE_SETTER}" or n.target_users == "role:setter"):
            is_target = True
        elif isinstance(n.target_users, list) and current_user.id in n.target_users:
            is_target = True
            
        if is_target:
            is_read = current_user.id in (n.read_by or [])
            relevant.append({
                "id": n.id,
                "subject": n.subject,
                "content": n.content,
                "created_at": n.created_at.isoformat(),
                "is_read": is_read,
                "associated_id": n.associated_id,
                "associated_type": n.associated_type
            })
            
    return jsonify(relevant), 200

@bp.route('/notifications/<int:id>/read', methods=['POST'])
@role_required(ROLE_SETTER)
def mark_notification_read(id):
    from app.models import Notification
    
    notif = Notification.query.get_or_404(id)
    
    # Initialize read_by if None
    if not notif.read_by:
        notif.read_by = []
        
    # Add user if not present
    if current_user.id not in notif.read_by:
        # Create a new list to ensure SQLAlchemy detects change
        new_list = list(notif.read_by)
        new_list.append(current_user.id)
        notif.read_by = new_list
        db.session.commit()
        
    return jsonify({"message": "Marked as read"}), 200


