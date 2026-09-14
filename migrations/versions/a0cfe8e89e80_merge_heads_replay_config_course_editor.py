"""merge heads: replay config + course editor

Revision ID: a0cfe8e89e80
Revises: 245dc0b0afd5, d4e6f8a0b2c4
Create Date: 2026-09-14 13:25:33.303272

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a0cfe8e89e80'
down_revision = ('245dc0b0afd5', 'd4e6f8a0b2c4')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
