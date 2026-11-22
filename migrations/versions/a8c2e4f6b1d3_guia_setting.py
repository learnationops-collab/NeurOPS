"""Guía del setting en el Inbox (ADR-W197): versiones publicadas, propuestas y qué paso se mandó

Revision ID: a8c2e4f6b1d3
Revises: f7b9d1e3a5c7
Create Date: 2026-11-22

Idempotente: lo que ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'a8c2e4f6b1d3'
down_revision = 'f7b9d1e3a5c7'
branch_labels = None
depends_on = None


def _insp():
    return sa.inspect(op.get_bind())


def upgrade():
    tablas = set(_insp().get_table_names())
    if 'guia' not in {c['name'] for c in _insp().get_columns('ig_mensajes')}:
        op.add_column('ig_mensajes', sa.Column('guia', sa.String(length=120), nullable=True))
        op.create_index('ix_ig_mensajes_guia', 'ig_mensajes', ['guia'])
    if 'guia_setting_versiones' not in tablas:
        op.create_table(
            'guia_setting_versiones',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('contenido', sa.JSON(), nullable=False),
            sa.Column('autor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('nota', sa.String(length=300), nullable=True),
            sa.Column('creada_en', sa.DateTime(), nullable=False),
        )
    if 'guia_setting_propuestas' not in tablas:
        op.create_table(
            'guia_setting_propuestas',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('etapa', sa.String(length=20), nullable=True),
            sa.Column('texto', sa.Text(), nullable=False),
            sa.Column('estado', sa.String(length=12), nullable=False),
            sa.Column('autor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('revisor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('respuesta', sa.Text(), nullable=True),
            sa.Column('creada_en', sa.DateTime(), nullable=False),
            sa.Column('revisada_en', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_guia_setting_propuestas_estado', 'guia_setting_propuestas', ['estado'])


def downgrade():
    op.drop_table('guia_setting_propuestas')
    op.drop_table('guia_setting_versiones')
    op.drop_index('ix_ig_mensajes_guia', table_name='ig_mensajes')
    op.drop_column('ig_mensajes', 'guia')
