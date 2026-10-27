"""Ventas: `renewal_months`, cuántos meses da una renovación (1 o 4, lo elige el closer)

Revision ID: e6a1c3d5f7b9
Revises: d5f7a9c1e3b6
Create Date: 2026-10-27 22:30:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e6a1c3d5f7b9'
down_revision = 'd5f7a9c1e3b6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.add_column(sa.Column('renewal_months', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.drop_column('renewal_months')
