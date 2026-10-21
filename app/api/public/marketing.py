# pyrefly: ignore [missing-import]
from flask import request, jsonify
from app.models import db, User
from flask_login import current_user
from app.services import agenda_contacto_service
from app.services import conversaciones_service
from app.services.commission_service import cash_neto_de
from app.services.identity_service import normalize_ig
from . import bp
import json
import requests

# ============================================================
# ADS MANAGEMENT (Público)
# ============================================================

def ensure_inbound_ad_exists():
    """Garantiza la existencia del anuncio ficticio Inbound en la base de datos."""
    from app.models import Campaign, AdSet, Ad
    try:
        # 1. Buscar o crear la campaña Inbound
        campaign = Campaign.query.filter_by(name='Inbound').first()
        if not campaign:
            campaign = Campaign(
                name='Inbound',
                status='active',
                type='organic',
                external_id='CAM-INBOUND'
            )
            db.session.add(campaign)
            db.session.flush()

        # 2. Buscar o crear el AdSet Inbound Grupo
        ad_set = AdSet.query.filter_by(campaign_id=campaign.id, name='Inbound Grupo').first()
        if not ad_set:
            ad_set = AdSet(
                name='Inbound Grupo',
                campaign_id=campaign.id,
                status='active',
                external_id='SET-INBOUND'
            )
            db.session.add(ad_set)
            db.session.flush()

        # 3. Buscar o crear el anuncio Inbound
        ad = Ad.query.filter_by(ad_set_id=ad_set.id, keyword='Inbound').first()
        if not ad:
            ad = Ad(
                name='Inbound',
                ad_set_id=ad_set.id,
                keyword='Inbound',
                status='active',
                total_spend=0.0,
                external_id='ADS-INBOUND'
            )
            db.session.add(ad)
            db.session.commit()
        elif ad.name != 'Inbound':
            ad.name = 'Inbound'
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f"Error al asegurar ad Inbound: {str(e)}")

@bp.route('/public/ads', methods=['GET'])
def get_public_ads():
    """Lista todos los anuncios con spend acumulado y leads, y sus relaciones de campaña."""
    ensure_inbound_ad_exists()
    from app.models import Ad, AdPeriodSpend, ManychatAdLead, AdSet, Campaign
    # pyrefly: ignore [missing-import]
    from sqlalchemy import func

    # Join para traer AdSet y Campaign fácilmente
    ads = db.session.query(Ad, AdSet, Campaign).outerjoin(AdSet, Ad.ad_set_id == AdSet.id).outerjoin(Campaign, AdSet.campaign_id == Campaign.id).order_by(Ad.created_at.desc()).all()

    # Pre-cargar stats de leads por ad_id
    lead_stats = db.session.query(
        ManychatAdLead.ad_id,
        func.count(ManychatAdLead.id).label('total_leads'),
        func.sum(db.case((ManychatAdLead.qualification == 'true', 1), else_=0)).label('qualified_leads')
    ).group_by(ManychatAdLead.ad_id).all()
    lead_map = {s.ad_id: {'total': s.total_leads, 'qualified': int(s.qualified_leads or 0)} for s in lead_stats}

    result = []
    for a, ad_set, campaign in ads:
        total_spend = db.session.query(func.coalesce(func.sum(AdPeriodSpend.spend), 0)).filter(
            AdPeriodSpend.ad_id == a.id
        ).scalar()

        ls = lead_map.get(a.id, {'total': 0, 'qualified': 0})
        cpl = round(float(total_spend) / ls['total'], 2) if ls['total'] > 0 and float(total_spend) > 0 else 0

        result.append({
            'id': a.id,
            'ad_set_id': a.ad_set_id,
            'campaign_id': ad_set.campaign_id if ad_set else None,
            'ad_set_name': ad_set.name if ad_set else 'Sin Conjunto',
            'campaign_name': campaign.name if campaign else 'Sin Campaña',
            'name': a.name,
            'keyword': a.keyword,
            'status': a.status,
            'total_spend': round(float(total_spend), 2),
            'total_leads': ls['total'],
            'qualified_leads': ls['qualified'],
            'cost_per_lead': cpl,
            'created_at': a.created_at.isoformat() if a.created_at else None
        })

    return jsonify(result), 200


