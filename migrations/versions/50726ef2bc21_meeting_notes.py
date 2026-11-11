"""Notas de Meet: tabla `meeting_notes` (las notas de Gemini leídas del Drive de team@)

Revision ID: 50726ef2bc21
Revises: f2b4d6e8a1c3
Create Date: 2026-11-04

Una fila por Doc «… - Notas de Gemini», vinculada a la agenda y a la persona
cuando se puede. Idempotente: si la tabla ya existe no hace nada.
"""
from alembic import op
import sqlalchemy as sa


revision = '50726ef2bc21'
down_revision = 'f2b4d6e8a1c3'
branch_labels = None
depends_on = None

TABLA = 'meeting_notes'


def upgrade():
    if TABLA in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        TABLA,
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('drive_file_id', sa.String(100), nullable=False, unique=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('kind', sa.String(100), nullable=True),
        sa.Column('meeting_at', sa.DateTime(), nullable=True),
        sa.Column('calendar_event_id', sa.String(255), nullable=True),
        sa.Column('calendar_ref', sa.String(255), nullable=True),
        sa.Column('guests', sa.JSON(), nullable=True),
        sa.Column('recording_url', sa.String(500), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('appointment_id', sa.Integer(),
                  sa.ForeignKey('appointments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('link_method', sa.String(10), nullable=True),
        sa.Column('person_uuid', sa.String(36),
                  sa.ForeignKey('people.uuid', ondelete='SET NULL'), nullable=True),
        sa.Column('drive_modified_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    for columna in ('kind', 'meeting_at', 'calendar_event_id', 'appointment_id', 'person_uuid'):
        op.create_index(f'ix_{TABLA}_{columna}', TABLA, [columna])


def downgrade():
    if TABLA in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table(TABLA)
