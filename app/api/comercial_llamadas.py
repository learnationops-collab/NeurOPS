"""La lista detrás de cada cifra de «Destino de las agendas» y de «Por llamada» (Analizar › Closers, ADR-W144)."""
from flask import jsonify, request

from app.api.comercial import _alcance, _rangos, bp
from app.services import comercial_llamadas, paises_lectura, segmentos_lectura
from app.services.comercial_service import ROL_CLOSERS


@bp.route('/llamadas/registros', methods=['GET'])
def llamadas_registros():
    """`?que=` una marca (agendas · base · asistieron · ventas), un grupo del panel (show_up · no_show · canceladas ·
    reprogramadas · sin_reporte · por_ocurrir · descalificadas · descartadas) o un estado; `&llamada=` primera ·
    segunda · momentum (sin él, todas); `&previo=1`, el período comparado. Mismo alcance y filtros que `/resumen`."""
    rol, miembro_id, _ = _alcance()
    if rol != ROL_CLOSERS:
        return jsonify({'error': 'Esta lista es del tablero de closers.'}), 400
    start, end, prev_start, prev_end = _rangos()
    if request.args.get('previo') in ('1', 'true'):
        if not prev_start:
            return jsonify({'error': 'No hay un período de comparación elegido.'}), 400
        start, end = prev_start, prev_end
    try:
        filas = comercial_llamadas.filas_de_closing(
            start, end, miembro_id, segmentos_lectura.parsear(request.args.get('segmento')),
            paises_lectura.parsear(request.args.get('pais')))
        datos = comercial_llamadas.registros(filas, request.args.get('que', ''), request.args.get('llamada'))
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    return jsonify(datos), 200