# El alta, la edición y el borrado de anuncios, campañas y conjuntos y el gasto por período vivían
# acá: los usaban Estructura e Inversión por período, que se retiraron el 14/10/2026 (los reemplazó
# la tabla por palabra clave de /api/marketing/anuncios). Las tablas siguen: el gasto cargado a mano
# suma en la tabla nueva (`anuncios_service`). El GET de arriba queda para «Sin anuncio».


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
    from app.models import FinancialSale, ManychatLead, LeadAnswer, Ad
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

    # 1. Normalizar IG y guardarlo en la venta si es diferente/nuevo
    ig_normalizado = instagram_input.strip().lstrip('@').lower()
    sale.instagram = f"@{ig_normalizado}"
    
    # 2. Buscar o crear ManychatLead: el del IG que se escribió y, si no hay, el de la persona de la venta
    matched_lead = ManychatLead.query.filter(
        db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_normalizado
    ).first() or conversaciones_service.lead_de_persona(sale.person_uuid)

    if not matched_lead:
        # Generar un ID único basado en la venta para evitar colisiones
        cliente_nombre = (sale.raw_data or {}).get('cliente') or (sale.raw_data or {}).get('nombre') or 'Desconocido'
        matched_lead = ManychatLead(
            manychat_id=f"manual_{sale.id}_{uuid.uuid4().hex[:6]}",
            name=cliente_nombre,
            ig=f"@{ig_normalizado}",
            follower=False
        )
        db.session.add(matched_lead)
        db.session.flush()

    # 3. Crear LeadAnswer (interacción de webhook falsa) un minuto antes de la venta
    fake_time = sale.date - timedelta(minutes=1) if sale.date else db.func.now()
    
    answer = LeadAnswer(
        lead_id=matched_lead.id,
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
        return jsonify({"error": f"Error interno al guardar: {str(e)}"}), 500


@bp.route('/public/marketing/unattributed-leads', methods=['GET'])
def get_unattributed_leads():
    """Obtiene ventas y agendas sin anuncio en un rango de fechas."""
    from app.models import FinancialSale, FinancialAgenda, ManychatLead, LeadAnswer
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

        for sale in sales:
            ig_val = sale.instagram or (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')
            ig_norm = normalize_ig(ig_val)
            nombre_norm = (sale.nombre_cliente or '').strip().lower()

            # El neto, sin la comisión estimada de la pasarela (`COMISION_PASARELA`).
            monto_original = float(sale.monto or 0.0)
            monto_ajustado = cash_neto_de(monto_original, sale.metodo_pago)

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

            # La conversación de su persona (plan_personas); el IG y el nombre, de respaldo.
            matched_lead = conversaciones_service.lead_de_persona(sale.person_uuid)
            if not matched_lead and ig_norm:
                matched_lead = ManychatLead.query.filter(
                    db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_norm
                ).first()

            if not matched_lead:
                if nombre_norm:
                    matched_lead = ManychatLead.query.filter(
                        db.func.lower(ManychatLead.name) == nombre_norm
                    ).first()

            has_attribution = False
            if matched_lead:
                closest = LeadAnswer.query.filter(
                    LeadAnswer.lead_id == matched_lead.id,
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
                    "cliente": sale.nombre_cliente or 'Desconocido',
                    "person_uuid": sale.person_uuid,
                    "instagram": sale.instagram or 'N/A',
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
            matched_lead = conversaciones_service.lead_de_persona(agenda.person_uuid)
            if not matched_lead and ig_norm:
                matched_lead = ManychatLead.query.filter(
                    db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_norm
                ).first()

            if not matched_lead:
                if nombre_norm:
                    matched_lead = ManychatLead.query.filter(
                        db.func.lower(ManychatLead.name) == nombre_norm
                    ).first()

            has_attribution = False
            if matched_lead:
                closest = LeadAnswer.query.filter(
                    LeadAnswer.lead_id == matched_lead.id,
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
    from app.models import FinancialAgenda, ManychatLead, LeadAnswer, Ad
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

    # Normalizar IG y guardar
    ig_normalizado = instagram_input.strip().lstrip('@').lower()
    agenda.instagram = f"@{ig_normalizado}"
    # Lo que se muestra sale de la persona: si no tenía instagram, queda éste como principal.
    if agenda.person is not None and not agenda.person.instagram:
        from app.services import person_service
        try:
            person_service.hacer_principal(agenda.person, 'instagram', ig_normalizado, current_user,
                                           reason='atribución de agenda')
        except ValueError as e:
            logger.error(f"[ATRIBUCION] instagram inválido para la persona de la agenda #{agenda.id}: {e}")

    # Buscar/crear lead de Manychat: el del IG que se escribió y, si no hay, el de la persona de la agenda
    matched_lead = ManychatLead.query.filter(
        db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_normalizado
    ).first() or conversaciones_service.lead_de_persona(agenda.person_uuid)

    if not matched_lead:
        cliente_nombre = agenda.nombre or 'Desconocido'
        matched_lead = ManychatLead(
            manychat_id=f"manual_agenda_{agenda.id}_{uuid.uuid4().hex[:6]}",
            name=cliente_nombre,
            ig=f"@{ig_normalizado}",
            follower=False
        )
        db.session.add(matched_lead)
        db.session.flush()

    # Interaccion virtual un minuto antes (reutilizar si ya existe para evitar duplicados)
    fake_time = agenda.date - timedelta(minutes=1) if agenda.date else db.func.now()
    
    answer = LeadAnswer.query.filter_by(lead_id=matched_lead.id).first()
    if answer:
        answer.ad_id = ad_id
        answer.qualification = "true"
        answer.updated_at = fake_time
    else:
        answer = LeadAnswer(
            lead_id=matched_lead.id,
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
    
    lead_nombre = agenda.contacto()['lead']
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
        return jsonify({"error": f"Error interno al guardar: {str(e)}"}), 500

