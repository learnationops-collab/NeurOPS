"""Resultado de la llamada de triage en la agenda (docs/plan_segmentos_triage.md §3)

En la agenda del triage: `triage_calificacion` ('calificado' si puede invertir más de 500 USD y pasa al
closer, 'descalificado' si no), `triage_low_ticket` (qué pasó con el low ticket de 100 USD de un
descalificado: 'no_pitch', 'cerrado', 'no_cerrado', 'seguimiento' o 'descartado'). La nota para el closer
va al log de la persona (lead_event_logs, ver f1a8d3c6b2e9).
En la agenda de closing que generó el pase: `agenda_triage_id`, la agenda del triage de la que viene.

Revision ID: c4e9a1d7f2b8
Revises: b8d2f4a6c1e3
Create Date: 2026-10-26 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c4e9a1d7f2b8'
down_revision = 'b8d2f4a6c1e3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('triage_calificacion', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('triage_low_ticket', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('agenda_triage_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_appointments_agenda_triage_id', ['agenda_triage_id'], unique=False)
        batch_op.create_foreign_key('fk_appointments_agenda_triage_id', 'appointments',
                                    ['agenda_triage_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_constraint('fk_appointments_agenda_triage_id', type_='foreignkey')
        batch_op.drop_index('ix_appointments_agenda_triage_id')
        batch_op.drop_column('agenda_triage_id')
        batch_op.drop_column('triage_low_ticket')
        batch_op.drop_column('triage_calificacion')
