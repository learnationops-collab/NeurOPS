"""setter_daily_stats: leads por canal y respuestas a las aperturas

Revision ID: f4c8a2d6b913
Revises: a8c3e5f71b24
Create Date: 2026-10-15 12:00:00.000000

Correcciones del dueño al reporte del setter (15/10/2026):

- «Aquí le vas a agregar no solamente los mensajes, los no leads, los inabribles, sino los leads»:
  hasta hoy los cualificados eran entrantes − no leads − in-abribles, así que el que no contestó
  contaba como cualificado. Ahora el setter carga los leads de cada canal (`*_leads`) y lo que sobra
  son los que no contestaron.
- «Una cosa es las aperturas que hicieron y otra cosa es lo que respondieron»: cuántos respondieron
  las aperturas en entrantes y en dolor de cada canal, y las de las bienvenidas (`*_resp`).

Las columnas son NULL sin default a propósito: NULL es «este reporte no lo cargó» (todo lo enviado
antes de hoy), y quien lee sigue con la cuenta vieja para esos días en vez de leer un cero que no
es cierto. Idempotente por si una base ya las tiene.
"""
from alembic import op
import sqlalchemy as sa


revision = 'f4c8a2d6b913'
down_revision = 'a8c3e5f71b24'
branch_labels = None
depends_on = None

TABLA = 'setter_daily_stats'
COLUMNAS = [
    'ads_leads', 'ads_ap_entrantes_resp', 'ads_ap_dolor_resp',
    'inb_leads', 'inb_ap_entrantes_resp', 'inb_ap_dolor_resp',
    'bnv_aperturas_resp',
]


def upgrade():
    existentes = {c['name'] for c in sa.inspect(op.get_bind()).get_columns(TABLA)}
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        for nombre in COLUMNAS:
            if nombre not in existentes:
                batch_op.add_column(sa.Column(nombre, sa.Integer(), nullable=True))


def downgrade():
    existentes = {c['name'] for c in sa.inspect(op.get_bind()).get_columns(TABLA)}
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        for nombre in reversed(COLUMNAS):
            if nombre in existentes:
                batch_op.drop_column(nombre)
