from flask import Blueprint, request, jsonify
from app import db
from app.models import WorkshopTemplate, WorkshopButton, WorkshopTemplateSent, WorkshopInteraction
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
