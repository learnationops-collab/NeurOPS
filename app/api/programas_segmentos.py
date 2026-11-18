"""Programas y segmentos (Leadership 1395 y 1403, ADR-W177): cifras por programa (AL, RR, SI) y CAC/ROAS de Setting
por segmento A/B/C/D, con la lista detrás de cada cifra. Admin, dirección comercial y dirección de marketing.

Ver `programas_analitica` (por programa) y `segmentos_costos` (por segmento, gasto repartido por agendas).
"""
from datetime import date

from flask import Blueprint, jsonify, request

from app.decorators import _acceso_denegado
from app.models.user import ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL, ROLE_DIRECTOR_MARKETING
from app.services import programas_analitica, segmentos_costos
from app.services.comercial_service import ComercialService

bp = Blueprint('programas_segmentos', __name__)

ROLES_CON_ACCESO = (ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL, ROLE_DIRECTOR_MARKETING)
PERIODO_MAXIMO = 400


@bp.before_request
def _solo_direccion():
    return _acceso_denegado(ROLES_CON_ACCESO, 'Acceso de dirección requerido')


def _periodo():
    """(desde, hasta): `?desde&hasta` (Marketing) o `?period&start_date&end_date` (Dirección comercial); por defecto, el mes."""
    args = request.args
    try:
        if args.get('desde') and args.get('hasta'):
            desde, hasta = date.fromisoformat(args['desde']), date.fromisoformat(args['hasta'])
        else:
            desde, hasta = ComercialService.rango(args.get('period', 'mes'), args.get('start_date'), args.get('end_date'))
    except ValueError:
        raise ValueError('Las fechas van como AAAA-MM-DD.') from None
    if desde > hasta:
        desde, hasta = hasta, desde
    if (hasta - desde).days > PERIODO_MAXIMO:
        raise ValueError(f'El período no puede pasar de {PERIODO_MAXIMO} días.')
    return desde, hasta


@bp.route('', methods=['GET'])
def resumen():
    try:
        desde, hasta = _periodo()
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify({'desde': desde.isoformat(), 'hasta': hasta.isoformat(),
                    'programas': programas_analitica.resumen(desde, hasta),
                    'segmentos': segmentos_costos.resumen(desde, hasta)}), 200


@bp.route('/registros', methods=['GET'])
def registros():
    """`?metrica=&programa=` (por programa) o `?metrica=&segmento=` (por segmento; vacío = todo Setting)."""
    try:
        desde, hasta = _periodo()
        metrica = request.args.get('metrica') or ''
        if request.args.get('programa'):
            datos = programas_analitica.registros(desde, hasta, metrica, request.args['programa'])
        else:
            datos = segmentos_costos.registros(desde, hasta, metrica, request.args.get('segmento') or '')
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify(datos), 200
