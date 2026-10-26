"""Listado de agendas financieras para el tablero."""
from flask import request, jsonify
from app.models import db, FinancialAgenda, User
from datetime import datetime
from . import bp
from .financial_agendas_helpers import (
    _build_agenda_queries)


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
        from app.services.avisos_service import clientes_con_notas_sin_leer
        unread_client_ids = clientes_con_notas_sin_leer(current_user)

    # Precalcular ventas asociadas para evitar N+1
    from app.models import FinancialSale
    from app.services import agenda_contacto_service
    agenda_contacto_service.precargar(all_agendas)
    # Los pagos de la persona de cada agenda (Etapa 2c: la agenda no guarda el contacto).
    sales_by_person = {}
    personas = sorted({a.person_uuid for a in all_agendas if a.person_uuid})
    for i in range(0, len(personas), 500):
        for s in FinancialSale.query.filter(FinancialSale.person_uuid.in_(personas[i:i + 500])).all():
            sales_by_person.setdefault(s.person_uuid, []).append(s)

    def get_agenda_sales_info(agenda):
        sales_dict = {s.id: s for s in sales_by_person.get(agenda.person_uuid, ())}
                
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
    # Closers activos únicamente, sin mezclar con nombres históricos sueltos en
    # agenda.closer (texto libre: closers renombrados, dados de baja, etc.). Es lo
    # que debe verse en los selectores de REASIGNACIÓN (columna Closer y modal de
    # edición) para no volver a asignar una agenda a alguien que ya no está activo
    # y que por lo tanto no la vería en su espacio de trabajo.
    active_closers = sorted(closer_usernames)

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
            "unique_states": ['Pendiente', 'Contactado', 'Confirmado', 'Show Up', 'No Show', 'Reagendada', 'Cancelada', 'Cerrada', '2TH Call', 'No Lead', 'Follow Up'],
            "unique_closers": unique_closers,
            "active_closers": active_closers,
            "unique_sources": unique_sources,
            "page": page,
            "pages": pages_count,
            "has_more": has_more
        }), 200
    else:
        return jsonify(serialized_all), 200
