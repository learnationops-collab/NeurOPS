"""Tabla instagram_webhook_eventos: lo que Meta manda al webhook de Instagram

Revision ID: a8c3e5f71b24
Revises: c5d9e1f3a724
Create Date: 2026-10-14 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a8c3e5f71b24'
down_revision = 'c5d9e1f3a724'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'instagram_webhook_eventos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recibido_en', sa.DateTime(), nullable=False),
        sa.Column('tipos', sa.String(length=200), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_instagram_webhook_eventos_recibido_en', 'instagram_webhook_eventos', ['recibido_en'])


def downgrade():
    op.drop_index('ix_instagram_webhook_eventos_recibido_en', table_name='instagram_webhook_eventos')
    op.drop_table('instagram_webhook_eventos')
