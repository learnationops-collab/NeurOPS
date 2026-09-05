from flask import request, jsonify, current_app
from flask_login import login_required, current_user
from app.models import db, FinancialAgenda, User, Client
from datetime import datetime
from . import bp
from sqlalchemy import or_, and_, func

from app.services.agenda_time_service import parse_a_utc, zona_origen, limites_dia_origen


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

def _split_multi(raw_value):
    # Los filtros del tablero envian una o varias opciones separadas por coma
    if not raw_value:
        return []
    return [part.strip() for part in raw_value.split(',') if part.strip()]

def _build_agenda_queries():
    # Construye la consulta filtrada por fechas y la consulta con el resto de filtros
    # de la request actual. Devuelve (date_query, query, closer_results) donde
    # closer_results son los estados post call pedidos (se filtran en memoria porque
    # se calculan a partir de la cita asociada).
    start_date_str = request.args.get('start_date', default='', type=str).strip()
    end_date_str = request.args.get('end_date', default='', type=str).strip()
    date_filter_by = request.args.get('date_filter_by', default='meet', type=str).strip().lower()
    search = request.args.get('search', default='', type=str).strip()

    estados = _split_multi(request.args.get('estado', default='', type=str))
    closers = _split_multi(request.args.get('closer', default='', type=str))
    fuentes = _split_multi(request.args.get('fuente', default='', type=str))
    encargados_triage = _split_multi(request.args.get('encargado_triage', default='', type=str))
    closer_results = _split_multi(request.args.get('closer_result', default='', type=str))

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
                end_date = None
                if end_date_str:
                    try:
                        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
                    except ValueError:
                        pass

                # Filtro para fecha de cita (date)
                date_conds = [FinancialAgenda.date >= start_date]
                if end_date:
                    date_conds.append(FinancialAgenda.date <= end_date)

                # Filtro para fecha de seguimiento (fecha_seguimiento)
                followup_conds = [FinancialAgenda.fecha_seguimiento >= start_date_str]
                if end_date_str:
                    followup_conds.append(FinancialAgenda.fecha_seguimiento <= f"{end_date_str}T23:59:59")
                else:
                    followup_conds.append(FinancialAgenda.fecha_seguimiento <= f"{start_date_str}T23:59:59")

                date_query = date_query.filter(or_(
                    and_(*date_conds),
                    and_(*followup_conds)
                ))
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

    if estados:
        query = query.filter(FinancialAgenda.estado.in_(estados))
    if closers:
        query = query.filter(FinancialAgenda.closer.in_(closers))
    if fuentes:
        query = query.filter(FinancialAgenda.nombre.in_(fuentes))
    if encargados_triage:
        triage_conds = []
        asignados = [t for t in encargados_triage if t != 'Sin Asignar']
        if 'Sin Asignar' in encargados_triage:
            triage_conds.append(or_(FinancialAgenda.encargado_triage == None, FinancialAgenda.encargado_triage == ''))
        if asignados:
            triage_conds.append(FinancialAgenda.encargado_triage.in_(asignados))
        query = query.filter(or_(*triage_conds))

    if date_filter_by == 'created':
        query = query.order_by(FinancialAgenda.registro.desc())
    else:
        query = query.order_by(FinancialAgenda.date.desc())

    return date_query, query, closer_results

