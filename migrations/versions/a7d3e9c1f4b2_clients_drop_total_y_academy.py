"""clients: se borran total_amount, academy_product_slug y academy_expires_at (Etapa 2c, parte 3)

El total acordado vive en la venta (`sales.agreed_total`) y el acceso a la Academia en la suscripción
(`subscriptions`). Correr SOLO con la aprobación de Santiago, después de `backfill_agreed_total` y
`backfill_subscriptions` en esa base (los dos leen estas columnas). El downgrade vuelve a crear las
columnas vacías: lo que tenían no vuelve.

Revision ID: a7d3e9c1f4b2
Revises: 4bfb690c63bc
Create Date: 2026-10-21 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a7d3e9c1f4b2'
down_revision = '4bfb690c63bc'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.drop_column('total_amount')
        batch_op.drop_column('academy_product_slug')
        batch_op.drop_column('academy_expires_at')


def downgrade():
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.add_column(sa.Column('academy_expires_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('academy_product_slug', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('total_amount', sa.Float(), nullable=True))
