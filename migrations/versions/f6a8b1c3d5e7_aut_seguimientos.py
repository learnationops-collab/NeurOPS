"""Inbox: seguimientos condicionales

«Si no responde en X horas, mandarle esto», programado desde el chat y enviado por el reloj del motor.

Revision ID: f6a8b1c3d5e7
Revises: e5f7a9b2c4d6
Create Date: 2026-11-17 17:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'f6a8b1c3d5e7'
down_revision = 'e5f7a9b2c4d6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'aut_seguimientos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('contacto_id', sa.Integer(), sa.ForeignKey('ig_contactos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('autor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('texto', sa.Text(), nullable=True),
        sa.Column('audio_id', sa.Integer(), sa.ForeignKey('audio_clips.id', ondelete='SET NULL'), nullable=True),
        sa.Column('url_audio', sa.String(600), nullable=True),
        sa.Column('nombre_audio', sa.String(120), nullable=True),
        sa.Column('pausar', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('enviar_en', sa.DateTime(), nullable=False),
        sa.Column('estado', sa.String(12), nullable=False, server_default='programado'),
        sa.Column('detalle', sa.String(300), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('resuelto_en', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_aut_seguimientos_contacto_id', 'aut_seguimientos', ['contacto_id'])
    op.create_index('ix_aut_seguimientos_enviar_en', 'aut_seguimientos', ['enviar_en'])
    op.create_index('ix_aut_seguimientos_estado', 'aut_seguimientos', ['estado'])


def downgrade():
    op.drop_table('aut_seguimientos')
