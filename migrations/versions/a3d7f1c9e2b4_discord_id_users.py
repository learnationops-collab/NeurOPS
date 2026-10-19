"""discord_id en users: el ID numérico para etiquetar al setter en los avisos de agenda

Revision ID: a3d7f1c9e2b4
Revises: b7d3e9a1c4f2
Create Date: 2026-10-19 22:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a3d7f1c9e2b4'
down_revision = 'b7d3e9a1c4f2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('discord_id', sa.String(length=24), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('discord_id')
