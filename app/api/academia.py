"""El cron que renueva las fotos de la Academia (ver `academy_snapshot_service`).

Blueprint propio y no una ruta del dashboard comercial porque aquel exige sesion en su
`before_request`, y un cron no tiene sesion: se identifica con `CRON_SECRET`, igual que los de
Sheets y los recordatorios. Sin esa variable la ruta responde 503 (falla cerrada).

El boton "Actualizar datos de la Academia" de Revisar corre el MISMO lote, por
`POST /api/comercial/academia/sincronizar`, con la sesion de la direccion.
"""
from flask import Blueprint, jsonify, request

from app.decorators import require_cron_secret

bp = Blueprint('academia_api', __name__)


@bp.route('/cron/sincronizar', methods=['GET'])
@require_cron_secret
def cron_sincronizar():
    """Un lote: los clientes con venta mas desactualizados, sin pasarse del presupuesto.

    `?presupuesto=N` lo ajusta (se acota a `PRESUPUESTO_MAXIMO`). Llamarlo de mas es seguro: cada
    corrida sigue desde el mas desactualizado y respeta el presupuesto, y un 429 de la Academia la
    corta sin perder lo que ya guardo.
    """
    from app.services import academy_snapshot_service

    resultado = academy_snapshot_service.sincronizar_lote(presupuesto=request.args.get('presupuesto'))
    return jsonify({'status': 'success', **resultado}), 200
