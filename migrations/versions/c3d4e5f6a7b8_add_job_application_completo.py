"""add completo flag to job_applications (guardado progresivo)

Revision ID: c3d4e5f6a7b8
Revises: a7b8c9d0e1f2
Create Date: 2026-09-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('job_applications', schema=None) as batch_op:
        # server_default=true(): las filas que ya existen se guardaron con el
        # flujo viejo (todo o nada, solo al terminar), así que son completas.
        batch_op.add_column(sa.Column('completo', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    with op.batch_alter_table('job_applications', schema=None) as batch_op:
        batch_op.drop_column('completo')
