from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import (
    User, PlaybookRoadmap, PlaybookModule, PlaybookLesson, PlaybookQuestion, PlaybookOption,
    PlaybookLessonProgress, PlaybookCompletion, QUESTION_TYPES
)
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('playbook', __name__)

MANAGER_ROLES = ('admin', 'operator')


def check_manager():
    if current_user.role not in MANAGER_ROLES:
        return jsonify({"message": "Forbidden: Acceso restringido a administradores y operadores"}), 403
    return None


def _visible_lessons(module, user):
    return [
        l for l in module.lessons
        if l.is_active and (not l.target_roles or user.role in l.target_roles)
    ]


def _user_completed_ids(user_id):
    return {c.lesson_id for c in PlaybookCompletion.query.filter_by(user_id=user_id).all()}


def _user_watched_ids(user_id):
    return {
        p.lesson_id for p in PlaybookLessonProgress.query.filter_by(user_id=user_id)
        .filter(PlaybookLessonProgress.video_watched_at.isnot(None)).all()
    }


def _apply_questions(lesson, questions_data):
    for q in list(lesson.questions):
        db.session.delete(q)
    db.session.flush()

    for q_order, q_data in enumerate(questions_data):
        text = (q_data.get('question_text') or '').strip()
        if not text:
            continue
        q_type = q_data.get('question_type') or 'single'
        if q_type not in QUESTION_TYPES:
            raise ValueError(f'Tipo de pregunta inválido: {q_type}')
        options_data = q_data.get('options') or []
        cleaned_options = [
            {'text': (o.get('option_text') or '').strip(), 'is_correct': bool(o.get('is_correct'))}
            for o in options_data if (o.get('option_text') or '').strip()
        ]
        if len(cleaned_options) < 2 or not any(o['is_correct'] for o in cleaned_options):
            raise ValueError(f'La pregunta "{text}" necesita al menos 2 opciones y al menos 1 correcta')
        if q_type == 'single' and sum(1 for o in cleaned_options if o['is_correct']) > 1:
            raise ValueError(f'La pregunta "{text}" es de selección única: marcá solo una opción correcta')

        question = PlaybookQuestion(lesson=lesson, question_text=text, question_type=q_type, order=q_order)
        db.session.add(question)
        for o_order, opt in enumerate(cleaned_options):
            db.session.add(PlaybookOption(
                question=question, option_text=opt['text'], is_correct=opt['is_correct'], order=o_order
            ))


# ---------------------------------------------------------------------------
# Gestión (Dirección / operador)
# ---------------------------------------------------------------------------

@bp.route('/playbook/roadmaps', methods=['POST'])
@login_required
def create_roadmap():
    forbidden = check_manager()
    if forbidden: return forbidden
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({"message": "El nombre es obligatorio"}), 400
    max_order = db.session.query(db.func.max(PlaybookRoadmap.order)).scalar() or 0
    roadmap = PlaybookRoadmap(name=name, accent=data.get('accent') or 'magenta', order=max_order + 1)
    db.session.add(roadmap)
    db.session.commit()
    return jsonify(roadmap.to_dict()), 201


@bp.route('/playbook/roadmaps/<int:roadmap_id>', methods=['PUT'])
@login_required
def update_roadmap(roadmap_id):
    forbidden = check_manager()
    if forbidden: return forbidden
    roadmap = PlaybookRoadmap.query.get_or_404(roadmap_id)
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({"message": "El nombre es obligatorio"}), 400
    roadmap.name = name
    roadmap.accent = data.get('accent') or roadmap.accent
    db.session.commit()
    return jsonify(roadmap.to_dict()), 200


@bp.route('/playbook/roadmaps/<int:roadmap_id>', methods=['DELETE'])
@login_required
def delete_roadmap(roadmap_id):
    forbidden = check_manager()
    if forbidden: return forbidden
    roadmap = PlaybookRoadmap.query.get_or_404(roadmap_id)
    db.session.delete(roadmap)
    db.session.commit()
    return jsonify({"message": "Roadmap eliminado"}), 200


