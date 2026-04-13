"""standardize_financial_models

Revision ID: 6b97d0358ed0
Revises: 493c095f5bfa
Create Date: 2026-04-12 14:28:08.235564

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6b97d0358ed0'
down_revision = '493c095f5bfa'
branch_labels = None
depends_on = None


def upgrade():
    # Agregar columna 'date' a ambas tablas (si no existe ya)
    try:
        op.add_column('financial_agendas', sa.Column('date', sa.DateTime(), nullable=True))
    except Exception:
        pass
    try:
        op.add_column('financial_sales', sa.Column('date', sa.DateTime(), nullable=True))
    except Exception:
        pass


def downgrade():
    try:
        op.drop_column('financial_sales', 'date')
    except Exception:
        pass
    try:
        op.drop_column('financial_agendas', 'date')
    except Exception:
        pass
