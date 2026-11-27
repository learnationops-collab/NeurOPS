"""Inbox: los ratos en que el setter marcó «Activo» (setter_actividad)

Revision ID: dc9f7bf7cfe1
Revises: b3d5f7a9c1e2
Create Date: 2026-11-26

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'dc9f7bf7cfe1'
down_revision = 'b3d5f7a9c1e2'
branch_labels = None
depends_on = None


def upgrade():
    if 'setter_actividad' in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        'setter_actividad',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('desde', sa.DateTime(), nullable=False),
        sa.Column('hasta', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_setter_actividad_user_id', 'setter_actividad', ['user_id'])
    op.create_index('ix_setter_actividad_desde', 'setter_actividad', ['desde'])


def downgrade():
    op.drop_table('setter_actividad')
