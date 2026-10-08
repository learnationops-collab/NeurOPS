"""Porcentajes de comisión editables, con vigencia desde un mes

Revision ID: a9d3c5e7f142
Revises: c4e8a2d17f93
Create Date: 2026-10-08 12:00:00.000000

Hasta ahora los % de la nómina (setters 8%, closers 10%, Marlon 5% y la tabla de Fulfillment)
vivían en el código. Desde acá se editan desde Payroll y cada juego vale desde el mes que se elige.
La tabla arranca vacía: sin filas valen los de fábrica, que son los que había en el código, así que
la nómina no cambia hasta que alguien guarde un juego nuevo.

Cuelga de `c4e8a2d17f93` (la cabeza de main el 08/10/2026) y no de la de develop: así llega a
producción sin arrastrar las ocho migraciones de develop que todavía no pasaron. En develop la une
con su rama `d6f1a3b5c7e9`. Es idempotente por si una base ya la tiene.
"""
import sqlalchemy as sa
from alembic import op


revision = 'a9d3c5e7f142'
down_revision = 'c4e8a2d17f93'
branch_labels = None
depends_on = None


def upgrade():
    if 'comision_tasas' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'comision_tasas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('vigente_desde', sa.String(length=7), nullable=False),
        sa.Column('tasas', sa.JSON(), nullable=False),
        sa.Column('editado_por_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('vigente_desde', name='uq_comision_tasas_vigente_desde'),
    )


def downgrade():
    op.drop_table('comision_tasas')
