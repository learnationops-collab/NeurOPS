from flask import request, jsonify
from app.models import db, FinancialAgenda
from datetime import datetime
from . import bp
from sqlalchemy import or_, func

def parse_date_robustly(val):
    if not val:
        return datetime.utcnow()
    val_str = str(val).strip()
    try:
        from dateutil import parser
        if '-' in val_str and val_str.find('-') == 4:
            return parser.parse(val_str, dayfirst=False)
        if '/' in val_str:
            parts = val_str.split('/')
            if len(parts) > 0 and len(parts[0]) <= 2:
                return parser.parse(val_str, dayfirst=True)
        return parser.parse(val_str)
    except:
        return datetime.utcnow()

@bp.route('/public/financial-agendas', methods=['POST'])
def receive_financial_agendas():
    # Recibe datos de agendas desde Excel/Apps Script/n8n
    from flask import current_app
    
    data = request.get_json() or {}
    items = data if isinstance(data, list) else [data]
    
    saved = 0
    agendas_created = []
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
            agenda_date = parse_date_robustly(dt_str)

        # Buscar duplicados en el mismo dia para el mismo lead
        existing = None
        ig_val = item.get('instagram') or item.get('ig')
        ig_norm = None
        if ig_val and isinstance(ig_val, str) and ig_val.lower() not in ('n/a', ''):
            ig_norm = ig_val.strip().lstrip('@').lower()
        
        mail_val = (item.get('mail') or item.get('email') or '').strip().lower()
        phone_val = (item.get('whatsapp') or item.get('phone') or '').strip()
        
        client_filters = []
        if ig_norm and ig_norm != 'n/a':
            client_filters.append(func.lower(func.replace(FinancialAgenda.instagram, '@', '')) == ig_norm)
        if mail_val and mail_val != 'n/a' and '@' in mail_val:
            client_filters.append(func.lower(FinancialAgenda.mail) == mail_val)
        if phone_val and phone_val != 'n/a':
            client_filters.append(FinancialAgenda.whatsapp.like(f"%{phone_val}%"))

        if client_filters and agenda_date:
            start_day = agenda_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_day = agenda_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            existing = FinancialAgenda.query.filter(
                or_(*client_filters),
                FinancialAgenda.date >= start_day,
                FinancialAgenda.date <= end_day
            ).first()

        if existing:
            # Actualizar datos de agenda existente
            existing.nombre = str(setter).strip()
            existing.lead = str(lead_val).strip()
            existing.closer = item.get('closer') or item.get('vendedor') or existing.closer
            existing.fecha_meet = dt_str or existing.fecha_meet
            existing.date = agenda_date
            existing.estado = item.get('estado') or existing.estado
            existing.raw_data = item
            agendas_created.append(existing)
        else:
            # Crear nueva agenda si no existe duplicado
            agenda = FinancialAgenda(
                nombre=str(setter).strip(),
                lead=str(lead_val).strip(),
                closer=item.get('closer') or item.get('vendedor') or 'Sin asignar',
                fecha_meet=dt_str or str(agenda_date),
                date=agenda_date,
                registro=item.get('registro') or item.get('fecha') or datetime.utcnow().isoformat(),
                instagram=item.get('instagram') or item.get('ig') or 'N/A',
                whatsapp=item.get('whatsapp') or item.get('phone') or 'N/A',
                mail=item.get('mail') or item.get('email') or 'N/A',
                estado=item.get('estado') or 'Pendiente',
                raw_data=item
            )
            db.session.add(agenda)
            agendas_created.append(agenda)
            saved += 1
        
    db.session.commit()

    # Sincronización en tiempo real con Appointments
    try:
        from app.services.booking_service import BookingService
        for agenda in agendas_created:
            BookingService.sync_financial_agenda_to_appointment(agenda)
    except Exception as sync_err:
        current_app.logger.error(f"[SYNC ERROR] No se pudo sincronizar cita: {sync_err}")

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
    date_filter_by = request.args.get('date_filter_by', default='meet', type=str).strip().lower()
    
    estado = request.args.get('estado', default='', type=str).strip()
    closer = request.args.get('closer', default='', type=str).strip()
    fuente = request.args.get('fuente', default='', type=str).strip()
    
    # Consulta base filtrada únicamente por fechas
    date_query = FinancialAgenda.query
    
    if date_filter_by == 'created':
        if start_date_str:
            date_query = date_query.filter(FinancialAgenda.registro >= start_date_str)
        if end_date_str:
            date_query = date_query.filter(FinancialAgenda.registro <= f"{end_date_str}T23:59:59")
    else:
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

    # La consulta principal aplica además los filtros específicos de estado, closer, fuente y búsqueda
    query = date_query
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(or_(
            FinancialAgenda.lead.ilike(search_pattern),
            FinancialAgenda.nombre.ilike(search_pattern),
            FinancialAgenda.closer.ilike(search_pattern),
            FinancialAgenda.mail.ilike(search_pattern),
            FinancialAgenda.whatsapp.ilike(search_pattern)
        ))
    
    if estado:
        query = query.filter(FinancialAgenda.estado == estado)
    if closer:
        query = query.filter(FinancialAgenda.closer == closer)
    if fuente:
        query = query.filter(FinancialAgenda.nombre == fuente)
        
    if date_filter_by == 'created':
        query = query.order_by(FinancialAgenda.registro.desc())
    else:
        query = query.order_by(FinancialAgenda.date.desc())
    
    if page is not None:
        agendas_pagination = query.paginate(page=page, per_page=limit, error_out=False)
        total_count = query.count()
        upcoming_count = query.filter(FinancialAgenda.date >= datetime.utcnow()).count()
        
        # Obtener todas las agendas del periodo filtrado para las agregaciones
        all_agendas = query.all()
        
        # Mapear ventas asociadas a las agendas en una sola consulta
        from app.models import FinancialSale
        emails = {a.mail.strip().lower() for a in all_agendas if a.mail and a.mail.lower() not in ('n/a', '')}
        instagrams = {a.instagram.strip().replace('@', '').lower() for a in all_agendas if a.instagram and a.instagram.lower() not in ('n/a', '')}
        
        sales_by_email = {}
        sales_by_ig = {}
        if emails or instagrams:
            sales_filters = []
            if instagrams:
                sales_filters.append(func.lower(func.replace(FinancialSale.instagram, '@', '')).in_(list(instagrams)))
            if emails:
                sales_filters.append(func.lower(FinancialSale.mail_cliente).in_(list(emails)))
            
            sales = FinancialSale.query.filter(or_(*sales_filters)).all()
            for s in sales:
                if s.mail_cliente:
                    m = s.mail_cliente.strip().lower()
                    if m not in sales_by_email: sales_by_email[m] = []
                    sales_by_email[m].append(s)
                if s.instagram:
                    ig = s.instagram.strip().replace('@', '').lower()
                    if ig not in sales_by_ig: sales_by_ig[ig] = []
                    sales_by_ig[ig].append(s)
                    
        def get_agenda_sales_count(agenda):
            ig_clean = agenda.instagram.strip().replace('@', '').lower() if agenda.instagram and agenda.instagram.lower() not in ('n/a', '') else None
            mail_clean = agenda.mail.strip().lower() if agenda.mail and agenda.mail.lower() not in ('n/a', '') else None
            associated_sales = set()
            if ig_clean and ig_clean in sales_by_ig:
                for s in sales_by_ig[ig_clean]: associated_sales.add(s.id)
            if mail_clean and mail_clean in sales_by_email:
                for s in sales_by_email[mail_clean]: associated_sales.add(s.id)
            return len(associated_sales)

        # Agrupaciones en memoria en Python
        by_closer = {}
        by_closer_state = {}
        by_source_state = {}
        
        known_setters_lower = {
            'elias', 'workshop', 'vsl', 'marketing', 'organico', 'orgánico',
            'sin asignar', 'sin_asignar', 'facebook', 'instagram', 'youtube',
            'tiktok', 'manychat', 'workshop manychat', 'ads', 'setter', 'organica'
        }
        
        for a in all_agendas:
            c_name = (a.closer or 'Sin Asignar').strip()
            st_name = a.estado or 'Pendiente'
            s_count = get_agenda_sales_count(a)
            
            # by_closer
            by_closer[c_name] = by_closer.get(c_name, 0) + 1
            
            # by_closer_state
            if c_name not in by_closer_state:
                by_closer_state[c_name] = {
                    "total": 0,
                    "Pendiente": 0,
                    "Show Up": 0,
                    "No show": 0,
                    "Reagendada": 0,
                    "Cancelada": 0,
                    "cierres": 0
                }
            if st_name in by_closer_state[c_name]:
                by_closer_state[c_name][st_name] += 1
            by_closer_state[c_name]["total"] += 1
            by_closer_state[c_name]["cierres"] += s_count
            
            # by_source_state
            s_name = (a.nombre or 'Sin Asignar').strip()
            if len(s_name.split()) > 2:
                continue
            s_name_lower = s_name.lower()
            if s_name_lower not in known_setters_lower and len(s_name.split()) == 2:
                words = [w.lower() for w in s_name.split()]
                if not any(w in known_setters_lower for w in words):
                    continue
                    
            if s_name not in by_source_state:
                by_source_state[s_name] = {
                    "total": 0,
                    "Pendiente": 0,
                    "Show Up": 0,
                    "No show": 0,
                    "Reagendada": 0,
                    "Cancelada": 0,
                    "cierres": 0
                }
            if st_name in by_source_state[s_name]:
                by_source_state[s_name][st_name] += 1
            by_source_state[s_name]["total"] += 1
            by_source_state[s_name]["cierres"] += s_count
        
        # Obtener closers y fuentes únicas para el periodo de fechas seleccionado
        closers_query = db.session.query(FinancialAgenda.closer).distinct().filter(
            FinancialAgenda.id.in_(date_query.with_entities(FinancialAgenda.id))
        ).all()
        sources_query = db.session.query(FinancialAgenda.nombre).distinct().filter(
            FinancialAgenda.id.in_(date_query.with_entities(FinancialAgenda.id))
        ).all()
        
        unique_closers = sorted(list(set([c[0].strip() for c in closers_query if c[0] and c[0].strip()])))
        
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
            "by_closer_state": by_closer_state,
            "by_source_state": by_source_state,
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
            agenda.date = parse_date_robustly(data['date'])
            
        db.session.commit()

        # Sincronizar la agenda editada
        try:
            from app.services.booking_service import BookingService
            BookingService.sync_financial_agenda_to_appointment(agenda)
        except Exception as sync_err:
            pass

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
        # Buscar y eliminar cita asociada si existe
        try:
            from app.models import Appointment, Client
            # Buscar el cliente asociado
            ig_norm = agenda.instagram.strip().lstrip('@').lower() if agenda.instagram else None
            email_norm = agenda.mail.strip().lower() if agenda.mail else None
            client = None
            if ig_norm or email_norm:
                client_filters = []
                if ig_norm: client_filters.append(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig_norm)
                if email_norm: client_filters.append(db.func.lower(Client.email) == email_norm)
                client = Client.query.filter(or_(*client_filters)).first()
            if client:
                start_of_day = datetime.combine(agenda.date.date(), datetime.min.time())
                end_of_day = datetime.combine(agenda.date.date(), datetime.max.time())
                appt = Appointment.query.filter(
                    Appointment.client_id == client.id,
                    Appointment.start_time >= start_of_day,
                    Appointment.start_time <= end_of_day
                ).first()
                if appt:
                    db.session.delete(appt)
        except Exception as appt_err:
            print(f"[DELETE SYNC ERROR] {appt_err}")

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

@bp.route('/public/financial-agendas/sync-appointments', methods=['POST'])
def sync_all_financial_agendas():
    """Sincroniza masivamente todas las agendas financieras con Appointments."""
    try:
        from app.services.booking_service import BookingService
        agendas = FinancialAgenda.query.all()
        synced_count = 0
        for agenda in agendas:
            appt = BookingService.sync_financial_agenda_to_appointment(agenda)
            if appt:
                synced_count += 1
        return jsonify({
            "status": "success",
            "message": f"Sincronización masiva completada. {synced_count} agendas sincronizadas con Appointments.",
            "total_agendas": len(agendas),
            "synced": synced_count
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
