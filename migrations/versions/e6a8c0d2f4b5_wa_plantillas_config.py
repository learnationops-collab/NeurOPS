"""WhatsApp: opción única por plantilla (wa_plantillas_config)

Revision ID: e6a8c0d2f4b5
Revises: c4e6a8b0d2f3
Create Date: 2026-11-27

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'e6a8c0d2f4b5'
down_revision = 'c4e6a8b0d2f3'
branch_labels = None
depends_on = None


def upgrade():
    if 'wa_plantillas_config' not in set(sa.inspect(op.get_bind()).get_table_names()):
        op.create_table(
            'wa_plantillas_config',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('plantilla', sa.String(120), nullable=False, unique=True),
            sa.Column('opcion_unica', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('texto_repetida', sa.Text(), nullable=True),
            sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        )


def downgrade():
    op.drop_table('wa_plantillas_config')
