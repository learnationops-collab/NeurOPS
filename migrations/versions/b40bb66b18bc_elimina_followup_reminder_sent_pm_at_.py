"""Elimina followup_reminder_sent_pm_at, sin uso tras la cola de recordatorios

Revision ID: b40bb66b18bc
Revises: 6be4ac5883e0
Create Date: 2026-08-11 00:44:33.323724

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b40bb66b18bc'
down_revision = '6be4ac5883e0'
branch_labels = None
depends_on = None


def upgrade():
    # Columna de la segunda franja fija de recordatorios (4pm), sin uso desde que las dos
    # franjas se reemplazaron por la cola con goteo de CloserFollowUpService.send_due_reminders
    # (que usa solo followup_reminder_sent_at). Solo guardaba timestamps de avisos ya enviados.
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_column('followup_reminder_sent_pm_at')


def downgrade():
    # sa.DateTime() (no el sa.DATETIME() del autogenerado, que es del dialecto SQLite local) para
    # que el rollback también aplique en PostgreSQL, igual que la migración que la creó.
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('followup_reminder_sent_pm_at', sa.DateTime(), nullable=True))
