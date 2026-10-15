"""meta_campanas_workshop: las campañas de Meta que llevan a las landings del workshop, marcadas a mano

Revision ID: b7d1f4a8c2e5
Revises: a4c9e2f7b1d3
Create Date: 2026-10-15 18:45:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b7d1f4a8c2e5'
down_revision = 'a4c9e2f7b1d3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'meta_campanas_workshop',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('campana_id', sa.String(length=40), nullable=False),
        sa.Column('nombre', sa.String(length=255), nullable=True),
        sa.Column('creado_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campana_id'),
    )


def downgrade():
    op.drop_table('meta_campanas_workshop')
