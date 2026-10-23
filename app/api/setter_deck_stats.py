"""KPIs y estadisticas del mazo: kpis, eventos, sin asignar de hoy y cualificacion.

Se cuelga del blueprint de `setter.py` (se importa al final de ese archivo).
"""
from flask import request, jsonify
from flask_login import current_user
from app import db
from app.models import ROLE_SETTER
from app.decorators import role_required
from app.services.closer_agendas_service import contar_no_show_y_canceladas
from app.services.user_time_service import hoy_del_usuario, limites_dia_utc, limites_rango_utc
from sqlalchemy import or_
from app.api.setter import bp


@bp.route('/deck/stats/kpis', methods=['GET'])
@role_required(ROLE_SETTER)
def get_deck_stats_kpis():
    from app.models import Appointment, Conversation, SetterDailyStats, CloserDailyStats
    from sqlalchemy import func, or_
    from datetime import timedelta

    date_range = request.args.get('date_range', 'all')
    start_date = None
    # "Hoy" es el del setter, no el del servidor (que corre en UTC): ver
    # user_time_service.
    today = hoy_del_usuario(current_user)
    if date_range == 'today':
        start_date, _ = limites_dia_utc(current_user, today)
    elif date_range == 'week':
        start_date, _ = limites_rango_utc(current_user, today - timedelta(days=7), today)
    elif date_range == 'month':
        start_date, _ = limites_rango_utc(current_user, today - timedelta(days=30), today)

    query_total = Appointment.query
    if start_date:
        query_total = query_total.filter(Appointment.start_time >= start_date)
    total_agendas = query_total.count()
    
    query_mis = Appointment.query.filter_by(setter_id=current_user.id)
    if start_date:
        query_mis = query_mis.filter(Appointment.start_time >= start_date)
    mis_agendas = query_mis.count()
        
    query_sin = Appointment.query.filter(or_(Appointment.closer_id == None, Appointment.setter_id == None))
    if start_date:
        query_sin = query_sin.filter(Appointment.start_time >= start_date)
    sin_asignar = query_sin.count()
    
    query_real = Appointment.query.filter(Appointment.result.in_(['Asistió', 'Terminada']))
    if start_date:
        query_real = query_real.filter(Appointment.start_time >= start_date)
    realizadas = query_real.count()
    pct_realizadas = (realizadas / total_agendas * 100) if total_agendas > 0 else 0
    
    # «Cancelada» y «No show» son dos cuentas distintas (antes el KPI las sumaba).
    perdidas = contar_no_show_y_canceladas(start_date)
    canceladas = perdidas['canceladas']
    no_show = perdidas['no_show']
    pct_no_show = (no_show / total_agendas * 100) if total_agendas > 0 else 0
    pct_canceladas = (canceladas / total_agendas * 100) if total_agendas > 0 else 0
    
    today_start, today_end = limites_dia_utc(current_user, today)

    agendas_hoy = Appointment.query.filter(Appointment.created_at >= today_start, Appointment.created_at <= today_end).count()
    
    confirmadas_hoy = Appointment.query.filter(
        Appointment.start_time >= today_start,
        Appointment.start_time <= today_end,
        Appointment.result == 'Agendado'
    ).count()
    
    perdidas_hoy = contar_no_show_y_canceladas(desde=today_start, hasta=today_end)
    cancelaciones_hoy = perdidas_hoy['canceladas']
    
    no_show_hoy = perdidas_hoy['no_show']

    reprogramadas_hoy = Appointment.query.filter(
        Appointment.start_time >= today_start,
        Appointment.start_time <= today_end,
        Appointment.result == 'Reprogramada'
    ).count()
    
    calificados_hoy = Appointment.query.filter(
        Appointment.created_at >= today_start,
        Appointment.created_at <= today_end,
        Appointment.setter_processed == True
    ).count()
    
    llamadas_hoy = 0
    setter_stats = SetterDailyStats.query.filter_by(date=today).all()
    for s in setter_stats:
        llamadas_hoy += (s.inbox_entrantes or 0)
        
    closer_stats = CloserDailyStats.query.filter_by(date=today).all()
    if llamadas_hoy == 0:
        llamadas_hoy = confirmadas_hoy + cancelaciones_hoy
        
    query_chart = db.session.query(
        Appointment.result, func.count(Appointment.id)
    )
    if start_date:
        query_chart = query_chart.filter(Appointment.start_time >= start_date)
    status_counts = query_chart.group_by(Appointment.result).all()
    
    chart_data = []
    total_chart = sum(c[1] for c in status_counts)
    for res_name, count in status_counts:
        name = res_name or "Pendiente"
        pct = (count / total_chart * 100) if total_chart > 0 else 0
        chart_data.append({
            "name": name,
            "value": count,
            "percentage": round(pct, 1)
        })

        
    return jsonify({
        "kpis_top": {
            "total_agendas": total_agendas,
            "mis_agendas": mis_agendas,
            "sin_asignar": sin_asignar,
            "realizadas": realizadas,
            "pct_realizadas": round(pct_realizadas, 1),
            "canceladas": canceladas,
            "pct_canceladas": round(pct_canceladas, 1),
            "no_show": no_show,
            "pct_no_show": round(pct_no_show, 1)
        },
        "kpis_bottom": {
            "llamadas_hoy": llamadas_hoy,
            "confirmadas_hoy": confirmadas_hoy,
            "cancelaciones_hoy": cancelaciones_hoy,
            "no_show_hoy": no_show_hoy,
            "reprogramaciones_hoy": reprogramadas_hoy,
            "calificados_hoy": calificados_hoy
        },
        "chart_data": chart_data
    }), 200


