from flask import Blueprint, request, jsonify
from app import db
from app.models import ConversationalMessage, LeadAnswer, ManychatLead, Ad, FinancialAgenda, FinancialSale
from sqlalchemy import func, not_
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('conversational', __name__)


# ──────────────────────────────────────────────
# CRUD DE MENSAJES CONVERSACIONALES
# ──────────────────────────────────────────────

@bp.route('/messages', methods=['GET'])
def get_messages():
    """Lista todos los mensajes configurados."""
    category = request.args.get('category')
    query = ConversationalMessage.query
    if category:
        query = query.filter_by(category=category)
    messages = query.order_by(ConversationalMessage.created_at.asc()).all()
    return jsonify([_msg_to_dict(m) for m in messages]), 200


@bp.route('/messages', methods=['POST'])
def create_message():
    """Crea un nuevo mensaje conversacional."""
    data = request.get_json() or {}
    message_id = (data.get('message_id') or '').strip()
    title = (data.get('title') or '').strip()
    category = data.get('category', 'cualificacion')

    if not message_id:
        return jsonify({'status': 'error', 'message': 'message_id es obligatorio'}), 400
    if not title:
        return jsonify({'status': 'error', 'message': 'title es obligatorio'}), 400
    if category not in ('cualificacion', 'dolor', 'seguimiento', 'opening'):
        return jsonify({'status': 'error', 'message': 'category inválida'}), 400

    if ConversationalMessage.query.filter_by(message_id=message_id).first():
        return jsonify({'status': 'error', 'message': 'message_id ya existe'}), 409

    msg = ConversationalMessage(
        message_id=message_id,
        title=title,
        body=data.get('body', ''),
        category=category,
        is_active=data.get('is_active', True)
    )
    db.session.add(msg)
    try:
        db.session.commit()
        return jsonify({'status': 'success', 'message': _msg_to_dict(msg)}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"[conversational.create_message] {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@bp.route('/messages/<int:msg_id>', methods=['PUT'])
def update_message(msg_id):
    """Actualiza un mensaje existente."""
    msg = ConversationalMessage.query.get_or_404(msg_id)
    data = request.get_json() or {}

    if 'title' in data:
        msg.title = data['title'].strip()
    if 'body' in data:
        msg.body = data['body']
    if 'category' in data:
        if data['category'] not in ('cualificacion', 'dolor', 'seguimiento', 'opening'):
            return jsonify({'status': 'error', 'message': 'category inválida'}), 400
        msg.category = data['category']
    if 'is_active' in data:
        msg.is_active = bool(data['is_active'])
    if 'message_id' in data:
        new_mid = data['message_id'].strip()
        existing = ConversationalMessage.query.filter_by(message_id=new_mid).first()
        if existing and existing.id != msg_id:
            return jsonify({'status': 'error', 'message': 'message_id ya existe'}), 409
        msg.message_id = new_mid

    try:
        db.session.commit()
        return jsonify({'status': 'success', 'message': _msg_to_dict(msg)}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"[conversational.update_message] {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@bp.route('/messages/<int:msg_id>', methods=['DELETE'])
def delete_message(msg_id):
    """Elimina un mensaje (con opción de forzar y eliminar sus estadísticas asociadas)."""
    msg = ConversationalMessage.query.get_or_404(msg_id)
    force = request.args.get('force') == 'true'

    if force:
        # Eliminar las interacciones vinculadas a este mensaje
        LeadAnswer.query.filter(
            (LeadAnswer.id_option_send == msg.message_id) |
            (LeadAnswer.id_option == msg.message_id)
        ).delete(synchronize_session=False)
        db.session.delete(msg)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Mensaje y sus estadísticas eliminados por completo.'}), 200

    # Comportamiento normal (desactivar si tiene histórico)
    has_sends = LeadAnswer.query.filter(
        (LeadAnswer.id_option_send == msg.message_id) |
        (LeadAnswer.id_option == msg.message_id)
    ).first()
    if has_sends:
        msg.is_active = False
        db.session.commit()
        return jsonify({'status': 'deactivated', 'message': 'Mensaje desactivado (tiene datos históricos)'}), 200

    db.session.delete(msg)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Mensaje eliminado'}), 200


def _msg_to_dict(m):
    return {
        'id': m.id,
        'message_id': m.message_id,
        'title': m.title,
        'body': m.body,
        'category': m.category,
        'is_active': m.is_active,
        'created_at': m.created_at.isoformat()
    }


@bp.route('/records/clear', methods=['DELETE'])
def clear_records():
    """Elimina todos los registros de interacciones (LeadAnswer) para limpiar las estadísticas."""
    try:
        deleted_count = db.session.query(LeadAnswer).delete()
        db.session.commit()
        return jsonify({'status': 'success', 'message': f'Se eliminaron {deleted_count} registros de interacción correctamente.'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"[conversational.clear_records] {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ──────────────────────────────────────────────
# STATS CONVERSACIONALES
# ──────────────────────────────────────────────

def _parse_date_range():
    """Resuelve rango de fechas según período o fechas explícitas."""
    period = request.args.get('period')
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')
    now = datetime.utcnow()

    if start_str and end_str:
        try:
            start_dt = datetime.strptime(start_str, '%Y-%m-%d')
            end_dt = datetime.strptime(end_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            return start_dt, end_dt
        except ValueError:
            pass

    if period == 'today':
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
    elif period == 'yesterday':
        d = now - timedelta(days=1)
        start_dt = d.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = d.replace(hour=23, minute=59, second=59)
    elif period == 'last_7':
        start_dt = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0)
        end_dt = now
    elif period == 'this_month':
        start_dt = now.replace(day=1, hour=0, minute=0, second=0)
        end_dt = now
    else:  # default: últimos 30 días
        start_dt = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0)
        end_dt = now

    return start_dt, end_dt


def _compute_stats_for_dates(start_dt, end_dt, category_filter, ad_id_filter):
    # ── Filtros base sobre LeadAnswer ──
    base_filters = [
        LeadAnswer.created_at >= start_dt,
        LeadAnswer.created_at <= end_dt
    ]
    if ad_id_filter:
        try:
            base_filters.append(LeadAnswer.ad_id == int(ad_id_filter))
        except ValueError:
            pass

    # ── 1. Mensajes ENVIADOS agrupados por id_option_send ──
    sends_query = db.session.query(
        LeadAnswer.id_option_send.label('msg_key'),
        func.count(LeadAnswer.id).label('total_sends'),
        func.sum(db.case((LeadAnswer.qualification == 'true', 1), else_=0)).label('qualified')
    ).filter(
        *base_filters,
        LeadAnswer.id_option_send != None,
        LeadAnswer.id_option_send != '',
        not_(LeadAnswer.id_option_send.like('%cuf_%'))
    ).group_by(LeadAnswer.id_option_send).all()

    # ── 2. Mensajes RESPONDIDOS agrupados por id_option ──
    responses_query = db.session.query(
        LeadAnswer.id_option.label('msg_key'),
        func.count(LeadAnswer.id).label('total_responses'),
        func.sum(db.case((LeadAnswer.qualification == 'true', 1), else_=0)).label('qualified_resp'),
        func.sum(db.case((LeadAnswer.qualification == 'false', 1), else_=0)).label('disqualified_resp')
    ).filter(
        *base_filters,
        LeadAnswer.id_option != None,
        LeadAnswer.id_option != '',
        not_(LeadAnswer.id_option.like('%cuf_%'))
    ).group_by(LeadAnswer.id_option).all()

    sends_map = {r.msg_key: {'sends': r.total_sends, 'qualified': int(r.qualified or 0)} for r in sends_query}
    resp_map = {
        r.msg_key: {
            'responses': r.total_responses,
            'qualified_resp': int(r.qualified_resp or 0),
            'disqualified_resp': int(r.disqualified_resp or 0)
        } for r in responses_query
    }

    # ── 3. Atribución de Agendas y Ventas ──
    def normalize_ig(val):
        if not val or not isinstance(val, str):
            return None
        v = val.strip().lstrip('@').lower()
        return v if v and v not in ('n/a', '') else None

    # Agendas del período
    agendas_all = FinancialAgenda.query.filter(
        FinancialAgenda.date >= start_dt,
        FinancialAgenda.date <= end_dt
    ).all()

    # Ventas del período
    sales_all = FinancialSale.query.filter(
        FinancialSale.date >= start_dt,
        FinancialSale.date <= end_dt
    ).all()

    # Mapas de atribución por mensaje
    agendas_per_msg = {}
    ventas_per_msg = {}

    def get_lead_msg_key(manychat_lead_id):
        """Devuelve el último id_option_send del lead en el período."""
        ans = LeadAnswer.query.filter(
            LeadAnswer.lead_id == manychat_lead_id,
            LeadAnswer.id_option_send != None,
            LeadAnswer.created_at >= start_dt,
            LeadAnswer.created_at <= end_dt
        ).order_by(LeadAnswer.created_at.desc()).first()
        return ans.id_option_send if ans else None

    def resolve_lead_by_ig_or_name(ig_val, nombre_val):
        ig_n = normalize_ig(ig_val)
        lead = None
        if ig_n:
            lead = ManychatLead.query.filter(
                func.lower(func.replace(ManychatLead.ig, '@', '')) == ig_n
            ).first()
        if not lead and nombre_val:
            lead = ManychatLead.query.filter(
                func.lower(ManychatLead.name) == nombre_val.strip().lower()
            ).first()
        return lead

    for ag in agendas_all:
        ig_val = ag.instagram or (ag.raw_data or {}).get('instagram')
        lead = resolve_lead_by_ig_or_name(ig_val, ag.nombre)
        if lead:
            key = get_lead_msg_key(lead.id)
            if key:
                agendas_per_msg[key] = agendas_per_msg.get(key, 0) + 1

    for sale in sales_all:
        ig_val = sale.instagram or (sale.raw_data or {}).get('instagram')
        lead = resolve_lead_by_ig_or_name(ig_val, sale.nombre_cliente)
        if lead:
            key = get_lead_msg_key(lead.id)
            if key:
                ventas_per_msg[key] = ventas_per_msg.get(key, 0) + 1

    # ── 4. Mensajes configurados para enriquecer la tabla ──
    msgs_query = ConversationalMessage.query
    if category_filter and category_filter != 'all':
        msgs_query = msgs_query.filter_by(category=category_filter)
    configured_msgs = {m.message_id: m for m in msgs_query.all()}

    # ── 5. Construir tabla de resultados ──
    # Unir las llaves configuradas con las que tienen envíos/respuestas reales
    all_keys = set(configured_msgs.keys()) | set(sends_map.keys()) | set(resp_map.keys())
    total_sends_all = sum(v['sends'] for v in sends_map.values())
    days_in_range = max(1, (end_dt - start_dt).days + 1)

    table_rows = []
    for key in all_keys:
        send_data = sends_map.get(key, {'sends': 0, 'qualified': 0})
        resp_data = resp_map.get(key, {'responses': 0, 'qualified_resp': 0, 'disqualified_resp': 0})
        msg = configured_msgs.get(key)

        # Filtrar por categoría si está configurado el mensaje
        if category_filter and category_filter != 'all':
            if msg is None:
                continue  # no mostrar los sin configurar cuando hay filtro de cat
            if msg.category != category_filter:
                continue

        sends = send_data['sends']
        responses = resp_data['responses']
        leads = resp_data['qualified_resp']
        disqualified = resp_data.get('disqualified_resp', 0)
        agendas = agendas_per_msg.get(key, 0)
        ventas = ventas_per_msg.get(key, 0)

        response_rate = round((responses / sends) * 100, 1) if sends > 0 else 0
        pct_of_total = round((sends / total_sends_all) * 100, 1) if total_sends_all > 0 else 0
        qual_rate = round((leads / responses) * 100, 1) if responses > 0 else 0
        agenda_rate = round((agendas / leads) * 100, 1) if leads > 0 else 0
        venta_rate = round((ventas / agendas) * 100, 1) if agendas > 0 else 0

        table_rows.append({
            'message_id': key,
            'title': msg.title if msg else f'Sin configurar ({key})',
            'body': msg.body if msg else None,
            'category': msg.category if msg else None,
            'is_configured': msg is not None,
            'total_sends': sends,
            'pct_of_total_sends': pct_of_total,
            'total_responses': responses,
            'response_rate': response_rate,
            'leads_generated': leads,
            'disqualified_leads': disqualified,
            'qualification_rate': qual_rate,
            'agendas': agendas,
            'agenda_rate': agenda_rate,
            'ventas': ventas,
            'venta_rate': venta_rate
        })

    # Ordenar por enviados desc
    table_rows.sort(key=lambda x: x['total_sends'], reverse=True)

    # ── 6. KPIs globales ──
    total_responses_all = sum(v['responses'] for v in resp_map.values())
    total_leads_all = sum(v['qualified_resp'] for v in resp_map.values())
    total_disqualified_all = sum(v.get('disqualified_resp', 0) for v in resp_map.values())
    total_agendas_all = sum(agendas_per_msg.values())
    total_ventas_all = sum(ventas_per_msg.values())

    kpis = {
        'total_sends': total_sends_all,
        'daily_avg_sends': round(total_sends_all / days_in_range, 1),
        'total_responses': total_responses_all,
        'global_response_rate': round((total_responses_all / total_sends_all) * 100, 1) if total_sends_all > 0 else 0,
        'total_leads': total_leads_all,
        'total_disqualified': total_disqualified_all,
        'global_qualification_rate': round((total_leads_all / total_responses_all) * 100, 1) if total_responses_all > 0 else 0,
        'total_agendas': total_agendas_all,
        'agenda_rate': round((total_agendas_all / total_leads_all) * 100, 1) if total_leads_all > 0 else 0,
        'total_ventas': total_ventas_all,
        'venta_rate_from_agendas': round((total_ventas_all / total_agendas_all) * 100, 1) if total_agendas_all > 0 else 0
    }

    return kpis, table_rows


def _subtract_one_month_dt(dt):
    """Resta exactamente un mes calendario a un objeto datetime."""
    year = dt.year
    month = dt.month - 1
    if month == 0:
        month = 12
        year -= 1
    day = dt.day
    while True:
        try:
            from datetime import date
            new_date = date(year, month, day)
            break
        except ValueError:
            day -= 1
    return dt.replace(year=new_date.year, month=new_date.month, day=new_date.day)

@bp.route('/stats/conversational', methods=['GET'])
def get_conversational_stats():
    """
    Retorna KPIs globales y stats por mensaje conversacional.
    Filtra por período, categoría y ad_id.
    Admite ?compare=true para retornar datos de comparación del período anterior.
    """
    start_dt, end_dt = _parse_date_range()
    category_filter = request.args.get('category')
    ad_id_filter = request.args.get('ad_id')
    compare = request.args.get('compare') == 'true'
    compare_mode = request.args.get('compare_mode', 'month')

    kpis, table_rows = _compute_stats_for_dates(start_dt, end_dt, category_filter, ad_id_filter)

    response_data = {
        'kpis': kpis,
        'table': table_rows,
        'period': {'start': start_dt.isoformat(), 'end': end_dt.isoformat()}
    }

    if compare:
        if compare_mode == 'period':
            delta = end_dt - start_dt + timedelta(days=1)
            prev_start_dt = start_dt - delta
            prev_end_dt = end_dt - delta
        else:
            prev_start_dt = _subtract_one_month_dt(start_dt)
            prev_end_dt = _subtract_one_month_dt(end_dt)

        prev_kpis, prev_table_rows = _compute_stats_for_dates(prev_start_dt, prev_end_dt, category_filter, ad_id_filter)
        response_data['comparison'] = {
            'kpis': prev_kpis,
            'table': prev_table_rows,
            'period': {'start': prev_start_dt.isoformat(), 'end': prev_end_dt.isoformat()}
        }

    return jsonify(response_data), 200
