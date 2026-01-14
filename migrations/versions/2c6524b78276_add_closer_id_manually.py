"""Add closer_id manually

Revision ID: 2c6524b78276
Revises: 76fbb1370bf4
Create Date: 2026-01-14 15:21:54.610957

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2c6524b78276'
down_revision = '76fbb1370bf4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('enrollments', sa.Column('closer_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_enrollments_closer_id_users', 'enrollments', 'users', ['closer_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_enrollments_closer_id_users', 'enrollments', type_='foreignkey')
    op.drop_column('enrollments', 'closer_id')

