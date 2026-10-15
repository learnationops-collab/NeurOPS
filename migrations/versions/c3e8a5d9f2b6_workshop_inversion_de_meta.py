"""workshop_events.meta_*: inversión, impresiones y clics de las campañas de workshop según Meta

Reemplazan a los cargados a mano mientras haya datos de Meta (ver workshop_meta_service).

Revision ID: c3e8a5d9f2b6
Revises: b7d1f4a8c2e5
Create Date: 2026-10-15 19:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c3e8a5d9f2b6'
down_revision = 'b7d1f4a8c2e5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meta_inversion', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('meta_impresiones', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('meta_clics', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('meta_clics_enlace', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('meta_actualizado_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.drop_column('meta_actualizado_at')
        batch_op.drop_column('meta_clics_enlace')
        batch_op.drop_column('meta_clics')
        batch_op.drop_column('meta_impresiones')
        batch_op.drop_column('meta_inversion')
