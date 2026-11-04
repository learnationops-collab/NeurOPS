"""Origen guardado de la agenda: conversación, taller de Workshop y cómo se atribuyó (ADR-W101)

Revision ID: f2b4d6e8a1c3
Revises: c4e6a8b0d2f4
Create Date: 2026-11-04

Idempotente: si las columnas ya existen no hace nada.
"""
from alembic import op
import sqlalchemy as sa


revision = 'f2b4d6e8a1c3'
down_revision = 'c4e6a8b0d2f4'
branch_labels = None
depends_on = None

TABLA = 'appointments'


def _columnas():
    return {c['name'] for c in sa.inspect(op.get_bind()).get_columns(TABLA)}


def upgrade():
    existentes = _columnas()
    with op.batch_alter_table(TABLA) as t:
        if 'conversation_id' not in existentes:
            t.add_column(sa.Column('conversation_id', sa.Integer(), nullable=True))
            t.create_foreign_key('fk_appointments_conversation_id', 'conversations', ['conversation_id'], ['id'],
                                 ondelete='SET NULL')
            t.create_index('ix_appointments_conversation_id', ['conversation_id'])
        if 'workshop_event_id' not in existentes:
            t.add_column(sa.Column('workshop_event_id', sa.Integer(), nullable=True))
            t.create_foreign_key('fk_appointments_workshop_event_id', 'workshop_events', ['workshop_event_id'], ['id'],
                                 ondelete='SET NULL')
            t.create_index('ix_appointments_workshop_event_id', ['workshop_event_id'])
        if 'atribucion' not in existentes:
            t.add_column(sa.Column('atribucion', sa.String(20), nullable=True))


def downgrade():
    existentes = _columnas()
    with op.batch_alter_table(TABLA) as t:
        if 'atribucion' in existentes:
            t.drop_column('atribucion')
        if 'workshop_event_id' in existentes:
            t.drop_index('ix_appointments_workshop_event_id')
            t.drop_constraint('fk_appointments_workshop_event_id', type_='foreignkey')
            t.drop_column('workshop_event_id')
        if 'conversation_id' in existentes:
            t.drop_index('ix_appointments_conversation_id')
            t.drop_constraint('fk_appointments_conversation_id', type_='foreignkey')
            t.drop_column('conversation_id')
