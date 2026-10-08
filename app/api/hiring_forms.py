"""Panel de Hiring → Forms y Búsqueda: editor de los formularios de postulación y
configuración de la búsqueda.

Autenticado (`admin` y el rol acotado `hiring`, igual que el resto del panel).
Las preguntas se guardan con el esquema del formulario público (ver
app/services/hiring_forms.py); acá solo se valida y se persiste. El editor
guarda solo, con un debounce, así que el PUT de un formulario se llama seguido:
no hace más que validar, guardar y contar respuestas.

Un solo formulario `activo` a la vez: es el que lee el formulario público.
"""
import copy
import logging
from datetime import date

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.decorators import hiring_required
from app.models import AssistantApplication, HiringConfig, HiringForm
from app.services import hiring_forms as hf

bp = Blueprint('hiring_forms', __name__)

MAX_NOMBRE = 120
MAX_PUESTO = 160


def _listado():
    """Payload del GET de la lista (lo devuelve también activar): el activo
    primero y después del más nuevo al más viejo."""
    forms = HiringForm.query.order_by(
        HiringForm.activo.desc(), HiringForm.created_at.desc(), HiringForm.id.desc()).all()
    respuestas = hf.respuestas_por_form()
    activo = next((f for f in forms if f.activo), None)
    return {
        "forms": [hf.form_dict(f, respuestas) for f in forms],
        "activo_id": activo.id if activo else None,
    }


def _completo(form):
    return hf.form_dict(form, con_preguntas=True)


def _nombre_valido(valor):
    nombre = (valor or '').strip() if isinstance(valor, str) else ''
    if not nombre:
        return None, "El formulario necesita un nombre."
    if len(nombre) > MAX_NOMBRE:
        return None, f"El nombre puede tener hasta {MAX_NOMBRE} caracteres."
    return nombre, None


def _guardar(respuesta_ok, contexto):
    try:
        db.session.commit()
        return respuesta_ok()
    except Exception as e:
        db.session.rollback()
        logging.error("[hiring-forms] Error al %s: %s", contexto, e)
        return jsonify({"message": f"Error interno al {contexto}"}), 500


@bp.route('/hiring/forms', methods=['GET'])
@login_required
@hiring_required
def listar_forms():
    hf.asegurar_semilla()
    return jsonify(_listado()), 200


@bp.route('/hiring/forms', methods=['POST'])
@login_required
@hiring_required
def crear_form():
    """Formulario nuevo, INACTIVO, copiado de `desde_id` o del activo (o de las
    preguntas base si no hay ninguno activo)."""
    hf.asegurar_semilla()
    data = request.get_json(silent=True) or {}
    nombre, error = _nombre_valido(data.get('nombre'))
    if error:
        return jsonify({"message": error}), 400

    desde_id = data.get('desde_id')
    if desde_id is not None:
        origen = db.session.get(HiringForm, desde_id) if isinstance(desde_id, int) else None
        if origen is None:
            return jsonify({"message": "No existe el formulario del que querés copiar."}), 404
    else:
        origen = hf.form_activo()
    preguntas = copy.deepcopy(origen.preguntas if origen else hf.PREGUNTAS_BASE)

    form = HiringForm(nombre=nombre, activo=False, preguntas=preguntas, created_by_id=current_user.id)
    db.session.add(form)
    return _guardar(lambda: (jsonify(_completo(form)), 201), 'crear el formulario')


@bp.route('/hiring/forms/<int:form_id>', methods=['GET'])
@login_required
@hiring_required
def ver_form(form_id):
    hf.asegurar_semilla()
    form = HiringForm.query.get_or_404(form_id)
    return jsonify(_completo(form)), 200


@bp.route('/hiring/forms/<int:form_id>', methods=['PUT'])
@login_required
@hiring_required
def editar_form(form_id):
    hf.asegurar_semilla()
    form = HiringForm.query.get_or_404(form_id)
    data = request.get_json(silent=True) or {}

    if 'nombre' in data:
        nombre, error = _nombre_valido(data.get('nombre'))
        if error:
            return jsonify({"message": error}), 400
        form.nombre = nombre
    if 'preguntas' in data:
        try:
            hf.validar_preguntas(data['preguntas'])
        except hf.PreguntasInvalidas as e:
            db.session.rollback()
            return jsonify({"message": str(e)}), 400
        # Lista nueva (no se muta la vieja): db.JSON solo detecta reasignaciones.
        form.preguntas = data['preguntas']

    return _guardar(lambda: (jsonify(_completo(form)), 200), 'guardar el formulario')


