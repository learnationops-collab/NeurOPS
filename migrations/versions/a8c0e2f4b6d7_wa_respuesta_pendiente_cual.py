"""WhatsApp: el mensaje que sale al abrir el link de una respuesta también puede esperar (wa_respuestas_pendientes.cual)

Revision ID: a8c0e2f4b6d7
Revises: e6a8c0d2f4b5
Create Date: 2026-11-27

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'a8c0e2f4b6d7'
down_revision = 'e6a8c0d2f4b5'
branch_labels = None
depends_on = None


def upgrade():
    columnas = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('wa_respuestas_pendientes')}
    if 'cual' not in columnas:
        op.add_column('wa_respuestas_pendientes',
                      sa.Column('cual', sa.String(10), nullable=False, server_default='respuesta'))


def downgrade():
    op.drop_column('wa_respuestas_pendientes', 'cual')
