from flask import request, jsonify
from app import db
from app.models import Client, Appointment, SurveyAnswer, SurveyQuestion, ClientComment, User
from app.models.financial import FinancialSale, FinancialAgenda
from app.models import Conversation, LeadAnswer
from app.services.identity_service import normalize_ig
from app.services import pagos_copia
from datetime import datetime, timedelta
from . import bp
from sqlalchemy import or_, func

# Re-export: lo que vivia aca y se partio en modulos (regla de las 500 lineas).
from .lead_roadmap_helpers import (  # noqa: F401
    _strip_accents, names_plausibly_match, is_generic_val, format_datetime_es, format_date_es)
from .lead_roadmap_sections import build_activity, build_programs, frequent_objections_and_dolores
from .lead_roadmap_edit import update_client_roadmap, relate_event_roadmap  # noqa: F401

@bp.route('/public/lead-roadmap', methods=['GET'])
def get_lead_roadmap():
    try:
        client_id = request.args.get('client_id', type=int)
        person_uuid = request.args.get('person_uuid', type=str)
        instagram = request.args.get('instagram', type=str)
        email = request.args.get('email', type=str)
        phone = request.args.get('phone', type=str)
        name = request.args.get('name', type=str)

        client = None
        conversacion = None
        financial_agendas = []
        financial_sales = []
        appointments = []
        comments = []
        survey_answers = []

        from app.services import person_service

        # 1. Resolver el cliente por ID, o por la persona (docs/plan_personas.md, Etapa 2a)
        person = person_service.por_uuid(person_uuid) if person_uuid else None
        if client_id:
            client = Client.query.get(client_id)
        if not client and person:
            client = person_service.cliente_de(person, crear=False)

        # 2. Resolver por otros campos si no se encontró
        ig_norm = normalize_ig(instagram)
        if is_generic_val(ig_norm):
            ig_norm = None
        
        clean_email = email.strip().lower() if email and not is_generic_val(email) else None
        clean_phone = phone.strip() if phone and not is_generic_val(phone) else None
        clean_name = name.strip() if name and name.strip() else None

        if not client and not person:
            # La persona primero (docs/plan_personas.md): cualquiera de sus mails, instagrams o teléfonos.
            person = person_service.buscar(clean_name, email=clean_email, instagram=ig_norm, phone=clean_phone)
            client = person_service.cliente_de(person, crear=False)

        if not client:
            if ig_norm:
                candidate = Client.query.filter(func.lower(Client.instagram) == ig_norm).first()
                if candidate and not names_plausibly_match(candidate.full_name, clean_name):
                    ig_norm = None  # este instagram quedo mal cargado en la fila: no es de este lead
                else:
                    client = candidate
            if not client and clean_email:
                candidate = Client.query.filter(func.lower(Client.email) == clean_email).first()
                if candidate and not names_plausibly_match(candidate.full_name, clean_name):
                    clean_email = None  # idem con el mail
                else:
                    client = candidate
            if not client and clean_phone:
                candidate = Client.query.filter(Client.phone.like(f"%{clean_phone}%")).first()
                if candidate and not names_plausibly_match(candidate.full_name, clean_name):
                    clean_phone = None  # idem con el telefono
                else:
                    client = candidate
            # Búsqueda por nombre (parcial, case-insensitive) como último recurso
            if not client and clean_name:
                client = Client.query.filter(
                    func.lower(Client.full_name).like(f"%{clean_name.lower()}%")
                ).first()

        if person is None and client is not None and client.person_uuid:
            person = person_service.por_uuid(client.person_uuid)
        puuid = person.uuid if person else None

        # Si se encontró un Client, normalizamos sus búsquedas para jalar todo lo relacionado
        resolved_ig = normalize_ig(client.instagram) if client else ig_norm
        if is_generic_val(resolved_ig):
            resolved_ig = None
            
        resolved_email = client.email.strip().lower() if client and client.email and not is_generic_val(client.email) else clean_email
        resolved_phone = client.phone.strip() if client and client.phone and not is_generic_val(client.phone) else clean_phone

        # 3. Buscar Conversation: el de la persona, el de la persona de su instagram y, de respaldo, el
        # de la fila con ese instagram (`lead_por_ig`).
        from app.services.conversaciones_service import de_persona as lead_de_persona
        from app.services import lead_contacto_service
        conversacion = lead_de_persona(puuid)
        if not conversacion and resolved_ig:
            conversacion = lead_contacto_service.lead_por_ig(resolved_ig)
        if not conversacion and resolved_email:
            conversacion = Conversation.query.filter(func.lower(Conversation.ig) == resolved_email).first() # Fallback a veces guardado como email

        # 4. Buscar FinancialAgendas
        # Las de su persona; por la copia, solo las agendas sin persona (Etapa 2b).
        from app.services import agenda_contacto_service
        agenda_filtro = agenda_contacto_service.filtro(puuid, instagram=resolved_ig, mail=resolved_email,
                                                       telefono=resolved_phone)
        if agenda_filtro is not None:
            financial_agendas = FinancialAgenda.query.filter(agenda_filtro).order_by(FinancialAgenda.date.desc()).all()
        contacto_agenda = financial_agendas[0].contacto() if financial_agendas else {}
        contacto_lead = lead_contacto_service.contacto(conversacion) if conversacion else {}

        # 5. Buscar FinancialSales: los de su persona y su ficha; la copia del pago (mail, instagram)
        # cuenta solo en pagos sin persona (docs/plan_personas.md, Etapa 2b).
        if puuid or client:
            from app.services.sales_consistency_service import filtro_de_pagos
            financial_sales = FinancialSale.query.filter(filtro_de_pagos(client, person_uuid=puuid))                 .order_by(FinancialSale.date.desc()).all()
        else:
            sale_filters = []
            if resolved_ig:
                sale_filters.append(pagos_copia.IG_NORMALIZADO == resolved_ig)
            if resolved_email:
                sale_filters.append(pagos_copia.MAIL_NORMALIZADO == resolved_email)
            if sale_filters:
                financial_sales = FinancialSale.query.filter(FinancialSale.person_uuid.is_(None), or_(*sale_filters))                     .order_by(FinancialSale.date.desc()).all()

        # 6. Buscar Appointments locales y respuestas de encuestas
        if client:
            appointments = client.appointments.order_by(Appointment.start_time.desc()).all()
            comments = ClientComment.query.filter_by(client_id=client.id).order_by(ClientComment.created_at.desc()).all()

            answers_query = db.session.query(SurveyAnswer, SurveyQuestion).join(SurveyQuestion).filter(SurveyAnswer.client_id == client.id).all()
            for answer, question in answers_query:
                survey_answers.append({
                    "question": question.text,
                    "answer": answer.answer
                })

        # Si no hay absolutamente nada, retornamos un 404
        if not client and not conversacion and not financial_agendas and not financial_sales:
            return jsonify({"error": "Lead no encontrado en el sistema"}), 404

        # Determinar la fecha de creación del lead
        created_at_val = None
        if client and client.created_at:
            created_at_val = client.created_at.isoformat()
        elif conversacion and conversacion.created_at:
            created_at_val = conversacion.created_at.isoformat()
        elif financial_agendas:
            # Usar el registro (creación) de la agenda más antigua (el final de la lista ordenada por date desc)
            created_at_val = financial_agendas[-1].registro or (financial_agendas[-1].date.isoformat() if financial_agendas[-1].date else None)
        elif financial_sales:
            created_at_val = financial_sales[-1].marca_temporal or (financial_sales[-1].date.isoformat() if financial_sales[-1].date else None)
            
        if not created_at_val:
            created_at_val = datetime.utcnow().isoformat()

        # Consolidar datos de perfil del lead
        contacto_venta = financial_sales[0].contacto() if financial_sales else {}
        lead_profile = {
            "id": client.id if client else None,
            "person_uuid": puuid,
            # `clean_name` (el nombre de la fila sobre la que se hizo click) va antes que
            # financial_agendas[0].lead: cuando el mismo telefono/mail tiene varias agendas y la
            # mas reciente es una de las historicas sin `lead` cargado (ver Bug agendas viejas),
            # ese [0] queda vacio y no debe pisar el nombre que sabiamos que era el correcto.
            "full_name": client.full_name if client else (clean_name or (contacto_lead['nombre'] if conversacion else (contacto_venta['nombre_cliente'] if financial_sales else (contacto_agenda.get('lead') if financial_agendas else "Desconocido")))),
            "email": client.email if client else (contacto_lead['ig'] if conversacion and '@' in (contacto_lead['ig'] or '') else (contacto_venta['mail_cliente'] if financial_sales else (contacto_agenda.get('mail') if financial_agendas else "Sin Email"))),
            "phone": client.phone if client else (contacto_venta['telefono'] if financial_sales else (contacto_agenda.get('whatsapp') if financial_agendas else "Sin Teléfono")),
            "instagram": client.instagram if client else (contacto_lead['ig'] if conversacion else (contacto_venta['instagram'] if financial_sales else (contacto_agenda.get('instagram') if financial_agendas else "Sin Instagram"))),
            "status": "Entrante",
            "created_at": created_at_val,
            "objeciones": client.objeciones if client else "",
            "observaciones": client.observaciones if client else "",
            "dolores": client.dolores if client else "",
            "form_data": client.form_data if client else None
        }

        # Resolver el estado del lead
        has_completed_sale = any((s.estado or '').lower() == 'completada' or not s.estado for s in financial_sales)
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
                "origen": conversacion.external_id if conversacion else "Registro Web/Directo",
                "canal": "Instagram Ads" if conversacion else "Orgánico / Búsqueda",
                "campaña": "N/A",
                "inversion": 0.0
            }
        }
        # Intentar obtener más detalles del primer contacto o ManyChat
        if conversacion:
            # Buscar la primera respuesta para ver origen
            first_la = LeadAnswer.query.filter_by(conversation_id=conversacion.id).order_by(LeadAnswer.created_at.asc()).first()
            if first_la:
                arrived_stage["details"]["campaña"] = first_la.keyword or "Instagram Bot"
                if first_la.opening:
                    arrived_stage["details"]["origen"] = f"Keyword: {first_la.keyword} ({first_la.opening})"

        stages.append(arrived_stage)

        # Etapa 2: Contactó
        contact_date = lead_profile["created_at"]
        contact_completed = False
        contact_msg = "Mensaje del bot gatillado"
        if conversacion:
            contact_completed = True
            first_la = LeadAnswer.query.filter_by(conversation_id=conversacion.id).order_by(LeadAnswer.created_at.asc()).first()
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
                "accion": "Inició conversación" if conversacion else "Registro Directo",
                "medio": "Instagram" if conversacion else "Web",
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
            sa_list = SurveyAnswer.query.filter_by(client_id=client.id).all()
            for sa in sa_list:
                q_text = sa.question.text.lower() if sa.question else ""
                if "dolor" in q_text or "problema" in q_text or "dificultad" in q_text or "obstáculo" in q_text:
                    pain_completed = True
                    if sa.answer not in pain_list:
                        pain_list.append(sa.answer)
                    if not pain_date:
                        pain_date = sa.appointment.start_time.isoformat() if sa.appointment else datetime.utcnow().isoformat()

        # Si no se encontraron dolores en las encuestas, buscar en ManyChat
        if not pain_completed and conversacion:
            # Buscar respuestas con categoría dolor en conversational_messages
            pain_answers = LeadAnswer.query.filter_by(conversation_id=conversacion.id).all()
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
            latest_appt = appointments[0]
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
            comp_sales = [s for s in financial_sales if (s.estado or '').lower() == 'completada' or not s.estado]
            latest_sale = comp_sales[0] if comp_sales else financial_sales[0]
            
            sale_completed = (latest_sale.estado or '').lower() == 'completada' or not latest_sale.estado
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

        activity = build_activity(lead_profile, arrived_stage, conversacion, financial_agendas, appointments,
                                  financial_sales, comments, client)

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

        comments_list = [
            {
                "id": c.id,
                "text": c.text,
                "author": c.author_rel.username if c.author_rel else "Desconocido",
                "created_at": c.created_at.isoformat()
            } for c in comments
        ]

        programs_list = build_programs(client, financial_sales)

        frequent_objections, frequent_dolores = frequent_objections_and_dolores()

        # Keyword seguro
        appt_keyword = appointments[0].keyword if appointments else (getattr(financial_agendas[0], 'keyword', None) if financial_agendas else None)

        return jsonify({
            "lead": lead_profile,
            "stages": stages,
            "activity": activity,
            "sales_summary": sales_summary,
            "dolores": dolores_lead,
            "comments": comments_list,
            "programs": programs_list,
            "survey_answers": survey_answers,
            "frequent_objections": frequent_objections,
            "frequent_dolores": frequent_dolores,
            "appointment_keyword": appt_keyword
        }), 200
    except Exception as e:
        import logging
        logging.error(f"Error en get_lead_roadmap: {e}", exc_info=True)
        return jsonify({"error": f"Error al procesar los datos del lead: {str(e)}"}), 500
