"""add porque_mejor_opcion column to job_applications

Revision ID: f1a2b3c4d5e6
Revises: e4f5a6b7c8d9
Create Date: 2026-09-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('job_applications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('porque_mejor_opcion', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('job_applications', schema=None) as batch_op:
        batch_op.drop_column('porque_mejor_opcion')
