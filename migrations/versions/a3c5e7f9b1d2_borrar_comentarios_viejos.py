"""Borra las tablas viejas de comentarios: sus notas ya están en lead_event_logs (scripts/backfill_notas_log.py,
corrido el 27/10/2026) y nadie las lee ni escribe.

Revision ID: a3c5e7f9b1d2
Revises: f7b2d4e6a8c1
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa

revision = 'a3c5e7f9b1d2'
down_revision = 'f7b2d4e6a8c1'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('comment_notifications')
    op.drop_table('client_comments')
    with op.batch_alter_table('comments') as batch_op:
        batch_op.drop_index('idx_comments_target')
    op.drop_table('comments')


def downgrade():
    op.create_table(
        'comments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('text', sa.String(500), nullable=False),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('comment_type', sa.String(50), nullable=False),
        sa.Column('associated_id', sa.Integer(), nullable=False),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('comments.id')),
    )
    op.create_index('idx_comments_target', 'comments', ['comment_type', 'associated_id'])
    op.create_table(
        'client_comments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime()),
    )
    op.create_table(
        'comment_notifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('comment_id', sa.Integer(), sa.ForeignKey('client_comments.id')),
        sa.Column('sender_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_read', sa.Boolean()),
        sa.Column('created_at', sa.DateTime()),
    )
