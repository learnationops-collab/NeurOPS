"""Panel de revisión de postulaciones (Closer de ventas). Autenticado: acá
salen datos personales y se vota. Cualquier `role == 'admin'` puede revisar
(mismo criterio que Alertas/Workshops/Formularios) — el voto se asocia a la
sesión real del usuario logueado (`current_user.id`), sin switch de demo."""
import logging
from collections import Counter
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app import db
from app.models import JobApplication, JobApplicationVote, ClarityWeight, User
from app.models.job_application import CLARITY_CRITERIA, VOTE_VALUES
from app.services import clarity

bp = Blueprint('job_applications', __name__)

FILTROS_VALIDOS = ('mis_pendientes', 'todas', 'preseleccionadas', 'decidir', 'descartadas')
# 'incompletas' no entra en FILTROS_VALIDOS: no es un veredicto de revisión
# (no tiene sentido votar algo a medio completar), es una vista aparte para
# ver dónde quedó alguien que no terminó.


def check_admin():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Se requiere rol admin"}), 403
    return None


def _weights_map():
    filas = ClarityWeight.query.all()
    if not filas:
        return {c['criterion']: c['default_weight'] for c in CLARITY_CRITERIA}
    return {f.criterion: f.weight for f in filas}


def _aplica_filtro(app_row, filtro):
    veredicto = app_row.veredicto()
    if filtro == 'todas' or not filtro:
        return True
    if filtro == 'mis_pendientes':
        return current_user.id not in {v.reviewer_id for v in app_row.votes}
    if filtro == 'preseleccionadas':
        return veredicto == 'preseleccionada'
    if filtro == 'decidir':
        return veredicto == 'decidir'
    if filtro == 'descartadas':
        return veredicto == 'descartado'
    return True


@bp.route('/job-applications', methods=['GET'])
@login_required
def listar_job_applications():
    forbidden = check_admin()
    if forbidden:
        return forbidden

    filtro = request.args.get('filtro', 'mis_pendientes')
    weights = _weights_map()

    todas = JobApplication.query.filter_by(completo=True).order_by(JobApplication.created_at.desc()).all()
    incompletas = JobApplication.query.filter_by(completo=False).order_by(JobApplication.updated_at.desc()).all()

    if filtro == 'incompletas':
        filtradas = incompletas
        peso_para_score = None
    else:
        filtradas = [a for a in todas if _aplica_filtro(a, filtro)]
        filtradas.sort(key=lambda a: clarity.score_de(a, weights), reverse=True)
        peso_para_score = weights

    conteos = {f: len([a for a in todas if _aplica_filtro(a, f)]) for f in FILTROS_VALIDOS}
    conteos['con_material'] = sum(1 for a in todas if a.video and a.llamada)
    conteos['incompletas'] = len(incompletas)

    return jsonify({
        "postulaciones": [a.to_dict(weights=peso_para_score, include_respuestas=False) for a in filtradas],
        "conteos": conteos,
        "total": len(todas),
    }), 200


@bp.route('/job-applications/<int:app_id>', methods=['GET'])
@login_required
def ver_job_application(app_id):
    forbidden = check_admin()
    if forbidden:
        return forbidden

    app_row = JobApplication.query.get_or_404(app_id)
    weights = _weights_map()
    data = app_row.to_dict(weights=weights, include_respuestas=True)
    data["votos_detalle"] = [v.to_dict() for v in app_row.votes]
    return jsonify(data), 200


@bp.route('/job-applications/<int:app_id>/vote', methods=['POST'])
@login_required
def votar_job_application(app_id):
    forbidden = check_admin()
    if forbidden:
        return forbidden

    data = request.get_json(silent=True) or {}
    valor = data.get('valor')
    if valor not in VOTE_VALUES:
        return jsonify({"message": "valor debe ser 'pre' o 'des'"}), 400

    app_row = JobApplication.query.get_or_404(app_id)

    try:
        voto = JobApplicationVote.query.filter_by(
            application_id=app_row.id, reviewer_id=current_user.id
        ).first()

        if voto and voto.vote == valor:
            # Tocar el mismo botón otra vez lo limpia.
            db.session.delete(voto)
            nuevo_valor = None
        elif voto:
            voto.vote = valor
            nuevo_valor = valor
        else:
            voto = JobApplicationVote(application_id=app_row.id, reviewer_id=current_user.id, vote=valor)
            db.session.add(voto)
            nuevo_valor = valor

        db.session.commit()

        return jsonify({
            "status": "success",
            "valor": nuevo_valor,
            "veredicto": app_row.veredicto(),
        }), 200
    except Exception as e:
        db.session.rollback()
        logging.error("[job-applications] Error al votar: %s", e)
        return jsonify({"message": "Error interno al votar"}), 500


