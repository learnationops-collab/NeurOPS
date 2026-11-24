"""WhatsApp Cloud API: tabla whatsapp_webhook_eventos, los eventos crudos del webhook

Revision ID: d1a3c5e7f9b2
Revises: b3d5f7a9c2e4
Create Date: 2026-11-24

Idempotente: lo que ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'd1a3c5e7f9b2'
down_revision = 'b3d5f7a9c2e4'
branch_labels = None
depends_on = None


def upgrade():
    if 'whatsapp_webhook_eventos' in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        'whatsapp_webhook_eventos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('recibido_en', sa.DateTime(), nullable=False),
        sa.Column('tipos', sa.String(200), nullable=False, server_default=''),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('procesado_en', sa.DateTime(), nullable=True),
        sa.Column('resultado', sa.String(200), nullable=True),
    )
    op.create_index('ix_whatsapp_webhook_eventos_recibido_en', 'whatsapp_webhook_eventos', ['recibido_en'])
    op.create_index('ix_whatsapp_webhook_eventos_procesado_en', 'whatsapp_webhook_eventos', ['procesado_en'])


def downgrade():
    op.drop_table('whatsapp_webhook_eventos')
