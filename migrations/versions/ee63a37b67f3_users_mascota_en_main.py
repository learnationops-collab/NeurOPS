"""users.mascota: el personaje que cada persona eligió para su avatar del dock (versión de main)

Revision ID: ee63a37b67f3
Revises: 6897f61b3985
Create Date: 2026-10-08 23:30:00.000000

Es el mismo cambio que `a4c8e2f6b913` de develop, colgado de la cabeza de main para que llegue a
producción antes que el resto de develop (que la encadena detrás de las de Agendas v2). Por eso es
idempotente: en una base que ya tiene la columna (local o staging, que vienen de develop) no hace
nada, y cuando develop pase a main `a4c8e2f6b913` tampoco la vuelve a crear.

El avatar del menú de sesión pasa de las iniciales a un personaje (page-mascot) que la persona
elige entre 10 desde el mismo menú.

No destructivo: una columna opcional, NULL para todos (el frontend asigna uno según el id).
"""
from alembic import op
import sqlalchemy as sa


revision = 'ee63a37b67f3'
down_revision = '6897f61b3985'
branch_labels = None
depends_on = None

TABLA = 'users'
COLUMNA = 'mascota'


def upgrade():
    columnas = {c['name'] for c in sa.inspect(op.get_bind()).get_columns(TABLA)}
    if COLUMNA in columnas:
        return
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        batch_op.add_column(sa.Column(COLUMNA, sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        batch_op.drop_column(COLUMNA)
