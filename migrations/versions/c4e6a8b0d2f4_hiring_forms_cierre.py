"""Hiring: cierre de la búsqueda por formulario (`hiring_forms.cierre_*`)

Revision ID: c4e6a8b0d2f4
Revises: b7d9f1a3c5e8
Create Date: 2026-11-03

La cuenta regresiva de la página de la vacante pasa a configurarse en cada
formulario: `cierre_modo` ('fecha': hasta `cierre_en`, la misma para todos;
'visita': `cierre_horas` desde la primera visita de cada persona; NULL: sin
cuenta regresiva). Idempotente y no destructiva: tres columnas opcionales.
"""
from alembic import op
import sqlalchemy as sa


revision = 'c4e6a8b0d2f4'
down_revision = 'b7d9f1a3c5e8'
branch_labels = None
depends_on = None

COLUMNAS = (
    ('cierre_modo', sa.String(12)),
    ('cierre_en', sa.DateTime()),
    ('cierre_horas', sa.Integer()),
)


def upgrade():
    bind = op.get_bind()
    existentes = {c['name'] for c in sa.inspect(bind).get_columns('hiring_forms')}
    for nombre, tipo in COLUMNAS:
        if nombre not in existentes:
            op.add_column('hiring_forms', sa.Column(nombre, tipo, nullable=True))


def downgrade():
    bind = op.get_bind()
    existentes = {c['name'] for c in sa.inspect(bind).get_columns('hiring_forms')}
    for nombre, _ in COLUMNAS:
        if nombre in existentes:
            op.drop_column('hiring_forms', nombre)
