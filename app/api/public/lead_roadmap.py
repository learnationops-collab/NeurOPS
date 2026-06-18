from flask import request, jsonify
from app import db
from app.models import Client, Appointment, SurveyAnswer, SurveyQuestion, ClientComment, User, Enrollment, Program
from app.models.financial import FinancialSale, FinancialAgenda
from app.models.marketing import ManychatLead, LeadAnswer
from datetime import datetime, timedelta
from . import bp
from sqlalchemy import or_, func

def normalize_ig(ig_str):
    # Normaliza el usuario de Instagram removiendo @ y espacios
    if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
        return None
    return ig_str.strip().lstrip('@').lower()

def is_generic_val(val):
    # Valida si un valor es generico o no valido
    if not val:
        return True
    val_clean = str(val).strip().lower()
    return val_clean in ('n/a', 'none', 'null', 'sin email', 'sin telefono', 'sin teléfono', 'desconocido', '')

def format_datetime_es(dt):
    # Formatea un objeto datetime a string legible en español
    if not dt:
        return ""
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    return f"{dt.day:02d} {months[dt.month - 1]} {dt.year}, {dt.hour:02d}:{dt.minute:02d} hs"

def format_date_es(dt):
    # Formatea un objeto datetime a solo fecha en español
    if not dt:
        return ""
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    return f"{dt.day:02d} {months[dt.month - 1]} {dt.year}"

