"""Embudo de seguimiento: días del equipo y registros por lead

Revision ID: e3a9c5b17d40
Revises: c7d1f4a9e2b6
Create Date: 2026-11-07

`embudo_config` guarda los días del embudo (después de la llamada) y desde qué llamada cuenta.
`embudo_registros` guarda cada seguimiento registrado: día del embudo y si el lead respondió.
"""
from alembic import op
import sqlalchemy as sa


revision = 'e3a9c5b17d40'
down_revision = 'c7d1f4a9e2b6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'embudo_config',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('dias', sa.JSON(), nullable=False),
        sa.Column('desde', sa.Date(), nullable=False),
        sa.Column('updated_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_table(
        'embudo_registros',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('dia', sa.Integer(), nullable=False),
        sa.Column('resultado', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_embudo_registros_appointment_id', 'embudo_registros', ['appointment_id'])
    op.create_index('ix_embudo_registros_user_id', 'embudo_registros', ['user_id'])
    op.create_index('ix_embudo_registros_created_at', 'embudo_registros', ['created_at'])


def downgrade():
    op.drop_index('ix_embudo_registros_created_at', 'embudo_registros')
    op.drop_index('ix_embudo_registros_user_id', 'embudo_registros')
    op.drop_index('ix_embudo_registros_appointment_id', 'embudo_registros')
    op.drop_table('embudo_registros')
    op.drop_table('embudo_config')
