from flask import request, jsonify
from app.models import db, FinancialAgenda
from datetime import datetime
from . import bp
from sqlalchemy import or_, func

@bp.route('/public/financial-agendas', methods=['POST'])
def receive_financial_agendas():
    # Recibe datos de agendas desde Excel/Apps Script/n8n
    from flask import current_app
    
    data = request.get_json() or {}
    items = data if isinstance(data, list) else [data]
    
    saved = 0
    for item in items:
        if 'fuente' in item:
            setter = item.get('fuente')
            lead_val = item.get('nombre') or item.get('cliente') or item.get('lead') or 'Desconocido'
        elif 'setter' in item or 'setter_name' in item or 'vendedor' in item:
            setter = item.get('setter') or item.get('setter_name') or item.get('vendedor')
            lead_val = item.get('lead') or item.get('cliente') or item.get('nombre') or 'Desconocido'
        elif 'lead' in item and 'nombre' in item:
            setter = item.get('lead')
            lead_val = item.get('nombre')
        else:
            setter = item.get('nombre') or item.get('setter') or 'Sin asignar'
            lead_val = item.get('lead') or item.get('cliente') or 'Desconocido'

        if not setter:
            setter = 'Sin asignar'

        dt_str = item.get('fecha') or item.get('date') or item.get('registro')
        agenda_date = datetime.utcnow()
        if dt_str:
            try:
                from dateutil import parser
                agenda_date = parser.parse(str(dt_str))
            except: pass

        agenda = FinancialAgenda(
            nombre=str(setter).strip(),
            lead=str(lead_val).strip(),
            closer=item.get('closer') or item.get('vendedor') or 'Sin asignar',
            fecha_meet=dt_str or str(agenda_date),
            date=agenda_date,
            instagram=item.get('instagram') or item.get('ig') or 'N/A',
            whatsapp=item.get('whatsapp') or item.get('phone') or 'N/A',
            mail=item.get('mail') or item.get('email') or 'N/A',
            estado=item.get('estado') or 'Pendiente',
            raw_data=item
        )
        db.session.add(agenda)
        saved += 1
        
    db.session.commit()
    return jsonify({"message": f"{saved} agenda records saved", "saved": saved}), 201

@bp.route('/public/financial-agendas/sync', methods=['POST'])
def sync_financial_agendas_from_sheets():
    # Deshabilitado en favor de n8n
    return jsonify({"message": "La sincronización de agendas desde Google Sheets ha sido deshabilitada en favor de n8n."}), 200

@bp.route('/public/financial-agendas', methods=['GET'])
def get_financial_agendas():
    # Retorna todas las agendas financieras con filtros
    page = request.args.get('page', default=None, type=int)
    limit = request.args.get('limit', default=10, type=int)
    search = request.args.get('search', default='', type=str).strip()
    start_date_str = request.args.get('start_date', default='', type=str).strip()
    end_date_str = request.args.get('end_date', default='', type=str).strip()
    
    estado = request.args.get('estado', default='', type=str).strip()
    closer = request.args.get('closer', default='', type=str).strip()
    fuente = request.args.get('fuente', default='', type=str).strip()
    
    query = FinancialAgenda.query
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(or_(
            FinancialAgenda.lead.ilike(search_pattern),
            FinancialAgenda.nombre.ilike(search_pattern),
            FinancialAgenda.closer.ilike(search_pattern),
            FinancialAgenda.mail.ilike(search_pattern),
            FinancialAgenda.whatsapp.ilike(search_pattern)
        ))
        
    # Consulta base filtrada únicamente por fechas
    date_query = FinancialAgenda.query
    
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            date_query = date_query.filter(FinancialAgenda.date >= start_date)
        except ValueError:
            pass
            
    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            date_query = date_query.filter(FinancialAgenda.date <= end_date)
        except ValueError:
            pass

    # La consulta principal aplica además los filtros específicos de estado, closer y fuente
    query = date_query
    
    if estado:
        query = query.filter(FinancialAgenda.estado == estado)
    if closer:
        query = query.filter(FinancialAgenda.closer == closer)
    if fuente:
        query = query.filter(FinancialAgenda.nombre == fuente)
        
    query = query.order_by(FinancialAgenda.date.desc())
    
    if page is not None:
        agendas_pagination = query.paginate(page=page, per_page=limit, error_out=False)
        total_count = query.count()
        upcoming_count = query.filter(FinancialAgenda.date >= datetime.utcnow()).count()
        
        closer_counts = db.session.query(
            FinancialAgenda.closer, 
            func.count(FinancialAgenda.id)
        ).filter(
            FinancialAgenda.id.in_(query.with_entities(FinancialAgenda.id))
        ).group_by(FinancialAgenda.closer).all()
        
        by_closer = {closer or 'Sin Asignar': count for closer, count in closer_counts}
        
        # Obtener closers y fuentes únicas para el periodo de fechas seleccionado
        closers_query = db.session.query(FinancialAgenda.closer).distinct().filter(
            FinancialAgenda.id.in_(date_query.with_entities(FinancialAgenda.id))
        ).all()
        sources_query = db.session.query(FinancialAgenda.nombre).distinct().filter(
            FinancialAgenda.id.in_(date_query.with_entities(FinancialAgenda.id))
        ).all()
        
        unique_closers = sorted(list(set([c[0].strip() for c in closers_query if c[0] and c[0].strip()])))
        
        # Filtrar fuentes para evitar nombres de clientes obvios
        known_setters_lower = {
            'elias', 'workshop', 'vsl', 'marketing', 'organico', 'orgánico',
            'sin asignar', 'sin_asignar', 'facebook', 'instagram', 'youtube',
            'tiktok', 'manychat', 'workshop manychat', 'ads', 'setter', 'organica'
        }
        
        raw_sources = [s[0].strip() for s in sources_query if s[0] and s[0].strip()]
        unique_sources = []
        for src in raw_sources:
            if len(src.split()) > 2:
                continue
            src_lower = src.lower()
            if src_lower in known_setters_lower:
                unique_sources.append(src)
            elif len(src.split()) == 1:
                unique_sources.append(src)
            elif len(src.split()) == 2:
                words = [w.lower() for w in src.split()]
                if any(w in known_setters_lower for w in words):
                    unique_sources.append(src)
                    
        unique_sources = sorted(list(set(unique_sources)))
        
        return jsonify({
            "data": [a.to_dict() for a in agendas_pagination.items],
            "total": total_count,
            "upcoming_count": upcoming_count,
            "by_closer": by_closer,
            "unique_states": ['Pendiente', 'Show Up', 'No show', 'Reagendada', 'Cancelada'],
            "unique_closers": unique_closers,
            "unique_sources": unique_sources,
            "page": agendas_pagination.page,
            "pages": agendas_pagination.pages,
            "has_more": agendas_pagination.has_next
        }), 200
    else:
        agendas = query.all()
        return jsonify([a.to_dict() for a in agendas]), 200