@bp.route('/public/lead-roadmap', methods=['GET'])
def get_lead_roadmap():
    client_id = request.args.get('client_id', type=int)
    instagram = request.args.get('instagram', type=str)
    email = request.args.get('email', type=str)
    phone = request.args.get('phone', type=str)
    name = request.args.get('name', type=str)

    client = None
    manychat_lead = None
    financial_agendas = []
    financial_sales = []
    appointments = []
    comments = []

    # 1. Resolver el cliente por ID
    if client_id:
        client = Client.query.get(client_id)

    # 2. Resolver por otros campos si no se encontró
    ig_norm = normalize_ig(instagram)
    if is_generic_val(ig_norm):
        ig_norm = None
    
    clean_email = email.strip().lower() if email and not is_generic_val(email) else None
    clean_phone = phone.strip() if phone and not is_generic_val(phone) else None
    clean_name = name.strip() if name and name.strip() else None
    
    if not client:
        if ig_norm:
            client = Client.query.filter(func.lower(Client.instagram) == ig_norm).first()
        if not client and clean_email:
            client = Client.query.filter(func.lower(Client.email) == clean_email).first()
        if not client and clean_phone:
            client = Client.query.filter(Client.phone.like(f"%{clean_phone}%")).first()
        # Búsqueda por nombre (parcial, case-insensitive) como último recurso
        if not client and clean_name:
            client = Client.query.filter(
                func.lower(Client.full_name).like(f"%{clean_name.lower()}%")
            ).first()

    # Si se encontró un Client, normalizamos sus búsquedas para jalar todo lo relacionado
    resolved_ig = normalize_ig(client.instagram) if client else ig_norm
    if is_generic_val(resolved_ig):
        resolved_ig = None
        
    resolved_email = client.email.strip().lower() if client and client.email and not is_generic_val(client.email) else clean_email
    resolved_phone = client.phone.strip() if client and client.phone and not is_generic_val(client.phone) else clean_phone

    # 3. Buscar ManychatLead
    if resolved_ig:
        manychat_lead = ManychatLead.query.filter(func.lower(ManychatLead.ig) == resolved_ig).first()
    if not manychat_lead and resolved_email:
        manychat_lead = ManychatLead.query.filter(func.lower(ManychatLead.ig) == resolved_email).first() # Fallback a veces guardado como email

    # 4. Buscar FinancialAgendas
    agenda_filters = []
    if resolved_ig:
        agenda_filters.append(func.lower(func.replace(FinancialAgenda.instagram, '@', '')) == resolved_ig)
    if resolved_email:
        agenda_filters.append(func.lower(FinancialAgenda.mail) == resolved_email)
    if resolved_phone:
        agenda_filters.append(FinancialAgenda.whatsapp.like(f"%{resolved_phone}%"))
    
    if agenda_filters:
        financial_agendas = FinancialAgenda.query.filter(or_(*agenda_filters)).order_by(FinancialAgenda.date.desc()).all()

    # 5. Buscar FinancialSales
    sale_filters = []
    if resolved_ig:
        sale_filters.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == resolved_ig)
    if resolved_email:
        sale_filters.append(func.lower(FinancialSale.mail_cliente) == resolved_email)
    if resolved_phone:
        sale_filters.append(FinancialSale.telefono.like(f"%{resolved_phone}%"))
        
    if sale_filters:
        financial_sales = FinancialSale.query.filter(or_(*sale_filters)).order_by(FinancialSale.date.desc()).all()

    # 6. Buscar Appointments locales
    if client:
        appointments = client.appointments.order_by(Appointment.start_time.desc()).all()
        comments = ClientComment.query.filter_by(client_id=client.id).order_by(ClientComment.created_at.desc()).all()

    # Si no hay absolutamente nada, retornamos un 404
    if not client and not manychat_lead and not financial_agendas and not financial_sales:
        return jsonify({"error": "Lead no encontrado en el sistema"}), 404

    # Determinar la fecha de creación del lead
    created_at_val = None
    if client and client.created_at:
        created_at_val = client.created_at.isoformat()
    elif manychat_lead and manychat_lead.created_at:
        created_at_val = manychat_lead.created_at.isoformat()
    elif financial_agendas:
        # Usar el registro (creación) de la agenda más antigua (el final de la lista ordenada por date desc)
        created_at_val = financial_agendas[-1].registro or (financial_agendas[-1].date.isoformat() if financial_agendas[-1].date else None)
    elif financial_sales:
        created_at_val = financial_sales[-1].marca_temporal or (financial_sales[-1].date.isoformat() if financial_sales[-1].date else None)
        
    if not created_at_val:
        created_at_val = datetime.utcnow().isoformat()

    # Consolidar datos de perfil del lead
    lead_profile = {
        "id": client.id if client else None,
        "full_name": client.full_name if client else (manychat_lead.name if manychat_lead else (financial_sales[0].nombre_cliente if financial_sales else (financial_agendas[0].lead if financial_agendas else "Desconocido"))),
        "email": client.email if client else (manychat_lead.ig if manychat_lead and '@' in manychat_lead.ig else (financial_sales[0].mail_cliente if financial_sales else (financial_agendas[0].mail if financial_agendas else "Sin Email"))),
        "phone": client.phone if client else (financial_sales[0].telefono if financial_sales else (financial_agendas[0].whatsapp if financial_agendas else "Sin Teléfono")),
        "instagram": client.instagram if client else (manychat_lead.ig if manychat_lead else (financial_sales[0].instagram if financial_sales else (financial_agendas[0].instagram if financial_agendas else "Sin Instagram"))),
        "status": "Entrante",
        "created_at": created_at_val,
        "objeciones": client.objeciones if client else "",
        "observaciones": client.observaciones if client else "",
        "dolores": client.dolores if client else "",
        "form_data": client.form_data if client else None
    }

    # Resolver el estado del lead
    has_completed_sale = any(s.estado.lower() == 'completada' or not s.estado for s in financial_sales)
    if has_completed_sale:
        lead_profile["status"] = "Ganado"
    elif financial_agendas or appointments:
        lead_profile["status"] = "En proceso"

    # Construir las 6 etapas del Roadmap
    stages = []

    # Etapa 1: Llegó
    arrived_stage = {
        "name": "1. Llegó",
        "completed": True,
        "date": lead_profile["created_at"],
        "details": {
            "origen": manychat_lead.manychat_id if manychat_lead else "Registro Web/Directo",
            "canal": "Instagram Ads" if manychat_lead else "Orgánico / Búsqueda",
            "campaña": "N/A",
            "inversion": 0.0
        }
    }
    # Intentar obtener más detalles del primer contacto o ManyChat
    if manychat_lead:
        # Buscar la primera respuesta para ver origen
        first_la = LeadAnswer.query.filter_by(lead_id=manychat_lead.id).order_by(LeadAnswer.created_at.asc()).first()
        if first_la:
            arrived_stage["details"]["campaña"] = first_la.keyword or "Instagram Bot"
            if first_la.opening:
                arrived_stage["details"]["origen"] = f"Keyword: {first_la.keyword} ({first_la.opening})"

    stages.append(arrived_stage)

    # Etapa 2: Contactó
    contact_date = lead_profile["created_at"]
    contact_completed = False
    contact_msg = "Mensaje del bot gatillado"
    if manychat_lead:
        contact_completed = True
        first_la = LeadAnswer.query.filter_by(lead_id=manychat_lead.id).order_by(LeadAnswer.created_at.asc()).first()
        if first_la:
            contact_date = first_la.created_at.isoformat()
            contact_msg = f"Keyword: {first_la.keyword} - Opción: {first_la.id_option_send or 'N/A'}"
    elif financial_agendas or appointments:
        contact_completed = True
        first_meet_date = financial_agendas[-1].created_at if financial_agendas else appointments[-1].created_at
        contact_date = first_meet_date.isoformat() if first_meet_date else contact_date
        contact_msg = "Agendado directamente"

    stages.append({
        "name": "2. Contactó",
        "completed": contact_completed,
        "date": contact_date,
        "details": {
            "accion": "Inició conversación" if manychat_lead else "Registro Directo",
            "medio": "Instagram" if manychat_lead else "Web",
            "mensaje": contact_msg
        }
    })

    # Etapa 3: Dolor
    pain_completed = False
    pain_date = None
    pain_list = []
    pain_notes = "Sin notas de dolor registradas"

    if client:
        # Agregar dolores manuales registrados
        if client.dolores:
            pain_completed = True
            for d in client.dolores.split(','):
                d_clean = d.strip()
                if d_clean:
                    pain_list.append(d_clean)
            pain_date = client.created_at.isoformat() if client.created_at else datetime.utcnow().isoformat()

        # Buscar en survey answers
        survey_answers = SurveyAnswer.query.filter_by(client_id=client.id).all()
        for sa in survey_answers:
            q_text = sa.question.text.lower() if sa.question else ""
            if "dolor" in q_text or "problema" in q_text or "dificultad" in q_text or "obstáculo" in q_text:
                pain_completed = True
                if sa.answer not in pain_list:
                    pain_list.append(sa.answer)
                if not pain_date:
                    pain_date = sa.appointment.start_time.isoformat() if sa.appointment else datetime.utcnow().isoformat()

    # Si no se encontraron dolores en las encuestas, buscar en ManyChat
    if not pain_completed and manychat_lead:
        # Buscar respuestas con categoría dolor en conversational_messages
        pain_answers = LeadAnswer.query.filter_by(lead_id=manychat_lead.id).all()
        for pa in pain_answers:
            if pa.keyword and ("dolor" in pa.keyword.lower() or "pain" in pa.keyword.lower()):
                pain_completed = True
                pain_list.append(f"{pa.keyword}: {pa.id_option_send or 'Seleccionado'}")
                pain_date = pa.created_at.isoformat()

    stages.append({
        "name": "3. Dolor",
        "completed": pain_completed,
        "date": pain_date or lead_profile["created_at"],
        "details": {
            "dolores": pain_list if pain_list else ["Por identificar"],
            "notas": pain_notes if not pain_list else "Dolores recopilados de formularios"
        }
    })

    # Etapa 4: Agenda
    agenda_completed = False
    agenda_date = None
    agenda_type = "Llamada de cierre"
    fecha_agendada_meet = None
    
    if appointments:
        agenda_completed = True
        latest_appt = appointments[0]
        agenda_date = latest_appt.created_at.isoformat() if latest_appt.created_at else None
        agenda_type = latest_appt.origin or "Manual Closer"
        fecha_agendada_meet = latest_appt.start_time.isoformat()
    elif financial_agendas:
        agenda_completed = True
        latest_fa = financial_agendas[0]
        agenda_date = latest_fa.registro or (latest_fa.created_at.isoformat() if latest_fa.created_at else None)
        agenda_type = latest_fa.nombre or "Calendly / n8n"
        fecha_agendada_meet = latest_fa.date.isoformat() if latest_fa.date else latest_fa.fecha_meet

    stages.append({
        "name": "4. Agenda",
        "completed": agenda_completed,
        "date": agenda_date or lead_profile["created_at"],
        "details": {
            "tipo": agenda_type,
            "fecha_agendada": fecha_agendada_meet,
            "recordatorio": "Enviado" if agenda_completed else "No programado"
        }
    })

    # Etapa 5: Llamada
    call_completed = False
    call_date = None
    call_duration = "45 min"
    call_result = "Pendiente"
    call_notes = "Sin notas"

    if appointments:
        # Cita local
        latest_appt = appointments[0]
        # Si ya ocurrió o tiene resultado
        if latest_appt.result or latest_appt.start_time < datetime.utcnow():
            call_completed = True
            call_date = latest_appt.start_time.isoformat()
            call_result = latest_appt.result or "Terminada"
            call_notes = latest_appt.closer_notes or latest_appt.setter_notes or "Llamada realizada"
    elif financial_agendas:
        latest_fa = financial_agendas[0]
        if latest_fa.estado and latest_fa.estado != "Pendiente":
            call_completed = True
            call_date = latest_fa.date.isoformat() if latest_fa.date else None
            call_result = latest_fa.estado
            call_notes = f"Agenda de sheets con estado: {latest_fa.estado}"

    stages.append({
        "name": "5. Llamada",
        "completed": call_completed,
        "date": call_date or lead_profile["created_at"],
        "details": {
            "duracion": call_duration,
            "resultado": call_result,
            "notes": call_notes
        }
    })

    # Etapa 6: Venta
    sale_completed = False
    sale_date = None
    sale_product = "N/A"
    sale_monto = 0.0
    sale_method = "N/A"
    sale_next_pay = "N/A"

    if financial_sales:
        # Obtener venta completada o la más reciente
        comp_sales = [s for s in financial_sales if s.estado.lower() == 'completada' or not s.estado]
        latest_sale = comp_sales[0] if comp_sales else financial_sales[0]
        
        sale_completed = latest_sale.estado.lower() == 'completada' or not latest_sale.estado
        sale_date = latest_sale.date.isoformat() if latest_sale.date else None
        sale_product = latest_sale.tipo_pago or "Desconocido"
        sale_monto = latest_sale.monto or 0.0
        sale_method = latest_sale.metodo_pago or "No especificado"
        if latest_sale.segundo_pago:
            sale_next_pay = latest_sale.segundo_pago

    stages.append({
        "name": "6. Venta",
        "completed": sale_completed,
        "date": sale_date or lead_profile["created_at"],
        "details": {
            "producto": sale_product,
            "monto": sale_monto,
            "metodo_pago": sale_method,
            "proximo_pago": sale_next_pay
        }
    })

    # Construir Historial de Actividad Cronológica
    activity = []

    # 1. Llegada
    activity.append({
        "date": lead_profile["created_at"],
        "event": "Llegó al embudo",
        "detail": f"Prospecto ingresó al sistema. Origen resuelto: {arrived_stage['details']['origen']}",
        "origin": "ManyChat" if manychat_lead else "Sistema"
    })

    # 2. Respuestas de bot
    if manychat_lead:
        answers = LeadAnswer.query.filter_by(lead_id=manychat_lead.id).all()
        for la in answers:
            activity.append({
                "date": la.created_at.isoformat() if la.created_at else lead_profile["created_at"],
                "event": "Interacción Bot",
                "detail": f"Keyword: {la.keyword} | Opción: {la.id_option_send or 'Seleccionada'} (Calificación: {la.qualification})",
                "origin": "ManyChat"
            })

    # 3. Agendas
    seen_agenda_dates = set()
    for fa in financial_agendas:
        fecha_formateada = ""
        if fa.date:
            fecha_formateada = format_date_es(fa.date)
        elif fa.fecha_meet:
            fecha_formateada = fa.fecha_meet.split('T')[0]
        else:
            fecha_formateada = "N/A"

        # Fusionar duplicados para la misma fecha
        if fecha_formateada in seen_agenda_dates and fecha_formateada != "N/A":
            continue
        seen_agenda_dates.add(fecha_formateada)

        activity.append({
            "id": fa.id,
            "event_type": "agenda",
            "date": fa.registro if fa.registro else (fa.date.isoformat() if fa.date else (fa.created_at.isoformat() if fa.created_at else lead_profile["created_at"])),
            "event": "Agenda Creada",
            "detail": f"Cita programada para {fecha_formateada} con closer: {fa.closer or 'Sin asignar'} (Fuente: {fa.nombre})",
            "origin": "Calendly / Webhook"
        })

    # 4. Appointments locales (filtrando el evento de agendamiento local directo)
    for appt in appointments:
        # Si ocurrió, agregar la llamada realizada
        if appt.result or appt.start_time < datetime.utcnow():
            activity.append({
                "date": appt.start_time.isoformat(),
                "event": "Llamada Realizada",
                "detail": f"Resultado: {appt.result or 'Terminada'}. Notas: {appt.closer_notes or 'Sin notas'}",
                "origin": "Closer"
            })

    # 5. Ventas financieras
    seen_sale_dates = set()
    for fs in financial_sales:
        fecha_venta_str = fs.date.strftime('%Y-%m-%d') if fs.date else "N/A"
        
        # Fusionar duplicados para la misma fecha
        if fecha_venta_str in seen_sale_dates and fecha_venta_str != "N/A":
            continue
        seen_sale_dates.add(fecha_venta_str)

        activity.append({
            "id": fs.id,
            "event_type": "sale",
            "date": fs.date.isoformat() if fs.date else lead_profile["created_at"],
            "event": "Venta Registrada",
            "detail": f"Declarada venta de {fs.tipo_pago} por ${fs.monto} via {fs.metodo_pago} (Estado: {fs.estado or 'Completada'})",
            "origin": "Closer"
        })

    # 6. Comentarios / Notas Internas
    for c in comments:
        activity.append({
            "date": c.created_at.isoformat(),
            "event": f"Nota de {c.author_rel.username if c.author_rel else 'Desconocido'}",
            "detail": c.text,
            "origin": "Notas Internas"
        })

    # 6b. Calificación en Caliente manual
    if client and (client.dolores or client.objeciones or client.observaciones):
        detail_parts = []
        if client.dolores:
            detail_parts.append(f"Dolores: {client.dolores}")
        if client.objeciones:
            detail_parts.append(f"Objeciones: {client.objeciones}")
        if client.observaciones:
            detail_parts.append(f"Obs. Call Confirmer: {client.observaciones}")
            
        activity.append({
            "date": client.created_at.isoformat() if client.created_at else lead_profile["created_at"],
            "event": "Calificación Registrada",
            "detail": " | ".join(detail_parts),
            "origin": "Call Confirmer"
        })

    # Ordenar por fecha descendentemente
    activity.sort(key=lambda x: x["date"] or "", reverse=True)

    # Ventas resumen
    sales_summary = None
    if financial_sales:
        latest_sale = financial_sales[0]
        sales_summary = {
            "monto": latest_sale.monto or 0.0,
            "estado": latest_sale.estado or "Completada",
            "producto": latest_sale.tipo_pago or "Desconocido",
            "metodo_pago": latest_sale.metodo_pago or "No especificado",
            "proximo_pago": latest_sale.segundo_pago or "Sin pagos pendientes",
            "pagos_desglose": [
                {
                    "id": s.id,
                    "monto": s.monto,
                    "fecha": s.date.isoformat() if s.date else None,
                    "metodo": s.metodo_pago,
                    "estado": s.estado or "Completada"
                } for s in financial_sales
            ]
        }

    # Dolores consolidados
    dolores_set = set()
    if client and client.dolores:
        for d in client.dolores.split(','):
            d_clean = d.strip()
            if d_clean:
                dolores_set.add(d_clean)
    for d in pain_list:
        d_clean = d.strip()
        if d_clean and d_clean.lower() != "por identificar":
            dolores_set.add(d_clean)
            
    dolores_lead = list(dolores_set) if dolores_set else ["Por identificar"]

    # Comentarios / Notas en formato simplificado
    comments_list = [
        {
            "id": c.id,
            "text": c.text,
            "author": c.author_rel.username if c.author_rel else "Desconocido",
            "created_at": c.created_at.isoformat()
        } for c in comments
    ]

    # 7. Permanencia en Programas
    programs_list = []
    seen_program_names = set()
    
    if client:
        for enroll in client.enrollments.all():
            program_name = enroll.program.name if enroll.program else "Programa Desconocido"
            seen_program_names.add(program_name.lower().strip())
            total_paid = enroll.total_paid
            days_enrolled = (datetime.utcnow() - enroll.enrollment_date).days if enroll.enrollment_date else 0
            permanence_str = f"{days_enrolled} días"
            if days_enrolled >= 30:
                months = days_enrolled // 30
                rem_days = days_enrolled % 30
                permanence_str = f"{months} mes(es)"
                if rem_days > 0:
                    permanence_str += f" y {rem_days} día(s)"
                
            programs_list.append({
                "program_name": program_name,
                "enrollment_date": enroll.enrollment_date.isoformat() if enroll.enrollment_date else None,
                "total_paid": total_paid,
                "permanence": permanence_str,
                "source": "Matrícula"
            })

    # Integrar también desde FinancialSales
    for fs in financial_sales:
        if not fs.tipo_pago:
            continue
        p_name = fs.tipo_pago.strip()
        if p_name.lower().strip() in seen_program_names:
            continue
            
        seen_program_names.add(p_name.lower().strip())
        
        days_enrolled = (datetime.utcnow() - fs.date).days if fs.date else 0
        permanence_str = f"{days_enrolled} días"
        if days_enrolled >= 30:
            months = days_enrolled // 30
            rem_days = days_enrolled % 30
            permanence_str = f"{months} mes(es)"
            if rem_days > 0:
                permanence_str += f" y {rem_days} día(s)"
                
        # Calcular el monto total abonado sumando todas las transacciones de esta venta
        total_paid_product = sum(sale.monto or 0.0 for sale in financial_sales if sale.tipo_pago and sale.tipo_pago.strip().lower() == p_name.lower())
        
        programs_list.append({
            "program_name": p_name,
            "enrollment_date": fs.date.isoformat() if fs.date else None,
            "total_paid": total_paid_product,
            "permanence": permanence_str,
            "source": "Venta Declarada"
        })

    # Calcular las objeciones y dolores más frecuentes de todos los clientes
    all_clients = Client.query.with_entities(Client.objeciones, Client.dolores).all()
    objection_counts = {}
    dolores_counts = {}
    for c_obj, c_dol in all_clients:
        if c_obj:
            for obj in c_obj.split(','):
                obj_clean = obj.strip()
                if obj_clean:
                    objection_counts[obj_clean] = objection_counts.get(obj_clean, 0) + 1
        if c_dol:
            for dol in c_dol.split(','):
                dol_clean = dol.strip()
                if dol_clean:
                    dolores_counts[dol_clean] = dolores_counts.get(dol_clean, 0) + 1

    frequent_objections = sorted(objection_counts.keys(), key=lambda k: objection_counts[k], reverse=True)[:10]
    frequent_dolores = sorted(dolores_counts.keys(), key=lambda k: dolores_counts[k], reverse=True)[:10]

    return jsonify({
        "lead": lead_profile,
        "stages": stages,
        "activity": activity,
        "sales_summary": sales_summary,
        "dolores": dolores_lead,
        "comments": comments_list,
        "programs": programs_list,
        "frequent_objections": frequent_objections,
        "frequent_dolores": frequent_dolores
    }), 200

