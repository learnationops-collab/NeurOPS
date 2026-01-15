"""add is_active to programs

Revision ID: a1b2c3d4e5f6
Revises: 2c6524b78276
Create Date: 2026-01-15 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '2c6524b78276'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('programs', sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'))


def downgrade():
    op.drop_column('programs', 'is_active')