@bp.route('/playbook/modules', methods=['POST'])
@login_required
def create_module():
    forbidden = check_manager()
    if forbidden: return forbidden
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    roadmap_id = data.get('roadmap_id')
    if not name or not roadmap_id:
        return jsonify({"message": "Nombre y roadmap son obligatorios"}), 400
    roadmap = PlaybookRoadmap.query.get_or_404(roadmap_id)
    max_order = db.session.query(db.func.max(PlaybookModule.order)).filter_by(roadmap_id=roadmap.id).scalar() or 0
    module = PlaybookModule(roadmap_id=roadmap.id, name=name, order=max_order + 1)
    db.session.add(module)
    db.session.commit()
    return jsonify(module.to_dict()), 201


@bp.route('/playbook/modules/<int:module_id>', methods=['PUT'])
@login_required
def update_module(module_id):
    forbidden = check_manager()
    if forbidden: return forbidden
    module = PlaybookModule.query.get_or_404(module_id)
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({"message": "El nombre es obligatorio"}), 400
    module.name = name
    db.session.commit()
    return jsonify(module.to_dict()), 200


@bp.route('/playbook/modules/<int:module_id>', methods=['DELETE'])
@login_required
def delete_module(module_id):
    forbidden = check_manager()
    if forbidden: return forbidden
    module = PlaybookModule.query.get_or_404(module_id)
    db.session.delete(module)
    db.session.commit()
    return jsonify({"message": "Módulo eliminado"}), 200


@bp.route('/playbook/lessons', methods=['POST'])
@login_required
def create_lesson():
    forbidden = check_manager()
    if forbidden: return forbidden
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    loom_link = (data.get('loom_link') or '').strip()
    module_id = data.get('module_id')
    if not title or not loom_link or not module_id:
        return jsonify({"message": "Título, link de Loom y módulo son obligatorios"}), 400
    module = PlaybookModule.query.get_or_404(module_id)

    try:
        max_order = db.session.query(db.func.max(PlaybookLesson.order)).filter_by(module_id=module.id).scalar() or 0
        lesson = PlaybookLesson(
            module_id=module.id,
            title=title,
            description=(data.get('description') or '').strip() or None,
            loom_link=loom_link,
            duration_minutes=data.get('duration_minutes') or None,
            transcript=(data.get('transcript') or '').strip() or None,
            target_roles=[r for r in (data.get('target_roles') or []) if isinstance(r, str) and r] or None,
            is_active=data.get('is_active', True),
            order=max_order + 1,
            created_by_id=current_user.id,
        )
        db.session.add(lesson)
        _apply_questions(lesson, data.get('questions') or [])
        db.session.commit()
        return jsonify(lesson.to_dict(include_questions=True, include_correct=True)), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al crear lección: {str(e)}")
        return jsonify({"message": f"Error al crear la lección: {str(e)}"}), 500


@bp.route('/playbook/lessons/<int:lesson_id>/admin', methods=['GET'])
@login_required
def get_lesson_admin(lesson_id):
    forbidden = check_manager()
    if forbidden: return forbidden
    lesson = PlaybookLesson.query.get_or_404(lesson_id)
    return jsonify(lesson.to_dict(include_questions=True, include_correct=True)), 200


