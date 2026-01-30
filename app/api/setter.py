from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import DailyReportQuestion, DailyReportAnswer, SetterDailyStats, ROLE_SETTER
from app.decorators import role_required
from datetime import datetime

bp = Blueprint('setter', __name__)

@bp.route('/questions', methods=['GET'])
@login_required
@role_required(ROLE_SETTER)
def get_setter_questions():
    questions = DailyReportQuestion.query.filter_by(role='setter', is_active=True).order_by(DailyReportQuestion.order).all()
    return jsonify([{"id": q.id, "text": q.text, "type": q.question_type} for q in questions]), 200

@bp.route('/report', methods=['POST'])
@login_required
@role_required(ROLE_SETTER)
def submit_daily_report():
    data = request.get_json() or {}
    
    # Datos fijos obligatorios
    report_date_str = data.get('date')
    if not report_date_str:
        return jsonify({"message": "La fecha es obligatoria"}), 400
    
    report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    
    # Verificar si ya existe un reporte para este setter en esta fecha
    existing = SetterDailyStats.query.filter_by(setter_id=current_user.id, date=report_date).first()
    if existing:
        # En una versión futura podríamos permitir editar, por ahora bloqueamos duplicados
        return jsonify({"message": "Ya has enviado un reporte para esta fecha"}), 400
    
    # Crear estadísticas fijas
    stats = SetterDailyStats(
        setter_id=current_user.id,
        date=report_date,
        inbound_leads=data.get('inbound_leads', 0),
        openings=data.get('openings', 0),
        not_lead=data.get('not_lead', 0),
        new_offers=data.get('new_offers', 0),
        links_sent=data.get('links_sent', 0),
        appointments_booked=data.get('appointments_booked', 0),
        follow_ups=data.get('follow_ups', 0)
    )
    
    db.session.add(stats)
    
    # Procesar preguntas dinámicas
    answers = data.get('answers', [])
    for ans in answers:
        question_id = ans.get('question_id')
        answer_text = str(ans.get('answer', ''))
        
        if question_id:
            answer_obj = DailyReportAnswer(
                setter_stats_id=stats.id,
                question_id=question_id,
                answer=answer_text
            )
            db.session.add(answer_obj)
            
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar el reporte: {str(e)}"}), 500
        
    return jsonify({"message": "Reporte enviado con éxito", "id": stats.id}), 201

@bp.route('/stats/summary', methods=['GET'])
@login_required
@role_required(ROLE_SETTER)
def get_stats_summary():
    # Placeholder para estadísticas individuales del setter que se mostrarán en su dashboard
    return jsonify({
        "total_agendas": 0,
        "total_openings": 0,
        "weekly_conversion": 0
    }), 200
