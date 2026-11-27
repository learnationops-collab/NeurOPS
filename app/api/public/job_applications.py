"""Alta pública de postulaciones al puesto de Closer de ventas, desde el
formulario de institute.thelearnation.com/formulario.

Mismo patrón que workshop_lead.py:
  · va en el blueprint `public_api`, exento de CSRF (ver app/__init__.py);
  · institute.thelearnation.com ya está en la lista blanca de CORS;
  · upsert por dedupe_key: la landing reenvía en "Editar mis respuestas", y
    sin esto cada edición o reintento de red generaría una fila nueva.
"""
import logging

from flask import request, jsonify

from app import db
from app.models import HiringForm, JobApplication
from app.models.job_application import CAMPOS_FORMULARIO
from app.api.public import bp
from app.services import hiring_forms, hiring_forms_closer
from app.services.limite_intentos import limitar

MAX_CORTO = 160
MAX_LARGO = 4000
MAX_LISTA = 20


def _texto(valor, largo=MAX_CORTO):
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    return texto[:largo]


def _url(valor):
    """Un link http(s) o None: el panel lo pone en un href, y un `javascript:` correría en Work."""
    texto = _texto(valor, 500)
    return texto if texto and texto.lower().startswith(('http://', 'https://')) else None


def _lista(valor):
    if not isinstance(valor, list):
        return None
    return [str(v).strip()[:MAX_CORTO] for v in valor[:MAX_LISTA] if str(v).strip()]


def _cierre(valor):
    if valor is None or valor == '':
        return None
    if valor == 'nada':
        return 'nada'
    try:
        return str(int(round(float(valor))))
    except (TypeError, ValueError):
        return None


def _set_si_presente(app_row, campo, valor):
    """Asigna solo si el valor viene con algo. El guardado progresivo manda el
    formulario acumulado en CADA pregunta, y esas peticiones pueden llegarle
    al servidor desordenadas (red móvil, reintentos); si una más vieja (con
    menos campos contestados todavía) llega después de una más nueva, no debe
    borrar lo que esa más nueva ya había guardado. Por eso nunca se pisa un
    campo con "vacío" — solo se actualiza cuando hay un valor real."""
    if valor is None:
        return
    if isinstance(valor, list) and len(valor) == 0:
        return
    setattr(app_row, campo, valor)


# Claves del payload que no son respuestas: nunca van a `respuestas_extra`.
RESERVADAS = {'nombre', 'dedupe_key', 'completo', 'form_id'}


@bp.route('/public/closer-form', methods=['GET'])
def ver_closer_form():
    """Las preguntas prendidas del formulario de Closer (Talent › Forms, ADR-W280), en orden y
    sin las claves del editor, y su cierre. Inactivo: `activo: false` (la página muestra la
    búsqueda cerrada). `?preview=<id>`: el mismo formulario para la vista previa del editor."""
    form = hiring_forms_closer.asegurar_closer()
    data = {
        "activo": bool(form.activo),
        "id": form.id,
        "nombre": form.nombre,
        "preguntas": hiring_forms.preguntas_publicas(form),
        "cierre": form.cierre_dict(),
    }
    if request.args.get('preview'):
        data["preview"] = True
    return jsonify(data), 200


def _guardar_extras(app_row, data):
    """Las respuestas a preguntas del formulario que no tienen columna van a `respuestas_extra`.
    Lo que no viene en este POST no borra lo que ya estaba (mismo criterio que `_set_si_presente`)."""
    form = db.session.get(HiringForm, app_row.form_id) if app_row.form_id else None
    if form is None:
        return
    extras = dict(app_row.respuestas_extra or {})
    cambio = False
    for pregunta in form.preguntas or []:
        pid = pregunta.get('id') if isinstance(pregunta, dict) else None
        if not pid or pid in CAMPOS_FORMULARIO or pid in RESERVADAS:
            continue
        valor = data.get(pid)
        valor = _lista(valor) if isinstance(valor, list) else _texto(valor, MAX_LARGO)
        if valor and extras.get(pid) != valor:
            extras[pid] = valor
            cambio = True
    if cambio:
        app_row.respuestas_extra = extras  # dict nuevo: db.JSON solo detecta reasignaciones


def _form_closer(valor):
    if isinstance(valor, str) and valor.strip().isdigit():
        valor = int(valor.strip())
    if isinstance(valor, bool) or not isinstance(valor, int):
        return None
    form = db.session.get(HiringForm, valor)
    return form if form is not None and form.puesto == 'closer' else None


