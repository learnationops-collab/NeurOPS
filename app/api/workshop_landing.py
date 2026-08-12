"""Panel de la landing de la grabacion (/replay/) — solo administradores.

Se cuelga del blueprint `workshop` para que viva en la misma pestaña del panel
que el workshop en vivo, pero mide un embudo distinto:

  WORKSHOP EN VIVO  -> la clase en vivo, fuente 'workshop'
  WORKSHOP LANDING  -> la grabacion en /replay/, fuente 'workshop landing'

Estos endpoints SI devuelven datos personales, asi que van todos con
@login_required + @admin_required. El contador publico de la landing usa
/api/public/workshop-lead/stats, que solo devuelve enteros.
"""
import logging
from datetime import datetime, timedelta

from flask import request, jsonify
from flask_login import login_required
from sqlalchemy import func

from app import db
from app.models import LandingSession, WorkshopLead, FinancialAgenda, Client
from app.decorators import admin_required
from app.services.fuente_service import es_workshop_landing, es_workshop_vivo
from app.api.workshop import bp

logger = logging.getLogger(__name__)

RANGO_POR_DEFECTO = 30   # dias


def _rango():
    """Lee ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD; por defecto, ultimos 30 dias."""
    hasta_str = request.args.get('hasta')
    desde_str = request.args.get('desde')

    try:
        hasta = datetime.strptime(hasta_str, '%Y-%m-%d') + timedelta(days=1) if hasta_str \
            else datetime.utcnow() + timedelta(days=1)
    except ValueError:
        hasta = datetime.utcnow() + timedelta(days=1)

    try:
        desde = datetime.strptime(desde_str, '%Y-%m-%d') if desde_str \
            else hasta - timedelta(days=RANGO_POR_DEFECTO + 1)
    except ValueError:
        desde = hasta - timedelta(days=RANGO_POR_DEFECTO + 1)

    return desde, hasta


def _pct(parte, total):
    return round(parte / total * 100, 1) if total else 0.0


@bp.route('/landing/leads', methods=['GET'])
@login_required
@admin_required
def listar_leads_landing():
    """Personas que completaron el gate, con su comportamiento en la pagina."""
    desde, hasta = _rango()
    try:
        limite = min(int(request.args.get('limit', 200)), 1000)
    except (TypeError, ValueError):
        limite = 200

    q = WorkshopLead.query.filter(
        WorkshopLead.created_at >= desde,
        WorkshopLead.created_at < hasta
    )

    examen = request.args.get('examen')
    if examen:
        q = q.filter(WorkshopLead.examen == examen)

    leads = q.order_by(WorkshopLead.created_at.desc()).limit(limite).all()

    # Una sola consulta para las sesiones de todos los leads, en vez de una por
    # lead dentro del bucle.
    ids = [l.id for l in leads]
    sesiones = {}
    if ids:
        for s in LandingSession.query.filter(LandingSession.workshop_lead_id.in_(ids)).all():
            # Si hubo varias, nos quedamos con la de mayor permanencia
            previa = sesiones.get(s.workshop_lead_id)
            if not previa or (s.segundos_visible or 0) > (previa.segundos_visible or 0):
                sesiones[s.workshop_lead_id] = s

    salida = []
    for l in leads:
        d = l.to_dict()
        s = sesiones.get(l.id)
        d['sesion'] = s.to_dict() if s else None
        d['segundos_visible'] = (s.segundos_visible if s else 0) or 0
        d['segundos_video'] = (s.segundos_video if s else 0) or 0
        d['dio_play'] = bool(s.dio_play) if s else False
        d['vio_oferta'] = bool(s.vio_oferta) if s else False
        d['etapa'] = s.etapa if s else 'completo_gate'
        salida.append(d)

    return jsonify(salida), 200


@bp.route('/landing/sesiones', methods=['GET'])
@login_required
@admin_required
def listar_sesiones_landing():
    """Todas las visitas, hayan completado el gate o no.

    Es lo que responde "cuanta gente entro y intento ver el video": los que
    dieron play sin registrarse tambien aparecen aca.
    """
    desde, hasta = _rango()
    try:
        limite = min(int(request.args.get('limit', 300)), 1000)
    except (TypeError, ValueError):
        limite = 300

    q = LandingSession.query.filter(
        LandingSession.created_at >= desde,
        LandingSession.created_at < hasta
    )

    etapa = request.args.get('etapa')
    if etapa == 'dio_play':
        q = q.filter(LandingSession.dio_play.is_(True))
    elif etapa == 'sin_registro':
        q = q.filter(LandingSession.completo_gate.is_(False))

    sesiones = q.order_by(LandingSession.created_at.desc()).limit(limite).all()

    salida = []
    for s in sesiones:
        d = s.to_dict()
        d['lead'] = s.lead.to_dict() if s.lead else None
        salida.append(d)

    return jsonify(salida), 200