@bp.route('/job-applications/clarity-weights', methods=['GET'])
@login_required
def ver_clarity_weights():
    forbidden = check_admin()
    if forbidden:
        return forbidden

    filas = ClarityWeight.query.order_by(ClarityWeight.id).all()
    if not filas:
        return jsonify([
            {"criterion": c['criterion'], "label": c['label'], "weight": c['default_weight'], "default_weight": c['default_weight']}
            for c in CLARITY_CRITERIA
        ]), 200
    return jsonify([f.to_dict() for f in filas]), 200


@bp.route('/job-applications/clarity-weights', methods=['PUT'])
@login_required
def guardar_clarity_weights():
    forbidden = check_admin()
    if forbidden:
        return forbidden

    data = request.get_json(silent=True) or {}
    pesos = data.get('weights') or {}
    claves_validas = {c['criterion'] for c in CLARITY_CRITERIA}

    try:
        for criterio, peso in pesos.items():
            if criterio not in claves_validas:
                continue
            fila = ClarityWeight.query.filter_by(criterion=criterio).first()
            if fila is None:
                default = next(c for c in CLARITY_CRITERIA if c['criterion'] == criterio)
                fila = ClarityWeight(criterion=criterio, label=default['label'], default_weight=default['default_weight'], weight=0)
                db.session.add(fila)
            fila.weight = max(0, int(peso))

        db.session.commit()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        db.session.rollback()
        logging.error("[job-applications] Error al guardar pesos: %s", e)
        return jsonify({"message": "Error interno al guardar los pesos"}), 500


@bp.route('/job-applications/stats', methods=['GET'])
@login_required
def stats_job_applications():
    forbidden = check_admin()
    if forbidden:
        return forbidden

    weights = _weights_map()
    todas_las_filas = JobApplication.query.all()
    todas = [a for a in todas_las_filas if a.completo]
    scores = [clarity.score_de(a, weights) for a in todas]

    tramos = [(0, 40), (40, 60), (60, 75), (75, 85), (85, 101)]
    distribucion_tramos = [
        {"desde": lo, "hasta": hi, "cantidad": sum(1 for s in scores if lo <= s < hi)}
        for lo, hi in tramos
    ]

    histograma = [
        {"decena": d, "cantidad": sum(1 for s in scores if d <= s < d + 10)}
        for d in range(0, 100, 10)
    ]

    con_material = sum(1 for a in todas if a.video and a.llamada)
    score_85 = sum(1 for s in scores if s >= 85)
    pasaron_disclaimer = sum(1 for a in todas_las_filas if a.disclaimer)
    embudo = [
        {"etapa": "Abrieron el formulario", "cantidad": len(todas_las_filas)},
        {"etapa": "Pasaron el disclaimer", "cantidad": pasaron_disclaimer},
        {"etapa": "Completaron", "cantidad": len(todas)},
        {"etapa": "Con video y llamada", "cantidad": con_material},
        {"etapa": "Score 85+", "cantidad": score_85},
    ]

    desde = datetime.utcnow() - timedelta(days=14)
    por_dia = Counter()
    for a in todas:
        if a.created_at and a.created_at >= desde:
            por_dia[a.created_at.date().isoformat()] += 1
    linea_por_dia = [{"fecha": f, "cantidad": c} for f, c in sorted(por_dia.items())]

    def distribucion(campo):
        conteo = Counter(getattr(a, campo) for a in todas if getattr(a, campo))
        return [{"opcion": k, "cantidad": v} for k, v in conteo.most_common()]

    def distribucion_lista(campo):
        conteo = Counter()
        for a in todas:
            for v in (getattr(a, campo) or []):
                conteo[v] += 1
        return [{"opcion": k, "cantidad": v} for k, v in conteo.most_common()]

    return jsonify({
        "total": len(todas),
        "score_medio": round(sum(scores) / len(scores)) if scores else 0,
        "distribucion_tramos": distribucion_tramos,
        "histograma": histograma,
        "embudo": embudo,
        "por_dia": linea_por_dia,
        "distribucion_conocimiento": distribucion('conocimiento'),
        "distribucion_ingles": distribucion('ingles'),
        "distribucion_pais": distribucion('pais'),
        "distribucion_edad": distribucion('edad'),
        "distribucion_herramientas": distribucion_lista('herramientas'),
        "distribucion_disclaimer": distribucion('disclaimer'),
    }), 200
