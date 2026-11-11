"""Inbox: la variante del mensaje que recibió cada persona (`ig_mensajes.variante`)

Revision ID: d5f7a9c1e3b6
Revises: c4e6a8b0d2f4
Create Date: 2026-11-07

Prueba A/B de un mensaje del flujo: cada saliente guarda qué variante del nodo
se mandó ('A' es el contenido del nodo; NULL, un nodo sin variantes).
Idempotente y no destructiva: una columna opcional con su índice.
"""
from alembic import op
import sqlalchemy as sa


revision = 'd5f7a9c1e3b6'
down_revision = 'c4e6a8b0d2f4'
branch_labels = None
depends_on = None

INDICE = 'ix_ig_mensajes_variante'


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'variante' not in {c['name'] for c in inspector.get_columns('ig_mensajes')}:
        op.add_column('ig_mensajes', sa.Column('variante', sa.String(10), nullable=True))
    if INDICE not in {i['name'] for i in inspector.get_indexes('ig_mensajes')}:
        op.create_index(INDICE, 'ig_mensajes', ['variante'])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if INDICE in {i['name'] for i in inspector.get_indexes('ig_mensajes')}:
        op.drop_index(INDICE, table_name='ig_mensajes')
    if 'variante' in {c['name'] for c in inspector.get_columns('ig_mensajes')}:
        op.drop_column('ig_mensajes', 'variante')
