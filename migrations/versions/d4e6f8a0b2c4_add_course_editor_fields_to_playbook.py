"""add course editor fields to playbook (roadmap icon/description, question explanation)

Revision ID: d4e6f8a0b2c4
Revises: b1c2d3e4f5a6
Create Date: 2026-09-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e6f8a0b2c4'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('playbook_roadmaps', schema=None) as batch_op:
        batch_op.add_column(sa.Column('icon', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('description', sa.String(length=500), nullable=True))

    with op.batch_alter_table('playbook_questions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('explanation', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('playbook_questions', schema=None) as batch_op:
        batch_op.drop_column('explanation')

    with op.batch_alter_table('playbook_roadmaps', schema=None) as batch_op:
        batch_op.drop_column('description')
        batch_op.drop_column('icon')
