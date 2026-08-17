"""Aviso de seguimiento por WhatsApp a la hora que elige el closer

El closer ahora decide, al programar cada seguimiento, si quiere el aviso y a
que hora. Los seguimientos que ya existen quedan sin aviso (enabled=False, sin
hora): el opt-in es explicito, nadie empieza a recibir mensajes por la
migracion.

Revision ID: f3b8d5c07a41
Revises: e7a4c1b9d302
Create Date: 2026-08-17 01:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f3b8d5c07a41'
down_revision = 'e7a4c1b9d302'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('followup_reminder_enabled', sa.Boolean(),
                                      server_default='0', nullable=True))
        batch_op.add_column(sa.Column('followup_reminder_time', sa.String(length=5), nullable=True))

    op.execute("UPDATE appointments SET followup_reminder_enabled = false "
               "WHERE followup_reminder_enabled IS NULL")


def downgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_column('followup_reminder_time')
        batch_op.drop_column('followup_reminder_enabled')
