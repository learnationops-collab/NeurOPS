"""sales.subscription_id: la suscripción que la venta activó o extendió

La venta guarda el producto, el precio acordado, el plan y su suscripción; financial_sales queda
como el registro de sus pagos (decisión del 20/10/2026).

Revision ID: f6a2c8e4b1d3
Revises: e5c9a3f7b2d1
Create Date: 2026-10-21 02:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'f6a2c8e4b1d3'
down_revision = 'e5c9a3f7b2d1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.add_column(sa.Column('subscription_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_sales_subscription_id', ['subscription_id'], unique=False)
        batch_op.create_foreign_key('fk_sales_subscription_id', 'subscriptions', ['subscription_id'], ['id'],
                                    ondelete='SET NULL')
    # Las ventas que ya tienen suscripción colgada.
    op.execute('UPDATE sales SET subscription_id = s.id FROM subscriptions s WHERE s.sale_id = sales.id')


def downgrade():
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.drop_constraint('fk_sales_subscription_id', type_='foreignkey')
        batch_op.drop_index('ix_sales_subscription_id')
        batch_op.drop_column('subscription_id')
