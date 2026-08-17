"""Agrega el setter asignado por ManyChat a manychat_leads

ManyChat empezó a mandar la variable "setter" con el nombre del setter al que
reparte cada lead. Los leads que ya existían venían todos de Elias, así que se
rellenan con ese nombre para no dejarlos huérfanos en la bandeja.

Revision ID: e7a4c1b9d302
Revises: d5e2a08c9b31
Create Date: 2026-08-16 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7a4c1b9d302'
down_revision = 'd5e2a08c9b31'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('manychat_leads', schema=None) as batch_op:
        batch_op.add_column(sa.Column('setter', sa.String(length=100), nullable=True))

    # Backfill: todo lo que ya estaba creado era de Elias.
    op.execute("UPDATE manychat_leads SET setter = 'Elias' WHERE setter IS NULL")


def downgrade():
    with op.batch_alter_table('manychat_leads', schema=None) as batch_op:
        batch_op.drop_column('setter')