@bp.route('/public/financial-agendas', methods=['POST'])
def receive_financial_agendas():
    # Recibe datos de agendas desde Excel/Apps Script/n8n
    from flask import current_app
    
    data = request.get_json() or {}
    items = data if isinstance(data, list) else [data]
    
    saved = 0
    agendas_created = []
    for item in items:
        # Loggear el item para auditoría y diagnóstico
        current_app.logger.info(f"[n8n AGENDA WEBHOOK] Recibido item: {item}")

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
        # La columna `date` es UTC naive (la lee asi todo el sistema: las ventanas de dia de
        # user_time_service, el isoformat() de la API y el parseUtcIso() del frontend). Antes
        # aca se guardaba hora local de La Paz, y eso corria cada agenda de Calendly 4 horas
        # hacia atras -- ver app/services/agenda_time_service.py.
        agenda_date = datetime.utcnow()
        if dt_str:
            parsed_utc, traia_offset = parse_a_utc(dt_str)
            if parsed_utc:
                agenda_date = parsed_utc
                if not traia_offset:
                    # Sin offset no hay forma de saber la zona: se asume AGENDAS_SOURCE_TZ. Queda
                    # el aviso en Railway para poder pedirle a n8n que mande ISO con zona.
                    current_app.logger.warning(
                        f"[AGENDA SIN ZONA] '{dt_str}' llego sin offset; se asumio "
                        f"{zona_origen()} para convertir a UTC (lead '{lead_val}').")
            else:
                current_app.logger.warning(
                    f"[AGENDA FECHA INVALIDA] No se pudo interpretar '{dt_str}' (lead '{lead_val}').")

        import pytz
        la_paz_tz = pytz.timezone('America/La_Paz')

        # Normalizar el campo de registro a formato local de America/La_Paz
        registro_val = item.get('registro') or item.get('fecha') or datetime.now(la_paz_tz).isoformat()
        try:
            from dateutil import parser
            parsed_reg = parser.parse(str(registro_val).strip())
            if parsed_reg.tzinfo is not None:
                registro_val = parsed_reg.astimezone(la_paz_tz).replace(tzinfo=None).isoformat()
        except:
            pass

        # Buscar duplicados en el mismo dia para el mismo lead
        existing = None
        ig_val = item.get('instagram') or item.get('ig')
        ig_norm = None
        if ig_val and isinstance(ig_val, str) and ig_val.lower() not in ('n/a', ''):
            ig_norm = ig_val.strip().lstrip('@').lower()
        
        mail_val = (item.get('mail') or item.get('email') or '').strip().lower()
        phone_val = (item.get('whatsapp') or item.get('phone') or item.get('telefono') or '').strip()
        
        client_filters = []
        if ig_norm and ig_norm != 'n/a':
            client_filters.append(func.lower(func.replace(FinancialAgenda.instagram, '@', '')) == ig_norm)
        if mail_val and mail_val != 'n/a' and '@' in mail_val:
            client_filters.append(func.lower(FinancialAgenda.mail) == mail_val)
        if phone_val and phone_val != 'n/a':
            client_filters.append(FinancialAgenda.whatsapp.like(f"%{phone_val}%"))

        if client_filters and agenda_date:
            # "El mismo dia" es el dia local de la fuente, no el dia UTC: con las fechas ya
            # normalizadas a UTC, una cita de las 21:00 cae en el dia UTC siguiente y el
            # deduplicador dejaria de reconocer la agenda que acaba de reprogramarse.
            start_day, end_day = limites_dia_origen(agenda_date)
            existing = FinancialAgenda.query.filter(
                or_(*client_filters),
                FinancialAgenda.date >= start_day,
                FinancialAgenda.date <= end_day
            ).first()

        # Extraer encargado de triage de forma robusta
        encargado_triage_val = None
        for k in ['encargado_triage', 'encargado', 'triage', 'call_confirmer', 'confirmer', 'encargadotriage', 'callconfirmer']:
            val = next((item[key] for key in item if key.lower() == k), None)
            if val:
                encargado_triage_val = str(val).strip()
                break

        from app.services.booking_service import BookingService
        raw_closer = item.get('closer') or item.get('vendedor')
        grupo_val = (item.get('grupo') or '').strip() or None

        # Todos los formularios de Calendly apuntan al mismo evento, asi que este
        # webhook llega siempre con la misma fuente sin importar que setter trajo
        # al lead. Si esa persona ya completo el formulario de un setter, esa es
        # la fuente que vale. Ver app/services/fuente_formulario_service.py.
        from app.services.fuente_formulario_service import fuente_para_agenda_entrante
        setter, fuente_del_form = fuente_para_agenda_entrante(
            str(setter).strip(),
            nombre=str(lead_val).strip(),
            telefono=phone_val,
            instagram=ig_val,
            mail=mail_val
        )
        if fuente_del_form:
            # Se guarda tambien la fuente original del webhook: sirve para auditar
            # que se piso y con que, sin perder el dato que mando n8n.
            item = dict(item)
            item['fuente_webhook'] = item.get('fuente')
            item['fuente_origen'] = 'formulario_calendly'
            item['fuente'] = setter
            current_app.logger.info(
                f"[FUENTE FORM] Agenda de {lead_val}: fuente tomada del formulario -> {setter}")

        if existing:
            # Actualizar datos de agenda existente
            existing.nombre = str(setter).strip()
            existing.lead = str(lead_val).strip()
            if raw_closer:
                existing.closer = BookingService.normalize_closer_name(raw_closer)
            existing.fecha_meet = dt_str or existing.fecha_meet
            existing.date = agenda_date
            existing.registro = registro_val
            existing.estado = item.get('estado') or existing.estado
            existing.grupo = grupo_val or existing.grupo
            existing.encargado_triage = encargado_triage_val or existing.encargado_triage
            # Mail/whatsapp/instagram no se actualizaban acá: si el primer webhook del día
            # llegaba sin email (o con 'N/A') y uno posterior del mismo lead (ej. Calendly
            # reprogramado) sí lo traía, la agenda existente se quedaba con el dato viejo para
            # siempre — y ese es el valor que sync_financial_agenda_to_appointment usa después
            # para el Client. Solo se pisa cuando el valor nuevo es mejor que 'N/A'/vacío.
            if mail_val and mail_val != 'n/a' and '@' in mail_val:
                existing.mail = item.get('mail') or item.get('email')
            if phone_val and phone_val != 'n/a':
                existing.whatsapp = item.get('whatsapp') or item.get('phone') or item.get('telefono')
            if ig_norm and ig_norm != 'n/a':
                existing.instagram = item.get('instagram') or item.get('ig')
            existing.raw_data = item
            agendas_created.append(existing)
        else:
            if not (item.get('mail') or item.get('email')):
                # Sin esto, una agenda sin email de n8n queda con el string literal 'N/A' en
                # silencio (ver mail=... más abajo) y nadie se entera hasta que un closer, meses
                # después, encuentra un cliente sin correo. Deja rastro explícito en los logs de
                # Railway para poder confirmar del lado de n8n/Calendly si el mail nunca llegó.
                current_app.logger.warning(
                    f"[AGENDA SIN EMAIL] n8n mandó la agenda de '{lead_val}' sin 'mail' ni 'email' en el payload. "
                    f"Keys recibidas: {list(item.keys())}"
                )
            # Crear nueva agenda si no existe duplicado
            agenda = FinancialAgenda(
                nombre=str(setter).strip(),
                lead=str(lead_val).strip(),
                closer=BookingService.normalize_closer_name(raw_closer or 'Sin asignar'),
                fecha_meet=dt_str or str(agenda_date),
                date=agenda_date,
                registro=registro_val,
                instagram=item.get('instagram') or item.get('ig') or 'N/A',
                whatsapp=item.get('whatsapp') or item.get('phone') or item.get('telefono') or 'N/A',
                mail=item.get('mail') or item.get('email') or 'N/A',
                estado=item.get('estado') or 'Pendiente',
                grupo=grupo_val,
                encargado_triage=encargado_triage_val,
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
    #
    # BUG real encontrado (31/ago/2026): este endpoint de LECTURA tenía un efecto secundario
    # (`_ensure_clients`, eliminado) que creaba un Client nuevo por cada agenda que no matcheara
    # a uno existente por email/instagram exactos — sin fallback por teléfono. Resultado: cada
    # vez que alguien simplemente ABRÍA la lista de agendas, cualquier fila con un instagram mal
    # tipeado/distinto al ya guardado (o sin coincidencia exacta de email) generaba un cliente
    # duplicado con un email placeholder `@neurops.temp`, en vez de reusar el cliente real —
    # reportado por el usuario como clientes duplicados en el buscador y en la lista de agendas
    # del admin, que además desalineaban los dashboards (dos historiales separados para la misma
    # persona). La creación real del cliente para una agenda nueva ya ocurre, con el matcher
    # bueno (email → instagram → teléfono), en `BookingService.sync_financial_agenda_to_appointment`
    # justo al crearse la agenda (`POST /public/financial-agendas`) — un endpoint de solo lectura
    # nunca debería duplicar esa responsabilidad, y mucho menos con un matcher más débil.
    page = request.args.get('page', default=None, type=int)
    limit = request.args.get('limit', default=10, type=int)

    date_query, query, closer_results = _build_agenda_queries()
    closer_results_lower = {cr.lower() for cr in closer_results}

    all_agendas = query.all()
    
    # Obtener notificaciones no leídas para ordenar
    unread_client_ids = set()
    from flask_login import current_user
    if current_user and current_user.is_authenticated:
        from app.models import CommentNotification
        unread_client_ids = {n.client_id for n in CommentNotification.query.filter_by(user_id=current_user.id, is_read=False).all()}

    # Precalcular ventas asociadas para evitar N+1
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
                
    def get_agenda_sales_info(agenda):
        ig_clean = agenda.instagram.strip().replace('@', '').lower() if agenda.instagram and agenda.instagram.lower() not in ('n/a', '') else None
        mail_clean = agenda.mail.strip().lower() if agenda.mail and agenda.mail.lower() not in ('n/a', '') else None
        
        sales_dict = {}
        if ig_clean and ig_clean in sales_by_ig:
            for s in sales_by_ig[ig_clean]:
                sales_dict[s.id] = s
        if mail_clean and mail_clean in sales_by_email:
            for s in sales_by_email[mail_clean]:
                sales_dict[s.id] = s
                
        associated_sales = list(sales_dict.values())
        
        has_deposit = False
        has_full_sale = False
        for s in associated_sales:
            tp = (s.tipo_pago or "").lower()
            if any(w in tp for w in ["seña", "sena", "deposito", "deposit"]):
                has_deposit = True
            else:
                has_full_sale = True
        return len(associated_sales), has_deposit, has_full_sale

    # Serializar y filtrar por closer_result en memoria
    serialized_all = []
    for a in all_agendas:
        s_count, has_deposit, has_full_sale = get_agenda_sales_info(a)
        dict_agenda = a.to_dict(sales_count=s_count)
        c_id = dict_agenda.get("client_id")
        dict_agenda["unread_comment"] = c_id in unread_client_ids if c_id else False
        dict_agenda["_sales_info"] = (s_count, has_deposit, has_full_sale)
        
        if closer_results_lower:
            agenda_closer_res = dict_agenda.get("closer_result") or "Pendiente"
            if agenda_closer_res.strip().lower() not in closer_results_lower:
                continue
                
        serialized_all.append(dict_agenda)

    # Agrupaciones en memoria en Python a partir de los datos finales filtrados
    by_closer = {}
    by_closer_state = {}
    by_source_state = {}
    
    known_setters_lower = {
        'elias', 'workshop', 'vsl', 'marketing', 'organico', 'orgánico',
        'sin asignar', 'sin_asignar', 'facebook', 'instagram', 'youtube',
        'tiktok', 'manychat', 'workshop manychat', 'ads', 'setter', 'organica'
    }
    
    for x in serialized_all:
        c_name = (x.get("closer") or 'Sin Asignar').strip()
        st_name = (x.get("closer_result") or 'Pendiente').strip()
        s_count, has_deposit, has_full_sale = x["_sales_info"]
        
        # by_closer
        by_closer[c_name] = by_closer.get(c_name, 0) + 1
        
        # by_closer_state
        if c_name not in by_closer_state:
            by_closer_state[c_name] = {
                "total": 0,
                "Pendiente": 0,
                "Contactado": 0,
                "Confirmado": 0,
                "Reagendada": 0,
                "Cancelada": 0,
                "Cerrada": 0,
                "Show Up": 0,
                "No Show": 0,
                "2TH Call": 0,
                "Ventas": 0,
                "Depósitos": 0,
                "Follow Ups": 0,
                "No Leads": 0
            }
        
        state_key = None
        if st_name == 'Pendiente': state_key = 'Pendiente'
        elif st_name == 'Contactado': state_key = 'Contactado'
        elif st_name == 'Confirmado': state_key = 'Confirmado'
        elif st_name in ('Reagendada', 'Reprogramada', 'Reagendado', 'Reprogramado'): state_key = 'Reagendada'
        elif st_name in ('Cancelada', 'Cancelado'): state_key = 'Cancelada'
        elif st_name in ('Cerrada', 'Cerrado'): state_key = 'Cerrada'
        elif st_name.lower() == 'no show': state_key = 'No Show'
        elif st_name in ('2TH Call', '2da Call', '2nd Call', '2da call', '2TH call', 'Segunda llamada', 'Segunda agenda'): state_key = '2TH Call'
        elif st_name in ('Show Up', 'Show up', 'completada', 'Completada', 'Follow Up', 'Follow Ups', 'follow_up', 'No Lead', 'No Leads', 'no_lead'):
            state_key = 'Show Up'
        
        if state_key:
            by_closer_state[c_name][state_key] += 1
        
        if state_key == 'Show Up':
            if s_count > 0:
                if has_full_sale:
                    by_closer_state[c_name]["Ventas"] += 1
                elif has_deposit:
                    by_closer_state[c_name]["Depósitos"] += 1
            else:
                if st_name in ('No Lead', 'No Leads', 'no_lead'):
                    by_closer_state[c_name]["No Leads"] += 1
                else:
                    by_closer_state[c_name]["Follow Ups"] += 1
        
        by_closer_state[c_name]["total"] += 1
        
        # by_source_state
        s_name = (x.get("nombre") or 'Sin Asignar').strip()
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
                "Contactado": 0,
                "Confirmado": 0,
                "Reagendada": 0,
                "Cancelada": 0,
                "Cerrada": 0,
                "Show Up": 0,
                "No Show": 0,
                "2TH Call": 0,
                "Ventas": 0,
                "Depósitos": 0,
                "Follow Ups": 0,
                "No Leads": 0
            }
        if state_key:
            by_source_state[s_name][state_key] += 1
            
        if state_key == 'Show Up':
            if s_count > 0:
                if has_full_sale:
                    by_source_state[s_name]["Ventas"] += 1
                elif has_deposit:
                    by_source_state[s_name]["Depósitos"] += 1
            else:
                if st_name in ('No Lead', 'No Leads', 'no_lead'):
                    by_source_state[s_name]["No Leads"] += 1
                else:
                    by_source_state[s_name]["Follow Ups"] += 1
        
        by_source_state[s_name]["total"] += 1

    # Obtener closers y fuentes únicas para el periodo de fechas seleccionado
    closers_query = db.session.query(FinancialAgenda.closer).distinct().filter(
        FinancialAgenda.id.in_(date_query.with_entities(FinancialAgenda.id))
    ).all()
    sources_query = db.session.query(FinancialAgenda.nombre).distinct().filter(
        FinancialAgenda.id.in_(date_query.with_entities(FinancialAgenda.id))
    ).all()
    
    closer_names_db = [c[0].strip() for c in closers_query if c[0] and c[0].strip()]
    closer_users = User.query.filter_by(role='closer', is_active=True).all()
    closer_usernames = [u.username for u in closer_users]
    unique_closers = sorted(list(set(closer_names_db + closer_usernames)))
    
    triage_query = db.session.query(FinancialAgenda.encargado_triage).distinct().filter(
        FinancialAgenda.id.in_(date_query.with_entities(FinancialAgenda.id))
    ).all()
    triage_names_db = [t[0].strip() for t in triage_query if t[0] and t[0].strip()]
    triage_users = User.query.filter_by(role='triage', is_active=True).all()
    triage_usernames = [u.username for u in triage_users]
    unique_triage = sorted(list(set(triage_names_db + triage_usernames)))
    
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
                
    # El filtro de arriba descarta cualquier fuente de mas de dos palabras que no
    # contenga un setter, y por eso 'workshop landing' nunca llegaba al selector de
    # Fuente del tablero. Las fuentes de embudo se agregan aparte, mas el catalogo
    # oficial, para que siempre se pueda filtrar por ellas aunque el recorte actual
    # no tenga ninguna.
    from app.services.fuente_service import FUENTES_CANONICAS, clasificar
    unique_sources += [src for src in raw_sources if clasificar(src) != 'otro']
    unique_sources = sorted(set(unique_sources) | set(FUENTES_CANONICAS))

    # Ordenar por no leídos
    if current_user and current_user.is_authenticated:
        serialized_all.sort(key=lambda x: 0 if x.get('unread_comment', False) else 1)
        
    for x in serialized_all:
        x.pop("_sales_info", None)
        
    total_count = len(serialized_all)
    upcoming_count = len([x for x in serialized_all if x.get('date') and datetime.fromisoformat(x['date']) >= datetime.utcnow()])

    if page is not None:
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_items = serialized_all[start_idx:end_idx]
        has_more = end_idx < total_count
        pages_count = (total_count + limit - 1) // limit
        
        return jsonify({
            "data": paginated_items,
            "total": total_count,
            "upcoming_count": upcoming_count,
            "by_closer": by_closer,
            "by_closer_state": by_closer_state,
            "by_source_state": by_source_state,
            "by_triage_state": {},
            "unique_states": ['Pendiente', 'Contactado', 'Confirmado', 'Show Up', 'No Show', 'Reagendada', 'Cancelada', 'Cerrada', '2TH Call', 'No Lead', 'Follow Up'],
            "unique_closers": unique_closers,
            "unique_sources": unique_sources,
            "unique_triage": unique_triage,
            "page": page,
            "pages": pages_count,
            "has_more": has_more
        }), 200
    else:
        return jsonify(serialized_all), 200

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
            from app.services.booking_service import BookingService
            agenda.closer = BookingService.normalize_closer_name(data['closer'])
        if 'fecha_meet' in data:
            agenda.fecha_meet = data['fecha_meet']
        if 'instagram' in data:
            agenda.instagram = data['instagram']
        if 'whatsapp' in data:
            agenda.whatsapp = data['whatsapp']
        if 'mail' in data:
            agenda.mail = data['mail']
        status_changed = False
        if 'estado' in data and data['estado'] != agenda.estado:
            status_changed = True
            agenda.estado = data['estado']
            
        if 'encargado_triage' in data:
            agenda.encargado_triage = data['encargado_triage']
        if 'fecha_seguimiento' in data:
            agenda.fecha_seguimiento = data['fecha_seguimiento']
        if 'seguimiento_realizado' in data:
            agenda.seguimiento_realizado = bool(data['seguimiento_realizado'])
        if 'date' in data:
            # Misma convencion que la ingesta: la columna guarda UTC naive. El editor del panel
            # manda ISO con 'Z' (ver FinancialAgendasPage.handleEditSubmit); si por lo que sea
            # llega un string sin zona, se asume AGENDAS_SOURCE_TZ igual que en el webhook.
            nueva_fecha, _ = parse_a_utc(data['date'])
            if nueva_fecha:
                agenda.date = nueva_fecha
        if 'created_at' in data and data['created_at']:
            nuevo_created_at, _ = parse_a_utc(data['created_at'])
            if nuevo_created_at:
                agenda.created_at = nuevo_created_at
                # `registro` es el texto que se muestra/ordena en el panel de agendas y siempre
                # fue hora local de la fuente, no UTC: se deja como estaba para no mover los
                # listados que ordenan por ese campo.
                import pytz
                agenda.registro = pytz.UTC.localize(nuevo_created_at).astimezone(
                    zona_origen()).replace(tzinfo=None).isoformat()
            
        if status_changed:
            from app.models import Notification
            notif = Notification(
                subject=f"Estado de Agenda Actualizado: {agenda.lead or agenda.nombre or 'Desconocido'}",
                content=f"La agenda con @{agenda.instagram or 'sin_ig'} ha cambiado de estado a '{agenda.estado}'.",
                target_users=["all"],
                associated_id=agenda.id,
                associated_type="agenda"
            )
            db.session.add(notif)
            
            # Sincronización in-line de razones para Setter (Confirmer)
            if agenda.estado in ('Cancelada', 'Reagendada'):
                from app.models import Client, Appointment
                from app.services.closer_service import CloserService
                from flask_login import current_user
                
                ig_clean = agenda.instagram.strip().replace('@', '').lower() if agenda.instagram and agenda.instagram.lower() not in ('n/a', '') else None
                mail_clean = agenda.mail.strip().lower() if agenda.mail and agenda.mail.lower() not in ('n/a', '') else None
                
                client_filters = []
                if ig_clean:
                    client_filters.append(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean)
                if mail_clean:
                    client_filters.append(func.lower(Client.email) == mail_clean)
                    
                client = None
                if client_filters:
                    client = Client.query.filter(or_(*client_filters)).first()
                    
                if client and agenda.date:
                    start_of_day = datetime.combine(agenda.date.date(), datetime.min.time())
                    end_of_day = datetime.combine(agenda.date.date(), datetime.max.time())
                    
                    appt = Appointment.query.filter(
                        Appointment.client_id == client.id,
                        Appointment.start_time >= start_of_day,
                        Appointment.start_time <= end_of_day
                    ).first()
                    
                    if appt:
                        mapped_st = 'Cancelado' if agenda.estado == 'Cancelada' else 'Reagendado'
                        process_payload = {
                            'status': mapped_st,
                            'reschedule_date': data.get('reschedule_date'),
                            'note': data.get('note'),
                            'role': 'setter'
                        }
                        user_id = current_user.id if (current_user and current_user.is_authenticated) else appt.setter_id
                        CloserService.process_agenda(closer_id=user_id, appt_id=appt.id, data=process_payload, is_admin=True)

        # Si se edita closer_result (desde la vista de admin/closer)
        if 'closer_result' in data:
            from app.models import Client, Appointment
            from app.services.booking_service import BookingService
            from app.services.closer_service import CloserService
            from flask_login import current_user
            
            ig_clean = agenda.instagram.strip().replace('@', '').lower() if agenda.instagram and agenda.instagram.lower() not in ('n/a', '') else None
            mail_clean = agenda.mail.strip().lower() if agenda.mail and agenda.mail.lower() not in ('n/a', '') else None
            
            client_filters = []
            if ig_clean:
                client_filters.append(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean)
            if mail_clean:
                client_filters.append(func.lower(Client.email) == mail_clean)
                
            client = None
            if client_filters:
                client = Client.query.filter(or_(*client_filters)).first()
                
            if client and agenda.date:
                start_of_day = datetime.combine(agenda.date.date(), datetime.min.time())
                end_of_day = datetime.combine(agenda.date.date(), datetime.max.time())
                
                appt = Appointment.query.filter(
                    Appointment.client_id == client.id,
                    Appointment.start_time >= start_of_day,
                    Appointment.start_time <= end_of_day
                ).first()
                
                if appt:
                    new_closer_res = data['closer_result']
                    # Mapear de vuelta al formato interno de closer_result
                    if new_closer_res == 'Show Up':
                        new_closer_res = 'Show up'
                    elif new_closer_res == '2TH Call':
                        new_closer_res = '2da call'
                    elif new_closer_res == 'Cancelada':
                        new_closer_res = 'Cancelado'
                    elif new_closer_res == 'Reagendada':
                        new_closer_res = 'Reagendado'
                        
                    if new_closer_res in ('Cancelado', 'Reagendado', '2da call'):
                        process_payload = {
                            'status': new_closer_res,
                            'reschedule_date': data.get('reschedule_date'),
                            'note': data.get('note'),
                            'role': 'closer'
                        }
                        user_id = current_user.id if (current_user and current_user.is_authenticated) else appt.closer_id
                        CloserService.process_agenda(closer_id=user_id, appt_id=appt.id, data=process_payload, is_admin=True)
                    else:
                        appt.closer_result = new_closer_res
                        if new_closer_res in ('Show up', 'No Show'):
                            appt.closer_processed = True
                        db.session.add(appt)
                        BookingService.sync_appointment_to_financial_agenda(appt)

        db.session.commit()

        # Sincronizar la agenda editada
        try:
            from app.services.booking_service import BookingService
            BookingService.sync_financial_agenda_to_appointment(agenda)
        except Exception as sync_err:
            # Si este sync falla, la agenda queda con la fecha nueva y el Appointment con la
            # vieja -- justo el tipo de desfase que se esta corrigiendo. Antes se silenciaba.
            current_app.logger.error(
                f"[SYNC ERROR] Agenda {agenda.id} editada pero no sincronizada a Appointment: {sync_err}")

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
    """Sincroniza masivamente las agendas financieras con Appointments, con filtro temporal por defecto."""
    try:
        from app.services.booking_service import BookingService
        from datetime import date, timedelta
        
        sync_all = request.args.get('all', 'false').lower() == 'true'
        days = request.args.get('days', 14, type=int)
        
        query = FinancialAgenda.query
        if not sync_all:
            limit_date = date.today() - timedelta(days=days)
            query = query.filter(FinancialAgenda.date >= limit_date)
            
        agendas = query.all()
        synced_count = 0
        for agenda in agendas:
            appt = BookingService.sync_financial_agenda_to_appointment(agenda)
            if appt:
                synced_count += 1
                
        return jsonify({
            "status": "success",
            "message": f"Sincronización completada. {synced_count} agendas procesadas.",
            "total_processed": len(agendas),
            "synced": synced_count,
            "filtered_by_days": None if sync_all else days
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-agendas-form', methods=['POST'])
def receive_financial_agendas_form():
    """Recibe datos del formulario de calificación de n8n y actualiza o crea el cliente correspondiente."""
    data = request.get_json() or {}
    
    nombre = data.get('nombre')
    telefono = data.get('telefono')
    fuente_form = data.get('fuente_form', 'Setting Form')
    instagram = data.get('instagram')
    # El mail es la llave mas confiable para cruzar el formulario con la agenda
    # (Calendly lo pide siempre); instagram y telefono los escribe el lead a mano.
    mail = data.get('mail') or data.get('email')
    
    # Datos de calificación
    examen = data.get('examen')
    profesion = data.get('profesion')
    formacion = data.get('formacion')
    empleo = data.get('empleo')
    interes = data.get('interes')
    puntaje = data.get('puntaje')
    inversion = data.get('inversion')
    apoyo = data.get('apoyo')
    
    # Validaciones iniciales
    if not nombre and not instagram and not telefono:
        return jsonify({"error": "Se requiere al menos un nombre, instagram o teléfono para procesar el lead"}), 400
        
    ig_norm = None
    if instagram and isinstance(instagram, str) and instagram.lower() not in ('n/a', ''):
        ig_norm = instagram.strip().lstrip('@').lower()
        
    clean_phone = None
    if telefono and isinstance(telefono, str) and telefono.lower() not in ('n/a', ''):
        clean_phone = telefono.strip()

    clean_mail = None
    if mail and isinstance(mail, str) and '@' in mail and mail.lower() not in ('n/a', ''):
        clean_mail = mail.strip().lower()

    client = None

    # 0. Buscar por mail, que es el identificador mas estable de los tres
    if clean_mail:
        client = Client.query.filter(func.lower(Client.email) == clean_mail).first()

    # 1. Intentar buscar cliente por instagram normalizado
    if not client and ig_norm:
        client = Client.query.filter(func.lower(Client.instagram) == ig_norm).first()
        
    # 2. Intentar buscar por teléfono si no se encontró por instagram
    if not client and clean_phone and len(clean_phone) > 4:
        client = Client.query.filter(Client.phone.like(f"%{clean_phone}%")).first()

    # 3. Buscar por nombre en FinancialAgenda (campo lead o nombre) → obtener el Client vinculado
    if not client and nombre:
        nombre_norm = nombre.strip().lower()
        agenda_match = FinancialAgenda.query.filter(
            or_(
                func.lower(FinancialAgenda.lead).like(f"%{nombre_norm}%"),
                func.lower(FinancialAgenda.nombre).like(f"%{nombre_norm}%")
            )
        ).order_by(FinancialAgenda.date.desc()).first()
        if agenda_match:
            # Buscar el Client asociado por instagram o mail de la agenda
            ag_ig = agenda_match.instagram.strip().lstrip('@').lower() if agenda_match.instagram and agenda_match.instagram.lower() not in ('n/a', '') else None
            ag_mail = agenda_match.mail.strip().lower() if agenda_match.mail and agenda_match.mail.lower() not in ('n/a', '') else None
            ag_phone = agenda_match.whatsapp.strip() if agenda_match.whatsapp and agenda_match.whatsapp.lower() not in ('n/a', '') else None
            if ag_ig:
                client = Client.query.filter(func.lower(Client.instagram) == ag_ig).first()
            if not client and ag_mail:
                client = Client.query.filter(func.lower(Client.email) == ag_mail).first()
            if not client and ag_phone:
                client = Client.query.filter(Client.phone.like(f"%{ag_phone}%")).first()
            # Si la agenda no tiene cliente vinculado, buscar por nombre directo
            if not client:
                client = Client.query.filter(func.lower(Client.full_name).like(f"%{nombre_norm}%")).first()

    # 4. Último recurso: buscar por nombre exacto en Client
    if not client and nombre:
        client = Client.query.filter(func.lower(Client.full_name) == nombre.strip().lower()).first()

        
    # Construir el nuevo bloque de respuestas de calificación
    new_form_data = {
        "nombre": nombre,
        "telefono": telefono,
        "fuente_form": fuente_form,
        "instagram": instagram,
        "mail": clean_mail,
        "examen": examen,
        "profesion": profesion,
        "formacion": formacion,
        "empleo": empleo,
        "interes": interes,
        "puntaje": puntaje,
        "inversion": inversion,
        "apoyo": apoyo,
        "submitted_at": datetime.utcnow().isoformat()
    }
    
    try:
        if client:
            # Actualizar datos básicos si están vacíos o son genéricos
            if nombre and (not client.full_name or client.full_name.lower() in ('desconocido', '', 'n/a')):
                client.full_name = nombre
            if clean_phone and (not client.phone or client.phone.lower() in ('sin telefono', 'sin teléfono', '', 'n/a')):
                client.phone = clean_phone
            if ig_norm and (not client.instagram or client.instagram.lower() in ('sin instagram', '', 'n/a')):
                client.instagram = ig_norm
            # Los clientes creados por el sync llevan un mail placeholder @neurops.com
            if clean_mail and (not client.email or '@neurops.com' in client.email.lower()):
                client.email = clean_mail
            # Actualizar form_data de manera incremental
            from sqlalchemy.orm.attributes import flag_modified
            current_form_data = dict(client.form_data or {})
            current_form_data.update(new_form_data)
            client.form_data = current_form_data
            flag_modified(client, 'form_data')
            
            message = "Cliente existente actualizado con las respuestas del formulario"
        else:
            # Crear un nuevo cliente
            client = Client(
                full_name=nombre or "Desconocido",
                phone=clean_phone,
                instagram=ig_norm,
                email=clean_mail,
                form_data=new_form_data
            )
            db.session.add(client)
            message = "Nuevo cliente creado con las respuestas del formulario"
            
        db.session.commit()

        # El formulario manda sobre la fuente de la agenda: si `fuente_form` es un
        # setter del equipo, se le reasignan las agendas de esta persona que hayan
        # entrado con la fuente generica del evento de Calendly. Ver
        # app/services/fuente_formulario_service.py.
        fuente_aplicada, agendas_actualizadas = None, 0
        try:
            from app.services.fuente_formulario_service import aplicar_a_agendas_del_cliente
            fuente_aplicada, agendas_actualizadas = aplicar_a_agendas_del_cliente(
                fuente_form,
                nombre=nombre,
                telefono=clean_phone,
                instagram=ig_norm,
                mail=clean_mail
            )
            if agendas_actualizadas:
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            from flask import current_app
            current_app.logger.error(f"[FUENTE FORM] No se pudo aplicar la fuente del formulario: {e}")

        return jsonify({
            "message": message,
            "status": "success",
            "fuente_aplicada": fuente_aplicada,
            "agendas_actualizadas": agendas_actualizadas,
            "client_id": client.id,
            "client": {
                "id": client.id,
                "full_name": client.full_name,
                "phone": client.phone,
                "instagram": client.instagram,
                "form_data": client.form_data
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al procesar el formulario de calificación: {str(e)}"}), 500

@bp.route('/public/financial-agendas/unread-no-agenda', methods=['GET'])
@login_required
def get_unread_no_agenda_triage():
    # Obtener clientes que tienen notificaciones de comentarios no leídos para este usuario de triaje
    from app.models import CommentNotification, Client, FinancialAgenda
    from sqlalchemy import func, or_
    
    unread_notifications = CommentNotification.query.filter_by(user_id=current_user.id, is_read=False).all()
    unread_client_ids = {n.client_id for n in unread_notifications}
    
    if not unread_client_ids:
        return jsonify([]), 200
        
    clients = Client.query.filter(Client.id.in_(list(unread_client_ids))).all()
    
    results = []
    for c in clients:
        ig_clean = c.instagram.strip().replace('@', '').lower() if c.instagram and c.instagram.lower() not in ('n/a', '') else None
        mail_clean = c.email.strip().lower() if c.email and c.email.lower() not in ('n/a', '') else None
        
        agenda_exists = False
        client_filters = []
        if ig_clean:
            client_filters.append(func.lower(func.replace(FinancialAgenda.instagram, '@', '')) == ig_clean)
        if mail_clean:
            client_filters.append(func.lower(FinancialAgenda.mail) == mail_clean)
            
        if client_filters:
            agenda_exists = FinancialAgenda.query.filter(or_(*client_filters)).first() is not None
            
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

def _resolve_closer_results(agendas):
    # Resuelve en lote el estado post call de cada agenda (cliente + cita del mismo dia)
    from app.models import Appointment
    from app.models.financial import map_closer_result_to_display

    resultados = {}
    if not agendas:
        return resultados

    agendas_por_ig = {}
    agendas_por_mail = {}
    for a in agendas:
        ig_clean = a.instagram.strip().replace('@', '').lower() if a.instagram and a.instagram.lower() not in ('n/a', '') else None
        mail_clean = a.mail.strip().lower() if a.mail and a.mail.lower() not in ('n/a', '') else None
        if ig_clean:
            agendas_por_ig.setdefault(ig_clean, []).append(a)
        if mail_clean:
            agendas_por_mail.setdefault(mail_clean, []).append(a)

    client_filters = []
    if agendas_por_ig:
        client_filters.append(func.lower(func.replace(Client.instagram, '@', '')).in_(list(agendas_por_ig.keys())))
    if agendas_por_mail:
        client_filters.append(func.lower(Client.email).in_(list(agendas_por_mail.keys())))
    if not client_filters:
        return resultados

    cliente_por_agenda = {}
    for c in Client.query.filter(or_(*client_filters)).all():
        c_ig = c.instagram.strip().replace('@', '').lower() if c.instagram else None
        c_mail = c.email.strip().lower() if c.email else None
        for a in agendas_por_ig.get(c_ig, []) + agendas_por_mail.get(c_mail, []):
            cliente_por_agenda.setdefault(a.id, c.id)

    client_ids = set(cliente_por_agenda.values())
    if not client_ids:
        return resultados

    citas_por_cliente = {}
    for appt in Appointment.query.filter(Appointment.client_id.in_(list(client_ids))).all():
        citas_por_cliente.setdefault(appt.client_id, []).append(appt)

    for a in agendas:
        client_id = cliente_por_agenda.get(a.id)
        if not client_id or not a.date:
            continue
        for appt in citas_por_cliente.get(client_id, []):
            if appt.start_time and appt.start_time.date() == a.date.date():
                mapped = map_closer_result_to_display(appt.closer_result)
                if mapped:
                    resultados[a.id] = mapped
                break

    return resultados

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
        sales = FinancialSale.query.all()
        sold_emails = {s.mail_cliente.strip().lower() for s in sales if s.mail_cliente}
        sold_instagrams = {s.instagram.strip().replace('@', '').lower() for s in sales if s.instagram}

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

            mail_clean = a.mail.strip().lower() if a.mail and a.mail.lower() not in ('n/a', '') else None
            ig_clean = a.instagram.strip().replace('@', '').lower() if a.instagram and a.instagram.lower() not in ('n/a', '') else None
            phone_clean = a.whatsapp.strip() if a.whatsapp else None

            # Ignorar compradores
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
                "date": a.date.isoformat() if a.date else (a.fecha_meet or ""),
                "registro": a.registro or (a.created_at.isoformat() if a.created_at else ""),
                "lead": a.lead or a.nombre or "Sin Nombre",
                "whatsapp": a.whatsapp or "",
                "mail": a.mail or "",
                "instagram": a.instagram or "",
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

