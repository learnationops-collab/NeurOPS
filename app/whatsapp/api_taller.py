"""/api/whatsapp/talleres: el broadcast de cada taller (ADR-W259), desde Planificar. Mismo permiso que Workshop.

  · GET  /talleres?ids=1,2              → {talleres: {id: {contactos, pasos, programados, lanzados}}, estandar}
  · GET  /talleres/<id>                 → el plan (lo crea con la copia del estándar), su audiencia y sus pasos.
  · PUT  /talleres/<id>                 → {descartes?, etiqueta?, pasos?}: cambia lo que todavía no salió.
  · POST /talleres/<id>/audiencia       → {csv} | {no_cerraron: [taller ids]} | {etiqueta}: suma a la audiencia.
  · POST /talleres/<id>/programar       → los borradores pasan a programado; los manda el reloj del motor.
  · POST /talleres/<id>/pausar          → los programados vuelven a borrador.
  · POST /talleres/<id>/estandar        → sus pasos pasan a ser el flujo con que arranca cada taller nuevo.
  · GET  /talleres/<id>/pasos/<paso>    → los números de ese paso, con lo que pasó con cada uno.
"""
from datetime import datetime

from flask import jsonify, request
from flask_login import current_user, login_required

from app import db
from app.decorators import workshop_required
from app.models import WorkshopEvent
from app.models.whatsapp_taller import WaPasoTaller
from app.whatsapp import audiencia, envios, historial, taller
from app.whatsapp.api import _filas, bp


def _evento_o_404(evento_id):
    evento = db.session.get(WorkshopEvent, evento_id)
    if evento is None:
        return None, (jsonify({'message': 'Taller no encontrado'}), 404)
    return evento, None


def _hoy():
    return {'usados': envios.usados_hoy(datetime.utcnow()), 'tope': envios.TOPE_DIARIO}


def _respuesta(plan, evento, **extra):
    return jsonify({**taller.a_json(plan, evento), 'hoy': _hoy(), **extra})


@bp.route('/talleres', methods=['GET'])
@login_required
@workshop_required
def resumen_talleres():
    try:
        ids = [int(x) for x in request.args.get('ids', '').split(',') if x.strip()]
    except ValueError:
        return jsonify({'message': 'ids inválidos'}), 400
    return jsonify(taller.resumenes(ids[:60]))


@bp.route('/talleres/<int:evento_id>', methods=['GET'])
@login_required
@workshop_required
def ver_taller(evento_id):
    evento, error = _evento_o_404(evento_id)
    if error:
        return error
    return _respuesta(taller.plan_de(evento), evento)


@bp.route('/talleres/<int:evento_id>', methods=['PUT'])
@login_required
@workshop_required
def guardar_taller(evento_id):
    evento, error = _evento_o_404(evento_id)
    if error:
        return error
    plan = taller.plan_de(evento)
    try:
        taller.guardar(plan, request.get_json(silent=True) or {})
    except (taller.PasoInvalido, TypeError, ValueError) as e:
        db.session.rollback()
        return jsonify({'message': str(e) if isinstance(e, taller.PasoInvalido) else 'Datos inválidos'}), 400
    return _respuesta(plan, evento)


@bp.route('/talleres/<int:evento_id>/audiencia', methods=['POST'])
@login_required
@workshop_required
def sumar_audiencia(evento_id):
    evento, error = _evento_o_404(evento_id)
    if error:
        return error
    plan = taller.plan_de(evento)
    datos = request.get_json(silent=True) or {}
    if isinstance(datos.get('no_cerraron'), list):
        try:
            filas = audiencia.no_cerraron([int(i) for i in datos['no_cerraron']][:60])
        except (TypeError, ValueError):
            return jsonify({'message': 'Talleres inválidos'}), 400
    elif datos.get('etiqueta'):
        filas = audiencia.de_etiqueta(str(datos['etiqueta']).strip())
    else:
        filas = _filas(datos)
    if not filas:
        return jsonify({'message': 'No llegó ningún número'}), 400
    carga = audiencia.sumar(plan.etiqueta, filas, current_user.id, datetime.utcnow())
    return _respuesta(plan, evento, carga=carga)


@bp.route('/talleres/<int:evento_id>/programar', methods=['POST'])
@login_required
@workshop_required
def programar_taller(evento_id):
    evento, error = _evento_o_404(evento_id)
    if error:
        return error
    plan = taller.plan_de(evento)
    try:
        n = taller.programar(plan, evento)
    except taller.PasoInvalido as e:
        return jsonify({'message': str(e)}), 400
    return _respuesta(plan, evento, programados=n)


@bp.route('/talleres/<int:evento_id>/pausar', methods=['POST'])
@login_required
@workshop_required
def pausar_taller(evento_id):
    evento, error = _evento_o_404(evento_id)
    if error:
        return error
    plan = taller.plan_de(evento)
    return _respuesta(plan, evento, pausados=taller.pausar(plan))


@bp.route('/talleres/<int:evento_id>/estandar', methods=['POST'])
@login_required
@workshop_required
def guardar_estandar(evento_id):
    evento, error = _evento_o_404(evento_id)
    if error:
        return error
    return jsonify({'pasos': taller.guardar_como_estandar(taller.plan_de(evento))})


@bp.route('/talleres/<int:evento_id>/pasos/<int:paso_id>', methods=['GET'])
@login_required
@workshop_required
def numeros_del_paso(evento_id, paso_id):
    paso = db.session.get(WaPasoTaller, paso_id)
    if paso is None or paso.plan.event_id != evento_id:
        return jsonify({'message': 'Paso no encontrado'}), 404
    return jsonify({'numeros': historial.numeros(paso.lote) if paso.lote else []})
