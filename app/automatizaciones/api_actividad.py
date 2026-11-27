"""El botón «Activo / Inactivo» del Inbox (ADR-W245). Es de cada uno: el setter lo cambia para sí."""
from flask import jsonify, request
from flask_login import current_user

from app.automatizaciones import actividad
from app.automatizaciones.api import bp


@bp.route('/actividad', methods=['GET'])
def mi_actividad():
    return jsonify(actividad.estado(current_user.id))


@bp.route('/actividad', methods=['PUT'])
def cambiar_actividad():
    datos = request.get_json(silent=True) or {}
    if not isinstance(datos.get('activo'), bool):
        return jsonify({'message': 'activo debe ser true o false'}), 400
    return jsonify(actividad.cambiar(current_user.id, datos['activo']))


@bp.route('/mis-stats', methods=['GET'])
def mis_stats():
    """Mini estadísticas del setter para la columna del lead (ADR-W246): su mediana de respuesta activo e inactivo
    (últimas 24 h), cuánto estuvo activo, las agendas que cargó hoy (en su zona) y su promedio diario de 30 días."""
    from datetime import date, datetime, time, timedelta
    from zoneinfo import ZoneInfo

    from app.automatizaciones import bandeja, servicio
    from app.models import Appointment

    ahora = servicio.ahora()
    propia = next((s for s in bandeja.medianas_por_setter(ahora) if s['id'] == current_user.id), None)
    try:
        zona = ZoneInfo(current_user.timezone or 'UTC')
    except Exception:  # zona mal cargada: el día en UTC
        zona = ZoneInfo('UTC')
    hoy = datetime.now(zona).date()
    inicio = datetime.combine(hoy, time.min, zona).astimezone(ZoneInfo('UTC')).replace(tzinfo=None)
    base = Appointment.query.filter(Appointment.setter_id == current_user.id)
    hoy_n = base.filter(Appointment.created_at >= inicio).count()
    dias = 30
    mes_n = base.filter(Appointment.created_at >= inicio - timedelta(days=dias),
                        Appointment.created_at < inicio).count()
    return jsonify({
        'activo': propia and propia['activo'], 'inactivo': propia and propia['inactivo'],
        'segundos_activo': actividad.estado(current_user.id)['segundos_24h'],
        'agendas_hoy': hoy_n, 'agendas_promedio': round(mes_n / dias, 1), 'dias': dias,
        'fecha': date.isoformat(hoy),
    })
