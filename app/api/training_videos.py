from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import TrainingVideo, TrainingVideoQuestion, TrainingVideoOption, TrainingVideoCompletion
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('training_videos', __name__)

MANAGER_ROLES = ('admin', 'operator')


def check_manager():
    if current_user.role not in MANAGER_ROLES:
        return jsonify({"message": "Forbidden: Acceso restringido a administradores y operadores"}), 403
    return None


def _apply_questions(video, questions_data):
    """Reemplaza por completo las preguntas/opciones del video con lo recibido. El volumen por
    video es chico (un puñado de preguntas de comprensión) y el formulario del operador siempre
    manda el set completo, así que borrar y recrear es más simple que diffear pregunta por
    pregunta."""
    for q in list(video.questions):
        db.session.delete(q)
    db.session.flush()

    for q_order, q_data in enumerate(questions_data):
        text = (q_data.get('question_text') or '').strip()
        if not text:
            continue
        options_data = q_data.get('options') or []
        cleaned_options = [
            {
                'text': (o.get('option_text') or '').strip(),
                'is_correct': bool(o.get('is_correct')),
            }
            for o in options_data if (o.get('option_text') or '').strip()
        ]
        if len(cleaned_options) < 2 or not any(o['is_correct'] for o in cleaned_options):
            raise ValueError(f'La pregunta "{text}" necesita al menos 2 opciones y al menos 1 marcada como correcta')

        question = TrainingVideoQuestion(video=video, question_text=text, order=q_order)
        db.session.add(question)
        for o_order, opt in enumerate(cleaned_options):
            db.session.add(TrainingVideoOption(
                question=question, option_text=opt['text'], is_correct=opt['is_correct'], order=o_order
            ))


@bp.route('/training-videos', methods=['POST'])
@login_required
def create_training_video():
    forbidden = check_manager()
    if forbidden: return forbidden

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    loom_link = (data.get('loom_link') or '').strip()
    if not title:
        return jsonify({"message": "El título es obligatorio"}), 400
    if not loom_link:
        return jsonify({"message": "El link de Loom es obligatorio"}), 400

    try:
        video = TrainingVideo(
            title=title,
            description=(data.get('description') or '').strip() or None,
            loom_link=loom_link,
            target_roles=[r for r in (data.get('target_roles') or []) if isinstance(r, str) and r] or None,
            is_active=data.get('is_active', True),
            created_by_id=current_user.id,
        )
        db.session.add(video)
        _apply_questions(video, data.get('questions') or [])
        db.session.commit()
        return jsonify(video.to_dict(include_questions=True, include_correct=True)), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al crear video de documentación: {str(e)}")
        return jsonify({"message": f"Error al crear el video: {str(e)}"}), 500


@bp.route('/training-videos', methods=['GET'])
@login_required
def list_training_videos():
    forbidden = check_manager()
    if forbidden: return forbidden

    videos = TrainingVideo.query.order_by(TrainingVideo.created_at.desc()).all()
    return jsonify([v.to_dict() for v in videos]), 200


@bp.route('/training-videos/<int:video_id>', methods=['GET'])
@login_required
def get_training_video(video_id):
    forbidden = check_manager()
    if forbidden: return forbidden

    video = TrainingVideo.query.get_or_404(video_id)
    return jsonify(video.to_dict(include_questions=True, include_correct=True)), 200


@bp.route('/training-videos/<int:video_id>', methods=['PUT'])
@login_required
def update_training_video(video_id):
    forbidden = check_manager()
    if forbidden: return forbidden

    video = TrainingVideo.query.get_or_404(video_id)
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    loom_link = (data.get('loom_link') or '').strip()
    if not title:
        return jsonify({"message": "El título es obligatorio"}), 400
    if not loom_link:
        return jsonify({"message": "El link de Loom es obligatorio"}), 400

    try:
        video.title = title
        video.description = (data.get('description') or '').strip() or None
        video.loom_link = loom_link
        video.target_roles = [r for r in (data.get('target_roles') or []) if isinstance(r, str) and r] or None
        video.is_active = data.get('is_active', video.is_active)
        if 'questions' in data:
            _apply_questions(video, data.get('questions') or [])
            # Si el contenido de comprobación cambió, quien ya lo había completado vuelve a
            # deber verlo — de lo contrario un video reeditado con info nueva nunca se
            # re-notificaría a quien ya lo "aprobó" con las preguntas viejas.
            TrainingVideoCompletion.query.filter_by(video_id=video.id).delete()
        db.session.commit()
        return jsonify(video.to_dict(include_questions=True, include_correct=True)), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al actualizar video de documentación {video_id}: {str(e)}")
        return jsonify({"message": f"Error al actualizar: {str(e)}"}), 500


@bp.route('/training-videos/<int:video_id>', methods=['DELETE'])
@login_required
def delete_training_video(video_id):
    forbidden = check_manager()
    if forbidden: return forbidden

    video = TrainingVideo.query.get_or_404(video_id)
    try:
        db.session.delete(video)
        db.session.commit()
        return jsonify({"message": "Video eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al eliminar video de documentación {video_id}: {str(e)}")
        return jsonify({"message": f"Error al eliminar: {str(e)}"}), 500


@bp.route('/training-videos/pending', methods=['GET'])
@login_required
def list_pending_training_videos():
    """Videos activos dirigidos al rol del usuario actual que todavía no completó (o cuyo
    quiz cambió desde la última vez que lo completó, ver update_training_video)."""
    completed_ids = {
        c.video_id for c in TrainingVideoCompletion.query.filter_by(user_id=current_user.id).all()
    }
    videos = TrainingVideo.query.filter_by(is_active=True).order_by(TrainingVideo.created_at.asc()).all()
    pending = [
        v for v in videos
        if v.id not in completed_ids
        and (not v.target_roles or current_user.role in v.target_roles)
        and v.questions.count() > 0
    ]
    return jsonify([v.to_dict(include_questions=True, include_correct=False) for v in pending]), 200


@bp.route('/training-videos/<int:video_id>/submit', methods=['POST'])
@login_required
def submit_training_video_quiz(video_id):
    video = TrainingVideo.query.get_or_404(video_id)
    data = request.get_json() or {}
    answers = data.get('answers') or {}  # { "<question_id>": [option_id, ...] }

    results = {}
    all_correct = True
    for question in video.questions:
        correct_ids = {o.id for o in question.options if o.is_correct}
        submitted_ids = set(answers.get(str(question.id)) or [])
        is_correct = submitted_ids == correct_ids
        results[question.id] = is_correct
        if not is_correct:
            all_correct = False

    if all_correct:
        completion = TrainingVideoCompletion.query.filter_by(video_id=video.id, user_id=current_user.id).first()
        if not completion:
            completion = TrainingVideoCompletion(video_id=video.id, user_id=current_user.id)
            db.session.add(completion)
        completion.completed_at = datetime.utcnow()
        db.session.commit()

    return jsonify({"all_correct": all_correct, "results": results}), 200
