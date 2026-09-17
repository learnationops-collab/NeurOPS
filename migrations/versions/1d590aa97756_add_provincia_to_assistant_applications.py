"""add_provincia_to_assistant_applications

Revision ID: 1d590aa97756
Revises: b3d5f7a1c9e2
Create Date: 2026-09-17 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1d590aa97756'
down_revision = 'b3d5f7a1c9e2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('assistant_applications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('provincia', sa.String(length=80), nullable=True))


def downgrade():
    with op.batch_alter_table('assistant_applications', schema=None) as batch_op:
        batch_op.drop_column('provincia')
