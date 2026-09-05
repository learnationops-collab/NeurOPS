"""add loom_link to bug_report_messages

Revision ID: d4e5f6a7b8c9
Revises: 4c64ef2c0f18
Create Date: 2026-09-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = '4c64ef2c0f18'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bug_report_messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('loom_link', sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table('bug_report_messages', schema=None) as batch_op:
        batch_op.drop_column('loom_link')