@bp.route('/playbook/lessons/<int:lesson_id>', methods=['PUT'])
@login_required
def update_lesson(lesson_id):
    forbidden = check_manager()
    if forbidden: return forbidden
    lesson = PlaybookLesson.query.get_or_404(lesson_id)
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    loom_link = (data.get('loom_link') or '').strip()
    if not title or not loom_link:
        return jsonify({"message": "Título y link de Loom son obligatorios"}), 400

    try:
        lesson.title = title
        lesson.description = (data.get('description') or '').strip() or None
        lesson.loom_link = loom_link
        lesson.duration_minutes = data.get('duration_minutes') or None
        lesson.transcript = (data.get('transcript') or '').strip() or None
        lesson.target_roles = [r for r in (data.get('target_roles') or []) if isinstance(r, str) and r] or None
        lesson.is_active = data.get('is_active', lesson.is_active)
        if data.get('module_id') and data['module_id'] != lesson.module_id:
            PlaybookModule.query.get_or_404(data['module_id'])
            lesson.module_id = data['module_id']
        if 'questions' in data:
            _apply_questions(lesson, data.get('questions') or [])
            # El quiz cambió: quien ya la había aprobado con las preguntas viejas vuelve a deberla.
            PlaybookCompletion.query.filter_by(lesson_id=lesson.id).delete()
        db.session.commit()
        return jsonify(lesson.to_dict(include_questions=True, include_correct=True)), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al actualizar lección {lesson_id}: {str(e)}")
        return jsonify({"message": f"Error al actualizar: {str(e)}"}), 500


@bp.route('/playbook/lessons/<int:lesson_id>', methods=['DELETE'])
@login_required
def delete_lesson(lesson_id):
    forbidden = check_manager()
    if forbidden: return forbidden
    lesson = PlaybookLesson.query.get_or_404(lesson_id)
    db.session.delete(lesson)
    db.session.commit()
    return jsonify({"message": "Lección eliminada"}), 200


@bp.route('/playbook/admin/overview', methods=['GET'])
@login_required
def admin_overview():
    """Pestaña 'Contenido y cumplimiento': métricas globales + cumplimiento por rol + tabla
    de roadmap/módulo/lección con estado de publicación y avance."""
    forbidden = check_manager()
    if forbidden: return forbidden

    lessons = PlaybookLesson.query.all()
    published = [l for l in lessons if l.is_active]
    users = User.query.filter_by(is_active=True).all()

    def audience_for(lesson):
        return lesson.target_roles or None

    def assigned_users(lesson):
        roles = audience_for(lesson)
        return [u for u in users if not roles or u.role in roles]

    total_assignments = 0
    total_completed = 0
    role_totals = {}
    for lesson in published:
        targets = assigned_users(lesson)
        completed_ids = {c.user_id for c in lesson.completions}
        for u in targets:
            role_totals.setdefault(u.role, {'total': 0, 'done': 0})
            role_totals[u.role]['total'] += 1
            total_assignments += 1
            if u.id in completed_ids:
                role_totals[u.role]['done'] += 1
                total_completed += 1

    compliance_pct = round(100 * total_completed / total_assignments) if total_assignments else 0
    by_role = [
        {"role": role, "done": v['done'], "total": v['total'],
         "pct": round(100 * v['done'] / v['total']) if v['total'] else 0}
        for role, v in sorted(role_totals.items())
    ]

    week_ago = datetime.utcnow()
    published_this_week = [l for l in published if (week_ago - l.created_at).days < 7] if published else []

    roadmaps_out = []
    for roadmap in PlaybookRoadmap.query.order_by(PlaybookRoadmap.order).all():
        modules_out = []
        for module in roadmap.modules:
            lessons_out = []
            for lesson in module.lessons:
                targets = assigned_users(lesson)
                completed_count = len({c.user_id for c in lesson.completions} & {u.id for u in targets})
                lessons_out.append({
                    **lesson.to_dict(),
                    "audience_label": "Todo el equipo" if not lesson.target_roles else ", ".join(lesson.target_roles),
                    "completed_count": completed_count,
                    "assigned_count": len(targets),
                })
            modules_out.append({**module.to_dict(), "lessons": lessons_out})
        roadmaps_out.append({**roadmap.to_dict(), "modules": modules_out})

    return jsonify({
        "lessons_published": len(published),
        "roadmap_count": PlaybookRoadmap.query.count(),
        "compliance_pct": compliance_pct,
        "by_role": by_role,
        "pending_total": total_assignments - total_completed,
        "published_this_week": len(published_this_week),
        "roadmaps": roadmaps_out,
    }), 200


