from flask import Blueprint, jsonify, request

from app import db
from app.models import BugReport, STATUS_VALUES, REPORT_TYPES
from app.decorators import require_dev_platform_token

bp = Blueprint('external_dev_platform_api', __name__)

# NeurOPS es hoy el unico "proyecto" que reporta a esta API - se manda fijo en cada item para
# que la plataforma de gestion pueda distinguir estos bugs si en el futuro suma otras fuentes.
PROJECT_NAME = 'neurops'

DEFAULT_PAGE_SIZE = 200
MAX_PAGE_SIZE = 500


def _parse_pagination():
    page = request.args.get('page', default=1, type=int) or 1
    limit = request.args.get('limit', default=DEFAULT_PAGE_SIZE, type=int) or DEFAULT_PAGE_SIZE
    page = max(page, 1)
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    return page, limit


def _bug_report_dict(report, include_screenshot=False):
    """Lista blanca explicita pensada para un consumidor de gestion de trabajo, no para el
    panel interno de operacion - por eso si incluye technical_context/route (utiles para
    diagnosticar) pero deja screenshot/extra_screenshots fuera del listado (payload pesado,
    solo se piden en el detalle de un reporte puntual)."""
    data = {
        "id": report.id,
        "project": PROJECT_NAME,
        "report_type": report.report_type,
        "problem": report.problem,
        "description": report.description,
        "status": report.status,
        "route": report.route,
        "technical_context": report.technical_context,
        "reported_by": report.user.username if report.user else None,
        "reported_by_role": report.user_role,
        "message_count": report.messages.count(),
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }
    if include_screenshot:
        data["screenshot"] = report.screenshot
        data["extra_screenshots"] = report.extra_screenshots or []
        data["loom_link"] = report.loom_link
        data["messages"] = [
            {
                "id": m.id,
                "sender_name": m.sender.username if m.sender else None,
                "sender_role": m.sender_role,
                "message": m.message,
                "loom_link": m.loom_link,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in report.messages
        ]
    return data


@bp.route('/bug-reports', methods=['GET'])
@require_dev_platform_token
def list_bug_reports():
    """Volcado paginado de bugs/mejoras reportados en NeurOPS. Filtros opcionales por
    status y type (comma-separated), igual convencion que el panel interno de operador."""
    status_filter = request.args.get('status')
    type_filter = request.args.get('type')

    query = BugReport.query
    if status_filter:
        statuses = [s.strip() for s in status_filter.split(',') if s.strip() in STATUS_VALUES]
        if statuses:
            query = query.filter(BugReport.status.in_(statuses))
    if type_filter:
        types = [t.strip() for t in type_filter.split(',') if t.strip() in REPORT_TYPES]
        if types:
            query = query.filter(BugReport.report_type.in_(types))

    # Mismo criterio que el panel interno: bugs antes que mejoras, y dentro de cada tipo el
    # mas nuevo arriba.
    query = query.order_by(
        db.case((BugReport.report_type == 'bug', 0), else_=1),
        BugReport.created_at.desc()
    )

    page, limit = _parse_pagination()
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    pages = (total + limit - 1) // limit if total else 0
    return jsonify({
        "success": True,
        "data": [_bug_report_dict(r) for r in items],
        "total": total,
        "page": page,
        "pages": pages,
        "has_more": (page * limit) < total,
    }), 200


@bp.route('/bug-reports/<int:report_id>', methods=['GET'])
@require_dev_platform_token
def get_bug_report(report_id):
    report = BugReport.query.get(report_id)
    if not report:
        return jsonify({"success": False, "error": "No existe ningún reporte con ese id"}), 404
    return jsonify({"success": True, "bug_report": _bug_report_dict(report, include_screenshot=True)}), 200


@bp.route('/bug-reports/<int:report_id>/status', methods=['PATCH'])
@require_dev_platform_token
def update_bug_report_status(report_id):
    report = BugReport.query.get(report_id)
    if not report:
        return jsonify({"success": False, "error": "No existe ningún reporte con ese id"}), 404

    data = request.get_json(silent=True) or {}
    status = (data.get('status') or '').strip()
    if status not in STATUS_VALUES:
        return jsonify({
            "success": False,
            "error": f"Estado inválido - valores válidos: {', '.join(STATUS_VALUES)}"
        }), 400

    report.status = status
    db.session.commit()
    return jsonify({"success": True, "bug_report": _bug_report_dict(report)}), 200
