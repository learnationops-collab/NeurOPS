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


@bp.route('/public/job-applications', methods=['POST'])
def crear_job_application():
    data = request.get_json(silent=True) or {}

    nombre = _texto(data.get('nombre'), 120)
    email = _texto(data.get('email'), 160)
    if not nombre:
        return jsonify({"status": "error", "message": "El nombre es obligatorio"}), 400
    if not email:
        return jsonify({"status": "error", "message": "El correo es obligatorio"}), 400

    clave = _texto(data.get('dedupe_key'), 64)

    try:
        app_row = None
        if clave:
            app_row = JobApplication.query.filter(JobApplication.dedupe_key == clave).first()

        if app_row is None:
            app_row = JobApplication(dedupe_key=clave)
            db.session.add(app_row)

        app_row.nombre = nombre
        app_row.email = email
        app_row.disclaimer = _texto(data.get('disclaimer'), 10)
        app_row.whatsapp = _texto(data.get('whatsapp'), 40)
        app_row.edad = _texto(data.get('edad'), 40)
        app_row.pais = _texto(data.get('pais'), 60)
        app_row.instagram = _texto(data.get('instagram'), 80)
        app_row.dedicacion = _texto(data.get('dedicacion'), MAX_LARGO)
        app_row.conocimiento = _texto(data.get('conocimiento'), 60)
        app_row.formacion = _texto(data.get('formacion'), MAX_LARGO)
        app_row.cierre = _cierre(data.get('cierre'))
        app_row.ingles = _texto(data.get('ingles'), 20)
        app_row.herramientas = _lista(data.get('herramientas'))
        app_row.reporte = _texto(data.get('reporte'), 160)
        app_row.aportes = _lista(data.get('aportes'))
        app_row.habilidades = _texto(data.get('habilidades'), MAX_LARGO)
        app_row.obstaculo = _texto(data.get('obstaculo'), MAX_LARGO)
        app_row.objetivos = _texto(data.get('objetivos'), MAX_LARGO)
        app_row.porque = _lista(data.get('porque'))
        app_row.fuente = _texto(data.get('fuente'), 60)
        app_row.bolsa = _texto(data.get('bolsa'), 120)
        app_row.video = _texto(data.get('video'), 500)
        app_row.llamada = _texto(data.get('llamada'), 500)

        db.session.commit()

        logging.info("[job-application] %s · %s", app_row.nombre, app_row.email)

        return jsonify({"status": "success", "id": app_row.id}), 201

    except Exception as e:
        db.session.rollback()
        logging.error("[job-application] Error al guardar: %s", e)
        return jsonify({"status": "error", "message": "Internal server error"}), 500