@bp.route('/hiring/forms/<int:form_id>/activar', methods=['POST'])
@login_required
@hiring_required
def activar_form(form_id):
    """`activo: true` lo deja como el único activo; `activo: false` lo apaga y
    entonces el formulario público queda sin formulario."""
    hf.asegurar_semilla()
    form = HiringForm.query.get_or_404(form_id)
    data = request.get_json(silent=True) or {}
    activo = data.get('activo', True)
    if not isinstance(activo, bool):
        return jsonify({"message": "`activo` tiene que ser true o false."}), 400

    if activo:
        HiringForm.query.filter(HiringForm.id != form.id, HiringForm.activo.is_(True)).update(
            {HiringForm.activo: False}, synchronize_session=False)
    form.activo = activo
    return _guardar(lambda: (jsonify(_listado()), 200), 'activar el formulario')


@bp.route('/hiring/forms/<int:form_id>/duplicar', methods=['POST'])
@login_required
@hiring_required
def duplicar_form(form_id):
    hf.asegurar_semilla()
    origen = HiringForm.query.get_or_404(form_id)
    copia = HiringForm(
        nombre=f'{origen.nombre} · copia'[:MAX_NOMBRE], activo=False,
        preguntas=copy.deepcopy(origen.preguntas), created_by_id=current_user.id,
    )
    db.session.add(copia)
    return _guardar(lambda: (jsonify(_completo(copia)), 201), 'duplicar el formulario')


@bp.route('/hiring/forms/<int:form_id>', methods=['DELETE'])
@login_required
@hiring_required
def borrar_form(form_id):
    """No se borra el activo (el formulario público se quedaría sin preguntas) ni
    uno que ya tiene postulaciones (perderían con qué preguntas se contestaron)."""
    hf.asegurar_semilla()
    form = HiringForm.query.get_or_404(form_id)
    if form.activo:
        return jsonify({"message": "No se puede borrar el formulario activo: activá otro o desactivalo primero."}), 409
    con_postulaciones = AssistantApplication.query.filter_by(form_id=form.id).count()
    if con_postulaciones:
        return jsonify({
            "message": f"No se puede borrar: tiene {con_postulaciones} postulación(es) contestadas con él. "
                       "Podés dejarlo inactivo.",
        }), 409
    db.session.delete(form)
    return _guardar(lambda: (jsonify({"status": "success", "id": form_id}), 200), 'borrar el formulario')


# --- Configuración de la búsqueda -------------------------------------------------------------

@bp.route('/hiring/config', methods=['GET'])
@login_required
@hiring_required
def ver_config():
    return jsonify(HiringConfig.vigente().to_dict()), 200


def _entero_positivo(valor, campo):
    if isinstance(valor, bool) or not isinstance(valor, (int, float)) or int(valor) != valor or valor <= 0:
        raise ValueError(f"{campo} tiene que ser un número entero mayor que cero.")
    return int(valor)


@bp.route('/hiring/config', methods=['PUT'])
@login_required
@hiring_required
def guardar_config():
    """Acepta los campos que vengan; los que no, quedan como estaban."""
    data = request.get_json(silent=True) or {}
    config = HiringConfig.vigente()
    try:
        if 'puesto' in data:
            puesto = data['puesto'].strip() if isinstance(data['puesto'], str) else ''
            if not puesto or len(puesto) > MAX_PUESTO:
                raise ValueError(f"El puesto necesita un nombre de hasta {MAX_PUESTO} caracteres.")
            config.puesto = puesto
        if 'cierre' in data:
            cierre = data['cierre']
            if cierre in (None, ''):
                config.cierre = None
            else:
                try:
                    config.cierre = date.fromisoformat(str(cierre))
                except ValueError:
                    raise ValueError("La fecha de cierre va como AAAA-MM-DD.")
        if 'presupuesto_min' in data:
            config.presupuesto_min = _entero_positivo(data['presupuesto_min'], "El presupuesto mínimo")
        if 'presupuesto_max' in data:
            config.presupuesto_max = _entero_positivo(data['presupuesto_max'], "El presupuesto máximo")
        if config.presupuesto_min > config.presupuesto_max:
            raise ValueError("El presupuesto mínimo no puede ser mayor que el máximo.")
        if 'tasa_brl' in data:
            tasa = data['tasa_brl']
            if isinstance(tasa, bool) or not isinstance(tasa, (int, float)) or not 0 < tasa < 100:
                raise ValueError("La tasa USD → BRL tiene que ser un número entre 0 y 100.")
            config.tasa_brl = float(tasa)
    except ValueError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 400

    if config.id is None:
        db.session.add(config)
    return _guardar(lambda: (jsonify(config.to_dict()), 200), 'guardar la configuración')
