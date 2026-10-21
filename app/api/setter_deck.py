"""El mazo del setter: armado de la lista de cartas (GET /deck).

Se cuelga del blueprint de `setter.py` (se importa al final de ese archivo).
"""
from flask import request, jsonify
from flask_login import current_user
from app import db
from app.models import ROLE_SETTER
from app.decorators import role_required
from app.services import conversaciones_service, person_service
from app.services.setter_assignment_service import condicion_leads_visibles
from app.api.setter import bp


@bp.route('/deck', methods=['GET'])
@role_required(ROLE_SETTER)
def get_setter_deck():
    from app.models import Appointment, CommentNotification, Comment, ManychatLead, LeadAnswer, Ad, Event, Client
    from datetime import date, timedelta, datetime
    from sqlalchemy import or_, func
    
    from app.api.setter_mazo import _rango_pedido

    step = request.args.get('step')
    # Los chips de fecha son los mismos que los de la lista de agendas del mazo, con el "hoy" del
    # setter: ver `_rango_pedido`. Sin chip, la cualificacion trae todo.
    start_dt, end_dt = _rango_pedido('today' if step == 'agendas' else 'all')

    unread_client_ids = set()
    if current_user and current_user.is_authenticated:
        unread_client_ids = {n.client_id for n in CommentNotification.query.filter_by(user_id=current_user.id, is_read=False).all()}

    # Filtrar según el paso del flujo de trabajo
    if step == 'cualificacion':
        show_disqualified = request.args.get('show_disqualified') == 'true'
        
        query = LeadAnswer.query
        
        if not show_disqualified:
            query = query.filter(LeadAnswer.qualification.in_(['true', 'yes']))
        else:
            query = query.filter(LeadAnswer.qualification.in_(['true', 'yes', 'false', 'no']))

        if start_dt and end_dt:
            query = query.filter(LeadAnswer.created_at.between(start_dt, end_dt))
            
        # El dueño del lead lo decide ManyChat (ManychatLead.setter), no el
        # anuncio: antes se acotaba por Event.setter_id y como la mayoría de
        # anuncios no tiene evento con setter dueño, todos veían todo.
        condicion_setter = condicion_leads_visibles(current_user)
        if condicion_setter is not None:
            query = query.join(ManychatLead, ManychatLead.id == LeadAnswer.lead_id)\
                         .filter(condicion_setter)

        lead_answers = query.order_by(LeadAnswer.created_at.desc()).all()
        
        booked_instagrams_q = db.session.query(func.lower(func.replace(Client.instagram, '@', '')))\
            .join(Appointment, Appointment.client_id == Client.id)\
            .filter(Client.instagram != None, Client.instagram != '')\
            .distinct().all()
        booked_igs = {ig[0] for ig in booked_instagrams_q if ig[0]}
        

        
        present_igs = set()
        for la in lead_answers:
            if la.lead and la.lead.ig:
                present_igs.add(la.lead.ig.strip().replace('@', '').lower())
                
        if unread_client_ids:
            unread_clients = Client.query.filter(Client.id.in_(list(unread_client_ids))).all()
            for uc in unread_clients:
                uc_ig_clean = uc.instagram.strip().replace('@', '').lower() if uc.instagram else None
                if not uc_ig_clean:
                    uc_ig_clean = f"no_ig_{uc.id}"
                if uc_ig_clean not in present_igs:
                    # La conversación de su persona (plan_personas) antes que la de su Instagram.
                    m_lead = conversaciones_service.lead_de_persona(uc.person_uuid) or ManychatLead.query.filter(
                        func.lower(func.replace(ManychatLead.ig, '@', '')) == uc_ig_clean).first()
                    if not m_lead:
                        try:
                            m_lead = ManychatLead(
                                manychat_id=f"synth_{uc.id}_{int(datetime.utcnow().timestamp())}",
                                name=uc.full_name or "Sin Nombre",
                                ig=uc.instagram or uc_ig_clean,
                                created_at=datetime.utcnow()
                            )
                            db.session.add(m_lead)
                            db.session.commit()
                        except Exception as ex:
                            db.session.rollback()
                            import logging
                            logging.error(f"Error persistiendo ManychatLead de setter en GET: {ex}")
                            m_lead = ManychatLead(
                                id=-(uc.id + 2000000),
                                name=uc.full_name or "Sin Nombre",
                                ig=uc.instagram or uc_ig_clean,
                                created_at=datetime.utcnow()
                            )
                            
                    la_obj = LeadAnswer.query.filter_by(lead_id=m_lead.id).order_by(LeadAnswer.created_at.desc()).first() if m_lead.id > 0 else None
                    if not la_obj:
                        try:
                            la_obj = LeadAnswer(
                                lead_id=m_lead.id,
                                qualification='null',
                                keyword='Mensaje Directo',
                                created_at=datetime.utcnow()
                            )
                            db.session.add(la_obj)
                            db.session.commit()
                        except Exception as ex:
                            db.session.rollback()
                            import logging
                            logging.error(f"Error persistiendo LeadAnswer de setter en GET: {ex}")
                            la_obj = LeadAnswer(
                                id=-(uc.id + 3000000),
                                lead_id=m_lead.id,
                                qualification='null',
                                keyword='Mensaje Directo',
                                created_at=datetime.utcnow()
                            )
                    if la_obj:
                        lead_answers.insert(0, la_obj)
                        present_igs.add(uc_ig_clean)
                    
        response_data = []
        seen_igs = set()
        for la in lead_answers:
            lead = la.lead
            if not lead:
                continue
                
            ig_clean = lead.ig.strip().replace('@', '').lower() if lead.ig else None
            lead_identifier = ig_clean or f"lead_id_{lead.id}"
            
            # Garantizar que cada Instagram / prospecto sea ÚNICO en el mazo
            if lead_identifier in seen_igs:
                continue
            seen_igs.add(lead_identifier)

            edad_str = "N/A"
            
            # El cliente de su persona, si ya la tiene; si no, por el Instagram como antes.
            client = person_service.cliente_de(lead.person, crear=False) if lead.person_uuid else None
            if ig_clean and not client:
                if ig_clean.startswith("no_ig_"):
                    try:
                        c_id = int(ig_clean.split("_")[-1])
                        client = Client.query.get(c_id)
                    except Exception:
                        pass
                if not client:
                    client = Client.query.filter(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean).first()
                if not client:
                    try:
                        client = Client(
                            full_name=lead.name or "Sin Nombre",
                            instagram=lead.ig,
                            created_at=datetime.utcnow()
                        )
                        db.session.add(client)
                        db.session.commit()
                    except Exception as ex:
                        db.session.rollback()
                        import logging
                        logging.error(f"Error registrando cliente implícito en deck setter: {ex}")
            
            has_unread = client.id in unread_client_ids if client else False
            if ig_clean and ig_clean in booked_igs and not has_unread:
                continue

            if client and client.form_data:
                for key, val in client.form_data.items():
                    if 'edad' in key.lower() or 'age' in key.lower():
                        edad_str = f"{val} años"
                        break
                        
            assigned_setter = "Sin asignar"
            assigned_closer = "Sin asignar"
            
            ad = Ad.query.get(la.ad_id) if la.ad_id else None
            event = Event.query.get(ad.event_id) if (ad and ad.event_id) else None
            if event:
                if event.setter:
                    assigned_setter = event.setter.username
                if event.closers:
                    assigned_closer = " / ".join([c.username for c in event.closers])

            # El reparto real lo hace ManyChat; el setter del evento es solo el
            # respaldo para los leads que entraron antes de la variable.
            if lead.setter:
                assigned_setter = lead.setter
                    
            response_data.append({
                "id": la.id,
                "lead_name": lead.name or "Sin Nombre",
                "email": client.email if client else "",
                "phone": client.phone if client else "",
                "instagram": lead.ig or "",
                "start_time": la.created_at.isoformat() if la.created_at else None,
                "created_at": lead.created_at.isoformat() if lead.created_at else None,
                "origin": "ManyChat / Instagram",
                "result": la.qualification,
                "ig_chat_link": f"https://instagram.com/{lead.ig.replace('@', '')}" if lead.ig else "",
                "keyword": la.keyword or "",
                "ad_name": ad.name if ad else (la.keyword or "Desatribuido"),
                "setter_notes": "",
                "assigned_to": f"{assigned_setter} / {assigned_closer}",
                "edad_form": edad_str,
                "dolores": client.dolores if client else "",
                "observaciones": client.observaciones if client else "",
                "client_id": client.id if client else None,
                "person_uuid": lead.person_uuid or (client.person_uuid if client else None),
                "comments_count": db.session.query(Comment).filter(Comment.comment_type == 'client', Comment.associated_id == client.id).count() if client else 0,
                "unread_comment": client.id in unread_client_ids if client else False
            })
            
        response_data.sort(key=lambda x: 0 if x.get('unread_comment', False) else 1)
        return jsonify(response_data), 200

    # Filtrar según el paso del flujo de trabajo (citas)
    if step == 'entrantes':
        query = Appointment.query.filter(
            or_(Appointment.result == None, Appointment.result == '', Appointment.result == 'Pendiente')
        )
    elif step == 'agendas':
        # Todas las citas de este setter en el periodo, incluso procesadas o confirmadas
        query = Appointment.query
    else:
        query = Appointment.query.filter(
            or_(Appointment.result == 'Agendado', Appointment.result == None, Appointment.result == ''),
            Appointment.setter_processed == False
        )
    
    if start_dt and end_dt:
        query = query.filter(
            or_(
                Appointment.start_time.between(start_dt, end_dt),
                Appointment.created_at.between(start_dt, end_dt)
            )
        )
        
    agenda_de_cita = {}
    if current_user.role != 'admin':
        if step == 'agendas':
            # Mismo criterio que "Mis Agendas": la FUENTE de la agenda, no
            # `Appointment.setter_id`. Ese campo tambien lo llenan las
            # cualificaciones de ManyChat, que crean una cita placeholder sin
            # agenda real detras y ensuciaban esta lista con leads que no eran
            # agendas; y al reves, se perdian las agendas cuya fuente es este
            # setter pero cuya cita quedo sin atribuir.
            from app.api.setter_agendas import agendas_por_cita
            agenda_de_cita = agendas_por_cita(current_user, start_dt, end_dt)
            query = query.filter(Appointment.id.in_(list(agenda_de_cita))) if agenda_de_cita \
                else query.filter(db.false())
        else:
            query = query.filter_by(setter_id=current_user.id)

    appointments = query.order_by(Appointment.start_time.asc()).all()

    res_list = []
    for a in appointments:
        # La conversación de su persona (plan_personas); el Instagram y el nombre, de respaldo.
        lead_persona = conversaciones_service.lead_de_persona(a.person_uuid)
        client_ig = a.client.instagram if (a.client and a.client.instagram) else ""
        if not client_ig and a.ig_chat_link:
            clean_chat = a.ig_chat_link.strip()
            if "instagram.com/" in clean_chat:
                parts = clean_chat.split("instagram.com/")[1].split("/")[0].split("?")[0]
                if parts and parts != "direct":
                    client_ig = parts
            elif clean_chat.startswith("@"):
                client_ig = clean_chat

        if not client_ig and lead_persona and lead_persona.ig:
            client_ig = lead_persona.ig
        if not client_ig and a.client:
            if a.client.full_name:
                m_lead = ManychatLead.query.filter(func.lower(ManychatLead.name) == a.client.full_name.lower().strip()).first()
                if m_lead and m_lead.ig:
                    client_ig = m_lead.ig

        ad_obj = None
        if a.keyword:
            ad_obj = Ad.query.filter_by(keyword=a.keyword).first()

        if not ad_obj and (lead_persona or client_ig):
            ig_clean_normal = client_ig.strip().lstrip('@').lower()
            m_lead = lead_persona or ManychatLead.query.filter(
                func.lower(func.replace(ManychatLead.ig, '@', '')) == ig_clean_normal
            ).first()
            if m_lead:
                la = LeadAnswer.query.filter(
                    LeadAnswer.lead_id == m_lead.id,
                    LeadAnswer.ad_id != None
                ).order_by(LeadAnswer.created_at.desc()).first()
                if la:
                    ad_obj = Ad.query.get(la.ad_id)

        if not ad_obj and a.client and a.client.full_name:
            m_lead = ManychatLead.query.filter(
                func.lower(ManychatLead.name) == a.client.full_name.strip().lower()
            ).first()
            if m_lead:
                la = LeadAnswer.query.filter(
                    LeadAnswer.lead_id == m_lead.id,
                    LeadAnswer.ad_id != None
                ).order_by(LeadAnswer.created_at.desc()).first()
                if la:
                    ad_obj = Ad.query.get(la.ad_id)

        res_list.append({
            "id": a.id,
            "lead_name": a.client.full_name or "Sin Nombre" if a.client else "Sin Cliente",
            "email": a.client.email if a.client else "",
            "phone": a.client.phone if a.client else "",
            "instagram": client_ig,
            "start_time": a.start_time.isoformat() if a.start_time else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "origin": a.origin or "Agendamiento",
            "result": a.result or "Agendado",
            "ig_chat_link": a.ig_chat_link or "",
            "keyword": a.keyword or "",
            "ad_name": ad_obj.name if ad_obj else (a.keyword or "Desatribuido"),
            "setter_notes": a.setter_notes or "",
            "client_id": a.client_id,
            "person_uuid": a.person_uuid,
            # Con que agenda se corresponde esta cita: es lo que le permite al
            # mazo abrir el detalle del lead, que se pide por agenda y no por cita.
            "agenda_id": agenda_de_cita.get(a.id),
            "comments_count": Comment.query.filter(Comment.comment_type == 'client', Comment.associated_id == a.client_id).count() if a.client_id else 0,
            "unread_comment": a.client_id in unread_client_ids if (a.client_id and unread_client_ids) else False
        })

    return jsonify(res_list), 200
