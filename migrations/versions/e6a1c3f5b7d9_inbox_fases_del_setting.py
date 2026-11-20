"""Fases del setting en el Inbox (ADR-W184): fase y canal de cada conversación, su historial y la cita de las notas

Revision ID: e6a1c3f5b7d9
Revises: d5f8b1c3e7a9
Create Date: 2026-11-20

Idempotente: lo que ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'e6a1c3f5b7d9'
down_revision = 'd5f8b1c3e7a9'
branch_labels = None
depends_on = None


def _insp():
    return sa.inspect(op.get_bind())


def _columnas(tabla):
    return {c['name'] for c in _insp().get_columns(tabla)}


def upgrade():
    contactos = _columnas('ig_contactos')
    if 'fase' not in contactos:
        op.add_column('ig_contactos', sa.Column('fase', sa.String(length=20), nullable=True))
    if 'canal' not in contactos:
        op.add_column('ig_contactos', sa.Column('canal', sa.String(length=20), nullable=True))
    if 'payload' not in _columnas('notes'):
        op.add_column('notes', sa.Column('payload', sa.JSON(), nullable=True))
    if 'ig_fases' not in set(_insp().get_table_names()):
        op.create_table(
            'ig_fases',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('contacto_id', sa.Integer(), sa.ForeignKey('ig_contactos.id', ondelete='CASCADE'), nullable=False),
            sa.Column('fase', sa.String(length=20), nullable=False),
            sa.Column('desde', sa.String(length=20), nullable=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('en', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_ig_fases_contacto', 'ig_fases', ['contacto_id'])
        op.create_index('ix_ig_fases_en', 'ig_fases', ['en'])


def downgrade():
    if 'ig_fases' in set(_insp().get_table_names()):
        op.drop_table('ig_fases')
    if 'payload' in _columnas('notes'):
        op.drop_column('notes', 'payload')
    contactos = _columnas('ig_contactos')
    for col in ('canal', 'fase'):
        if col in contactos:
            op.drop_column('ig_contactos', col)
