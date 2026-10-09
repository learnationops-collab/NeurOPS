"""Conciliación de pasarelas: los CSV de Stripe y Hotmart y las diferencias revisadas

Revision ID: 6f248427caf5
Revises: 132b9589504a
Create Date: 2026-10-09 15:00:00.000000

Pedido de Kerwin (09/10/2026): una pestaña Diferencias en Finanzas donde subir los exports de Stripe
y Hotmart y ver qué no cierra entre lo reportado (las ventas del sistema) y lo que entró de verdad.
Tres tablas nuevas (ver `app/models/conciliacion.py`): cada CSV subido, cada cobro que trajo y las
diferencias que alguien ya miró y aceptó.

Va colgada de la cabeza de main para salir a producción sola, y es idempotente como `132b9589504a`:
cada tabla se crea solo si no está (una base que ya la tiene, local o staging, no se toca). En
develop una migración de unión junta esta rama con la suya.

No destructiva: tablas nuevas y vacías; no toca ninguna que ya exista.
"""
import sqlalchemy as sa
from alembic import op


revision = '6f248427caf5'
down_revision = '132b9589504a'
branch_labels = None
depends_on = None


def upgrade():
    existentes = set(sa.inspect(op.get_bind()).get_table_names())

    if 'conciliacion_cargas' not in existentes:
        op.create_table(
            'conciliacion_cargas',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('pasarela', sa.String(length=20), nullable=False),
            sa.Column('archivo', sa.String(length=255), nullable=True),
            sa.Column('filas', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('nuevas', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('repetidas', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('omitidas', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('subido_por_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('subido_at', sa.DateTime(), nullable=False),
        )

    if 'conciliacion_movimientos' not in existentes:
        op.create_table(
            'conciliacion_movimientos',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('carga_id', sa.Integer(),
                      sa.ForeignKey('conciliacion_cargas.id', ondelete='CASCADE'), nullable=False),
            sa.Column('pasarela', sa.String(length=20), nullable=False),
            sa.Column('fecha', sa.DateTime(), nullable=False),
            sa.Column('nombre', sa.String(length=255), nullable=True),
            sa.Column('email', sa.String(length=255), nullable=True),
            sa.Column('bruto', sa.Float(), nullable=False),
            sa.Column('comision', sa.Float(), nullable=True),
            sa.Column('neto', sa.Float(), nullable=True),
            sa.Column('bruto_desconocido', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('nota', sa.Text(), nullable=True),
            sa.Column('clave', sa.String(length=400), nullable=False),
            sa.UniqueConstraint('clave', name='uq_conciliacion_movimientos_clave'),
        )
        op.create_index('ix_conciliacion_movimientos_carga_id', 'conciliacion_movimientos', ['carga_id'])
        op.create_index('ix_conciliacion_movimientos_fecha', 'conciliacion_movimientos', ['fecha'])

    if 'conciliacion_revisiones' not in existentes:
        op.create_table(
            'conciliacion_revisiones',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('clave', sa.String(length=200), nullable=False),
            sa.Column('estado', sa.String(length=30), nullable=True),
            sa.Column('nota', sa.String(length=500), nullable=True),
            sa.Column('revisada_por_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('revisada_at', sa.DateTime(), nullable=False),
            sa.UniqueConstraint('clave', name='uq_conciliacion_revisiones_clave'),
        )


def downgrade():
    existentes = set(sa.inspect(op.get_bind()).get_table_names())
    for tabla in ('conciliacion_revisiones', 'conciliacion_movimientos', 'conciliacion_cargas'):
        if tabla in existentes:
            op.drop_table(tabla)
