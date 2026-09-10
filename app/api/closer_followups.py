import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Appointment
from app.services.closer_followup_service import CloserFollowUpService, TIPOS_SEGUIMIENTO, PROGRAM_CODE_NAMES

bp = Blueprint('closer_followups_api', __name__)


def _resolve_closer_id():
    return None if current_user.role == 'admin' else current_user.id


@bp.route('/followups/today', methods=['GET'])
@login_required
def get_followups_today():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    selected_date = request.args.get('selected_date') or __import__('datetime').date.today().isoformat()
    grouped = CloserFollowUpService.get_today_grouped(_resolve_closer_id(), selected_date)
    return jsonify({
        "grouped": grouped,
        "tipos": TIPOS_SEGUIMIENTO
    }), 200


@bp.route('/followups/pool', methods=['GET'])
@login_required
def get_followups_pool():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    tipo = request.args.get('tipo')
    sub = request.args.get('sub') or None
    days_since = request.args.get('days_since') or None
    programa = request.args.get('programa') or None
    deuda = request.args.get('deuda') or None
    items = CloserFollowUpService.get_pool(_resolve_closer_id(), tipo=tipo, sub=sub, days_since=days_since, programa=programa, deuda=deuda)
    return jsonify({
        "items": items,
        "programas": PROGRAM_CODE_NAMES
    }), 200


@bp.route('/cartera', methods=['GET'])
@login_required
def get_cartera():
    """"Mi Cartera": los clientes que el closer autenticado efectivamente vendió (por
    email_vendedor), a diferencia de /followups/pool?tipo=cerrada que sigue al dueño ACTUAL de la
    agenda (la cola de "a quién le toca cobrar hoy"). Corrige el bug reportado por el usuario
    (27/ago/2026): closers activos veían en su cartera clientes de closers dados de baja, porque
    ese otro endpoint no filtra a cuál closer específico asignar un cliente huérfano."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    items = CloserFollowUpService._cartera_items(_resolve_closer_id())
    return jsonify({
        "items": items,
        "programas": PROGRAM_CODE_NAMES
    }), 200


@bp.route('/followups/pool-counts', methods=['GET'])
@login_required
def get_followups_pool_counts():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    return jsonify(CloserFollowUpService.get_pool_counts(_resolve_closer_id())), 200


@bp.route('/followups/earnings-stats', methods=['GET'])
@login_required
def get_followups_earnings_stats():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    return jsonify(CloserFollowUpService.get_earnings_stats(_resolve_closer_id())), 200


@bp.route('/followups/goal', methods=['GET'])
@login_required
def get_followups_goal():
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    selected_date = request.args.get('selected_date') or __import__('datetime').date.today().isoformat()
    return jsonify(CloserFollowUpService.get_daily_goal_progress(_resolve_closer_id(), selected_date)), 200


@bp.route('/followups/<int:appt_id>/schedule', methods=['POST'])
@login_required
def schedule_followup(appt_id):
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    appt = Appointment.query.get_or_404(appt_id)
    # Cualquier closer puede programar seguimiento sobre cualquier lead (ver process_closer_card
    # para el mismo criterio). Si el dueño quedó inactivo, se reasigna al closer que lo trabaja.
    if current_user.role == 'closer' and appt.closer_id != current_user.id:
        from app.models import User
        owner = User.query.get(appt.closer_id)
        if owner and owner.is_active is False:
            appt.closer_id = current_user.id

    data = request.get_json() or {}
    tipo = data.get('tipo')
    if tipo not in TIPOS_SEGUIMIENTO:
        return jsonify({"error": "tipo inválido"}), 400

    CloserFollowUpService.schedule_followup(
        appt,
        tipo=tipo,
        sub=data.get('sub') or '',
        fecha_seguimiento=data.get('fecha_seguimiento'),
        notes=data.get('notes'),
        intento=data.get('intento'),
        reminder_enabled=data.get('followup_reminder_enabled'),
        reminder_time=data.get('followup_reminder_time')
    )
    db.session.commit()
    return jsonify({"message": "Seguimiento programado", "id": appt.id}), 200


@bp.route('/followups/cron/send-reminders', methods=['GET'])
def cron_send_followup_reminders():
    """Manda los avisos de seguimiento por WhatsApp (Whatchimp) que ya llegaron a la hora que el
    closer eligió al programarlos. Pensado para un cron externo (mismo patrón/token que
    /api/sheets/cron-sync) como alternativa al scheduler interno — llamarlo de más es seguro, el
    "una vez por día por cita" evita reenviar.

    Si el interruptor global está apagado (`FOLLOWUP_REMINDERS_ENABLED=false`) responde 200 con
    `disabled: true` y no envía nada, para que un cron ya configurado no empiece a fallar."""
    token = request.args.get('token')
    expected_token = os.getenv('CRON_SECRET', 'token-seguro-neur0ps-2026')
    if not token or token != expected_token:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    selected_date = request.args.get('date')
    result = CloserFollowUpService.send_due_reminders(selected_date)
    return jsonify({"status": "success", **result}), 200


@bp.route('/cartera/agendas', methods=['GET'])
@login_required
def get_cartera_agendas():
    """Pestaña "Agendas" de Mi cartera: TODAS las citas del closer en el período pedido, cada
    una con su estado derivado y los totales por estado, para que pueda corroborar cuántas
    agendas tiene y en qué quedó cada una (ver `CloserAgendasService`). Los ids de `period`
    son los mismos de "Ver mis datos" más `proximas` y `todo`; `custom` usa `start_date`/
    `end_date` (YYYY-MM-DD). Un admin sin simular puede pedir un closer puntual con
    `closer_id`; sin eso responde vacío, igual que `/cartera`."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    from app.services.closer_agendas_service import CloserAgendasService
    closer_id = _resolve_closer_id() or request.args.get('closer_id', type=int)
    data = CloserAgendasService.get_ledger(
        closer_id,
        period=request.args.get('period') or 'mes',
        start_date=request.args.get('start_date'),
        end_date=request.args.get('end_date')
    )
    return jsonify(data), 200


