"""Suscripciones: `academy_synced_at`, hasta cuándo la Academia tiene cada una tal como está

Las que ya existen se marcan como avisadas: el 26/10 se reenviaron a mano las que cambiaron.

Revision ID: b8d4f1a6c3e7
Revises: a7c3e9f2d4b1
Create Date: 2026-10-26 23:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b8d4f1a6c3e7'
down_revision = 'a7c3e9f2d4b1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('academy_synced_at', sa.DateTime(), nullable=True))
    op.execute('UPDATE subscriptions SET academy_synced_at = updated_at')


def downgrade():
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.drop_column('academy_synced_at')
