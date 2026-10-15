"""La tabla de anuncios de Marketing (una fila por palabra clave de ManyChat) y su gasto de Meta Ads.

Ver `anuncios_service` (qué cuenta cada columna) y `meta_ads_service` (cómo llega el gasto). Todas las
rutas exigen sesión con rol de admin o de dirección de marketing (su `before_request`), salvo el cron
diario de Meta, que no tiene sesión y se identifica con `CRON_SECRET` como los demás crons.
"""
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from app.decorators import _acceso_denegado, require_cron_secret
from app.models.user import ROLE_ADMIN, ROLE_DIRECTOR_MARKETING
from app.services import anuncios_service, meta_ads_service

bp = Blueprint('marketing_anuncios', __name__)

ROLES_CON_ACCESO = (ROLE_ADMIN, ROLE_DIRECTOR_MARKETING)
PERIODO_MAXIMO = 400


@bp.before_request
def _solo_marketing():
    if request.endpoint == 'marketing_anuncios.cron_meta':
        return None
    return _acceso_denegado(ROLES_CON_ACCESO, 'Marketing access required')


def _periodo():
    """(desde, hasta) de `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`; por defecto, los últimos 30 días."""
    hoy = date.today()
    try:
        hasta = date.fromisoformat(request.args.get('hasta')) if request.args.get('hasta') else hoy
        desde = date.fromisoformat(request.args.get('desde')) if request.args.get('desde') \
            else hasta - timedelta(days=29)
    except ValueError:
        raise ValueError('Las fechas van como AAAA-MM-DD.') from None
    if desde > hasta:
        desde, hasta = hasta, desde
    if (hasta - desde).days > PERIODO_MAXIMO:
        raise ValueError(f'El período no puede pasar de {PERIODO_MAXIMO} días.')
    return desde, hasta


def _estado_de_meta():
    ultima = meta_ads_service.ultima_sincronizacion()
    muestra = meta_ads_service.modo_muestra()
    return {'conectado': meta_ads_service.configurado() or muestra,
            'muestra': muestra,
            'ultima_sincronizacion': ultima.isoformat() if ultima else None}


@bp.route('', methods=['GET'])
def tablero():
    try:
        desde, hasta = _periodo()
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify({**anuncios_service.tablero(desde, hasta), 'meta': _estado_de_meta()}), 200


@bp.route('/archivar', methods=['POST'])
def archivar():
    """Body: {"clave": "CURSO GRATUITO", "archivado": true}."""
    datos = request.get_json(silent=True) or {}
    try:
        return jsonify(anuncios_service.archivar(datos.get('clave'), bool(datos.get('archivado')))), 200
    except ValueError as error:
        return jsonify({'error': str(error)}), 400


@bp.route('/agrupar', methods=['POST'])
def agrupar():
    """Body: {"clave": "APLICAR", "campana": "DM Funnel", "conjunto": "Broad"}; sin campaña, vuelve a la de Meta."""
    datos = request.get_json(silent=True) or {}
    if any(datos.get(k) is not None and not isinstance(datos.get(k), str) for k in ('campana', 'conjunto')):
        return jsonify({'error': 'La campaña y el conjunto van como texto.'}), 400
    try:
        return jsonify(anuncios_service.agrupar(datos.get('clave'), datos.get('campana'), datos.get('conjunto'))), 200
    except ValueError as error:
        return jsonify({'error': str(error)}), 400


@bp.route('/meta', methods=['GET'])
def anuncios_de_meta():
    """Los anuncios publicados en Meta con su palabra clave y su gasto del período."""
    try:
        desde, hasta = _periodo()
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify({
        'anuncios': meta_ads_service.listado(desde, hasta),
        'claves': sorted(anuncios_service.claves_conocidas()),
        **_estado_de_meta(),
    }), 200


@bp.route('/meta/<meta_ad_id>', methods=['PUT'])
def asignar_clave(meta_ad_id):
    """Body: {"clave": "APLICAR"} (o null = no es de ninguna palabra clave), o {"automatico": true}."""
    datos = request.get_json(silent=True) or {}
    clave = datos.get('clave')
    if clave is not None and not isinstance(clave, str):
        return jsonify({'error': 'La palabra clave tiene que ser texto.'}), 400
    try:
        anuncio = meta_ads_service.asignar_clave(meta_ad_id, clave=clave or None,
                                                 automatico=bool(datos.get('automatico')))
    except LookupError as error:
        return jsonify({'error': str(error)}), 404
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify({'meta_ad_id': anuncio.meta_ad_id, 'clave': anuncio.clave, 'mapeo': anuncio.mapeo}), 200


@bp.route('/meta/sincronizar', methods=['POST'])
def sincronizar_meta():
    """Body opcional: {"dias": 30} (hasta 180): cuántos días para atrás traer el gasto."""
    datos = request.get_json(silent=True) or {}
    try:
        dias = int(datos.get('dias') or meta_ads_service.DIAS_POR_DEFECTO)
    except (TypeError, ValueError):
        return jsonify({'error': 'Los días tienen que ser un número.'}), 400
    dias = max(1, min(dias, meta_ads_service.DIAS_MAXIMOS))
    hasta = date.today()
    try:
        resumen = meta_ads_service.sincronizar(hasta - timedelta(days=dias - 1), hasta)
    except meta_ads_service.ErrorDeMeta as error:
        return jsonify({'error': str(error)}), 502 if meta_ads_service.configurado() else 409
    return jsonify(resumen), 200


@bp.route('/cron/meta', methods=['GET'])
@require_cron_secret
def cron_meta():
    """El cron diario: el gasto de la última semana (Meta todavía ajusta los días recientes)."""
    try:
        return jsonify({'status': 'success', **meta_ads_service.sincronizar()}), 200
    except meta_ads_service.ErrorDeMeta as error:
        return jsonify({'status': 'error', 'message': str(error)}), 502 if meta_ads_service.configurado() else 503
