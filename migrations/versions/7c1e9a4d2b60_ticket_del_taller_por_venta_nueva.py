"""ticket del taller por venta nueva: cash_ventas y ventas_cobradas en workshop_events

Revision ID: 7c1e9a4d2b60
Revises: ba7a0c1e3009
Create Date: 2026-10-02 12:00:00.000000

El ticket promedio del taller era `cash_collected / sales`: el cash incluye las señas
(a proposito, el ROAS las usa) y `sales` cuenta PERSONAS, incluso a quien la hoja marca
como cerrada sin la venta cargada, asi que el ticket salia inflado. Desde el 02/10/2026
el ticket es lo cobrado en ventas nuevas (pago completo y split pay) dividido por esas
filas de venta, y el snapshot del taller guarda los dos numeros por separado.

Las columnas quedan en NULL en los talleres ya cargados: el listado de eventos
(GET /api/workshop/events) las completa solo la primera vez que las ve vacias.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7c1e9a4d2b60'
down_revision = 'ba7a0c1e3009'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cash_ventas', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('ventas_cobradas', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.drop_column('ventas_cobradas')
        batch_op.drop_column('cash_ventas')
