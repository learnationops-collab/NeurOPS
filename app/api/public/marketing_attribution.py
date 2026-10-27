"""Atribucion manual de ventas y agendas sin anuncio (UnattributedLeadsPage). Las rutas viven sobre `bp`."""
# pyrefly: ignore [missing-import]
from flask import request, jsonify
from app.api.errores import error_interno
from app.models import db
from flask_login import current_user
from app.services import agenda_contacto_service
from app.services import conversaciones_service
from app.services.commission_service import cash_neto
from app.services.identity_service import normalize_ig
from . import bp

import logging


def _sumar_instagram(person, ig, donde):
    """El IG que el setter escribió para atribuir queda en la persona (de donde se lee, Etapa 2b): como
    principal si no tenía, si no como otro dato válido. Uno que ya es de otra persona no se le suma."""
    from app.services import person_service

    valor = person_service.normalizar('instagram', ig)
    if person is None or not valor:
        return
    if set(person_service.duenos('instagram', valor)) - {person.uuid}:
        logging.getLogger(__name__).warning(f"[ATRIBUCION] @{valor} de la {donde} ya es de otra persona: no se le suma")
        return
    person_service.anotar(person, [('instagram', valor)], 'atribucion')


def _nombre_del_lead(agenda):
    """El de su persona; sin persona, el de la copia según el formato de la hoja (`nombre_persona`)."""
    return agenda.contacto()['lead'] if agenda.person_uuid else agenda.nombre_persona


# ============================================================
# ATRIBUCIÓN MANUAL (Sin Anuncio: UnattributedLeadsPage)
# ============================================================
# El reporte GET /public/reports/sales-attribution vivía acá: lo usaba solo «Importaciones
# Sheets» (/admin/sheets), que se retiró el 10/10/2026.

