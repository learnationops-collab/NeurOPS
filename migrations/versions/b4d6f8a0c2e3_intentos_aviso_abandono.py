"""sched_intentos: país del teléfono y cuándo se avisó a Discord que el lead no terminó de agendar.

Revision ID: b4d6f8a0c2e3
Revises: a3c5e7f9b1d2
Create Date: 2026-10-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'b4d6f8a0c2e3'
down_revision = 'a3c5e7f9b1d2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('sched_intentos') as batch_op:
        batch_op.add_column(sa.Column('pais', sa.String(4), nullable=True))
        batch_op.add_column(sa.Column('avisado_en', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('sched_intentos') as batch_op:
        batch_op.drop_column('avisado_en')
        batch_op.drop_column('pais')