@bp.route('/landing/stats', methods=['GET'])
@login_required
@admin_required
def stats_landing():
    """KPIs del embudo de la grabacion + rendimiento de la fuente."""
    desde, hasta = _rango()

    base = LandingSession.query.filter(
        LandingSession.created_at >= desde,
        LandingSession.created_at < hasta
    )

    visitas = base.count()

    def cuantos(campo):
        return base.filter(getattr(LandingSession, campo).is_(True)).count()

    abrio = cuantos('abrio_gate')
    completo = cuantos('completo_gate')
    play = cuantos('dio_play')
    oferta = cuantos('vio_oferta')
    agenda = cuantos('clic_agenda')

    # Promedios solo sobre quienes efectivamente hicieron la accion: promediar
    # el tiempo de video incluyendo a los que nunca dieron play daria un numero
    # que no significa nada.
    prom_visible = db.session.query(func.avg(LandingSession.segundos_visible)).filter(
        LandingSession.created_at >= desde, LandingSession.created_at < hasta,
        LandingSession.segundos_visible > 0
    ).scalar() or 0

    prom_video = db.session.query(func.avg(LandingSession.segundos_video)).filter(
        LandingSession.created_at >= desde, LandingSession.created_at < hasta,
        LandingSession.dio_play.is_(True)
    ).scalar() or 0

    mediana_visible = 0
    tiempos = [t[0] for t in db.session.query(LandingSession.segundos_visible).filter(
        LandingSession.created_at >= desde, LandingSession.created_at < hasta,
        LandingSession.segundos_visible > 0
    ).order_by(LandingSession.segundos_visible).all()]
    if tiempos:
        mitad = len(tiempos) // 2
        mediana_visible = tiempos[mitad] if len(tiempos) % 2 else (tiempos[mitad - 1] + tiempos[mitad]) / 2

    # Leads del periodo (puede haber leads sin sesion si el latido no llego)
    leads = WorkshopLead.query.filter(
        WorkshopLead.created_at >= desde, WorkshopLead.created_at < hasta
    ).count()

    # Reparto por examen, para saber a quien atrae la grabacion
    por_examen = [
        {"examen": e or 'Sin dato', "total": n}
        for e, n in db.session.query(WorkshopLead.examen, func.count(WorkshopLead.id)).filter(
            WorkshopLead.created_at >= desde, WorkshopLead.created_at < hasta
        ).group_by(WorkshopLead.examen).order_by(func.count(WorkshopLead.id).desc()).all()
    ]

    por_utm = [
        {"utm_source": u or 'directo', "total": n}
        for u, n in db.session.query(LandingSession.utm_source, func.count(LandingSession.id)).filter(
            LandingSession.created_at >= desde, LandingSession.created_at < hasta
        ).group_by(LandingSession.utm_source).order_by(func.count(LandingSession.id).desc()).all()
    ]

    return jsonify({
        "rango": {"desde": desde.strftime('%Y-%m-%d'), "hasta": (hasta - timedelta(days=1)).strftime('%Y-%m-%d')},
        "embudo": {
            "visitas": visitas,
            "abrio_gate": abrio,
            "completo_gate": completo,
            "dio_play": play,
            "vio_oferta": oferta,
            "clic_agenda": agenda,
        },
        "conversion": {
            "visita_a_gate": _pct(abrio, visitas),
            "gate_a_registro": _pct(completo, abrio),
            "visita_a_registro": _pct(completo, visitas),
            "registro_a_play": _pct(play, completo),
            "play_a_oferta": _pct(oferta, play),
            "oferta_a_agenda": _pct(agenda, oferta),
        },
        "permanencia": {
            "promedio_segundos": int(prom_visible),
            "mediana_segundos": int(mediana_visible),
            "promedio_video_segundos": int(prom_video),
        },
        "leads": leads,
        "por_examen": por_examen,
        "por_utm": por_utm,
    }), 200


@bp.route('/landing/agendas', methods=['GET'])
@login_required
@admin_required
def agendas_por_fuente():
    """Compara las agendas del workshop EN VIVO contra las de la GRABACION.

    Hasta ahora las dos caian en la misma bolsa: la deteccion era
    `'workshop' in fuente`, un substring, asi que 'workshop landing' tambien
    matcheaba y las agendas de la grabacion inflaban las del vivo.
    """
    desde, hasta = _rango()

    agendas = FinancialAgenda.query.filter(
        FinancialAgenda.created_at >= desde,
        FinancialAgenda.created_at < hasta
    ).all()

    grupos = {'workshop': [], 'workshop_landing': []}
    for a in agendas:
        raw = a.raw_data or {}
        candidatos = (a.nombre, raw.get('fuente'), raw.get('fuente_form'))
        if es_workshop_landing(*candidatos):
            grupos['workshop_landing'].append(a)
        elif es_workshop_vivo(*candidatos):
            grupos['workshop'].append(a)

    def resumir(lista):
        total = len(lista)
        con_closer = sum(
            1 for a in lista
            if a.closer and a.closer.strip() and a.closer.strip().lower() != 'sin asignar'
        )
        return {"total": total, "con_closer": con_closer, "sin_asignar": total - con_closer}

    return jsonify({
        "rango": {"desde": desde.strftime('%Y-%m-%d'), "hasta": (hasta - timedelta(days=1)).strftime('%Y-%m-%d')},
        "workshop_vivo": resumir(grupos['workshop']),
        "workshop_landing": resumir(grupos['workshop_landing']),
    }), 200
