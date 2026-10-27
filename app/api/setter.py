from flask import Blueprint, request, jsonify
from flask_login import current_user
from app.api.errores import error_interno
from app import db
from app.models import DailyReportQuestion, SetterDailyStats, ROLE_SETTER
from app.decorators import role_required
from datetime import datetime

bp = Blueprint('setter', __name__)

@bp.route('/questions', methods=['GET'])
@role_required(ROLE_SETTER)
def get_setter_questions():
    try:
        questions = DailyReportQuestion.query.filter_by(role='setter', is_active=True).order_by(DailyReportQuestion.order).all()
        return jsonify([{"id": q.id, "text": q.text, "type": q.question_type} for q in questions]), 200
    except Exception as e:
        return error_interno(e, clave='message')

def _get_setter_stages_ordered():
    from app.models import Pipeline, PipelineStage
    pipeline = Pipeline.query.filter_by(name='setter_default').first()
    if not pipeline:
        return []
    return PipelineStage.query.filter_by(pipeline_id=pipeline.id, is_active=True).order_by(PipelineStage.order).all()

def _trigger_setter_report_webhook(stat):
    """
    Triggers the Discord webhook with a single generated image of the setter report — el
    template `setter_report.html` ya incluye su propia seccion de "Reflexiones de Alto
    Rendimiento" (reflections.daily_reflection / reflections.win_of_day), asi que la segunda
    imagen de reflexion (generate_reflection_card, pensada para las 5 preguntas viejas que
    setter nunca llena) era pura redundancia.
    """
    try:
        import requests
        import json
        from app.services.image_service import ImageService

        import os
        url = os.environ.get('DISCORD_REPORTS_WEBHOOK')
        if not url:
            from app.models import Integration
            integration = Integration.query.filter_by(key='discord_reports').first()
            if integration and integration.payload_config:
                url = integration.payload_config.get('webhook_url')

        if not url:
            print("[Discord Setter] No webhook URL configured in environment or database.")
            return

        # El reporte v2 (por canal, desde el 10/10/2026) tiene su propio mensaje y su tarjeta. El
        # v1 sigue saliendo exactamente como antes.
        if (getattr(stat, 'report_version', None) or 1) >= 2:
            _enviar_reporte_v2(url, stat)
            return

        # 1. Prepare Data for Image
        from app.api.public.setter import _prepare_setter_report_data
        img_data = _prepare_setter_report_data(stat)
        setter_name = img_data.get("setter_name", "Setter")

        # 2. Generate Image (metricas + reflexion, ya integradas en la misma tarjeta)
        img_buffer = ImageService.generate_setter_report_card(img_data)

        # 3. Discord Metadata
        content = (
            f"🚀 **NUEVO REPORTE DIARIO DE SETTER**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"👤 **Setter:** `{setter_name}`\n"
            f"📅 **Fecha:** `{stat.date.strftime('%d/%m/%Y')}`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"@everyone"
        )

        json_payload = {
            "content": content,
            "embeds": [
                {
                    "color": 4521291, # #2DD4BF
                    "image": {"url": "attachment://setter_report.png"},
                    "footer": {"text": "NeurOPS Stats"}
                }
            ]
        }

        files = {
            'file1': ('setter_report.png', img_buffer, 'image/png'),
        }

        # 4. Send
        res = requests.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=20)
        print(f"[Discord Setter] Status: {res.status_code}")
        
    except Exception as e:
        print(f"[Discord Setter Error] {e}")
        import traceback
        traceback.print_exc()