# ---------------------------------------------------------------------------
# Navegación (cualquier usuario autenticado)
# ---------------------------------------------------------------------------

@bp.route('/playbook/roadmaps/summary', methods=['GET'])
@login_required
def list_roadmaps_summary():
    completed_ids = _user_completed_ids(current_user.id)
    out = []
    for roadmap in PlaybookRoadmap.query.order_by(PlaybookRoadmap.order).all():
        visible_lessons = []
        for module in roadmap.modules:
            visible_lessons.extend(_visible_lessons(module, current_user))
        if not visible_lessons:
            continue
        done = sum(1 for l in visible_lessons if l.id in completed_ids)
        out.append({
            **roadmap.to_dict(),
            "lesson_count": len(visible_lessons),
            "module_count": sum(1 for m in roadmap.modules if _visible_lessons(m, current_user)),
            "completed_count": done,
            "pending_count": len(visible_lessons) - done,
            "pct": round(100 * done / len(visible_lessons)) if visible_lessons else 0,
        })
    return jsonify(out), 200


@bp.route('/playbook/roadmaps/<int:roadmap_id>/modules', methods=['GET'])
@login_required
def list_modules(roadmap_id):
    roadmap = PlaybookRoadmap.query.get_or_404(roadmap_id)
    completed_ids = _user_completed_ids(current_user.id)
    watched_ids = _user_watched_ids(current_user.id)
    out = []
    for module in roadmap.modules:
        visible = _visible_lessons(module, current_user)
        if not visible:
            continue
        approved = sum(1 for l in visible if l.id in completed_ids)
        in_progress = any(l.id in watched_ids and l.id not in completed_ids for l in visible)
        status = 'completo' if approved == len(visible) else ('en_curso' if (approved > 0 or in_progress) else 'no_iniciado')
        out.append({
            **module.to_dict(),
            "roadmap_name": roadmap.name,
            "roadmap_accent": roadmap.accent,
            "lesson_count": len(visible),
            "approved_count": approved,
            "status": status,
            "total_minutes": sum(l.duration_minutes or 0 for l in visible),
        })
    return jsonify(out), 200


@bp.route('/playbook/modules/<int:module_id>/lessons', methods=['GET'])
@login_required
def list_lessons(module_id):
    module = PlaybookModule.query.get_or_404(module_id)
    completed_ids = _user_completed_ids(current_user.id)
    watched_ids = _user_watched_ids(current_user.id)
    visible = _visible_lessons(module, current_user)
    out = [{
        **l.to_dict(),
        "state": l.state_for_user(current_user.id, completed_ids, watched_ids),
    } for l in visible]
    return jsonify({
        "module": {**module.to_dict(), "roadmap_name": module.roadmap.name, "roadmap_accent": module.roadmap.accent},
        "lessons": out,
    }), 200


@bp.route('/playbook/lessons/<int:lesson_id>', methods=['GET'])
@login_required
def get_lesson(lesson_id):
    lesson = PlaybookLesson.query.get_or_404(lesson_id)
    if lesson.target_roles and current_user.role not in lesson.target_roles:
        return jsonify({"message": "Forbidden"}), 403
    completed_ids = _user_completed_ids(current_user.id)
    watched_ids = _user_watched_ids(current_user.id)
    siblings = _visible_lessons(lesson.module, current_user)
    return jsonify({
        "lesson": {**lesson.to_dict(include_questions=True, include_correct=False),
                   "state": lesson.state_for_user(current_user.id, completed_ids, watched_ids)},
        "module": {**lesson.module.to_dict(), "roadmap_name": lesson.module.roadmap.name},
        "playlist": [{
            "id": s.id, "title": s.title, "duration_minutes": s.duration_minutes,
            "state": s.state_for_user(current_user.id, completed_ids, watched_ids),
        } for s in siblings],
    }), 200