@bp.route('/public/financial-agendas/<int:agenda_id>', methods=['PUT', 'OPTIONS'])
def update_financial_agenda(agenda_id):
    # Actualiza una agenda financiera
    if request.method == 'OPTIONS':
        return '', 204
        
    data = request.json or {}
    agenda = FinancialAgenda.query.get(agenda_id)
    if not agenda:
        return jsonify({"error": "Agenda no encontrada"}), 404
        
    try:
        if 'nombre' in data:
            agenda.nombre = data['nombre']
        if 'lead' in data:
            agenda.lead = data['lead']
        if 'closer' in data:
            agenda.closer = data['closer']
        if 'fecha_meet' in data:
            agenda.fecha_meet = data['fecha_meet']
        if 'instagram' in data:
            agenda.instagram = data['instagram']
        if 'whatsapp' in data:
            agenda.whatsapp = data['whatsapp']
        if 'mail' in data:
            agenda.mail = data['mail']
        if 'estado' in data:
            agenda.estado = data['estado']
        if 'date' in data:
            try:
                from dateutil import parser
                agenda.date = parser.parse(str(data['date']))
            except: pass
            
        db.session.commit()
        return jsonify({"message": "Agenda actualizada correctamente", "agenda": agenda.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-agendas/<int:agenda_id>', methods=['DELETE'])
def delete_financial_agenda(agenda_id):
    # Elimina un registro de agenda financiera
    agenda = FinancialAgenda.query.get(agenda_id)
    if not agenda:
        return jsonify({"error": "Agenda no encontrada"}), 404
        
    try:
        db.session.delete(agenda)
        db.session.commit()
        return jsonify({"message": "Agenda eliminada correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-agendas/repair-db', methods=['POST'])
def repair_financial_agendas_db():
    # Corrige de forma selectiva registros históricos de agendas
    setters_known = {
        'elias', 'workshop', 'vsl', 'marketing', 'organico', 'orgánico',
        'sin asignar', 'sin_asignar', 'facebook', 'instagram', 'youtube',
        'tiktok', 'manychat', 'workshop manychat'
    }
    
    try:
        agendas = FinancialAgenda.query.all()
        corrected_n8n = 0
        restored_sheets = 0
        
        for agenda in agendas:
            if agenda.raw_data and isinstance(agenda.raw_data, dict):
                raw = agenda.raw_data
                raw_lead = raw.get('lead')
                raw_nombre = raw.get('nombre')
                
                lead_str = str(raw_lead).strip() if raw_lead else ""
                nombre_str = str(raw_nombre).strip() if raw_nombre else ""
                
                orig_nombre = agenda.nombre
                orig_lead = agenda.lead
                
                if lead_str.lower() in setters_known:
                    agenda.nombre = lead_str
                    agenda.lead = nombre_str
                    if agenda.nombre != orig_nombre or agenda.lead != orig_lead:
                        corrected_n8n += 1
                elif nombre_str.lower() in setters_known:
                    agenda.nombre = nombre_str
                    agenda.lead = lead_str
                    if agenda.nombre != orig_nombre or agenda.lead != orig_lead:
                        restored_sheets += 1
                elif 'entrevista' in lead_str.lower() or 'consultor' in lead_str.lower() or 'sesi' in lead_str.lower() or 'reagenda' in lead_str.lower() or 'referido' in lead_str.lower():
                    agenda.nombre = nombre_str
                    agenda.lead = lead_str
                    if agenda.nombre != orig_nombre or agenda.lead != orig_lead:
                        restored_sheets += 1
                else:
                    agenda.nombre = nombre_str if raw_nombre else None
                    agenda.lead = lead_str if raw_lead else None
                    if agenda.nombre != orig_nombre or agenda.lead != orig_lead:
                        restored_sheets += 1

        db.session.commit()
        return jsonify({
            "status": "success",
            "message": "Reparación completada",
            "corrected_n8n": corrected_n8n,
            "restored_sheets": restored_sheets
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
