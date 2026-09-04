"""add academy (learnation) linking fields to clients

Revision ID: b4c5d6e7f8a9
Revises: f1a2b3c4d5e6
Create Date: 2026-09-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b4c5d6e7f8a9'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.add_column(sa.Column('learnation_user_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('academy_product_slug', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('academy_expires_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.drop_column('academy_expires_at')
        batch_op.drop_column('academy_product_slug')
        batch_op.drop_column('learnation_user_id')
