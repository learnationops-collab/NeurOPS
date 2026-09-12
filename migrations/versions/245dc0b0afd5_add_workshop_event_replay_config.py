"""add replay config fields to workshop_events

Revision ID: 245dc0b0afd5
Revises: b1c2d3e4f5a6
Create Date: 2026-09-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '245dc0b0afd5'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('replay_loom_id', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('replay_activo_desde', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('replay_vence_hasta', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('replay_info_segundos', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('replay_oferta_segundos', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.drop_column('replay_oferta_segundos')
        batch_op.drop_column('replay_info_segundos')
        batch_op.drop_column('replay_vence_hasta')
        batch_op.drop_column('replay_activo_desde')
        batch_op.drop_column('replay_loom_id')