@bp.route('/public/marketing/manual-attribution', methods=['POST'])
def force_manual_attribution():
    """
    Fuerza la atribución de una venta inyectando un usuario y una interacción virtual.
    """
    from app.models import FinancialSale, Conversation, LeadAnswer, Ad
    from datetime import timedelta
    import uuid
    import logging
    logger = logging.getLogger(__name__)

    data = request.json or {}
    raw_sale_id = data.get('sale_id')
    raw_ad_id = data.get('ad_id')
    instagram_input = data.get('instagram')

    if not raw_sale_id or not raw_ad_id or not instagram_input:
        return jsonify({"error": "Faltan parámetros requeridos (sale_id, ad_id, instagram)"}), 400

    # Conversión segura a entero para evitar problemas en base de datos estricta
    try:
        sale_id = int(raw_sale_id)
        ad_id = int(raw_ad_id)
    except (ValueError, TypeError) as e:
        logger.error(f"Error de casteo en atribucion manual: sale_id={raw_sale_id}, ad_id={raw_ad_id}. Detalle: {str(e)}")
        return jsonify({"error": "Los IDs de venta y anuncio deben ser enteros válidos"}), 400

    # Validar existencia de la venta
    sale = FinancialSale.query.get(sale_id)
    if not sale:
        logger.error(f"Atribucion fallida: No se encontro la venta con ID={sale_id}")
        return jsonify({"error": f"No se encontró la venta con ID {sale_id}"}), 404

    # Validar existencia del anuncio
    ad_exists = Ad.query.get(ad_id)
    if not ad_exists:
        logger.error(f"Atribucion fallida: No se encontro el anuncio con ID={ad_id}")
        return jsonify({"error": f"El anuncio con ID {ad_id} no existe en la base de datos"}), 404

    # 1. Normalizar IG y guardarlo en la venta si es diferente/nuevo, y en su persona (de donde se lee)
    ig_normalizado = instagram_input.strip().lstrip('@').lower()
    sale.instagram = f"@{ig_normalizado}"
    _sumar_instagram(sale.person if sale.person_uuid else None, ig_normalizado, f'venta #{sale.id}')
    
    # 2. Buscar o crear Conversation: el del IG que se escribió y, si no hay, el de la persona de la venta
    matched_lead = Conversation.query.filter(
        db.func.lower(db.func.replace(Conversation.ig, '@', '')) == ig_normalizado
    ).first() or conversaciones_service.de_persona(sale.person_uuid)

    if not matched_lead:
        # Generar un ID único basado en la venta para evitar colisiones
        cliente_nombre = (sale.raw_data or {}).get('cliente') or (sale.raw_data or {}).get('nombre') or 'Desconocido'
        matched_lead = Conversation(
            external_id=f"manual_{sale.id}_{uuid.uuid4().hex[:6]}",
            name=cliente_nombre,
            ig=f"@{ig_normalizado}",
            follower=False
        )
        db.session.add(matched_lead)
        db.session.flush()

    # 3. Crear LeadAnswer (interacción de webhook falsa) un minuto antes de la venta
    fake_time = sale.date - timedelta(minutes=1) if sale.date else db.func.now()
    
    answer = LeadAnswer(
        conversation_id=matched_lead.id,
        ad_id=ad_id,
        keyword="manual_attribution",
        qualification="true", # calificado porque compro
        created_at=fake_time,
        updated_at=fake_time
    )
    
    db.session.add(answer)
    
    try:
        db.session.commit()
        
        # Forzar timestamps post-commit por si SQLAlchemy los sobreescribe
        answer.created_at = fake_time
        answer.updated_at = fake_time
        db.session.commit()

        return jsonify({
            "message": "Atribución forzada con éxito.",
            "sale_id": sale.id,
            "lead_id": matched_lead.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error de base de datos en atribucion manual: {str(e)}")
        return error_interno(e, 'Error interno al guardar')


@bp.route('/public/marketing/unattributed-leads', methods=['GET'])
def get_unattributed_leads():
    """Obtiene ventas y agendas sin anuncio en un rango de fechas."""
    from app.models import FinancialSale, FinancialAgenda, Conversation, LeadAnswer
    from datetime import datetime, timedelta

    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')
    lead_type = request.args.get('type', 'all')
    search_query = request.args.get('search', '').strip().lower()

    # Rango de fechas por defecto: ultimos 30 dias
    if not start_str or not end_str:
        today = datetime.utcnow().date()
        start_dt = datetime.combine(today - timedelta(days=30), datetime.min.time())
        end_dt = datetime.combine(today, datetime.max.time())
    else:
        try:
            start_dt = datetime.strptime(start_str, '%Y-%m-%d')
            end_dt = datetime.strptime(end_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
        except ValueError:
            return jsonify({"error": "Formato de fecha invalido"}), 400

    unattributed_sales_map = {}
    unattributed_sales = []
    unattributed_agendas = []
    seen_agenda_leads = set()

    # 1. Buscar ventas sin anuncio
    if lead_type in ('all', 'sales'):
        from sqlalchemy import or_
        sales = FinancialSale.query.filter(
            FinancialSale.date >= start_dt,
            FinancialSale.date <= end_dt,
            or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == '')
        ).order_by(FinancialSale.date.desc()).all()

        # Lo que se muestra sale de la persona del pago; la copia, solo en pagos sin persona.
        contactos = FinancialSale.contactos(sales)
        for sale in sales:
            contacto = contactos[sale.id]
            ig_val = contacto['instagram'] or (None if sale.person_uuid else (
                (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')))
            ig_norm = normalize_ig(ig_val)
            nombre_norm = (contacto['nombre_cliente'] or '').strip().lower()

            # El neto, sin la comisión estimada de la pasarela (`COMISION_PASARELA`).
            monto_original = float(sale.monto or 0.0)
            monto_ajustado = cash_neto(sale)

            lead_key = None
            if sale.person_uuid:
                lead_key = f"p:{sale.person_uuid}"
            elif ig_norm:
                lead_key = f"ig:{ig_norm}"
            elif nombre_norm:
                lead_key = f"nombre:{nombre_norm}"
            else:
                lead_key = f"sale:{sale.id}"

            # Si ya validamos a este lead y se determinó que no está atribuido, sumamos al acumulado
            if lead_key in unattributed_sales_map:
                unattributed_sales_map[lead_key]["monto"] += monto_ajustado
                # Mantener la fecha de la venta más antigua (primer pago)
                sale_date_str = sale.date.isoformat() if sale.date else sale.created_at.isoformat()
                if sale_date_str < unattributed_sales_map[lead_key]["date"]:
                    unattributed_sales_map[lead_key]["date"] = sale_date_str
                continue

            # La conversación de su persona (plan_personas); el IG y el nombre, solo sin persona.
            matched_lead = conversaciones_service.de_persona(sale.person_uuid)
            if not matched_lead and not sale.person_uuid and ig_norm:
                matched_lead = Conversation.query.filter(
                    db.func.lower(db.func.replace(Conversation.ig, '@', '')) == ig_norm
                ).first()

            if not matched_lead and not sale.person_uuid:
                if nombre_norm:
                    matched_lead = Conversation.query.filter(
                        db.func.lower(Conversation.name) == nombre_norm
                    ).first()

            has_attribution = False
            if matched_lead:
                closest = LeadAnswer.query.filter(
                    LeadAnswer.conversation_id == matched_lead.id,
                    LeadAnswer.ad_id != None,
                    LeadAnswer.created_at <= sale.date
                ).order_by(LeadAnswer.created_at.desc()).first()

                if closest and closest.ad_id:
                    has_attribution = True

            if not has_attribution:
                closer = (sale.raw_data or {}).get('vendedor') or (sale.raw_data or {}).get('closer') or sale.email_vendedor or 'Sin asignar'
                setter = sale.setter or 'Sin asignar'
                
                unattributed_sales_map[lead_key] = {
                    "id": sale.id,
                    "date": sale.date.isoformat() if sale.date else sale.created_at.isoformat(),
                    "cliente": contacto['nombre_cliente'] or 'Desconocido',
                    "person_uuid": sale.person_uuid,
                    "instagram": contacto['instagram'] or 'N/A',
                    "setter": setter,
                    "closer": closer,
                    "monto": monto_ajustado
                }

        # Redondear y aplicar filtros de búsqueda
        for lead_key, sale_data in unattributed_sales_map.items():
            sale_data["monto"] = round(sale_data["monto"], 2)
            
            if search_query:
                search_match = (
                    search_query in sale_data["cliente"].lower() or
                    search_query in sale_data["instagram"].lower() or
                    search_query in sale_data["setter"].lower() or
                    search_query in sale_data["closer"].lower()
                )
                if search_match:
                    unattributed_sales.append(sale_data)
            else:
                unattributed_sales.append(sale_data)

    # 2. Buscar agendas sin anuncio (Solo agendas de la fuente Elias)
    if lead_type in ('all', 'agendas'):
        agendas = FinancialAgenda.query.filter(
            FinancialAgenda.date >= start_dt,
            FinancialAgenda.date <= end_dt
        ).order_by(FinancialAgenda.date.desc()).all()
        agenda_contacto_service.precargar(agendas)

        for agenda in agendas:
            # Las agendas desatribuidas deben ser las que tengan como fuente "Elias"
            nombre_val = str(agenda.nombre or '').strip().lower()
            raw = agenda.raw_data or {}
            fuente_raw = str(raw.get('fuente') or raw.get('fuente_form') or raw.get('setter') or '').strip().lower()
            if 'elias' not in nombre_val and 'elias' not in fuente_raw:
                continue

            contacto = agenda.contacto()  # de su persona; la copia si no tiene
            ig_val = contacto['instagram'] or raw.get('instagram') or raw.get('ig')
            ig_norm = normalize_ig(ig_val)
            nombre_norm = (contacto['lead'] or '').strip().lower()

            lead_key = None
            if agenda.person_uuid:
                lead_key = f"p:{agenda.person_uuid}"
            elif ig_norm:
                lead_key = f"ig:{ig_norm}"
            elif nombre_norm:
                lead_key = f"nombre:{nombre_norm}"

            if lead_key and lead_key in seen_agenda_leads:
                continue

            # La conversación de su persona (plan_personas); el IG y el nombre, de respaldo.
            matched_lead = conversaciones_service.de_persona(agenda.person_uuid)
            if not matched_lead and ig_norm:
                matched_lead = Conversation.query.filter(
                    db.func.lower(db.func.replace(Conversation.ig, '@', '')) == ig_norm
                ).first()

            if not matched_lead:
                if nombre_norm:
                    matched_lead = Conversation.query.filter(
                        db.func.lower(Conversation.name) == nombre_norm
                    ).first()

            has_attribution = False
            if matched_lead:
                closest = LeadAnswer.query.filter(
                    LeadAnswer.conversation_id == matched_lead.id,
                    LeadAnswer.ad_id != None,
                    LeadAnswer.created_at <= agenda.date
                ).order_by(LeadAnswer.created_at.desc()).first()

                if closest and closest.ad_id:
                    has_attribution = True

            if not has_attribution:
                if lead_key:
                    seen_agenda_leads.add(lead_key)

                setter = agenda.nombre or 'Sin asignar'
                closer = agenda.closer or 'Sin asignar'
                
                agenda_data = {
                    "id": agenda.id,
                    "date": agenda.date.isoformat() if agenda.date else agenda.created_at.isoformat(),
                    "cliente": contacto['lead'] or 'Desconocido',
                    "person_uuid": agenda.person_uuid,
                    "instagram": contacto['instagram'] or 'N/A',
                    "setter": setter,
                    "closer": closer,
                    "whatsapp": contacto['whatsapp'] or 'N/A',
                    "fecha_meet": agenda.fecha_meet or 'N/A'
                }
                
                if search_query:
                    search_match = (
                        search_query in agenda_data["cliente"].lower() or
                        search_query in agenda_data["instagram"].lower() or
                        search_query in agenda_data["setter"].lower() or
                        search_query in agenda_data["closer"].lower()
                    )
                    if search_match:
                        unattributed_agendas.append(agenda_data)
                else:
                    unattributed_agendas.append(agenda_data)

    return jsonify({
        "summary": {
            "unattributed_sales": len(unattributed_sales),
            "unattributed_agendas": len(unattributed_agendas),
            "total_unattributed": len(unattributed_sales) + len(unattributed_agendas)
        },
        "sales": unattributed_sales,
        "agendas": unattributed_agendas
    }), 200


@bp.route('/public/marketing/manual-attribution-agenda', methods=['POST'])
def force_manual_attribution_agenda():
    """Asocia un anuncio a una agenda insertando lead e interaccion virtual."""
    from app.models import FinancialAgenda, Conversation, LeadAnswer, Ad
    from datetime import timedelta
    import uuid
    import logging
    logger = logging.getLogger(__name__)

    data = request.json or {}
    raw_agenda_id = data.get('agenda_id')
    raw_ad_id = data.get('ad_id')
    instagram_input = data.get('instagram')

    if not raw_agenda_id or not raw_ad_id or not instagram_input:
        return jsonify({"error": "Faltan parametros requeridos"}), 400

    # Conversión segura de IDs para consistencia en bases relacionales
    try:
        agenda_id = int(raw_agenda_id)
        ad_id = int(raw_ad_id)
    except (ValueError, TypeError) as e:
        logger.error(f"Error de casteo en atribucion manual de agenda: agenda_id={raw_agenda_id}, ad_id={raw_ad_id}. Detalle: {str(e)}")
        return jsonify({"error": "Los IDs de agenda y anuncio deben ser enteros válidos"}), 400

    # Validar que exista la agenda
    agenda = FinancialAgenda.query.get(agenda_id)
    if not agenda:
        logger.error(f"Atribucion fallida: No se encontro la agenda con ID={agenda_id}")
        return jsonify({"error": f"No se encontró la agenda con ID {agenda_id}"}), 404

    # Validar que exista el anuncio
    ad_exists = Ad.query.get(ad_id)
    if not ad_exists:
        logger.error(f"Atribucion fallida: No se encontro el anuncio con ID={ad_id}")
        return jsonify({"error": f"El anuncio con ID {ad_id} no existe en la base de datos"}), 404

    # Normalizar IG y anotarlo en la persona de la agenda (Etapa 2c: la agenda no guarda el contacto)
    ig_normalizado = instagram_input.strip().lstrip('@').lower()
    if agenda.person_uuid:
        _sumar_instagram(agenda.person, ig_normalizado, f'agenda #{agenda.id}')
    else:
        from app.services import agenda_contacto_service
        agenda_contacto_service.dar_persona(agenda, instagram=ig_normalizado)

    # Buscar/crear lead de Manychat: el del IG que se escribió y, si no hay, el de la persona de la agenda
    matched_lead = Conversation.query.filter(
        db.func.lower(db.func.replace(Conversation.ig, '@', '')) == ig_normalizado
    ).first() or conversaciones_service.de_persona(agenda.person_uuid)

    if not matched_lead:
        cliente_nombre = _nombre_del_lead(agenda) or 'Desconocido'
        matched_lead = Conversation(
            external_id=f"manual_agenda_{agenda.id}_{uuid.uuid4().hex[:6]}",
            name=cliente_nombre,
            ig=f"@{ig_normalizado}",
            follower=False
        )
        db.session.add(matched_lead)
        db.session.flush()

    # Interaccion virtual un minuto antes (reutilizar si ya existe para evitar duplicados)
    fake_time = agenda.date - timedelta(minutes=1) if agenda.date else db.func.now()
    
    answer = LeadAnswer.query.filter_by(conversation_id=matched_lead.id).first()
    if answer:
        answer.ad_id = ad_id
        answer.qualification = "true"
        answer.updated_at = fake_time
    else:
        answer = LeadAnswer(
            conversation_id=matched_lead.id,
            ad_id=ad_id,
            keyword="manual_attribution",
            qualification="true",
            created_at=fake_time,
            updated_at=fake_time
        )
        db.session.add(answer)
    
    # Sincronizar hacia NeurOPS Client y Appointment para asociar el lead a su agenda
    from app.models import Client, Appointment
    client_match = Client.query.filter(
        db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig_normalizado
    ).first()
    
    lead_nombre = _nombre_del_lead(agenda)
    if not client_match and lead_nombre:
        client_match = Client.query.filter(
            db.func.lower(Client.full_name) == lead_nombre.strip().lower()
        ).first()
        
    if client_match:
        client_match.instagram = f"@{ig_normalizado}"
        appt_match = Appointment.query.filter_by(client_id=client_match.id).order_by(Appointment.start_time.desc()).first()
        if appt_match:
            appt_match.keyword = ad_exists.keyword

    try:
        db.session.commit()
        
        # Forzar timestamps post-commit
        answer.created_at = fake_time
        answer.updated_at = fake_time
        db.session.commit()

        return jsonify({
            "message": "Atribucion de agenda completada.",
            "agenda_id": agenda.id,
            "lead_id": matched_lead.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error de base de datos en atribucion de agenda: {str(e)}")
        return error_interno(e, 'Error interno al guardar')

