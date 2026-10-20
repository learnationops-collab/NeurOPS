"""subscriptions: la suscripción del cliente a un producto de la Academia, y su historial

Work pasa a ser la fuente de verdad del acceso. Las vigentes se cargan con scripts/backfill_subscriptions.py.

Revision ID: b8d4f0a2c6e3
Revises: a7c3e9f1b5d2
Create Date: 2026-10-20 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b8d4f0a2c6e3'
down_revision = 'a7c3e9f1b5d2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('product_slug', sa.String(length=100), nullable=False),
        sa.Column('program_code', sa.String(length=10), nullable=True),
        sa.Column('sale_id', sa.Integer(), nullable=True),
        sa.Column('starts_at', sa.Date(), nullable=False),
        sa.Column('expires_at', sa.Date(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('is_deposit', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', 'product_slug', name='uq_subscriptions_client_product'),
    )
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_subscriptions_client_id'), ['client_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_subscriptions_sale_id'), ['sale_id'], unique=False)

    op.create_table(
        'subscription_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subscription_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('from_date', sa.Date(), nullable=True),
        sa.Column('to_date', sa.Date(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='work'),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('actor_email', sa.String(length=255), nullable=True),
        sa.Column('sale_id', sa.Integer(), nullable=True),
        sa.Column('payment_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['payment_id'], ['financial_sales.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('subscription_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_subscription_events_subscription_id'), ['subscription_id'],
                              unique=False)


def downgrade():
    op.drop_table('subscription_events')
    op.drop_table('subscriptions')
