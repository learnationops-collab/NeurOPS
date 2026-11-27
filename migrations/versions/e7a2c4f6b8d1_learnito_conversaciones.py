"""Learnito: conversaciones fijadas y renombradas por persona (learnito_conversaciones)

Revision ID: e7a2c4f6b8d1
Revises: dc9f7bf7cfe1
Create Date: 2026-11-26

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'e7a2c4f6b8d1'
down_revision = 'dc9f7bf7cfe1'
branch_labels = None
depends_on = None


def upgrade():
    if 'learnito_conversaciones' in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        'learnito_conversaciones',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('conversacion_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(120), nullable=True),
        sa.Column('fijada', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('user_id', 'conversacion_id', name='uq_learnito_conv_user'),
    )
    op.create_index('ix_learnito_conversaciones_user_id', 'learnito_conversaciones', ['user_id'])


def downgrade():
    op.drop_table('learnito_conversaciones')
