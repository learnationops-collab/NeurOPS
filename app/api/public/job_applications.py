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
from app.models import JobApplication
from app.api.public import bp

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


@bp.route('/public/job-applications', methods=['POST'])
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
        _set_si_presente(app_row, 'aportes', _lista(data.get('aportes')))
        _set_si_presente(app_row, 'habilidades', _texto(data.get('habilidades'), MAX_LARGO))
        _set_si_presente(app_row, 'obstaculo', _texto(data.get('obstaculo'), MAX_LARGO))
        _set_si_presente(app_row, 'objetivos', _texto(data.get('objetivos'), MAX_LARGO))
        _set_si_presente(app_row, 'porque', _lista(data.get('porque')))
        _set_si_presente(app_row, 'fuente', _texto(data.get('fuente'), 60))
        _set_si_presente(app_row, 'bolsa', _texto(data.get('bolsa'), 120))
        _set_si_presente(app_row, 'video', _texto(data.get('video'), 500))
        _set_si_presente(app_row, 'llamada', _texto(data.get('llamada'), 500))
        # Solo se prende: mismo motivo que arriba, un request viejo (completo=False)
        # no debe apagar una postulación que otro más nuevo ya marcó terminada.
        app_row.completo = app_row.completo or bool(data.get('completo'))

        db.session.commit()

        logging.info("[job-application] %s · %s", app_row.nombre, app_row.email)

        return jsonify({"status": "success", "id": app_row.id}), 201

    except Exception as e:
        db.session.rollback()
        logging.error("[job-application] Error al guardar: %s", e)
        return jsonify({"status": "error", "message": "Internal server error"}), 500
