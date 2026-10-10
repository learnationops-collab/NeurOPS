"""setter_daily_stats: columnas del reporte diario v2 (por canal y bienvenidas)

Revision ID: b7e4c2a9d561
Revises: c469c16a3847
Create Date: 2026-10-10 12:00:00.000000

El reporte del setter pasa al formulario por pasos que aprobó Kerwin (10/10/2026): entrantes, no
leads, in-abribles, aperturas (en entrantes y en dolor) y agendas se cargan por canal —anuncios e
inbound—, y aparecen las bienvenidas (hechas, respondidas, aperturas). El embudo, los follow-ups y
la reflexión reusan columnas que ya existían, y los totales viejos se siguen llenando.

`report_version` distingue los reportes: 1 para todo lo cargado antes (el server_default), 2 para
los nuevos. Así quien lee sabe si los canales existen o si solo hay totales.

No destructivo: columnas nuevas con default 0 (1 la versión) para las filas que ya están.
Idempotente por si una base ya las tiene.
"""
from alembic import op
import sqlalchemy as sa


revision = 'b7e4c2a9d561'
down_revision = 'c469c16a3847'
branch_labels = None
depends_on = None

TABLA = 'setter_daily_stats'
COLUMNAS = [
    'ads_entrantes', 'ads_no_lead', 'ads_inabribles', 'ads_ap_entrantes', 'ads_ap_dolor', 'ads_agendas',
    'inb_entrantes', 'inb_no_lead', 'inb_inabribles', 'inb_ap_entrantes', 'inb_ap_dolor', 'inb_agendas',
    'bnv_hechas', 'bnv_respondidas', 'bnv_aperturas',
]


def upgrade():
    existentes = {c['name'] for c in sa.inspect(op.get_bind()).get_columns(TABLA)}
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        if 'report_version' not in existentes:
            batch_op.add_column(sa.Column('report_version', sa.Integer(), nullable=False, server_default='1'))
        for nombre in COLUMNAS:
            if nombre not in existentes:
                batch_op.add_column(sa.Column(nombre, sa.Integer(), nullable=True, server_default='0'))


def downgrade():
    existentes = {c['name'] for c in sa.inspect(op.get_bind()).get_columns(TABLA)}
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        for nombre in reversed(COLUMNAS):
            if nombre in existentes:
                batch_op.drop_column(nombre)
        if 'report_version' in existentes:
            batch_op.drop_column('report_version')