@bp.route('/public/job-applications', methods=['POST'])
@limitar('job-applications', 120, 10 * 60)
def crear_job_application():
    """Alta/actualización de una postulación.

    Guardado progresivo: la landing llama esto en CADA pregunta respondida
    (no solo al final), así que la mayoría de los POST llegan con el
    formulario a medio completar. Solo el nombre es obligatorio — es la
    primera pregunta, así que ya está contestado en el primer autosave.
    `completo` (bool) lo manda la landing cuando el candidato llegó a la
    pantalla final; antes de eso la fila queda con completo=False.
    """
    data = request.get_json(silent=True) or {}

    nombre = _texto(data.get('nombre'), 120)
    if not nombre:
        return jsonify({"status": "error", "message": "El nombre es obligatorio"}), 400

    clave = _texto(data.get('dedupe_key'), 64)

    try:
        app_row = None
        if clave:
            app_row = JobApplication.query.filter(JobApplication.dedupe_key == clave).first()

        if app_row is None:
            app_row = JobApplication(dedupe_key=clave, email='')
            db.session.add(app_row)

        app_row.nombre = nombre
        _set_si_presente(app_row, 'email', _texto(data.get('email'), 160))
        _set_si_presente(app_row, 'disclaimer', _texto(data.get('disclaimer'), 10))
        _set_si_presente(app_row, 'whatsapp', _texto(data.get('whatsapp'), 40))
        _set_si_presente(app_row, 'edad', _texto(data.get('edad'), 40))
        _set_si_presente(app_row, 'pais', _texto(data.get('pais'), 60))
        _set_si_presente(app_row, 'instagram', _texto(data.get('instagram'), 80))
        _set_si_presente(app_row, 'dedicacion', _texto(data.get('dedicacion'), MAX_LARGO))
        _set_si_presente(app_row, 'conocimiento', _texto(data.get('conocimiento'), 60))
        _set_si_presente(app_row, 'formacion', _texto(data.get('formacion'), MAX_LARGO))
        _set_si_presente(app_row, 'cierre', _cierre(data.get('cierre')))
        _set_si_presente(app_row, 'ingles', _texto(data.get('ingles'), 20))
        _set_si_presente(app_row, 'herramientas', _lista(data.get('herramientas')))
        _set_si_presente(app_row, 'reporte', _texto(data.get('reporte'), 160))
        # 'aportes' y 'porque' eran checkboxes (listas) y pasaron a ser
        # preguntas abiertas de texto libre en el formulario (ver
        # institute-site) — se guardan igual como texto en la misma columna
        # JSON, las postulaciones viejas quedan con su lista original.
        _set_si_presente(app_row, 'aportes', _texto(data.get('aportes'), MAX_LARGO))
        _set_si_presente(app_row, 'habilidades', _texto(data.get('habilidades'), MAX_LARGO))
        _set_si_presente(app_row, 'obstaculo', _texto(data.get('obstaculo'), MAX_LARGO))
        _set_si_presente(app_row, 'objetivos', _texto(data.get('objetivos'), MAX_LARGO))
        _set_si_presente(app_row, 'porque_mejor_opcion', _texto(data.get('porque_mejor_opcion'), MAX_LARGO))
        _set_si_presente(app_row, 'porque', _texto(data.get('porque'), MAX_LARGO))
        _set_si_presente(app_row, 'fuente', _texto(data.get('fuente'), 60))
        _set_si_presente(app_row, 'bolsa', _texto(data.get('bolsa'), 120))
        _set_si_presente(app_row, 'video', _url(data.get('video')))
        _set_si_presente(app_row, 'llamada', _url(data.get('llamada')))
        # Solo se prende: mismo motivo que arriba, un request viejo (completo=False)
        # no debe apagar una postulación que otro más nuevo ya marcó terminada.
        app_row.completo = app_row.completo or bool(data.get('completo'))
        if app_row.form_id is None:
            form = _form_closer(data.get('form_id'))
            if form is not None:
                app_row.form_id = form.id
        _guardar_extras(app_row, data)

        db.session.commit()

        logging.info("[job-application] %s · %s", app_row.nombre, app_row.email)

        return jsonify({"status": "success", "id": app_row.id}), 201

    except Exception as e:
        db.session.rollback()
        logging.error("[job-application] Error al guardar: %s", e)
        return jsonify({"status": "error", "message": "Internal server error"}), 500
