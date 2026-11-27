"""WhatsApp: la respuesta a un botón pone varias etiquetas y saca otras (wa_respuestas_boton.etiquetas y .quitar)

Revision ID: c1e3a5b7d9f2
Revises: a8c0e2f4b6d7
Create Date: 2026-11-27

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'c1e3a5b7d9f2'
down_revision = 'a8c0e2f4b6d7'
branch_labels = None
depends_on = None


def upgrade():
    columnas = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('wa_respuestas_boton')}
    if 'etiquetas' not in columnas:
        op.add_column('wa_respuestas_boton', sa.Column('etiquetas', sa.JSON(), nullable=True))
    if 'quitar' not in columnas:
        op.add_column('wa_respuestas_boton', sa.Column('quitar', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('wa_respuestas_boton', 'quitar')
    op.drop_column('wa_respuestas_boton', 'etiquetas')