@bp.route('/public/lead-roadmap/update-client', methods=['POST'])
def update_client_roadmap():
    data = request.get_json() or {}
    client_id = data.get('client_id')
    email = data.get('email')
    phone = data.get('phone')
    instagram = data.get('instagram')
    full_name = data.get('full_name')
    objeciones = data.get('objeciones')
    observaciones = data.get('observaciones')
    dolores = data.get('dolores')

    client = None
    if client_id:
        client = Client.query.get(client_id)
        
    if not client and instagram:
        client = Client.query.filter(func.lower(Client.instagram) == normalize_ig(instagram)).first()
        
    if not client and email:
        client = Client.query.filter(func.lower(Client.email) == email.strip().lower()).first()

    # Si no existe, crear uno nuevo
    if not client:
        # Se requiere al menos un nombre para crear
        if not full_name:
            return jsonify({"error": "Para crear un nuevo cliente se requiere el Nombre Completo"}), 400
        client = Client(
            full_name=full_name,
            email=email.strip().lower() if email else None,
            phone=phone.strip() if phone else None,
            instagram=normalize_ig(instagram),
            objeciones=objeciones,
            observaciones=observaciones,
            dolores=dolores
        )
        db.session.add(client)
    else:
        # Actualizar campos existentes
        if full_name:
            client.full_name = full_name
        if email:
            client.email = email.strip().lower()
        if phone:
            client.phone = phone.strip()
        if instagram:
            client.instagram = normalize_ig(instagram)
        if objeciones is not None:
            client.objeciones = objeciones
        if observaciones is not None:
            client.observaciones = observaciones
        if dolores is not None:
            client.dolores = dolores

    if objeciones is not None or observaciones is not None or dolores is not None:
        from app.models import Notification
        notif = Notification(
            subject=f"Calificación de Lead Actualizada: {client.full_name or client.instagram or 'Desconocido'}",
            content=f"Se actualizaron los datos de calificación del lead.\nDolores: {client.dolores or 'N/A'}\nObjeciones: {client.objeciones or 'N/A'}\nObservaciones: {client.observaciones or 'N/A'}",
            target_users="all",
            associated_id=client.id,
            associated_type="lead"
        )
        db.session.add(notif)

    try:
        db.session.commit()
        return jsonify({
            "message": "Ficha de cliente guardada con éxito",
            "client": {
                "id": client.id,
                "full_name": client.full_name,
                "email": client.email,
                "phone": client.phone,
                "instagram": client.instagram,
                "objeciones": client.objeciones or "",
                "observaciones": client.observaciones or "",
                "dolores": client.dolores or "",
                "form_data": client.form_data
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/lead-roadmap/relate-event', methods=['POST'])
def relate_event_roadmap():
    data = request.get_json() or {}
    event_type = data.get('event_type') # 'sale' o 'agenda'
    event_id = data.get('event_id')
    instagram = data.get('instagram')

    if not event_type or not event_id or not instagram:
        return jsonify({"error": "Faltan datos requeridos (event_type, event_id, instagram)"}), 400

    ig_norm = normalize_ig(instagram)
    if not ig_norm:
        return jsonify({"error": "Instagram inválido o vacío"}), 400

    try:
        if event_type == 'sale':
            sale = FinancialSale.query.get(event_id)
            if not sale:
                return jsonify({"error": "Venta no encontrada"}), 404
            sale.instagram = ig_norm
            
            # Sincronizar en Sheets si aplica
            if sale.marca_temporal:
                from app.services.sheets_service import SheetsService
                update_payload = {
                    "email_vendedor": sale.email_vendedor,
                    "nombre_cliente": sale.nombre_cliente,
                    "telefono": sale.telefono,
                    "mail_cliente": sale.mail_cliente,
                    "tipo_pago": sale.tipo_pago,
                    "monto": sale.monto,
                    "segundo_pago": sale.segundo_pago,
                    "metodo_pago": sale.metodo_pago,
                    "examen": sale.examen,
                    "instagram": sale.instagram,
                    "setter": sale.setter,
                    "estado": sale.estado
                }
                SheetsService.update_in_sheets("Ventas_DB", sale.marca_temporal, update_payload)

        elif event_type == 'agenda':
            agenda = FinancialAgenda.query.get(event_id)
            if not agenda:
                return jsonify({"error": "Agenda no encontrada"}), 404
            agenda.instagram = ig_norm
        else:
            return jsonify({"error": "Tipo de evento inválido"}), 400

        db.session.commit()
        return jsonify({"message": f"Evento {event_type} relacionado con éxito a @{ig_norm}"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
