"""La tabla de anuncios de Marketing (una fila por palabra clave de ManyChat) y su gasto de Meta Ads.

Ver `anuncios_service` (qué cuenta cada columna) y `meta_ads_service` (cómo llega el gasto). Todas las
rutas exigen sesión con rol de admin o de dirección de marketing (su `before_request`), salvo el cron
diario de Meta, que no tiene sesión y se identifica con `CRON_SECRET` como los demás crons.
"""
from datetime import date, timedelta

import pytz
from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.decorators import _acceso_denegado, require_cron_secret
from app.models.user import ROLE_ADMIN, ROLE_DIRECTOR_MARKETING
from app.services import (
    anuncios_service, fuentes_registros_service, meta_ads_service, segmentos_marketing_service, workshop_meta_service,
)
from app.services.comercial_service import ComercialService

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
    # `cuentas`: las cuentas publicitarias, para los enlaces al Administrador de anuncios (`act=`).
    return {'conectado': meta_ads_service.configurado() or muestra,
            'muestra': muestra,
            'cuentas': meta_ads_service.cuentas_publicitarias(),
            'ultima_sincronizacion': ultima.isoformat() if ultima else None}


@bp.route('', methods=['GET'])
def tablero():
    try:
        desde, hasta = _periodo()
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify({**anuncios_service.tablero(desde, hasta, request.args.get('base')),
                    'meta': _estado_de_meta()}), 200


def _comparado(desde, hasta):
    """(desde, hasta) del período contra el que se compara, de `?comparar=prev|month|year|custom&comparar_desde=&comparar_hasta=`
    (los mismos del VS de Analizar, `ComercialService.rango_comparado`); None si no se pidió ninguno."""
    modo = request.args.get('comparar') or 'none'
    if modo not in ('prev', 'month', 'year', 'custom'):
        return None
    try:
        rango = ComercialService.rango_comparado(desde, hasta, modo, request.args.get('comparar_desde'),
                                                 request.args.get('comparar_hasta'))
    except ValueError:
        raise ValueError('Las fechas van como AAAA-MM-DD.') from None
    if rango[0] is None:
        return None
    if (rango[1] - rango[0]).days > PERIODO_MAXIMO:
        raise ValueError(f'El período no puede pasar de {PERIODO_MAXIMO} días.')
    return rango


@bp.route('/segmentos', methods=['GET'])
def segmentos():
    """Marketing › Todos › Segmentos: la matriz A/B/C/D cortada por `corte` (fuente|origen|closer|ninguno), con las `fuentes`
    (coma) y los `segmento` (coma) que se quieran y, con `comparar`, contra otro período (ver `segmentos_marketing_service`)."""
    try:
        desde, hasta = _periodo()
        datos = segmentos_marketing_service.vista(desde, hasta, request.args.get('corte', 'fuente'), request.args.get('fuentes'),
                                                  request.args.get('segmento'), _comparado(desde, hasta))
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify({**datos, 'desde': desde.isoformat(), 'hasta': hasta.isoformat()}), 200


@bp.route('/registros', methods=['GET'])
def registros():
    """La lista que suma una cifra de una fuente: `?fuente=setting|workshop|otras&metrica=agendas|reportadas|
    show_up|ventas|new_cash|cash_total&base=alta|reunion` (ver `fuentes_registros_service`)."""
    try:
        desde, hasta = _periodo()
        if 'segmento' in request.args:
            # Con `segmento` (A, B, C, D, sin; vacío = todos) la lista trae la columna de segmento y solo ese grupo.
            # `corte` + `grupo` (un closer, un origen…) y `fuentes` son los de la vista; sin corte, `fuente` es el grupo.
            corte = request.args.get('corte') or 'fuente'
            grupo = request.args.get('grupo') if 'grupo' in request.args else (request.args.get('fuente') or None)
            datos = segmentos_marketing_service.registros(desde, hasta, request.args.get('metrica', ''),
                                                          request.args.get('segmento', ''), request.args.get('fuentes'),
                                                          corte, grupo)
        else:
            datos = fuentes_registros_service.registros(request.args.get('fuente', ''), request.args.get('metrica', ''),
                                                        desde, hasta, request.args.get('base'), request.args.get('origen'))
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify(datos), 200


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


