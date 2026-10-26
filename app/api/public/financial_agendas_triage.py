"""Triage: leads con comentarios sin leer y leads potenciales."""
from flask import request, jsonify
from flask_login import login_required, current_user
from app.models import db, FinancialAgenda
from app.services.agenda_contacto_service import ig_limpio, mail_limpio
from . import bp
from .financial_agendas_helpers import (
    _build_agenda_queries, _resolve_closer_results)


@bp.route('/public/financial-agendas/unread-no-agenda', methods=['GET'])
@login_required
def get_unread_no_agenda_triage():
    # Obtener clientes que tienen notificaciones de comentarios no leídos para este usuario de triaje
    from app.models import Client, FinancialAgenda
    from app.services.avisos_service import clientes_con_notas_sin_leer
    from sqlalchemy import func, or_

    unread_client_ids = clientes_con_notas_sin_leer(current_user)
    
    if not unread_client_ids:
        return jsonify([]), 200
        
    clients = Client.query.filter(Client.id.in_(list(unread_client_ids))).all()
    
    results = []
    for c in clients:
        ig_clean = c.instagram.strip().replace('@', '').lower() if c.instagram and c.instagram.lower() not in ('n/a', '') else None
        mail_clean = c.email.strip().lower() if c.email and c.email.lower() not in ('n/a', '') else None
        
        from app.services import agenda_contacto_service
        filtro = agenda_contacto_service.filtro(c.person_uuid, instagram=ig_clean, mail=mail_clean)
        agenda_exists = filtro is not None and FinancialAgenda.query.filter(filtro).first() is not None
            
        if not agenda_exists:
            results.append({
                "id": -(c.id + 2000000),
                "client_id": c.id,
                "nombre": "Mensaje de Triaje (Sin Agenda)",
                "lead": c.full_name or "Sin Nombre",
                "mail": c.email or "",
                "instagram": c.instagram or "",
                "whatsapp": c.phone or "",
                "estado": "Pendiente",
                "closer": "Sin Asignar",
                "unread_comment": True,
                "date": None,
                "fecha_meet": None
            })
            
    return jsonify(results), 200


@bp.route('/public/financial-agendas/potential-leads', methods=['GET'])
@login_required
def get_potential_leads():
    # Retorna los ultimos N leads potenciales sin ventas cerradas, respetando los
    # filtros activos del tablero salvo que se pida explicitamente ignorarlos
    limit = request.args.get('limit', default=1000, type=int)
    apply_filters = request.args.get('apply_filters', default='true', type=str).strip().lower() not in ('false', '0', 'no')
    try:
        from app.models import FinancialSale

        # Obtener datos de ventas para filtrar compradores
        # Compró = tiene un pago de su persona; la copia del pago cuenta solo en pagos sin persona.
        sold_persons = {u for (u,) in db.session.query(FinancialSale.person_uuid)
                        .filter(FinancialSale.person_uuid.isnot(None)).distinct()}
        sales = FinancialSale.query.filter(FinancialSale.person_uuid.is_(None)).all()
        from app.services.pagos_copia import copia
        copias = [copia(s) for s in sales]
        sold_emails = {c['mail'].strip().lower() for c in copias if c['mail']}
        sold_instagrams = {c['instagram'].strip().replace('@', '').lower() for c in copias if c['instagram']}

        if apply_filters:
            _, query, closer_results = _build_agenda_queries()
        else:
            query = FinancialAgenda.query.order_by(FinancialAgenda.date.desc())
            closer_results = []

        agendas = query.all()
        closer_results_lower = {cr.lower() for cr in closer_results}
        estados_post_call = _resolve_closer_results(agendas)

        potential_leads = []
        seen_emails = set()
        seen_instagrams = set()
        seen_phones = set()

        for a in agendas:
            if len(potential_leads) >= limit:
                break

            contacto = a.contacto()
            mail_clean = mail_limpio(contacto['mail'])
            ig_clean = ig_limpio(contacto['instagram'])
            phone_clean = contacto['whatsapp'].strip() if contacto['whatsapp'] else None

            # Ignorar compradores
            if a.person_uuid and a.person_uuid in sold_persons:
                continue
            if mail_clean and mail_clean in sold_emails:
                continue
            if ig_clean and ig_clean in sold_instagrams:
                continue

            estado_post_call = estados_post_call.get(a.id) or (a.estado or "Pendiente")
            if closer_results_lower and estado_post_call.strip().lower() not in closer_results_lower:
                continue

            # Evitar duplicados (agenda mas reciente primero)
            if mail_clean and mail_clean in seen_emails:
                continue
            if ig_clean and ig_clean in seen_instagrams:
                continue
            if phone_clean and phone_clean in seen_phones:
                continue

            if mail_clean:
                seen_emails.add(mail_clean)
            if ig_clean:
                seen_instagrams.add(ig_clean)
            if phone_clean:
                seen_phones.add(phone_clean)

            potential_leads.append({
                "id": a.id,
                "person_uuid": a.person_uuid,
                "date": a.date.isoformat() if a.date else (a.fecha_meet or ""),
                "registro": a.registro or (a.created_at.isoformat() if a.created_at else ""),
                "lead": contacto['lead'] or a.nombre or "Sin Nombre",
                "whatsapp": contacto['whatsapp'] or "",
                "mail": contacto['mail'] or "",
                "instagram": contacto['instagram'] or "",
                "nombre": a.nombre or "",
                "closer": a.closer or "",
                "encargado_triage": a.encargado_triage or "",
                "estado": a.estado or "Pendiente",
                "closer_result": estado_post_call,
                "zona_geografica": a.zona_geografica or "",
                "fecha_seguimiento": a.fecha_seguimiento or ""
            })

        return jsonify(potential_leads), 200
    except Exception as e:
        import logging
        logging.error(f"Error al obtener clientes potenciales: {e}")
        return jsonify({"error": "Error interno del servidor"}), 500
