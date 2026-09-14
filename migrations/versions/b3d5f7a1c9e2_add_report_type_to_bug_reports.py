"""add report_type to bug_reports

Revision ID: b3d5f7a1c9e2
Revises: a0cfe8e89e80
Create Date: 2026-09-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b3d5f7a1c9e2'
down_revision = 'a0cfe8e89e80'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.add_column(sa.Column('report_type', sa.String(length=20), nullable=False, server_default='bug'))


def downgrade():
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.drop_column('report_type')
