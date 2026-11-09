"""Las métricas del triage: el embudo de sus llamadas, calculado de lo que marca en cada lead."""
from datetime import date, timedelta

from flask import jsonify, request
from flask_login import current_user

from app.api.auth import login_required
from app.api.triage import bp
from app.decorators import triage_metricas_required
from app.services import triage_alcance, triage_service
from app.services.user_time_service import limites_rango_utc, zona_del_usuario


def _dia(clave, defecto):
    try:
        return date.fromisoformat(request.args.get(clave) or '')
    except ValueError:
        return defecto


@bp.route('/metricas', methods=['GET'])
@login_required
@triage_metricas_required
def metricas():
    """`desde` y `hasta` (AAAA-MM-DD, en la zona de quien mira; por defecto los últimos 7 días).
    La triage ve lo suyo; la dirección, todas o una (`triage_id`). `segmento`: A,B,C,D,sin separados por coma."""
    hoy = date.today()
    desde = _dia('desde', hoy - timedelta(days=6))
    hasta = _dia('hasta', hoy)
    if desde > hasta:
        return jsonify({'message': '«Desde» es posterior a «hasta».'}), 400
    inicio, fin = limites_rango_utc(current_user, desde, hasta)
    segmentos = {s for s in (request.args.get('segmento') or '').split(',') if s in ('A', 'B', 'C', 'D', 'sin')}
    zona = zona_del_usuario(current_user)
    if current_user.role == 'triage':
        # La triage ve lo suyo y, para compararse, las cifras de cada compañera (sin sus leads).
        return jsonify(triage_alcance.solo_de(triage_service.metricas(inicio, fin, zona=zona, segmentos=segmentos),
                                              current_user.id)), 200
    solo = request.args.get('triage_id', type=int)
    return jsonify(triage_service.metricas(inicio, fin, solo=solo, zona=zona, segmentos=segmentos)), 200
