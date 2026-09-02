"""add bug report response fields

Revision ID: c9d1e2f3a4b5
Revises: b7c8d9e0f1a2
Create Date: 2026-09-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c9d1e2f3a4b5'
down_revision = 'b7c8d9e0f1a2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.add_column(sa.Column('problem', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('admin_response', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('responded_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('responded_by_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('is_read_by_user', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.create_foreign_key(batch_op.f('fk_bug_reports_responded_by_id_users'), 'users', ['responded_by_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_bug_reports_responded_by_id_users'), type_='foreignkey')
        batch_op.drop_column('is_read_by_user')
        batch_op.drop_column('responded_by_id')
        batch_op.drop_column('responded_at')
        batch_op.drop_column('admin_response')
        batch_op.drop_column('problem')
