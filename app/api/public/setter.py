from flask import request, jsonify, render_template_string
from app.models import db, User
from datetime import datetime, date, timedelta
from . import bp
import json
import requests

@bp.route('/public/active-setters', methods=['GET'])
def get_active_setters():
    """Retorna lista de setters activos (Nombre e ID)"""
    try:
        setters = User.query.filter_by(role='setter', is_active=True).all()
        return jsonify([
            {"id": s.id, "name": s.username} 
            for s in setters
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/public/setter-questions', methods=['GET'])
def get_public_setter_questions():
    """Retorna las preguntas configuradas para los setters"""
    from app.models import DailyReportQuestion
    try:
        questions = DailyReportQuestion.query.filter_by(role='setter', is_active=True).order_by(DailyReportQuestion.order).all()
        return jsonify([{"id": q.id, "text": q.text, "type": q.question_type} for q in questions]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _setter_del_pedido(valor):
    """El setter de un pedido sobre reportes, y el error si no corresponde: `(id, None)` o `(None, respuesta)`.

    Con un setter logueado (también la dirección simulándolo: la sesión ES el setter) manda la
    sesión: sin `setter_id` es él, y otro `setter_id` es un 403. Un setter no carga ni lee el
    reporte de otro. La dirección y admin eligen a quién mirar.
    """
    from flask_login import current_user

    if current_user.is_authenticated and current_user.role == 'setter':
        if valor not in (None, '') and str(valor) != str(current_user.id):
            return None, (jsonify({"message": "Solo podés cargar o ver tu propio reporte"}), 403)
        return current_user.id, None
    if valor in (None, ''):
        return None, (jsonify({"message": "setter_id es obligatorio"}), 400)
    try:
        return int(valor), None
    except (TypeError, ValueError):
        return None, (jsonify({"message": "ID del setter inválido"}), 400)


@bp.route('/public/setter-report', methods=['GET'])
def get_public_setter_report():
    """El reporte que un setter mandó un día, para reabrirlo y editarlo: `{"reporte": leer(...)}`,
    o `{"reporte": null}` si ese día no reportó. Un v1 vuelve sin canales (ver `leer`)."""
    from app.models import SetterDailyStats
    from app.services import setter_reporte_v2

    setter_id, error = _setter_del_pedido(request.args.get('setter_id'))
    if error:
        return error
    try:
        dia = datetime.strptime(request.args.get('date') or '', '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400

    stat = SetterDailyStats.query.filter_by(setter_id=setter_id, date=dia).first()
    return jsonify({"reporte": setter_reporte_v2.leer(stat) if stat else None}), 200


@bp.route('/public/setter-report/fechas', methods=['GET'])
def get_public_setter_report_dates():
    """Los días de un rango (`desde`, `hasta`) en los que el setter mandó su reporte: las marcas
    «Enviado» del calendario del formulario. Los no laborables van además aparte."""
    from app.models import SetterDailyStats

    setter_id, error = _setter_del_pedido(request.args.get('setter_id'))
    if error:
        return error
    try:
        desde = datetime.strptime(request.args.get('desde') or '', '%Y-%m-%d').date()
        hasta = datetime.strptime(request.args.get('hasta') or '', '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "desde y hasta son obligatorios (AAAA-MM-DD)"}), 400
    if hasta < desde or (hasta - desde).days > 400:
        return jsonify({"message": "El rango tiene que ir de desde a hasta, y no pasar de un año"}), 400

    filas = db.session.query(SetterDailyStats.date, SetterDailyStats.is_non_working_day).filter(
        SetterDailyStats.setter_id == setter_id,
        SetterDailyStats.date >= desde, SetterDailyStats.date <= hasta,
    ).order_by(SetterDailyStats.date).all()
    return jsonify({
        "fechas": [d.isoformat() for d, _ in filas],
        "no_laborables": [d.isoformat() for d, libre in filas if libre],
    }), 200


def _es_v2(data):
    """¿El pedido es del formulario por pasos? Lo dice `version: 2`; sin eso es el v1 de siempre."""
    try:
        return int(data.get('version') or 1) >= 2
    except (TypeError, ValueError):
        return False


def _guardar_reporte_v2(setter_id, report_date, data):
    """El reporte v2 del día: crea la fila o pisa la que había (también si era del v1) con
    `setter_reporte_v2.escribir`, que además deja los totales del v1 con su significado de siempre."""
    from app.models import SetterDailyStats
    from app.api.setter import _trigger_setter_report_webhook
    from app.services import setter_reporte_v2

    try:
        setter_id = int(setter_id)
    except (TypeError, ValueError):
        return jsonify({"message": "ID del setter inválido"}), 400
    if not db.session.get(User, setter_id):
        return jsonify({"message": "Setter no encontrado"}), 404

    stat = SetterDailyStats.query.filter_by(setter_id=setter_id, date=report_date).first()
    if not stat:
        stat = SetterDailyStats(setter_id=setter_id, date=report_date)
        db.session.add(stat)
    setter_reporte_v2.escribir(stat, data)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Error al guardar el reporte: {e}"}), 500

    # Discord aparte: si falla, el reporte ya quedó guardado.
    _trigger_setter_report_webhook(stat)
    return jsonify({"message": "Reporte guardado exitosamente", "id": stat.id,
                    "reporte": setter_reporte_v2.leer(stat)}), 201


@bp.route('/public/setter-report', methods=['POST'])
def submit_public_setter_report():
    """Recibe y guarda el reporte diario de un setter, disparando las automatizaciones.

    Desde el 10/10/2026 el espacio del setter manda el v2 (`version: 2`, por canal y con
    bienvenidas: ver `app/services/setter_reporte_v2.py`). Lo que llegue sin `version` es el v1 de
    siempre y se guarda como antes: este endpoint es público para cualquier cliente que lo use.
    """
    from app.models import SetterDailyStats, PipelineStage
    from app.api.setter import _trigger_setter_report_webhook, _get_setter_stages_ordered

    data = request.get_json() or {}

    # Un setter carga solo su reporte: el `setter_id` lo fija la sesión (ver `_setter_del_pedido`).
    # El formulario viejo dejaba elegir el perfil de cualquier setter y mandarlo a su nombre.
    setter_id, error = _setter_del_pedido(data.get('setter_id'))
    if error:
        return error
    report_date_str = data.get('date')

    if not report_date_str:
        return jsonify({"message": "ID del setter y fecha son obligatorios"}), 400

    try:
        report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400

    if _es_v2(data):
        return _guardar_reporte_v2(setter_id, report_date, data)

    # Verificar existencia
    stat = SetterDailyStats.query.filter_by(setter_id=setter_id, date=report_date).first()

    if stat:
        # Si el día se había mandado con el v2, ahora es un reporte v1: sin los canales de antes.
        from app.services.setter_reporte_v2 import como_v1
        como_v1(stat)
        stat.not_lead = int(data.get('not_lead') or 0)
        stat.inbox_entrantes = int(data.get('inbox_entrantes') or 0)
        stat.inbox_inabribles = int(data.get('inbox_inabribles') or 0)
        stat.inbox_leads = int(data.get('inbox_leads') or 0)
        
        # Calcular totales de aperturas para legacy/compatibilidad
        q_op_sub = int(data.get('qualification_opening_submitted') or 0)
        p_op_sub = int(data.get('pain_opening_submitted') or 0)
        q_op_res = int(data.get('qualification_opening_responded') or 0)
        p_op_res = int(data.get('pain_opening_responded') or 0)
        
        stat.opening_submitted = q_op_sub + p_op_sub
        stat.opening_responded = q_op_res + p_op_res
        
        stat.funnel_qualification = int(data.get('funnel_qualification') or 0)
        stat.funnel_pain = int(data.get('funnel_pain') or 0)
        stat.funnel_offer = int(data.get('funnel_offer') or 0)
        stat.funnel_link = int(data.get('funnel_link') or 0)
        stat.funnel_agenda = int(data.get('funnel_agenda') or 0)
        stat.qualification_fu = int(data.get('qualification_fu') or 0)
        stat.pain_fu = int(data.get('pain_fu') or 0)
        stat.offer_fu = int(data.get('offer_fu') or 0)
        stat.agenda_fu = int(data.get('agenda_fu') or 0)
        stat.link_fu = int(data.get('link_fu') or 0)
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
        stat = SetterDailyStats(
            setter_id=setter_id,
            date=report_date,
            not_lead=int(data.get('not_lead') or 0),
            inbox_entrantes=int(data.get('inbox_entrantes') or 0),
            inbox_inabribles=int(data.get('inbox_inabribles') or 0),
            inbox_leads=int(data.get('inbox_leads') or 0),
            opening_submitted=int(data.get('qualification_opening_submitted') or 0) + int(data.get('pain_opening_submitted') or 0),
            opening_responded=int(data.get('qualification_opening_responded') or 0) + int(data.get('pain_opening_responded') or 0),
            funnel_qualification=int(data.get('funnel_qualification') or 0),
            funnel_pain=int(data.get('funnel_pain') or 0),
            funnel_offer=int(data.get('funnel_offer') or 0),
            funnel_link=int(data.get('funnel_link') or 0),
            funnel_agenda=int(data.get('funnel_agenda') or 0),
            qualification_fu=int(data.get('qualification_fu') or 0),
            pain_fu=int(data.get('pain_fu') or 0),
            offer_fu=int(data.get('offer_fu') or 0),
            agenda_fu=int(data.get('agenda_fu') or 0),
            link_fu=int(data.get('link_fu') or 0),
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
        
    # Procesar Funnel Metrics -> Map to stage_X_value
    funnel_metrics = data.get('funnel_metrics', [])
    stages = _get_setter_stages_ordered()
    stage_id_to_index = {s.id: i for i, s in enumerate(stages)}
    
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
            
    # Process dinamic answers
    answers_data = data.get('answers', [])
    answers_json = {}
    for ans in answers_data:
        question_id = str(ans.get('question_id'))
        answer_text = str(ans.get('answer', ''))
        if question_id:
            answers_json[question_id] = answer_text
            
    if 'frequent_questions' in data:
        answers_json['frequent_questions'] = data.get('frequent_questions')
            
    stat.answers = answers_json
    
    # Guardar Daily Reflection si viene en el payload
    reflections_data = data.get('reflections')
    if reflections_data:
        stat.reflections = reflections_data
    
    try:
        db.session.commit()
        # Trigger webhook AFTER successful save (imported directly from setter.py logic)
        _trigger_setter_report_webhook(stat)
        return jsonify({"message": "Reporte guardado exitosamente"}), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/setter-report/prefill', methods=['GET'])
def prefill_public_setter_report():
    """Los números con los que arranca el reporte del día: los MISMOS que "Mis datos" para ese día.

    Antes se contaban acá con otra regla y el setter veía dos verdades del mismo día (01/10/2026,
    septiembre de 2026 en producción):

      · "Entrantes" eran las filas de `LeadAnswer` del día —interacciones, no personas— filtradas
        por el setter del EVENTO del anuncio, que casi ningún anuncio tiene: con `setter_id IS NULL`
        entraba todo el equipo y los leads sin repartir. A Elias y a Paula les sumaba 5.503 en el
        mes, contra 692 y 480 leads suyos en "Mis datos".
      · "Agendas" eran todas sus citas creadas ese día, sin depurar y con el marcador que deja
        cualificar un lead (`no_es_marcador`).

    Ahora sale de `ComercialService.leads` y `ComercialService.generadas`, con el día naive (UTC)
    que usa "Mis datos". El reporte guarda tres campos y deriva "Leads netos" como Cualificación −
    No Lead, así que se llenan para que esa resta dé los cualificados de "Mis datos":

      · Entrantes = Entrantes; Cualificación = Respondieron (contestaron la pregunta filtro);
      · No Lead = Respondieron − Cualificados (contestaron y no califican);
      · Agendas = Agendas generadas.

    Siguen siendo editables: es un punto de partida, el setter puede corregirlos antes de enviar.
    Un usuario que no es setter (la dirección probando el formulario) recibe los del equipo, como
    "Todo el equipo" en el dashboard.

    Un setter solo pide los suyos: ahora son sus números reales, y en "Mis datos" nadie ve los de
    otro (decisión del 24/09/2026). Antes daba igual, porque los entrantes eran los del equipo.

    **Por canal, para el reporte v2 (10/10/2026).** `anuncios` e `inbound` traen lo mismo partido
    por canal (ver `_precarga_por_canal`): entrantes, no leads, in-abribles y agendas. Las claves
    del v1 siguen para quien las use.
    """
    from flask_login import current_user

    from app.models import User
    from app.services.comercial_service import ComercialService

    setter_id = request.args.get('setter_id')
    date_str = request.args.get('date')

    if not setter_id or not date_str:
        return jsonify({"message": "setter_id y date son obligatorios"}), 400

    if current_user.is_authenticated and current_user.role == 'setter' \
            and str(current_user.id) != str(setter_id):
        return jsonify({"message": "Solo podés autocompletar tu propio reporte"}), 403

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Formato de fecha inválido"}), 400

    user = User.query.get(setter_id)
    if not user:
        return jsonify({"message": "Setter no encontrado"}), 404

    es_setter = user.role == 'setter'
    generadas = ComercialService.generadas(target_date, target_date,
                                           setter_id=user.id if es_setter else None)

    filas_leads = ComercialService.leads(
        target_date, target_date,
        setter_nombre=user.username if es_setter else None,
        setter_id=user.id if es_setter else None)
    leads = ComercialService.totales_leads(filas_leads)

    return jsonify({
        "inbox_entrantes": leads['leads'],
        "funnel_qualification": leads['respondieron'],
        "not_lead": leads['respondieron'] - leads['cualificados'],
        "funnel_agenda": len(generadas),
        "version": 2,
        **_precarga_por_canal(filas_leads, generadas),
    }), 200


def _leads_de_inbound(lead_ids):
    """Cuáles de estos leads de ManyChat entraron por Inbound y no por un anuncio.

    Inbound es el «anuncio» ficticio con `keyword='Inbound'` que crea `ensure_inbound_ad_exists`
    (marketing.py): ManyChat manda esa palabra clave cuando el lead escribe sin venir de un
    anuncio. Un lead es de Inbound si alguna de sus respuestas trae esa palabra o ese anuncio.
    """
    from sqlalchemy import func
    from app.models import Ad, LeadAnswer

    if not lead_ids:
        return set()
    anuncios_inbound = {i for (i,) in db.session.query(Ad.id).filter(func.lower(Ad.keyword) == 'inbound')}
    inbound = set()
    for lead_id, keyword, ad_id in db.session.query(LeadAnswer.lead_id, LeadAnswer.keyword, LeadAnswer.ad_id)             .filter(LeadAnswer.lead_id.in_(list(lead_ids))):
        if (keyword or '').strip().lower() == 'inbound' or (ad_id is not None and ad_id in anuncios_inbound):
            inbound.add(lead_id)
    return inbound


def _precarga_por_canal(filas_leads, generadas):
    """La precarga del reporte v2 partida en anuncios e inbound. Lo que el sistema NO sabe
    (aperturas, bienvenidas, embudo, follow-ups) no viene: eso lo carga el setter.

    Por canal, con las mismas filas que "Mis datos" (los cualificados de los dos canales suman los
    de "Mis datos"):

      · Entrantes = sus leads de ManyChat del día (personas, no interacciones).
      · No leads = contestaron la pregunta filtro y no califican.
      · In-abribles = no contestaron nunca: la conversación no se pudo abrir.
        Así entrantes − no leads − in-abribles = los cualificados, que es como el v2 los calcula.
      · Agendas = sus agendas generadas del día, por el canal del lead que agendó: se cruza el
        instagram del cliente con sus leads de ManyChat (de cualquier fecha). Si alguno vino de un
        anuncio, es de anuncios; si solo vino por Inbound, o no tiene lead de ManyChat (escribió
        por su cuenta y nadie lo cargó como lead de un anuncio), es de inbound.

    Hasta el 10/10/2026 ningún lead de la base trae la marca de Inbound (ManyChat todavía no la
    manda), así que en la práctica todo lo de ManyChat cae en anuncios: es lo que dice el dato, y
    el setter lo corrige si no.
    """
    from sqlalchemy import func
    from app.models import ManychatLead
    from app.services.comercial_service import _limpiar_ig

    def vacio():
        return {'entrantes': 0, 'no_lead': 0, 'inabribles': 0, 'agendas': 0}

    canales = {'anuncios': vacio(), 'inbound': vacio()}
    de_inbound = _leads_de_inbound({f['id'] for f in filas_leads})
    for fila in filas_leads:
        c = canales['inbound' if fila['id'] in de_inbound else 'anuncios']
        c['entrantes'] += 1
        if not fila['respondio']:
            c['inabribles'] += 1
        elif not fila['cualificado']:
            c['no_lead'] += 1

    igs = {ig for ig in (_limpiar_ig(a.get('ig')) for a in generadas) if ig}
    leads_por_ig = {}
    if igs:
        ig_lead = func.lower(func.replace(ManychatLead.ig, '@', ''))
        for lead_id, ig in db.session.query(ManychatLead.id, ig_lead).filter(ig_lead.in_(sorted(igs))):
            leads_por_ig.setdefault(_limpiar_ig(ig), set()).add(lead_id)
    inbound_por_ig = _leads_de_inbound({i for ids in leads_por_ig.values() for i in ids})
    for agenda in generadas:
        ids = leads_por_ig.get(_limpiar_ig(agenda.get('ig')), set())
        de_un_anuncio = any(i not in inbound_por_ig for i in ids)
        canales['anuncios' if de_un_anuncio else 'inbound']['agendas'] += 1
    return canales

def _compute_setter_stats(start_date_str, end_date_str, setter_id, agg_type):
    """La Vista General de /admin/ventas › Setters (y su período de comparación).

    **Con reportes v2 (10/10/2026).** Los totales salen de las columnas del v1, que el v2 sigue
    llenando con el mismo significado (`setter_reporte_v2.escribir`), así que entrantes,
    cualificados, embudo y agendas suman los dos formularios. Lo que el v2 NO pide son las
    respuestas: a aperturas y a follow-ups. Una tasa de respuesta con el v2 adentro dividía las
    respuestas del v1 por los envíos de los dos y bajaba sola. Por eso cada tasa de respuesta se
    calcula solo con los reportes v1 (`*_v1`), y `por_canal` trae lo nuevo del v2 (canales,
    cualificación, aperturas, agendas y bienvenidas) con `setter_reporte_v2.sumar`.
    """
    from app.models import SetterDailyStats, User
    from app.services import setter_reporte_v2
    from sqlalchemy import case, func, or_

    es_v1 = or_(SetterDailyStats.report_version.is_(None), SetterDailyStats.report_version < 2)

    def solo_v1(columna):
        return func.sum(case((es_v1, columna), else_=0))

    # Count how many days of reports are in this range to calculate averages correctly
    days_count_query = db.session.query(func.count(SetterDailyStats.id))
    
    query = db.session.query(
        func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
        func.sum(SetterDailyStats.not_lead).label('not_lead'),
        func.sum(SetterDailyStats.inbox_inabribles).label('inabribles'),
        (func.sum(SetterDailyStats.funnel_qualification) - func.sum(SetterDailyStats.not_lead)).label('leads'),
        # Sumamos las aperturas de cualificación y dolor para el total
        func.sum(SetterDailyStats.qualification_opening_submitted + SetterDailyStats.pain_opening_submitted).label('op_sub'),
        func.sum(SetterDailyStats.qualification_opening_responded + SetterDailyStats.pain_opening_responded).label('op_res'),
        func.sum(SetterDailyStats.funnel_qualification).label('fun_qual'),
        func.sum(SetterDailyStats.funnel_pain).label('fun_pain'),
        func.sum(SetterDailyStats.funnel_offer).label('fun_offer'),
        func.sum(SetterDailyStats.funnel_link).label('fun_link'),
        func.sum(SetterDailyStats.funnel_agenda).label('fun_agenda'),
        
        # Follow Ups Sub/Res
        func.sum(SetterDailyStats.qualification_fu).label('fu_q_s'),
        func.sum(SetterDailyStats.qualification_fur).label('fu_q_r'),
        func.sum(SetterDailyStats.pain_fu).label('fu_p_s'),
        func.sum(SetterDailyStats.pain_fur).label('fu_p_r'),
        func.sum(SetterDailyStats.offer_fu).label('fu_o_s'),
        func.sum(SetterDailyStats.offer_fur).label('fu_o_r'),
        func.sum(SetterDailyStats.link_fu).label('fu_l_s'),
        func.sum(SetterDailyStats.link_fur).label('fu_l_r'),
        func.sum(SetterDailyStats.agenda_fu).label('fu_a_s'),
        func.sum(SetterDailyStats.agenda_fur).label('fu_a_r'),
        
        # Total Follow Ups
        (func.sum(SetterDailyStats.qualification_fu) + 
         func.sum(SetterDailyStats.pain_fu) + 
         func.sum(SetterDailyStats.offer_fu) + 
         func.sum(SetterDailyStats.link_fu) + 
         func.sum(SetterDailyStats.agenda_fu)).label('total_fu_s'),
        (func.sum(SetterDailyStats.qualification_fur) + 
         func.sum(SetterDailyStats.pain_fur) + 
         func.sum(SetterDailyStats.offer_fur) + 
         func.sum(SetterDailyStats.link_fur) + 
         func.sum(SetterDailyStats.agenda_fur)).label('total_fu_r'),
        
        # Openings Sub/Res
        func.sum(SetterDailyStats.qualification_opening_submitted).label('q_op_s'),
        func.sum(SetterDailyStats.qualification_opening_responded).label('q_op_r'),
        func.sum(SetterDailyStats.pain_opening_submitted).label('p_op_s'),
        func.sum(SetterDailyStats.pain_opening_responded).label('p_op_r'),
        func.sum(SetterDailyStats.offer_opening_submitted).label('o_op_s'),
        func.sum(SetterDailyStats.offer_opening_responded).label('o_op_r'),
        func.sum(SetterDailyStats.link_opening_submitted).label('l_op_s'),
        func.sum(SetterDailyStats.link_opening_responded).label('l_op_r'),
        
        # Question Efficacy
        func.sum(SetterDailyStats.q1_useful).label('q1_u'),
        func.sum(SetterDailyStats.q1_unuseful).label('q1_i'),
        func.sum(SetterDailyStats.q2_useful).label('q2_u'),
        func.sum(SetterDailyStats.q2_unuseful).label('q2_i'),

        # Los envíos de los reportes que miden la respuesta (solo el v1): denominadores de las tasas
        solo_v1(SetterDailyStats.qualification_opening_submitted + SetterDailyStats.pain_opening_submitted).label('op_sub_v1'),
        solo_v1(SetterDailyStats.qualification_fu).label('fu_q_s_v1'),
        solo_v1(SetterDailyStats.pain_fu).label('fu_p_s_v1'),
        solo_v1(SetterDailyStats.offer_fu).label('fu_o_s_v1'),
        solo_v1(SetterDailyStats.link_fu).label('fu_l_s_v1'),
        solo_v1(SetterDailyStats.agenda_fu).label('fu_a_s_v1'),
        solo_v1(SetterDailyStats.qualification_fu + SetterDailyStats.pain_fu + SetterDailyStats.offer_fu
                + SetterDailyStats.link_fu + SetterDailyStats.agenda_fu).label('total_fu_s_v1'),
        solo_v1(SetterDailyStats.qualification_opening_submitted).label('q_op_s_v1'),
        solo_v1(SetterDailyStats.pain_opening_submitted).label('p_op_s_v1'),
        solo_v1(SetterDailyStats.offer_opening_submitted).label('o_op_s_v1'),
        solo_v1(SetterDailyStats.link_opening_submitted).label('l_op_s_v1'),
        solo_v1(SetterDailyStats.funnel_agenda).label('fun_agenda_v1'),
        solo_v1(1).label('reportes_v1'),
    )
    
    filters = []
    if start_date_str:
        filters.append(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        filters.append(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
    if setter_id:
        filters.append(SetterDailyStats.setter_id == setter_id)
        
    for f in filters:
        query = query.filter(f)
        days_count_query = days_count_query.filter(f)
        
    stats = query.one()
    days_count = days_count_query.scalar() or 1
    
    # helper for safe division and averaging
    def div(n, d):
        return round((n / d) * 100, 2) if d and d > 0 else 0
    
    def process_val(v):
        val = float(v or 0)
        if agg_type == 'avg':
            return round(val / days_count, 2)
        return val

    # Totals/Averages
    entrantes = float(stats.entrantes or 0)
    
    res = {
        "metadata": {
            "days_analyzed": days_count,
            "agg_type": agg_type
        },
        "totals": {
            "entrantes": process_val(stats.entrantes),
            "not_lead": process_val(stats.not_lead),
            "inabribles": process_val(stats.inabribles),
            "leads": process_val(stats.leads),
            "no_response": process_val(stats.entrantes) - process_val(stats.fun_qual),
            "opening_submitted": process_val(stats.op_sub),
            "opening_responded": process_val(stats.op_res),
            "funnel_qualification": process_val(stats.fun_qual),
            "funnel_pain": process_val(stats.fun_pain),
            "funnel_offer": process_val(stats.fun_offer),
            "funnel_link": process_val(stats.fun_link),
            "funnel_agenda": process_val(stats.fun_agenda),
            
            "qualification_fu": process_val(stats.fu_q_s),
            "qualification_fur": process_val(stats.fu_q_r),
            "pain_fu": process_val(stats.fu_p_s),
            "pain_fur": process_val(stats.fu_p_r),
            "offer_fu": process_val(stats.fu_o_s),
            "offer_fur": process_val(stats.fu_o_r),
            "link_fu": process_val(stats.fu_l_s),
            "link_fur": process_val(stats.fu_l_r),
            "agenda_fu": process_val(stats.fu_a_s),
            "agenda_fur": process_val(stats.fu_a_r),
            "total_fu_s": process_val(stats.total_fu_s),
            "total_fu_r": process_val(stats.total_fu_r),
            
            "qualification_opening_submitted": process_val(stats.q_op_s),
            "qualification_opening_responded": process_val(stats.q_op_r),
            "pain_opening_submitted": process_val(stats.p_op_s),
            "pain_opening_responded": process_val(stats.p_op_r),
            "offer_opening_submitted": process_val(stats.o_op_s),
            "offer_opening_responded": process_val(stats.o_op_r),
            "link_opening_submitted": process_val(stats.l_op_s),
            "link_opening_responded": process_val(stats.l_op_r),
            
            "q1_useful": process_val(stats.q1_u),
            "q1_unuseful": process_val(stats.q1_i),
            "q2_useful": process_val(stats.q2_u),
            "q2_unuseful": process_val(stats.q2_i)
        },
        "percentages": {
            "questions": {
                "q1_useful": div(float(stats.q1_u or 0), float(stats.q1_u or 0) + float(stats.q1_i or 0)),
                "q2_useful": div(float(stats.q2_u or 0), float(stats.q2_u or 0) + float(stats.q2_i or 0)),
                "q1_total": float(stats.q1_u or 0) + float(stats.q1_i or 0),
                "q2_total": float(stats.q2_u or 0) + float(stats.q2_i or 0)
            },
            "inbox": {
                "leads": div(float(stats.leads or 0), entrantes),
                "not_lead": div(float(stats.not_lead or 0), entrantes),
                "inabribles": div(float(stats.inabribles or 0), entrantes)
            },
            # Las respuestas solo las mide el v1: cada tasa, sobre los envíos de esos reportes.
            "rates": {
                "opening_response": div(float(stats.op_res or 0), float(stats.op_sub_v1 or 0)),
                "opening_rate": div(float(stats.leads or 0), float(stats.entrantes or 0)),
                "qualification_fur": div(float(stats.fu_q_r or 0), float(stats.fu_q_s_v1 or 0)),
                "pain_fur": div(float(stats.fu_p_r or 0), float(stats.fu_p_s_v1 or 0)),
                "offer_fur": div(float(stats.fu_o_r or 0), float(stats.fu_o_s_v1 or 0)),
                "link_fur": div(float(stats.fu_l_r or 0), float(stats.fu_l_s_v1 or 0)),
                "agenda_fur": div(float(stats.fu_a_r or 0), float(stats.fu_a_s_v1 or 0)),
                "total_fur": div(float(stats.total_fu_r or 0), float(stats.total_fu_s_v1 or 0)),
                "qualification_opening_rate": div(float(stats.q_op_r or 0), float(stats.q_op_s_v1 or 0)),
                "pain_opening_rate": div(float(stats.p_op_r or 0), float(stats.p_op_s_v1 or 0)),
                "offer_opening_rate": div(float(stats.o_op_r or 0), float(stats.o_op_s_v1 or 0)),
                "link_opening_rate": div(float(stats.l_op_r or 0), float(stats.l_op_s_v1 or 0))
            },
            "funnel_evolution": {
                "qual_to_pain": div(float(stats.fun_pain or 0), float(stats.leads or 0)),
                "pain_to_offer": div(float(stats.fun_offer or 0), float(stats.fun_pain or 0)),
                "offer_to_link": div(float(stats.fun_link or 0), float(stats.fun_offer or 0)),
                "link_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_link or 0))
            },
            "conversions_to_agenda": {
                "opening_to_agenda": div(float(stats.fun_agenda_v1 or 0), float(stats.op_res or 0)),
                "offer_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_offer or 0)),
                "link_to_agenda": div(float(stats.fun_agenda or 0), float(stats.fun_link or 0))
            }
        },
        "setters_breakdown": []
    }

    # Lo nuevo del v2: por canal, bienvenidas, y cuántos reportes miden la respuesta (los v1).
    filas = SetterDailyStats.query
    for f in filters:
        filas = filas.filter(f)
    res["por_canal"] = setter_reporte_v2.sumar([setter_reporte_v2.leer(r) for r in filas.all()])
    res["reportes_por_version"] = {"v1": int(stats.reportes_v1 or 0),
                                   "v2": res["por_canal"]["reportes_v2"]}

    # Breakdown by setter
    breakdown_query = db.session.query(
        User.username.label('setter_name'),
        func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
        func.count(SetterDailyStats.id).label('reports_count')
    ).join(User, SetterDailyStats.setter_id == User.id)

    if start_date_str:
        breakdown_query = breakdown_query.filter(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        breakdown_query = breakdown_query.filter(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
    if setter_id:
        breakdown_query = breakdown_query.filter(SetterDailyStats.setter_id == setter_id)

    breakdown_query = breakdown_query.group_by(User.id)
    
    total_period_days = days_count
    if start_date_str and end_date_str:
        s_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        e_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        total_period_days = (e_date - s_date).days + 1
    
    for row in breakdown_query.all():
        res["setters_breakdown"].append({
            "setter_name": row.setter_name,
            "entrantes": int(row.entrantes or 0),
            "reports_count": row.reports_count,
            "report_rate": round((row.reports_count / total_period_days) * 100, 2) if total_period_days > 0 else 0
        })

    # Time Series Data (Daily Evolution)
    time_series_query = db.session.query(
        SetterDailyStats.date,
        func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
        func.sum(SetterDailyStats.qualification_opening_submitted + SetterDailyStats.pain_opening_submitted).label('op_sub'),
        func.sum(SetterDailyStats.qualification_opening_responded + SetterDailyStats.pain_opening_responded).label('op_res'),
        func.sum(SetterDailyStats.qualification_fu).label('fu_q'),
        func.sum(SetterDailyStats.qualification_fur).label('fur_q'),
        func.sum(SetterDailyStats.funnel_agenda).label('fun_agenda')
    )
    for f in filters:
        time_series_query = time_series_query.filter(f)
    time_series_query = time_series_query.group_by(SetterDailyStats.date).order_by(SetterDailyStats.date)

    time_series = []
    for row in time_series_query.all():
        time_series.append({
            "date": row.date.isoformat(),
            "entrantes": int(row.entrantes or 0),
            "op_sub": int(row.op_sub or 0),
            "op_res": int(row.op_res or 0),
            "fu_q": int(row.fu_q or 0),
            "fur_q": int(row.fur_q or 0),
            "fun_agenda": int(row.fun_agenda or 0)
        })
    res["time_series"] = time_series
    
    return res


def _subtract_one_month(d):
    """Resta exactamente un mes calendario a un objeto date."""
    year = d.year
    month = d.month - 1
    if month == 0:
        month = 12
        year -= 1
    day = d.day
    while True:
        try:
            return date(year, month, day)
        except ValueError:
            day -= 1

def _generadas_del_rango(start_date_str, end_date_str, setter_id):
    """Las agendas generadas de verdad en el rango, para ponerlas al lado de las reportadas.

    "Mis reportes" suma lo que el setter tipeó en `funnel_agenda` y lo mostraba como "Agendas
    Generadas", el nombre de la métrica real de "Mis datos" (septiembre de 2026: Elias 75
    reportadas contra 70 generadas, Paula 55 contra 52). Ahora esa tarjeta dice "Agendas
    reportadas" y esto es el número de "Mis datos" para el mismo rango (`ComercialService.generadas`),
    o None si no hay rango.

    Un setter solo ve el suyo: el selector de "Mis reportes" le deja mirar los reportes de otros,
    pero los números de "Mis datos" de otro no (decisión del 24/09/2026).
    """
    from flask_login import current_user

    from app.services.comercial_service import ComercialService

    if not (start_date_str and end_date_str):
        return None
    if current_user.is_authenticated and current_user.role == 'setter' \
            and str(setter_id or '') != str(current_user.id):
        return None
    try:
        inicio = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        fin = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        quien = int(setter_id) if setter_id else None
    except ValueError:
        return None
    return len(ComercialService.generadas(inicio, fin, setter_id=quien))


@bp.route('/public/setter-stats', methods=['GET'])
def get_public_setter_stats():
    """Returns aggregated stats for setters with sum/avg support and comparison."""
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    setter_id = request.args.get('setter_id')
    agg_type = request.args.get('agg_type', 'sum') # 'sum' or 'avg'
    compare = request.args.get('compare') == 'true'
    compare_mode = request.args.get('compare_mode', 'month')

    res = _compute_setter_stats(start_date_str, end_date_str, setter_id, agg_type)
    res['generadas'] = _generadas_del_rango(start_date_str, end_date_str, setter_id)

    if compare and start_date_str and end_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()

            if compare_mode == 'period':
                delta = (end_date - start_date) + timedelta(days=1)
                prev_start_date = start_date - delta
                prev_end_date = end_date - delta
            else:
                prev_start_date = _subtract_one_month(start_date)
                prev_end_date = _subtract_one_month(end_date)

            prev_start_str = prev_start_date.strftime('%Y-%m-%d')
            prev_end_str = prev_end_date.strftime('%Y-%m-%d')

            res['comparison'] = _compute_setter_stats(prev_start_str, prev_end_str, setter_id, agg_type)
            res['comparison_period'] = {'start': prev_start_str, 'end': prev_end_str}
        except Exception as e:
            pass

    return jsonify(res), 200
@bp.route('/public/setter-reports', methods=['GET'])
def get_public_setter_reports():
    """Retorna lista paginada de reportes con filtros."""
    from flask_login import current_user
    from app.models import SetterDailyStats, User
    from app.services import setter_reporte_v2
    
    setter_id = request.args.get('setter_id')
    # Un setter lista solo los suyos (sin `setter_id`, los suyos; con el de otro, 403). La
    # dirección ve los de todos o los de quien elija.
    if current_user.is_authenticated and current_user.role == 'setter':
        setter_id, error = _setter_del_pedido(setter_id)
        if error:
            return error
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    
    query = SetterDailyStats.query
    
    if setter_id:
        query = query.filter(SetterDailyStats.setter_id == setter_id)
    if start_date_str:
        query = query.filter(SetterDailyStats.date >= datetime.strptime(start_date_str, '%Y-%m-%d').date())
    if end_date_str:
        query = query.filter(SetterDailyStats.date <= datetime.strptime(end_date_str, '%Y-%m-%d').date())
        
    pagination = query.order_by(SetterDailyStats.date.desc()).paginate(page=page, per_page=per_page)
    
    reports = []
    for r in pagination.items:
        reports.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "setter_id": r.setter_id,
            "setter_name": r.setter.username if r.setter else "Unknown",
            "entrantes": r.inbox_entrantes,
            "not_lead": r.not_lead,
            "inabribles": r.inbox_inabribles,
            "leads": r.inbox_leads,
            "op_sub": r.opening_submitted if r.opening_submitted > 0 else (r.qualification_opening_submitted + r.pain_opening_submitted),
            "op_res": r.opening_responded if r.opening_responded > 0 else (r.qualification_opening_responded + r.pain_opening_responded),
            "fun_qual": r.funnel_qualification,
            "fun_pain": r.funnel_pain,
            "fun_offer": r.funnel_offer,
            "fun_link": r.funnel_link,
            "fun_agenda": r.funnel_agenda,
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
            "pain_opening_responded": r.pain_opening_responded,
            "q1_useful": r.q1_useful,
            "q1_unuseful": r.q1_unuseful,
            "q2_useful": r.q2_useful,
            "q2_unuseful": r.q2_unuseful,
            # El formulario con que se mandó y, si es el v2, su lectura por canal (`leer`): la tabla
            # muestra los canales y edita un v2 por canal, no por sus totales.
            "version": r.report_version or 1,
            "is_non_working_day": bool(r.is_non_working_day),
            "v2": setter_reporte_v2.leer(r) if (r.report_version or 1) >= 2 else None,
        })
        
    return jsonify({
        "reports": reports,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page
    }), 200

def _puede_tocar(stat):
    """Un setter edita o borra solo sus reportes; la dirección y admin, cualquiera. Antes un setter
    podía editar o borrar el reporte de otro con solo cambiar el número de la URL."""
    from flask_login import current_user

    return not (current_user.is_authenticated and current_user.role == 'setter'
                and stat.setter_id != current_user.id)


# Lo que edita la tabla de Registros: clave del pedido (la del listado) -> columna.
_COLUMNAS_EDITABLES = (
    ('entrantes', 'inbox_entrantes'), ('not_lead', 'not_lead'), ('inabribles', 'inbox_inabribles'),
    ('leads', 'inbox_leads'), ('op_sub', 'opening_submitted'), ('op_res', 'opening_responded'),
    ('fun_qual', 'funnel_qualification'), ('fun_pain', 'funnel_pain'), ('fun_offer', 'funnel_offer'),
    ('fun_link', 'funnel_link'), ('fun_agenda', 'funnel_agenda'),
    ('qualification_fu', 'qualification_fu'), ('pain_fu', 'pain_fu'), ('offer_fu', 'offer_fu'),
    ('link_fu', 'link_fu'), ('agenda_fu', 'agenda_fu'),
    ('qualification_fur', 'qualification_fur'), ('pain_fur', 'pain_fur'), ('offer_fur', 'offer_fur'),
    ('link_fur', 'link_fur'), ('agenda_fur', 'agenda_fur'),
    ('qualification_opening_submitted', 'qualification_opening_submitted'),
    ('qualification_opening_responded', 'qualification_opening_responded'),
    ('pain_opening_submitted', 'pain_opening_submitted'),
    ('pain_opening_responded', 'pain_opening_responded'),
    ('q1_useful', 'q1_useful'), ('q1_unuseful', 'q1_unuseful'),
    ('q2_useful', 'q2_useful'), ('q2_unuseful', 'q2_unuseful'),
)


@bp.route('/public/setter-reports/<int:report_id>', methods=['PUT'])
def update_public_setter_report(report_id):
    """Actualiza un reporte existente."""
    from app.models import SetterDailyStats
    stat = SetterDailyStats.query.get_or_404(report_id)
    if not _puede_tocar(stat):
        return jsonify({"message": "Solo podés cambiar tu propio reporte"}), 403
    data = request.get_json() or {}
    
    try:
        if 'date' in data and data['date']:
            try:
                stat.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"message": "Formato de fecha inválido. Debe ser YYYY-MM-DD"}), 400

        # Un v2 se edita por canal: sus totales los calcula `escribir`, y tocarlos sueltos dejaría
        # los canales diciendo otra cosa. Lo que no viene en el pedido queda como estaba.
        if (stat.report_version or 1) >= 2:
            from app.services import setter_reporte_v2
            if not _es_v2(data):
                db.session.rollback()
                return jsonify({"message": "Este reporte se cargó por canal: editalo por canal (version 2)."}), 409
            form = setter_reporte_v2.a_formulario(setter_reporte_v2.leer(stat))
            for seccion in ('anuncios', 'inbound', 'bienvenidas', 'embudo', 'followups', 'reflexion'):
                if isinstance(data.get(seccion), dict):
                    form[seccion].update({k: v for k, v in data[seccion].items() if k in form[seccion]})
            if 'is_non_working_day' in data:
                form['is_non_working_day'] = bool(data['is_non_working_day'])
            setter_reporte_v2.escribir(stat, form)
            db.session.commit()
            return jsonify({"message": "Reporte actualizado", "reporte": setter_reporte_v2.leer(stat)}), 200

        # Cada columna toma lo que manda el pedido o se queda como estaba. Un 0 se guarda: con
        # `data.get(x) or actual` un número llevado a cero volvía al de antes sin avisar.
        for clave, columna in _COLUMNAS_EDITABLES:
            if data.get(clave) not in (None, ''):
                setattr(stat, columna, int(data[clave]))
        
        db.session.commit()
        return jsonify({"message": "Reporte actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@bp.route('/public/setter-reports/<int:report_id>', methods=['DELETE'])
def delete_public_setter_report(report_id):
    """Elimina un reporte."""
    from app.models import SetterDailyStats
    stat = SetterDailyStats.query.get_or_404(report_id)
    if not _puede_tocar(stat):
        return jsonify({"message": "Solo podés borrar tu propio reporte"}), 403
    try:
        db.session.delete(stat)
        db.session.commit()
        return jsonify({"message": "Reporte eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


def _prepare_setter_report_data(stat):
    """Calcula y estructura todas las métricas del reporte diario de un setter."""
    setter_name = stat.setter.username if stat.setter else "Setter"
    
    from app.models import DailyReportQuestion
    qualitative_callouts = []
    if stat.answers:
        questions = {q.id: q.text for q in DailyReportQuestion.query.filter_by(role='setter').all()}
        for q_id, answer in stat.answers.items():
            if not str(q_id).isdigit():
                continue
            q_id_int = int(q_id)
            if answer and answer.strip():
                question_text = questions.get(q_id_int, f"Pregunta Cualitativa #{q_id_int}")
                qualitative_callouts.append({
                    "question": question_text,
                    "answer": answer
                })

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

    q_op_sub = stat.qualification_opening_submitted or 0
    q_op_res = stat.qualification_opening_responded or 0
    p_op_sub = stat.pain_opening_submitted or 0
    p_op_res = stat.pain_opening_responded or 0

    def generate_sparkline_points(values, width=75, height=25):
        if not values:
            return ""
        vals = [float(v) for v in values]
        min_val = min(vals)
        max_val = max(vals)
        range_val = max_val - min_val
        
        points = []
        n = len(vals)
        for i, val in enumerate(vals):
            x = (i / (n - 1)) * width if n > 1 else 0
            if range_val > 0:
                y = height - ((val - min_val) / range_val) * height
            else:
                y = height / 2
            points.append(f"{x:.1f},{y:.1f}")
        return " ".join(points)

    from app.models import SetterDailyStats
    from datetime import timedelta

    # Calcular las tasas actuales
    openings_sub = (stat.qualification_opening_submitted or 0) + (stat.pain_opening_submitted or 0) + (stat.offer_opening_submitted or 0) + (stat.link_opening_submitted or 0)
    openings_res = (stat.qualification_opening_responded or 0) + (stat.pain_opening_responded or 0) + (stat.offer_opening_responded or 0) + (stat.link_opening_responded or 0)
    if openings_sub == 0:
        openings_sub = stat.opening_submitted or 0
        openings_res = stat.opening_responded or 0
    openings_tasa = safe_percent(openings_res, openings_sub)
    kpi_qual_tasa = safe_percent(stat.inbox_leads or 0, inbox_entrantes)
    qual_tasa = safe_percent(qual, inbox_entrantes)
    conv_tasa = safe_percent(agenda, stat.inbox_leads or 0)

    last_10_reports = SetterDailyStats.query.filter(
        SetterDailyStats.setter_id == stat.setter_id,
        SetterDailyStats.date <= stat.date
    ).order_by(SetterDailyStats.date.desc()).limit(10).all()
    
    last_7_reports = last_10_reports[:7] if len(last_10_reports) >= 7 else last_10_reports

    r10_count = len(last_10_reports)
    if r10_count > 0:
        avg_entrantes_10 = round(sum(r.inbox_entrantes or 0 for r in last_10_reports) / r10_count, 1)
        
        t_openings_sub_10 = 0
        t_openings_res_10 = 0
        for r in last_10_reports:
            r_sub = (r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0) + (r.offer_opening_submitted or 0) + (r.link_opening_submitted or 0)
            r_res = (r.qualification_opening_responded or 0) + (r.pain_opening_responded or 0) + (r.offer_opening_responded or 0) + (r.link_opening_responded or 0)
            if r_sub == 0:
                r_sub = r.opening_submitted or 0
                r_res = r.opening_responded or 0
            t_openings_sub_10 += r_sub
            t_openings_res_10 += r_res
        avg_apertura_10 = safe_percent(t_openings_res_10, t_openings_sub_10)
        
        t_entrantes_10 = sum(r.inbox_entrantes or 0 for r in last_10_reports)
        t_qual_10 = sum(r.inbox_leads or 0 for r in last_10_reports)
        avg_cual_10 = safe_percent(t_qual_10, t_entrantes_10)
        
        t_agendas_10 = sum(r.funnel_agenda or 0 for r in last_10_reports)
        avg_conv_10 = safe_percent(t_agendas_10, t_qual_10)
    else:
        avg_entrantes_10 = 0
        avg_apertura_10 = 0
        avg_cual_10 = 0
        avg_conv_10 = 0

    r7_count = len(last_7_reports)
    if r7_count > 0:
        avg_agendas_7 = round(sum(r.funnel_agenda or 0 for r in last_7_reports) / r7_count, 1)
    else:
        avg_agendas_7 = 0

    target_date_prev = stat.date - timedelta(days=7)
    stat_prev = SetterDailyStats.query.filter_by(
        setter_id=stat.setter_id,
        date=target_date_prev
    ).first()

    comp_data = {}
    if stat_prev:
        entrantes_prev = stat_prev.inbox_entrantes or 0
        diff_entrantes = inbox_entrantes - entrantes_prev
        pct_entrantes = round((diff_entrantes / entrantes_prev) * 100) if entrantes_prev > 0 else 0

        openings_prev_sub = (stat_prev.qualification_opening_submitted or 0) + (stat_prev.pain_opening_submitted or 0) + (stat_prev.offer_opening_submitted or 0) + (stat_prev.link_opening_submitted or 0)
        openings_prev_res = (stat_prev.qualification_opening_responded or 0) + (stat_prev.pain_opening_responded or 0) + (stat_prev.offer_opening_responded or 0) + (stat_prev.link_opening_responded or 0)
        if openings_prev_sub == 0:
            openings_prev_sub = stat_prev.opening_submitted or 0
            openings_prev_res = stat_prev.opening_responded or 0
        tasa_apertura_prev = safe_percent(openings_prev_res, openings_prev_sub)
        diff_tasa_apertura = openings_tasa - tasa_apertura_prev
        pct_tasa_apertura = round((diff_tasa_apertura / tasa_apertura_prev) * 100) if tasa_apertura_prev > 0 else 0

        tasa_cual_prev = safe_percent(stat_prev.inbox_leads or 0, stat_prev.inbox_entrantes or 0)
        diff_tasa_cual = kpi_qual_tasa - tasa_cual_prev
        pct_tasa_cual = round((diff_tasa_cual / tasa_cual_prev) * 100) if tasa_cual_prev > 0 else 0

        tasa_conv_prev = safe_percent(stat_prev.funnel_agenda or 0, stat_prev.inbox_leads or 0)
        diff_tasa_conv = conv_tasa - tasa_conv_prev
        pct_tasa_conv = round((diff_tasa_conv / tasa_conv_prev) * 100) if tasa_conv_prev > 0 else 0

        agendas_prev = stat_prev.funnel_agenda or 0
        diff_agendas = agenda - agendas_prev
        pct_agendas = round((diff_agendas / agendas_prev) * 100) if agendas_prev > 0 else 0

        comp_data = {
            "entrantes": {"prev": entrantes_prev, "diff": diff_entrantes, "pct": pct_entrantes},
            "apertura": {"prev": tasa_apertura_prev, "diff": diff_tasa_apertura, "pct": pct_tasa_apertura},
            "cualificacion": {"prev": tasa_cual_prev, "diff": diff_tasa_cual, "pct": pct_tasa_cual},
            "conversion_cual": {"prev": tasa_conv_prev, "diff": diff_tasa_conv, "pct": pct_tasa_conv},
            "agendas": {"prev": agendas_prev, "diff": diff_agendas, "pct": pct_agendas}
        }
    else:
        comp_data = {
            "entrantes": None,
            "apertura": None,
            "cualificacion": None,
            "conversion_cual": None,
            "agendas": None
        }

    kpi_metrics = {
        "entrantes": {
            "val": inbox_entrantes,
            "avg_10": avg_entrantes_10,
            "comp": comp_data["entrantes"]
        },
        "apertura": {
            "val": openings_tasa,
            "avg_10": avg_apertura_10,
            "comp": comp_data["apertura"]
        },
        "cualificacion": {
            "val": kpi_qual_tasa,
            "avg_10": avg_cual_10,
            "comp": comp_data["cualificacion"]
        },
        "conversion_cual": {
            "val": conv_tasa,
            "avg_10": avg_conv_10,
            "comp": comp_data["conversion_cual"]
        },
        "agendas": {
            "val": agenda,
            "avg_7": avg_agendas_7,
            "comp": comp_data["agendas"]
        }
    }

    # Invertir para sparkline (cronológico ascendente)
    chronological_reports = list(reversed(last_10_reports))
    
    entrantes_vals = []
    apertura_vals = []
    cual_vals = []
    conv_vals = []
    agendas_vals = []
    
    for r in chronological_reports:
        e_val = r.inbox_entrantes or 0
        entrantes_vals.append(e_val)
        
        op_val = (r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0)
        if op_val == 0:
            op_val = r.opening_submitted or 0
        apertura_vals.append(safe_percent(op_val, e_val))
        
        q_val = r.inbox_leads or 0
        cual_vals.append(safe_percent(q_val, e_val))
        
        a_val = r.funnel_agenda or 0
        conv_vals.append(safe_percent(a_val, q_val))
        agendas_vals.append(a_val)
        
    sparklines = {
        "entrantes": generate_sparkline_points(entrantes_vals),
        "apertura": generate_sparkline_points(apertura_vals),
        "cualificacion": generate_sparkline_points(cual_vals),
        "conversion_cual": generate_sparkline_points(conv_vals),
        "agendas": generate_sparkline_points(agendas_vals[-7:])
    }

    # Obtener los 7 reportes previos (excluyendo el actual)
    prev_7_reports = SetterDailyStats.query.filter(
        SetterDailyStats.setter_id == stat.setter_id,
        SetterDailyStats.date < stat.date
    ).order_by(SetterDailyStats.date.desc()).limit(7).all()

    avg_entrantes_7 = 0
    avg_apertura_7 = 0
    avg_cual_7 = 0
    avg_conv_7 = 0
    avg_net_leads_tasa_7 = 0
    avg_leads_to_pain_tasa_7 = 0
    avg_pain_to_offer_tasa_7 = 0
    avg_offer_to_agenda_tasa_7 = 0
    avg_link_tasa_7 = 0

    p7_count = len(prev_7_reports)
    if p7_count > 0:
        avg_entrantes_7 = sum(r.inbox_entrantes or 0 for r in prev_7_reports) / p7_count
        
        t_openings_sub_7 = 0
        t_openings_res_7 = 0
        for r in prev_7_reports:
            r_sub = (r.qualification_opening_submitted or 0) + (r.pain_opening_submitted or 0) + (r.offer_opening_submitted or 0) + (r.link_opening_submitted or 0)
            r_res = (r.qualification_opening_responded or 0) + (r.pain_opening_responded or 0) + (r.offer_opening_responded or 0) + (r.link_opening_responded or 0)
            if r_sub == 0:
                r_sub = r.opening_submitted or 0
                r_res = r.opening_responded or 0
            t_openings_sub_7 += r_sub
            t_openings_res_7 += r_res
        avg_apertura_7 = safe_percent(t_openings_res_7, t_openings_sub_7)
        
        t_entrantes_7 = sum(r.inbox_entrantes or 0 for r in prev_7_reports)
        t_qual_7 = sum(r.funnel_qualification or 0 for r in prev_7_reports)
        avg_cual_7 = safe_percent(t_qual_7, t_entrantes_7)
        
        t_agendas_7 = sum(r.funnel_agenda or 0 for r in prev_7_reports)
        avg_conv_7 = safe_percent(t_agendas_7, t_qual_7)

        sum_net_leads = 0
        sum_leads_to_pain = 0
        sum_pain_to_offer = 0
        sum_link = 0
        sum_offer_to_agenda = 0
        for r in prev_7_reports:
            r_entrantes = r.inbox_entrantes or 0
            r_qual = r.funnel_qualification or 0
            r_net = r.inbox_leads or 0
            r_pain = r.funnel_pain or 0
            r_offer = r.funnel_offer or 0
            r_link = r.funnel_link or 0
            r_agenda = r.funnel_agenda or 0
            
            sum_net_leads += safe_percent(r_net, r_entrantes)
            sum_leads_to_pain += safe_percent(r_pain, r_net)
            sum_pain_to_offer += safe_percent(r_offer, r_pain)
            sum_link += safe_percent(r_link, r_pain)
            sum_offer_to_agenda += safe_percent(r_agenda, r_link)
            
        avg_net_leads_tasa_7 = round(sum_net_leads / p7_count)
        avg_leads_to_pain_tasa_7 = round(sum_leads_to_pain / p7_count)
        avg_pain_to_offer_tasa_7 = round(sum_pain_to_offer / p7_count)
        avg_link_tasa_7 = round(sum_link / p7_count)
        avg_offer_to_agenda_tasa_7 = round(sum_offer_to_agenda / p7_count)

    # Tasas de conversión actuales del embudo
    net_leads_tasa = safe_percent(stat.inbox_leads or 0, inbox_entrantes)
    leads_to_pain_tasa = safe_percent(pain, stat.inbox_leads or 0)
    pain_to_offer_tasa = safe_percent(offer, pain)
    link_tasa = safe_percent(link, pain)
    offer_to_agenda_tasa = safe_percent(agenda, link)

    # Diferencias
    diff_qual = qual_tasa - avg_cual_7
    diff_net_leads = net_leads_tasa - avg_net_leads_tasa_7
    diff_leads_to_pain = leads_to_pain_tasa - avg_leads_to_pain_tasa_7
    diff_pain_to_offer = pain_to_offer_tasa - avg_pain_to_offer_tasa_7
    diff_link = link_tasa - avg_link_tasa_7
    diff_offer_to_agenda = offer_to_agenda_tasa - avg_offer_to_agenda_tasa_7

    funnel_comparisons = {
        "qual": {
            "val": qual_tasa,
            "avg": avg_cual_7,
            "diff": diff_qual
        },
        "net_leads": {
            "val": net_leads_tasa,
            "avg": avg_net_leads_tasa_7,
            "diff": diff_net_leads
        },
        "leads_to_pain": {
            "val": leads_to_pain_tasa,
            "avg": avg_leads_to_pain_tasa_7,
            "diff": diff_leads_to_pain
        },
        "pain_to_offer": {
            "val": pain_to_offer_tasa,
            "avg": avg_pain_to_offer_tasa_7,
            "diff": diff_pain_to_offer
        },
        "link": {
            "val": link_tasa,
            "avg": avg_link_tasa_7,
            "diff": diff_link
        },
        "offer_to_agenda": {
            "val": offer_to_agenda_tasa,
            "avg": avg_offer_to_agenda_tasa_7,
            "diff": diff_offer_to_agenda
        }
    }

    # Insight 1: Entrantes vs promedio 7 días
    if avg_entrantes_7 > 0:
        diff_entrantes = inbox_entrantes - avg_entrantes_7
        pct_entrantes = round((diff_entrantes / avg_entrantes_7) * 100)
        if pct_entrantes > 0:
            insight_entrantes = {"dir": "up", "title": f"La tasa de entrantes subió {pct_entrantes}%", "subtitle": "vs el promedio de los últimos 7 días."}
        elif pct_entrantes < 0:
            insight_entrantes = {"dir": "down", "title": f"La tasa de entrantes bajó {abs(pct_entrantes)}%", "subtitle": "vs el promedio de los últimos 7 días."}
        else:
            insight_entrantes = {"dir": "neutral", "title": "La tasa de entrantes se mantuvo", "subtitle": "vs el promedio de los últimos 7 días."}
    else:
        insight_entrantes = {"dir": "neutral", "title": "Tasa de entrantes", "subtitle": f"Hoy: {inbox_entrantes} (sin promedio previo)"}

    # Insight 2: Tasa de apertura vs promedio 7 días
    if avg_apertura_7 > 0:
        diff_apertura = openings_tasa - avg_apertura_7
        if diff_apertura > 0:
            insight_apertura = {"dir": "up", "title": f"La tasa de apertura subió {diff_apertura} pp", "subtitle": "vs el promedio de los últimos 7 días."}
        elif diff_apertura < 0:
            insight_apertura = {"dir": "down", "title": f"La tasa de apertura bajó {abs(diff_apertura)} pp", "subtitle": "vs el promedio de los últimos 7 días."}
        else:
            insight_apertura = {"dir": "neutral", "title": "La tasa de apertura se mantuvo", "subtitle": "vs el promedio de los últimos 7 días."}
    else:
        insight_apertura = {"dir": "neutral", "title": "Tasa de apertura", "subtitle": f"Hoy: {openings_tasa}% (sin promedio previo)"}

    # Insight 3: Tasa de cualificación vs promedio 7 días
    if avg_cual_7 > 0:
        diff_cual = qual_tasa - avg_cual_7
        if diff_cual > 0:
            insight_cual = {"dir": "up", "title": f"La conversión Entrantes → Cualificación mejoró {diff_cual} pp", "subtitle": "vs el promedio de los últimos 7 días."}
        elif diff_cual < 0:
            insight_cual = {"dir": "down", "title": f"La conversión Entrantes → Cualificación bajó {abs(diff_cual)} pp", "subtitle": "vs el promedio de los últimos 7 días."}
        else:
            insight_cual = {"dir": "neutral", "title": "La conversión Entrantes → Cualificación se mantuvo", "subtitle": "vs el promedio de los últimos 7 días."}
    else:
        insight_cual = {"dir": "neutral", "title": "Conversión Entrantes → Cualificación", "subtitle": f"Hoy: {qual_tasa}% (sin promedio previo)"}

    # Insight 4: Conversión por lead cualificado vs promedio 7 días
    if avg_conv_7 > 0:
        diff_conv = conv_tasa - avg_conv_7
        if diff_conv > 0:
            insight_conv = {"dir": "up", "title": f"La conversión por lead cualificado subió {diff_conv} pp", "subtitle": "vs el promedio de 7 días."}
        elif diff_conv < 0:
            insight_conv = {"dir": "down", "title": f"La conversión por lead cualificado bajó {abs(diff_conv)} pp", "subtitle": "vs el promedio de 7 días."}
        else:
            insight_conv = {"dir": "neutral", "title": "La conversión por lead cualificado se mantuvo", "subtitle": "vs el promedio de 7 días."}
    else:
        insight_conv = {"dir": "neutral", "title": "Conversión por cualificado", "subtitle": f"Hoy: {conv_tasa}% (sin promedio previo)"}

    # Insight 5: Agendas vs semana anterior
    if stat_prev:
        agendas_prev = stat_prev.funnel_agenda or 0
        diff_agendas = agenda - agendas_prev
        if diff_agendas > 0:
            insight_agendas = {"dir": "up", "title": "Más agendas que la semana anterior", "subtitle": f"({agenda} vs {agendas_prev})."}
        elif diff_agendas < 0:
            insight_agendas = {"dir": "down", "title": "Menos agendas que la semana anterior", "subtitle": f"({agenda} vs {agendas_prev})."}
        else:
            insight_agendas = {"dir": "neutral", "title": "Mismas agendas que la semana anterior", "subtitle": f"({agenda} vs {agendas_prev})."}
    else:
        insight_agendas = {"dir": "neutral", "title": "Agendas generadas", "subtitle": f"Hoy: {agenda} (sin semana anterior)"}

    insights_rapidos = [insight_entrantes, insight_apertura, insight_cual, insight_conv, insight_agendas]

    avg_metrics = {
        "entrantes": avg_entrantes_10,
        "openings": avg_apertura_10,
        "agendas": avg_agendas_7,
        "conversion": avg_conv_10
    }

    return {
        "setter_name": setter_name,
        "date_str": stat.date.strftime('%d/%m/%Y'),
        "kpi_metrics": kpi_metrics,
        "sparklines": sparklines,
        "insights": insights_rapidos,
        
        "inbox": {
            "entrantes": inbox_entrantes,
            "not_lead": not_lead,
            "inabribles": inabribles,
            "leads": stat.inbox_leads or 0,
            "no_lead_pct": safe_percent(not_lead, inbox_entrantes),
            "inabribles_pct": safe_percent(inabribles, inbox_entrantes)
        },
        
        "openings": {
            "qualification": {"submitted": q_op_sub, "responded": q_op_res, "pct": safe_percent(q_op_res, q_op_sub)},
            "pain": {"submitted": p_op_sub, "responded": p_op_res, "pct": safe_percent(p_op_res, p_op_sub)},
            "offer": {"submitted": stat.offer_opening_submitted or 0, "responded": stat.offer_opening_responded or 0, "pct": safe_percent(stat.offer_opening_responded or 0, stat.offer_opening_submitted or 0)},
            "link": {"submitted": stat.link_opening_submitted or 0, "responded": stat.link_opening_responded or 0, "pct": safe_percent(stat.link_opening_responded or 0, stat.link_opening_submitted or 0)},
            "legacy": {"submitted": opened, "responded": op_resp, "pct": safe_percent(op_resp, opened)}
        },
        
        "funnel": {
            "qualification": qual,
            "leads_netos": stat.inbox_leads or 0,
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
        "follow_up": {
            "qualification": {"submitted": fu_qual, "responded": fur_qual, "pct": safe_percent(fur_qual, fu_qual)},
            "pain": {"submitted": fu_pain, "responded": fur_pain, "pct": safe_percent(fur_pain, fu_pain)},
            "offer": {"submitted": fu_offer, "responded": fur_offer, "pct": safe_percent(fur_offer, fu_offer)},
            "link": {"submitted": fu_link, "responded": fur_link, "pct": safe_percent(fur_link, fu_link)},
            "agenda": {"submitted": fu_agenda, "responded": fur_agenda, "pct": safe_percent(fur_agenda, fu_agenda)},
            "total_fu": fu_qual + fu_pain + fu_offer + fu_link + fu_agenda,
            "total_fur": fur_qual + fur_pain + fur_offer + fur_link + fur_agenda,
            "response_pct": safe_percent(fur_qual + fur_pain + fur_offer + fur_link + fur_agenda, fu_qual + fu_pain + fu_offer + fu_link + fu_agenda)
        },
        "funnel_comparisons": funnel_comparisons,
        
        "averages": avg_metrics,
        "questions_efficacy": {
            "q1": {
                "useful": stat.q1_useful or 0, 
                "unuseful": stat.q1_unuseful or 0,
                "pct": safe_percent(stat.q1_useful or 0, (stat.q1_useful or 0) + (stat.q1_unuseful or 0))
            },
            "q2": {
                "useful": stat.q2_useful or 0, 
                "unuseful": stat.q2_unuseful or 0,
                "pct": safe_percent(stat.q2_useful or 0, (stat.q2_useful or 0) + (stat.q2_unuseful or 0))
            }
        },
        "qualitative": qualitative_callouts,
        "reflections": stat.reflections or {},
        "safe_percent": safe_percent
    }


@bp.route('/public/setter-reports/<int:report_id>/preview', methods=['GET'])
def preview_setter_report_discord(report_id):
    """Genera una vista previa del reporte de Setter renderizado en HTML para administradores."""
    from app.models import SetterDailyStats, User
    from flask import current_app
    from flask_login import current_user
    import os
    
    user = None
    if current_user.is_authenticated:
        user = current_user
    else:
        token = request.args.get('token')
        if token:
            user_id = User.verify_auth_token(token)
            if user_id:
                user = User.query.get(user_id)
            
            if not user and (current_app.config.get('DEBUG') or current_app.debug):
                try:
                    import jwt
                    jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
                    user = User.query.filter_by(role='admin').first()
                except Exception as e:
                    print(f"DEBUG PREVIEW BYPASS ERROR: {e}")

    if not user or user.role != 'admin':
        return jsonify({"error": "No autorizado"}), 403

    stat = SetterDailyStats.query.get_or_404(report_id)
    # Un reporte v2 se ve con su propia tarjeta, la misma que sale a Discord.
    if (stat.report_version or 1) >= 2:
        from app.services.setter_reporte_discord import datos_de_la_imagen
        img_data = datos_de_la_imagen(stat)
        plantilla = 'setter_report_v2.html'
    else:
        img_data = _prepare_setter_report_data(stat)
        plantilla = 'setter_report.html'
    img_data["is_preview"] = True

    template_path = os.path.join(current_app.root_path, 'templates', 'reports', plantilla)
    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()

    return render_template_string(template_content, **img_data)


@bp.route('/public/setter-reports/<int:report_id>/resend-discord', methods=['POST'])
def resend_setter_report_discord(report_id):
    """Reenvía un reporte de Setter a Discord."""
    from app.models import SetterDailyStats, User
    from flask_login import current_user
    from app.api.setter import _trigger_setter_report_webhook

    if not current_user.is_authenticated:
        return jsonify({"error": "No autorizado"}), 401

    if current_user.role not in ['admin', 'setter']:
        return jsonify({"error": "No autorizado"}), 403

    stat = SetterDailyStats.query.get_or_404(report_id)

    if current_user.role == 'setter' and stat.setter_id != current_user.id:
        return jsonify({"error": "No autorizado"}), 403
    try:
        _trigger_setter_report_webhook(stat)
        return jsonify({"message": "Reporte reenviado a Discord exitosamente"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# FINANCIAL ANALYSIS (EXCEL DATA)
# ============================================================

