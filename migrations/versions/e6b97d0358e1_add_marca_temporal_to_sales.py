"""add marca_temporal to sales

Revision ID: e6b97d0358e1
Revises: 6b97d0358ed0
Create Date: 2026-04-13 13:11:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e6b97d0358e1'
down_revision = '6b97d0358ed0'
branch_labels = None
depends_on = None


def upgrade():
    # Usamos try/except por si el usuario ya aplicó cambios manualmente
    try:
        op.add_column('financial_sales', sa.Column('marca_temporal', sa.String(length=100), nullable=True))
    except Exception as e:
        print(f"Skipping add_column: {e}")


def downgrade():
    op.drop_column('financial_sales', 'marca_temporal')
