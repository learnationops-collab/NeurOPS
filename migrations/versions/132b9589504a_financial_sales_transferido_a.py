"""financial_sales.transferido_a: a quién del equipo se le hizo un pago por transferencia

Revision ID: 132b9589504a
Revises: ee63a37b67f3
Create Date: 2026-10-09 12:00:00.000000

Pedido de Kerwin (09/10/2026): marcar en cada pago por transferencia a quién del equipo se le hizo
(Pedro, Jean Carlo u otro), verlo en Finanzas y descontárselo en Payroll y la Nómina. La lista de
opciones vive en `app/services/transferencias_service.py`.

Va colgada de la cabeza de main para salir a producción sola, y es idempotente como
`ee63a37b67f3`: en una base que ya tiene la columna (local o staging, que vienen de develop) no
hace nada. En develop una migración de unión junta esta rama con la suya.

No destructiva: una columna opcional, NULL para todos los pagos que ya existen («sin marcar»).
"""
from alembic import op
import sqlalchemy as sa


revision = '132b9589504a'
down_revision = 'ee63a37b67f3'
branch_labels = None
depends_on = None

TABLA = 'financial_sales'
COLUMNA = 'transferido_a'


def upgrade():
    columnas = {c['name'] for c in sa.inspect(op.get_bind()).get_columns(TABLA)}
    if COLUMNA in columnas:
        return
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        batch_op.add_column(sa.Column(COLUMNA, sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        batch_op.drop_column(COLUMNA)