@bp.route('/embudos/workshop', methods=['GET'])
def embudo_workshop():
    """Rendimiento › Workshop: los anuncios de workshop del período (campaña › conjunto › anuncio)."""
    try:
        desde, hasta = _periodo()
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    try:
        zona = pytz.timezone(getattr(current_user, 'timezone', None) or 'America/La_Paz')
    except pytz.UnknownTimeZoneError:
        zona = pytz.timezone('America/La_Paz')
    return jsonify(workshop_meta_service.desglose_periodo(desde, hasta, zona)), 200


@bp.route('/meta/<meta_ad_id>/embudo', methods=['PUT'])
def asignar_embudo(meta_ad_id):
    """Body: {"embudo": "setting"|"workshop"|"contratacion"|"otro"} o {"automatico": true}."""
    datos = request.get_json(silent=True) or {}
    try:
        anuncio = meta_ads_service.asignar_embudo(meta_ad_id, datos.get('embudo'),
                                                  automatico=bool(datos.get('automatico')))
    except LookupError as error:
        return jsonify({'error': str(error)}), 404
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify({'meta_ad_id': anuncio.meta_ad_id, 'embudo': anuncio.embudo,
                    'embudo_mapeo': anuncio.embudo_mapeo}), 200


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
    return jsonify({'meta_ad_id': anuncio.meta_ad_id, 'clave': anuncio.clave, 'mapeo': anuncio.mapeo,
                    'embudo': anuncio.embudo, 'embudo_mapeo': anuncio.embudo_mapeo}), 200


@bp.route('/meta/sincronizar', methods=['POST'])
def sincronizar_meta():
    """Body opcional: {"dias": 30} (hasta 180): cuántos días para atrás traer el gasto, terminando hoy o
    en `"hasta": "AAAA-MM-DD"`. La pantalla pide 180 días en tramos de 30: de una sola vez, solo la
    parte de Meta tarda casi los 120 s que gunicorn le da a un pedido."""
    datos = request.get_json(silent=True) or {}
    try:
        dias = int(datos.get('dias') or meta_ads_service.DIAS_POR_DEFECTO)
    except (TypeError, ValueError):
        return jsonify({'error': 'Los días tienen que ser un número.'}), 400
    try:
        hasta = min(date.fromisoformat(datos['hasta']), date.today()) if datos.get('hasta') else date.today()
    except (TypeError, ValueError):
        return jsonify({'error': 'La fecha «hasta» tiene que ser AAAA-MM-DD.'}), 400
    dias = max(1, min(dias, meta_ads_service.DIAS_MAXIMOS))
    try:
        resumen = meta_ads_service.sincronizar(hasta - timedelta(days=dias - 1), hasta)
    except meta_ads_service.ErrorDeMeta as error:
        return jsonify({'error': str(error)}), 502 if meta_ads_service.configurado() else 409
    return jsonify(resumen), 200


@bp.route('/meta/estado', methods=['POST'])
def sincronizar_estado_meta():
    """Lo que se cambió en el Administrador de anuncios (nombres, estados, campaña, conjunto) y el gasto
    de los últimos días. Body opcional: {"forzar": true} (el botón; sin él —la pantalla al volver de
    Meta— no corre si la última sincronización fue hace menos de unos minutos)."""
    datos = request.get_json(silent=True) or {}
    try:
        resumen = meta_ads_service.sincronizar_estado(forzar=bool(datos.get('forzar')))
    except meta_ads_service.ErrorDeMeta as error:
        return jsonify({'error': str(error)}), 502 if meta_ads_service.configurado() else 409
    return jsonify({**resumen, **_estado_de_meta()}), 200


@bp.route('/cron/meta', methods=['GET'])
@require_cron_secret
def cron_meta():
    """El cron diario: el gasto de la última semana (Meta todavía ajusta los días recientes)."""
    try:
        return jsonify({'status': 'success', **meta_ads_service.sincronizar()}), 200
    except meta_ads_service.ErrorDeMeta as error:
        return jsonify({'status': 'error', 'message': str(error)}), 502 if meta_ads_service.configurado() else 503