@bp.route('/playbook/lessons/<int:lesson_id>/watched', methods=['POST'])
@login_required
def mark_watched(lesson_id):
    lesson = PlaybookLesson.query.get_or_404(lesson_id)
    progress = PlaybookLessonProgress.query.filter_by(lesson_id=lesson.id, user_id=current_user.id).first()
    if not progress:
        progress = PlaybookLessonProgress(lesson_id=lesson.id, user_id=current_user.id)
        db.session.add(progress)
    progress.video_watched_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"message": "ok"}), 200


@bp.route('/playbook/lessons/<int:lesson_id>/answer', methods=['POST'])
@login_required
def answer_question(lesson_id):
    """Corrige UNA pregunta por vez (feedback inmediato al elegir, no al final del quiz)."""
    data = request.get_json() or {}
    question = PlaybookQuestion.query.filter_by(id=data.get('question_id'), lesson_id=lesson_id).first_or_404()
    correct_ids = {o.id for o in question.options if o.is_correct}
    selected_ids = set(data.get('selected_option_ids') or [])
    return jsonify({"correct": selected_ids == correct_ids}), 200


@bp.route('/playbook/lessons/<int:lesson_id>/complete', methods=['POST'])
@login_required
def complete_lesson(lesson_id):
    """Se llama cuando ya se contestaron bien todas las preguntas (o no hay preguntas y ya
    se vio el video). Vuelve a validar todo server-side antes de aprobar -- nunca confía en
    que el frontend ya mostró todo en verde."""
    lesson = PlaybookLesson.query.get_or_404(lesson_id)
    data = request.get_json() or {}
    answers = data.get('answers') or {}  # { question_id: [option_id, ...] }

    for question in lesson.questions:
        correct_ids = {o.id for o in question.options if o.is_correct}
        submitted_ids = set(answers.get(str(question.id)) or [])
        if submitted_ids != correct_ids:
            return jsonify({"message": "Todavía hay preguntas sin responder bien"}), 400

    completion = PlaybookCompletion.query.filter_by(lesson_id=lesson.id, user_id=current_user.id).first()
    if not completion:
        completion = PlaybookCompletion(lesson_id=lesson.id, user_id=current_user.id)
        db.session.add(completion)
    completion.completed_at = datetime.utcnow()
    db.session.commit()

    next_lesson = PlaybookLesson.query.filter(
        PlaybookLesson.module_id == lesson.module_id,
        PlaybookLesson.order > lesson.order,
        PlaybookLesson.is_active == True,
    ).order_by(PlaybookLesson.order).first()

    return jsonify({"message": "ok", "next_lesson_id": next_lesson.id if next_lesson else None}), 200


@bp.route('/playbook/pending', methods=['GET'])
@login_required
def list_pending():
    completed_ids = _user_completed_ids(current_user.id)
    watched_ids = _user_watched_ids(current_user.id)
    out = []
    total_minutes = 0
    for roadmap in PlaybookRoadmap.query.all():
        for module in roadmap.modules:
            for lesson in _visible_lessons(module, current_user):
                if lesson.id in completed_ids:
                    continue
                state = lesson.state_for_user(current_user.id, completed_ids, watched_ids)
                total_minutes += lesson.duration_minutes or 0
                out.append({
                    "id": lesson.id,
                    "title": lesson.title,
                    "duration_minutes": lesson.duration_minutes,
                    "state": state,
                    "roadmap_name": roadmap.name,
                    "roadmap_accent": roadmap.accent,
                    "module_name": module.name,
                    "author_name": lesson.created_by.username if lesson.created_by else None,
                    "author_role": lesson.created_by.role if lesson.created_by else None,
                    "audience_label": "Para todo el equipo" if not lesson.target_roles else ", ".join(lesson.target_roles),
                    "question_count": lesson.questions.count(),
                    "created_at": lesson.created_at.isoformat() if lesson.created_at else None,
                })
    out.sort(key=lambda l: l['created_at'] or '', reverse=True)
    new_count = sum(1 for l in out if l['state'] == 'nuevo')
    return jsonify({
        "pending_count": len(out),
        "new_count": new_count,
        "total_minutes": total_minutes,
        "lessons": out,
    }), 200