@bp.route('/commission', methods=['GET'])
@login_required
def get_closer_commission():
    """Comisión del mes en curso para el espacio de trabajo del closer (pedido del usuario,
    10/sep/2026): 10% del cash collected neto, mismo total que ya alimenta "Ver mis datos"."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403
    from app.services.commission_service import CommissionService
    return jsonify(CommissionService.get_closer_commission(current_user)), 200


@bp.route('/cartera/agendas/<int:appt_id>/marcar-duplicada', methods=['POST'])
@login_required
def marcar_agenda_duplicada(appt_id):
    """Resuelve una inconsistencia de agenda duplicada desde la pestaña "Agendas" de Mi cartera
    (pedido del usuario, 10/sep/2026, caso real de Nerina con la lead "Mia Sky": dos citas
    idénticas -- mismo cliente, mismo horario -- nacidas de una sincronización que se procesó
    dos veces; una quedó "Show up" con la llamada real y la otra huérfana en "Sin reportar",
    inflando el total de agendas que el closer ve).

    Solo cancela la copia todavía sin reportar -- nunca la que ya tiene un resultado real --
    para que esta acción no pueda borrar el historial de una llamada que sí ocurrió. Reusa
    `CloserService.process_agenda` (mismo camino que "Canceló" desde el mazo) para que quede
    el mismo rastro de auditoría (ClientComment, borrado de evento de Google Calendar)."""
    if current_user.role not in ['closer', 'admin']:
        return jsonify({"message": "Forbidden"}), 403

    from app.services.closer_agendas_service import derivar_estado
    from app.services.closer_service import CloserService

    appt = Appointment.query.get_or_404(appt_id)
    closer_id = _resolve_closer_id()
    if closer_id and appt.closer_id != closer_id:
        return jsonify({"message": "Forbidden"}), 403
    if not appt.client_id or not appt.start_time:
        return jsonify({"message": "Esta agenda no tiene cliente u hora válidos"}), 400

    estado = derivar_estado(appt, datetime.utcnow())
    if estado not in ('por_confirmar', 'confirmada', 'sin_reportar'):
        return jsonify({"message": "Esta agenda ya tiene un resultado reportado — no se puede marcar como duplicada."}), 400

    ventana = timedelta(hours=6)
    hermana = Appointment.query.filter(
        Appointment.client_id == appt.client_id,
        Appointment.closer_id == appt.closer_id,
        Appointment.id != appt.id,
        Appointment.start_time >= appt.start_time - ventana,
        Appointment.start_time <= appt.start_time + ventana,
    ).first()
    if not hermana:
        return jsonify({"message": "No se encontró otra agenda cercana de este cliente — no parece una duplicada."}), 400

    CloserService.process_agenda(
        closer_id=appt.closer_id,
        appt_id=appt.id,
        data={
            'status': 'Cancelado',
            'role': 'closer',
            'note': f'Agenda duplicada — se conserva la cita #{hermana.id} del mismo cliente.',
        },
        is_admin=True
    )
    db.session.commit()
    return jsonify({"message": "Agenda marcada como duplicada y cancelada", "kept_id": hermana.id}), 200
