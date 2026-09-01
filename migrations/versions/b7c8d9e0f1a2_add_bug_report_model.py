"""add bug report model

Revision ID: b7c8d9e0f1a2
Revises: 286308c75915
Create Date: 2026-09-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7c8d9e0f1a2'
down_revision = '286308c75915'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('bug_reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('user_role', sa.String(length=20), nullable=True),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('urgency', sa.String(length=20), nullable=False),
    sa.Column('route', sa.String(length=255), nullable=True),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('technical_context', sa.Text(), nullable=True),
    sa.Column('screenshot', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_bug_reports_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_bug_reports'))
    )
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_bug_reports_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_bug_reports_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_bug_reports_user_id'))
        batch_op.drop_index(batch_op.f('ix_bug_reports_created_at'))
    op.drop_table('bug_reports')
