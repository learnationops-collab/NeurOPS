from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models import db, Comment, User
from datetime import datetime

bp = Blueprint('comments', __name__)

@bp.route('/', methods=['GET'])
@login_required
def get_comments():
    comment_type = request.args.get('type')
    associated_id = request.args.get('associated_id')

    if not comment_type or not associated_id:
        return jsonify({"error": "Missing type or associated_id"}), 400

    comments = Comment.query.filter_by(
        comment_type=comment_type,
        associated_id=int(associated_id)
    ).order_by(Comment.created_at.desc()).all()

    return jsonify([c.to_dict() for c in comments]), 200

@bp.route('/', methods=['POST'])
@login_required
def add_comment():
    data = request.get_json() or {}
    text = data.get('text')
    comment_type = data.get('type')
    associated_id = data.get('associated_id')

    if not text or not comment_type or not associated_id:
        return jsonify({"error": "Missing required fields"}), 400

    comment = Comment(
        text=text,
        comment_type=comment_type,
        associated_id=int(associated_id),
        author_id=current_user.id
    )

    try:
        db.session.add(comment)
        db.session.commit()
        return jsonify(comment.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
