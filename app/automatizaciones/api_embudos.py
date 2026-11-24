"""Embudos en /api/inbox/embudos (ADR-W204), colgado del blueprint del Inbox.

Todos los ven y simulan (el setter, por `ACCIONES_DEL_SETTER`). Crear, renombrar, cambiar fases y
variables, y prender los seguimientos automáticos lo hace admin, operador o dirección comercial.
Lo que se manda en cada fase y sus seguimientos viven en la Guía de cada embudo (`api_guia.py`).
"""
from datetime import timedelta

from flask import jsonify
from flask_login import current_user

from app import db
from app.automatizaciones import embudos
from app.automatizaciones.api import ROLES_CON_ACCESO, _cuerpo, bp
from app.automatizaciones.modelos import IgContacto, ahora

DIAS_ACTIVOS = 30


def _leads():
    """{embudo_id guardado (None = Conversión): leads que escribieron en los últimos DIAS_ACTIVOS}."""
    filas = (db.session.query(IgContacto.embudo_id, db.func.count(IgContacto.id))
             .filter(IgContacto.ultimo_entrante_en >= ahora() - timedelta(days=DIAS_ACTIVOS))
             .group_by(IgContacto.embudo_id).all())
    return dict(filas)


def _o_404(slug):
    e = embudos.por_slug(slug)
    if e is None:
        return None, (jsonify({'message': 'Not found'}), 404)
    return e, None


@bp.route('/embudos', methods=['GET'])
def listar_embudos():
    leads = _leads()
    lista = [embudos.resumen(e, leads.get(embudos.id_guardado(e), 0)) for e in embudos.todos()]
    db.session.commit()  # por si recién se creó Conversión
    return jsonify({'embudos': lista, 'dias_leads': DIAS_ACTIVOS,
                    'puede_editar': current_user.role in ROLES_CON_ACCESO})


@bp.route('/embudos', methods=['POST'])
def crear_embudo():
    try:
        e = embudos.crear(_cuerpo())
    except embudos.EmbudoInvalido as error:
        return jsonify({'message': str(error)}), 400
    db.session.commit()
    return jsonify(embudos.resumen(e, 0)), 201


@bp.route('/embudos/<slug>', methods=['PUT'])
def actualizar_embudo(slug):
    e, error = _o_404(slug)
    if error:
        return error
    try:
        embudos.actualizar(e, _cuerpo(), current_user.role in ROLES_CON_ACCESO)
    except embudos.EmbudoInvalido as problema:
        return jsonify({'message': str(problema)}), 400
    except PermissionError as problema:
        return jsonify({'message': str(problema)}), 403
    db.session.commit()
    return jsonify(embudos.resumen(e, _leads().get(embudos.id_guardado(e), 0)))


@bp.route('/embudos/<slug>/simular', methods=['POST'])
def simular_embudo(slug):
    """`{acciones: [...], borrador: contenido de la Guía}` → la conversación simulada. No guarda nada."""
    e, error = _o_404(slug)
    if error:
        return error
    from app.automatizaciones import simulacion  # importa el motor: solo cuando se usa
    datos = _cuerpo()
    try:
        return jsonify(simulacion.simular(e, datos.get('acciones') or [], datos.get('borrador')))
    except simulacion.SimulacionInvalida as problema:
        return jsonify({'message': str(problema)}), 400
