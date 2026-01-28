"""backfill is_active for existing users

Revision ID: cda38a634c3c
Revises: de82aaadda3a
Create Date: 2026-01-28 14:21:44.535325

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cda38a634c3c'
down_revision = 'de82aaadda3a'
branch_labels = None
depends_on = None


def upgrade():
    # Backfill is_active=True for existing users where it is NULL
    users_table = sa.table('users', sa.column('is_active', sa.Boolean))
    op.execute(users_table.update().where(users_table.c.is_active == None).values(is_active=True))


def downgrade():
    pass
