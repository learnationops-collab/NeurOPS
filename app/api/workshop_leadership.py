"""Cron diario: pone al día las tareas de los próximos talleres en Leadership (ver `leadership_rituales_service`)."""
import logging

from flask import jsonify

from app.api.workshop import bp
from app.decorators import require_cron_secret
from app.services import leadership_rituales_service as rituales
from app.services.leadership_client import LeadershipError, configurado

logger = logging.getLogger(__name__)


@bp.route('/cron/leadership', methods=['GET'])
@require_cron_secret
def cron_leadership():
    """Cada día entra un taller más al horizonte; sin esto solo se actualizaría al guardar uno."""
    if not configurado():
        return jsonify({'status': 'skipped', 'message': 'Leadership no está configurado'}), 200
    try:
        return jsonify({'status': 'success', 'acciones': rituales.sincronizar()}), 200
    except LeadershipError as e:
        logger.error('Leadership: %s', e)
        return jsonify({'status': 'error', 'message': str(e)}), 502
