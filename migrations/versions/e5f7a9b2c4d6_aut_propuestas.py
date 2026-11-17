"""Inbox: propuestas de cambios de estructura de un flujo

El setter propone un cambio de estructura y queda pendiente hasta que admin, operador o dirección
comercial lo aprueban (ADR-W147).

Revision ID: e5f7a9b2c4d6
Revises: d4e6f8a1b3c5
Create Date: 2026-11-17 15:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e5f7a9b2c4d6'
down_revision = 'd4e6f8a1b3c5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'aut_propuestas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('flujo_id', sa.Integer(), sa.ForeignKey('aut_flujos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_base_id', sa.Integer(), sa.ForeignKey('aut_flujo_versiones.id', ondelete='SET NULL'), nullable=True),
        sa.Column('grafo', sa.JSON(), nullable=False),
        sa.Column('nota', sa.Text(), nullable=True),
        sa.Column('estado', sa.String(12), nullable=False, server_default='pendiente'),
        sa.Column('autor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('revisor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('respuesta', sa.Text(), nullable=True),
        sa.Column('version_numero', sa.Integer(), nullable=True),
        sa.Column('creada_en', sa.DateTime(), nullable=False),
        sa.Column('revisada_en', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_aut_propuestas_flujo_id', 'aut_propuestas', ['flujo_id'])
    op.create_index('ix_aut_propuestas_estado', 'aut_propuestas', ['estado'])


def downgrade():
    op.drop_index('ix_aut_propuestas_estado', table_name='aut_propuestas')
    op.drop_index('ix_aut_propuestas_flujo_id', table_name='aut_propuestas')
    op.drop_table('aut_propuestas')