def _enviar_reporte_v2(url, stat):
    """Discord de un reporte v2: el Resumen en el texto del mensaje y la tarjeta por canal.

    El texto va siempre, aunque la tarjeta no se pueda dibujar (depende del Chromium del
    servidor): sin imagen, el reporte llega igual en vez de no llegar.
    """
    import json
    import requests
    from app.services import setter_reporte_discord
    from app.services.image_service import ImageService

    nombre = stat.setter.username if stat.setter else 'Setter'
    payload = {"content": setter_reporte_discord.texto_de_discord(stat, nombre)}
    try:
        tarjeta = ImageService.generate_setter_report_v2_card(setter_reporte_discord.datos_de_la_imagen(stat))
    except Exception as e:
        print(f"[Discord Setter] Sin tarjeta, sale solo el texto: {e}")
        tarjeta = None

    if tarjeta is None:
        res = requests.post(url, json=payload, timeout=20)
    else:
        payload["embeds"] = [{
            "color": 0xFF3FA4,
            "image": {"url": "attachment://setter_report.png"},
            "footer": {"text": "NeurOPS Stats"},
        }]
        res = requests.post(url, files={'file1': ('setter_report.png', tarjeta, 'image/png')},
                            data={"payload_json": json.dumps(payload)}, timeout=20)
    print(f"[Discord Setter v2] Status: {res.status_code}")


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
                "pain_opening_responded": stat.pain_opening_responded,
                "q1_useful": stat.q1_useful,
                "q1_unuseful": stat.q1_unuseful,
                "q2_useful": stat.q2_useful,
                "q2_unuseful": stat.q2_unuseful
            },
            "funnel_stats": stage_metrics,
            "answers": answers,
            "reflections": stat.reflections or {},
            "is_non_working_day": bool(stat.is_non_working_day) if stat.is_non_working_day is not None else False
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
    
    is_non_working = bool(data.get('is_non_working_day', False))

    if stat:
        # Update existing. Si el día se había mandado con el v2, ahora es un reporte v1.
        from app.services.setter_reporte_v2 import como_v1
        como_v1(stat)
        stat.is_non_working_day = is_non_working
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
        stat.offer_opening_submitted = int(data.get('offer_opening_submitted') or 0)
        stat.offer_opening_responded = int(data.get('offer_opening_responded') or 0)
        stat.link_opening_submitted = int(data.get('link_opening_submitted') or 0)
        stat.link_opening_responded = int(data.get('link_opening_responded') or 0)
        stat.q1_useful = int(data.get('q1_useful') or 0)
        stat.q1_unuseful = int(data.get('q1_unuseful') or 0)
        stat.q2_useful = int(data.get('q2_useful') or 0)
        stat.q2_unuseful = int(data.get('q2_unuseful') or 0)
        
    else:
        # Create new
        stat = SetterDailyStats(
            setter_id=current_user.id,
            date=report_date,
            is_non_working_day=is_non_working,
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
            pain_opening_responded=int(data.get('pain_opening_responded') or 0),
            offer_opening_submitted=int(data.get('offer_opening_submitted') or 0),
            offer_opening_responded=int(data.get('offer_opening_responded') or 0),
            link_opening_submitted=int(data.get('link_opening_submitted') or 0),
            link_opening_responded=int(data.get('link_opening_responded') or 0),
            q1_useful=int(data.get('q1_useful') or 0),
            q1_unuseful=int(data.get('q1_unuseful') or 0),
            q2_useful=int(data.get('q2_useful') or 0),
            q2_unuseful=int(data.get('q2_unuseful') or 0)
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

    # Guardar Daily Reflection si viene en el payload
    reflections_data = data.get('reflections')
    if reflections_data:
        stat.reflections = reflections_data
            
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return error_interno(e, 'Error al guardar el reporte', clave='message')

    # Discord separado para no comprometer el guardado si falla
    try:
        _trigger_setter_report_webhook(stat)
    except Exception as e:
        print(f"[Setter Webhook Error] {e}")
        import traceback
        traceback.print_exc()

    return jsonify({"message": "Reporte enviado con éxito", "id": stat.id}), 201


# Las demas rutas del blueprint viven en modulos aparte (regla de 500 lineas por archivo);
# se importan al final, ya definido `bp`, para que registren sus rutas sin import circular.
from app.api import setter_reportes  # noqa: E402,F401
from app.api import setter_links  # noqa: E402,F401
from app.api import setter_deck  # noqa: E402,F401
from app.api import setter_deck_acciones  # noqa: E402,F401
from app.api import setter_deck_stats  # noqa: E402,F401
from app.api import setter_cualificacion  # noqa: E402,F401
