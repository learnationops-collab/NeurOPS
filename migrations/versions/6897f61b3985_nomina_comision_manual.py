"""Nómina: la comisión guardada solo vale si se escribió a mano

Columna `commissions_manual` en `monthly_payroll`.

Revision ID: 6897f61b3985
Revises: e4a7c1b9f352
Create Date: 2026-10-08 21:00:00.000000

Guardar la fila de nómina de un mes por cualquier cambio (el sueldo, el tilde de pagado)
congelaba la comisión calculada en ese momento: un % editado después en Payroll o una venta
sacada de la nómina ya no se veían en Finanzas. Desde ahora la comisión guardada vale solo
con `commissions_manual`; sin la marca manda la calculada en vivo.

Backfill: las filas de antes de septiembre de 2026 son de antes del sistema de comisiones
(se cargaban a mano), así que quedan manuales; las de septiembre en adelante eran la foto del
cálculo y vuelven al cálculo automático.

Idempotente, como las anteriores: cuelga de la cabeza de main y develop la va a recibir por
un merge; si la columna ya existe, no hace nada. No destructiva: una columna con default.
"""
from alembic import op
import sqlalchemy as sa


revision = '6897f61b3985'
down_revision = 'e4a7c1b9f352'
branch_labels = None
depends_on = None

TABLA = 'monthly_payroll'
COLUMNA = 'commissions_manual'
# El primer mes con comisiones calculadas por el sistema (Fulfillment arrancó en septiembre).
PRIMER_MES_AUTOMATICO = '2026-09'


def upgrade():
    columnas = {c['name'] for c in sa.inspect(op.get_bind()).get_columns(TABLA)}
    if COLUMNA in columnas:
        return

    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        batch_op.add_column(sa.Column(COLUMNA, sa.Boolean(), nullable=False, server_default=sa.false()))

    nomina = sa.table(TABLA, sa.column('month', sa.String), sa.column(COLUMNA, sa.Boolean))
    op.execute(nomina.update().where(nomina.c.month < PRIMER_MES_AUTOMATICO).values({COLUMNA: True}))


def downgrade():
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        batch_op.drop_column(COLUMNA)
