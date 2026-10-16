"""aut_flujos.activo_desde: un flujo solo atrapa los mensajes que llegan después de activarlo

Revision ID: c5e1a7d3f924
Revises: e2b9c4f7a1d8
Create Date: 2026-10-16 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c5e1a7d3f924'
down_revision = 'e2b9c4f7a1d8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('aut_flujos', sa.Column('activo_desde', sa.DateTime(), nullable=True))
    op.execute("UPDATE aut_flujos SET activo_desde = actualizado_en WHERE estado = 'activo'")


def downgrade():
    op.drop_column('aut_flujos', 'activo_desde')
