"""Latidos de la landing de la grabacion.

La landing manda un POST cada ~15 s con la sesion acumulada. Esto es un UPSERT
por session_key: una fila por visita, no un evento por latido.

Decisiones que conviene no "arreglar":
  · Los contadores de tiempo se toman por MAXIMO, no se suman ni se pisan. Un
    latido que llega tarde o repetido no puede achicar la permanencia, y dos
    pestañas de la misma sesion no la duplican.
  · Los hitos solo pasan de False a True. Nunca se apagan: si el navegador
    manda un payload incompleto, no perdemos que la persona dio play.
  · El tiempo se limita a un techo razonable. Un reloj de cliente mal puesto o
    un payload manipulado no puede meter 400 horas y arruinar el promedio.
"""
import logging

from flask import request, jsonify

from app import db
from app.models import LandingSession, WorkshopLead
from app.api.public import bp

# Techo por sesion: 6 h de pagina visible. Nadie mira una clase de 1 h durante
# mas que eso; lo que pase el techo es reloj roto o payload inventado.
MAX_SEGUNDOS = 6 * 3600


def _entero(valor, tope=MAX_SEGUNDOS):
    try:
        n = int(float(valor))
    except (TypeError, ValueError):
        return 0
    if n < 0:
        return 0
    return min(n, tope)


def _texto(valor, largo):
    if valor is None:
        return None
    t = str(valor).strip()
    return t[:largo] if t else None


@bp.route('/public/landing-session', methods=['POST'])
def registrar_landing_session():
    data = request.get_json(silent=True) or {}

    clave = _texto(data.get('session_key'), 64)
    if not clave:
        return jsonify({"status": "error", "message": "session_key es obligatorio"}), 400

    try:
        sesion = LandingSession.query.filter_by(session_key=clave).first()
        if sesion is None:
            sesion = LandingSession(session_key=clave)
            db.session.add(sesion)
            # Los datos de procedencia solo se fijan al crear: si llegaran
            # distintos en un latido posterior seria ruido, no un dato nuevo.
            sesion.page_path = _texto(data.get('page_path'), 255)
            sesion.referrer = _texto(request.referrer, 500)
            sesion.dispositivo = 'movil' if data.get('movil') else 'escritorio'
            sesion.utm_source = _texto(data.get('utm_source'), 64)
            sesion.utm_medium = _texto(data.get('utm_medium'), 64)
            sesion.utm_campaign = _texto(data.get('utm_campaign'), 120)
            sesion.utm_content = _texto(data.get('utm_content'), 120)
            sesion.utm_term = _texto(data.get('utm_term'), 120)

        # Tiempos: siempre el mayor entre lo guardado y lo que llega
        sesion.segundos_visible = max(sesion.segundos_visible or 0,
                                      _entero(data.get('segundos_visible')))
        sesion.segundos_video = max(sesion.segundos_video or 0,
                                    _entero(data.get('segundos_video')))

        # Hitos: solo se encienden
        for campo in ('abrio_gate', 'completo_gate', 'dio_play', 'vio_oferta', 'clic_agenda'):
            if data.get(campo):
                setattr(sesion, campo, True)

        # Vinculo con el lead, si completo el gate en esta visita
        clave_lead = _texto(data.get('dedupe_key'), 64)
        if clave_lead and not sesion.workshop_lead_id:
            lead = WorkshopLead.query.filter_by(dedupe_key=clave_lead).first()
            if lead:
                sesion.workshop_lead_id = lead.id

        db.session.commit()
        return jsonify({"status": "success"}), 200

    except Exception as e:
        db.session.rollback()
        logging.error("[landing-session] Error al guardar: %s", e)
        return jsonify({"status": "error", "message": "Internal server error"}), 500