@bp.route('/deck/events/<int:appt_id>', methods=['GET'])
@role_required(ROLE_SETTER)
def get_deck_events(appt_id):
    from app.models import LeadEventLog
    limit = request.args.get('limit', 5, type=int)
    
    logs = LeadEventLog.query.filter_by(appointment_id=appt_id)\
        .order_by(LeadEventLog.created_at.desc())\
        .limit(limit).all()
        
    return jsonify([log.to_dict() for log in logs]), 200


@bp.route('/deck/unassigned-today', methods=['GET'])
@role_required(ROLE_SETTER)
def get_unassigned_leads_today():
    from app.models import Appointment, Client
    from sqlalchemy import or_, and_
    from datetime import timedelta

    # Obtener el rango de fechas para el filtrado temporal. "Hoy" es el del
    # setter, no el del servidor (que corre en UTC): ver user_time_service.
    date_range = request.args.get('date_range', 'all')
    start_date = None
    today = hoy_del_usuario(current_user)

    if date_range == 'today':
        start_date, _ = limites_dia_utc(current_user, today)
    elif date_range == 'week':
        start_date, _ = limites_rango_utc(current_user, today - timedelta(days=7), today)
    elif date_range == 'month':
        start_date, _ = limites_rango_utc(current_user, today - timedelta(days=30), today)


    # Unir con Client para acceder a sus atributos en el filtro
    query = Appointment.query.join(Client)
    
    # 1. Filtro: Citas sin agendar o con resultado no confirmado como Agendado
    query = query.filter(
        or_(
            Appointment.result == None,
            Appointment.result == '',
            Appointment.result != 'Agendado'
        )
    )
    
    # 2. Filtro: Que no tengan todos los campos completados para la carta del mazo
    query = query.filter(
        or_(
            Client.instagram == None,
            Client.instagram == '',
            Appointment.ig_chat_link == None,
            Appointment.ig_chat_link == '',
            Appointment.keyword == None,
            Appointment.keyword == '',
            Appointment.setter_notes == None,
            Appointment.setter_notes == ''
        )
    )
    
    # Aplicar restriccion de fechas si corresponde
    if start_date:
        query = query.filter(Appointment.created_at >= start_date)
        
    appointments = query.order_by(Appointment.created_at.desc()).limit(30).all()
    
    return jsonify([{
        "id": a.id,
        "lead_name": a.client.full_name or "Sin Nombre" if a.client else "Sin Cliente",
        "created_at": a.created_at.isoformat(),
        "origin": a.origin or "Instagram"
    } for a in appointments]), 200


@bp.route('/deck/stats/cualificacion', methods=['GET'])
@role_required(ROLE_SETTER)
def get_cualificacion_stats():
    from app.models import LeadAnswer, Conversation

    # Mismo "hoy" que el mazo, para que el contador coincida con la lista.
    start_dt, end_dt = limites_dia_utc(current_user, hoy_del_usuario(current_user))


    from sqlalchemy import func
    from app.services.setter_assignment_service import condicion_leads_propios
    # 1. Cualificados hoy (únicos por prospecto/lead)
    query_qual = LeadAnswer.query.filter(
        LeadAnswer.qualification.in_(['yes', 'true']),
        LeadAnswer.created_at.between(start_dt, end_dt)
    )
    # "Cualificados hoy" y "Sin responder" son del setter: solo los leads que ManyChat ya le
    # repartió. La bandeja le muestra también los sin repartir, pero esos van aparte, en "Sin
    # asignación": antes entraban en los dos números y uno sin dueño podía terminar siendo de otro.
    # Así los dos chips se reparten la lista de "Hoy": lo suyo + lo sin asignar.
    condicion_setter = condicion_leads_propios(current_user)
    if condicion_setter is not None:
        query_qual = query_qual.join(Conversation, Conversation.id == LeadAnswer.conversation_id)\
                               .filter(condicion_setter)
    qualified_today = query_qual.with_entities(func.count(func.distinct(LeadAnswer.conversation_id))).scalar() or 0

    # 2. Sin asignación: cualificados de hoy que ManyChat todavía no repartió
    # (los 2 primeros JSON de una conversación llegan sin setter).
    query_unassigned = LeadAnswer.query.filter(
        LeadAnswer.qualification.in_(['yes', 'true']),
        LeadAnswer.created_at.between(start_dt, end_dt)
    ).join(Conversation, Conversation.id == LeadAnswer.conversation_id).filter(
        or_(Conversation.setter == None, Conversation.setter == '')
    )
    unassigned_today = query_unassigned.with_entities(func.count(func.distinct(LeadAnswer.conversation_id))).scalar() or 0

    # 3. Sin responder hoy (qualification == 'null' o vacía, únicos por prospecto)
    query_no_resp = LeadAnswer.query.filter(
        LeadAnswer.qualification.in_(['null', None, '', 'undefined']),
        LeadAnswer.created_at.between(start_dt, end_dt)
    )
    if condicion_setter is not None:
        query_no_resp = query_no_resp.join(Conversation, Conversation.id == LeadAnswer.conversation_id)\
                                     .filter(condicion_setter)
    no_response_today = query_no_resp.with_entities(func.count(func.distinct(LeadAnswer.conversation_id))).scalar() or 0
    
    return jsonify({
        "qualified_today": qualified_today,
        "unassigned_today": unassigned_today,
        "no_response_today": no_response_today
    }), 200
