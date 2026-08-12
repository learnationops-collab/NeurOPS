"""Captura de leads de las landings públicas de institute.thelearnation.com.

Estas rutas las llama el navegador de un visitante anónimo, así que:
  · van en el blueprint `public_api`, que está exento de CSRF (ver app/__init__.py);
  · el origen institute.thelearnation.com ya está en la lista blanca de CORS;
  · NUNCA devuelven datos personales. El contador expone un entero y nada más:
    la landing es pública y cualquiera puede pegarle.
"""
import logging
from datetime import datetime, timedelta

from flask import request, jsonify
from flask_login import login_required

from app import db
from app.models import WorkshopLead
from app.api.public import bp
from app.decorators import admin_required

# Largo máximo por campo de texto libre. Corta, no rechaza: preferimos guardar
# un lead con el nombre recortado antes que perderlo por un payload raro.
MAX_TEXTO = 80
MAX_UTM = 120

EXAMENES_CONOCIDOS = {'ENARM', 'MIR', 'USMLE', 'UNACOM', 'EUNACOM', 'Otro'}


def _limpiar(valor, largo=MAX_TEXTO):
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    return texto[:largo]


@bp.route('/public/workshop-lead', methods=['POST'])
def crear_workshop_lead():
    """Alta de un lead desde el gate de la landing.

    Es idempotente por dedupe_key: la landing reintenta los envíos fallidos, y
    sin esto un POST que llegó pero cuya respuesta se perdió generaría una fila
    nueva en cada reintento. Con la misma clave se actualiza la fila existente.
    """
    data = request.get_json(silent=True) or {}

    nombre = _limpiar(data.get('nombre'))
    if not nombre:
        return jsonify({"status": "error", "message": "El nombre es obligatorio"}), 400

    clave = _limpiar(data.get('dedupe_key'), 64)
    examen = _limpiar(data.get('examen'), 40)
    if examen and examen not in EXAMENES_CONOCIDOS:
        examen = examen[:40]

    try:
        lead = None
        if clave:
            lead = WorkshopLead.query.filter(WorkshopLead.dedupe_key == clave).first()

        if lead is None:
            lead = WorkshopLead(dedupe_key=clave)
            db.session.add(lead)

        lead.nombre = nombre
        lead.apellido = _limpiar(data.get('apellido'))
        lead.profesion = _limpiar(data.get('profesion'), 60)
        lead.etapa = _limpiar(data.get('etapa'), 60)
        lead.examen = examen

        lead.page_path = _limpiar(data.get('page_path'), 255)
        lead.utm_source = _limpiar(data.get('utm_source'), 64)
        lead.utm_medium = _limpiar(data.get('utm_medium'), 64)
        lead.utm_campaign = _limpiar(data.get('utm_campaign'), MAX_UTM)
        lead.utm_content = _limpiar(data.get('utm_content'), MAX_UTM)
        lead.utm_term = _limpiar(data.get('utm_term'), MAX_UTM)
        lead.referrer = _limpiar(request.referrer, 500)

        db.session.commit()

        logging.info(
            "[workshop-lead] %s · %s · utm=%s",
            lead.full_name, lead.examen, lead.utm_source
        )

        return jsonify({"status": "success", "id": lead.id}), 201

    except Exception as e:
        db.session.rollback()
        logging.error("[workshop-lead] Error al guardar: %s", e)
        return jsonify({"status": "error", "message": "Internal server error"}), 500


@bp.route('/public/workshop-lead/stats', methods=['GET'])
def stats_workshop_lead():
    """Contador público para la prueba social de la landing.

    Devuelve SOLO totales. Mientras el número real sea bajo la landing usa su
    contador simulado; el corte lo decide el front (ver CONTADOR en replay/).
    """
    try:
        total = db.session.query(db.func.count(WorkshopLead.id)).scalar() or 0
        desde = datetime.utcnow() - timedelta(hours=24)
        ultimas_24h = db.session.query(db.func.count(WorkshopLead.id)).filter(
            WorkshopLead.created_at >= desde
        ).scalar() or 0

        return jsonify({"total": total, "ultimas_24h": ultimas_24h}), 200
    except Exception as e:
        logging.error("[workshop-lead] Error en stats: %s", e)
        return jsonify({"total": 0, "ultimas_24h": 0}), 200


@bp.route('/public/workshop-lead/list', methods=['GET'])
@login_required
@admin_required
def listar_workshop_leads():
    """Listado para el panel. Protegido: acá sí salen datos personales."""
    try:
        limite = min(int(request.args.get('limit', 100)), 500)
    except (TypeError, ValueError):
        limite = 100

    query = WorkshopLead.query
    estado = request.args.get('status')
    if estado:
        query = query.filter(WorkshopLead.status == estado)

    leads = query.order_by(WorkshopLead.created_at.desc()).limit(limite).all()
    return jsonify([l.to_dict() for l in leads]), 200
