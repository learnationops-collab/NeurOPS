"""Talleres: base del show up de citas (citas con resultado y citas sin reportar)

El show up de citas pasa a dividirse por las citas con resultado (asistieron + no show) y no por todas
las agendadas. Quedan null en los talleres ya cargados hasta el proximo recalculo (el panel resync o
scripts/resync_workshop_events.py --apply).

Revision ID: a3c7e1f5b9d2
Revises: d7a3f1c9e5b4
Create Date: 2026-10-24 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a3c7e1f5b9d2'
down_revision = 'd7a3f1c9e5b4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('citas_reportadas', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('citas_sin_reportar', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.drop_column('citas_sin_reportar')
        batch_op.drop_column('citas_reportadas')
