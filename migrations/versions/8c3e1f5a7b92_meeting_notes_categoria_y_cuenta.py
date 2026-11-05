"""Notas de Meet: categoría, serie y cuenta de origen

Revision ID: 8c3e1f5a7b92
Revises: 50726ef2bc21
Create Date: 2026-11-05

`account_email` de las notas que ya estaban: la única cuenta que había conectada. `series` y `category`
las completa la próxima lectura (app/services/notas_meet/sincronizar.py, reprocesar).
"""
import json

from alembic import op
import sqlalchemy as sa


revision = '8c3e1f5a7b92'
down_revision = '50726ef2bc21'
branch_labels = None
depends_on = None

TABLA = 'meeting_notes'
COLUMNAS = (
    ('account_email', sa.String(255)),
    ('series', sa.String(200)),
    ('category', sa.String(20)),
)


def upgrade():
    bind = op.get_bind()
    existentes = {c['name'] for c in sa.inspect(bind).get_columns(TABLA)}
    for nombre, tipo in COLUMNAS:
        if nombre not in existentes:
            op.add_column(TABLA, sa.Column(nombre, tipo, nullable=True))
            op.create_index(f'ix_{TABLA}_{nombre}', TABLA, [nombre])
    if 'category_manual' not in existentes:
        op.add_column(TABLA, sa.Column('category_manual', sa.Boolean(), nullable=False, server_default=sa.false()))

    fila = bind.execute(sa.text("SELECT payload_config FROM integrations WHERE key = 'notas_meet'")).first()
    config = fila[0] if fila else None
    if isinstance(config, str):
        config = json.loads(config or '{}')
    email = (config or {}).get('email')
    if email:
        bind.execute(sa.text(f'UPDATE {TABLA} SET account_email = :e WHERE account_email IS NULL'), {'e': email})


def downgrade():
    for nombre, _ in COLUMNAS:
        op.drop_index(f'ix_{TABLA}_{nombre}', TABLA)
        op.drop_column(TABLA, nombre)
    op.drop_column(TABLA, 'category_manual')
