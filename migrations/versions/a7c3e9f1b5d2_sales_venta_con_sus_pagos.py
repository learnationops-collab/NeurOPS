"""sales: la venta, y sale_id en sus pagos (financial_sales) y en su plan de cuotas

Hasta acá cada pago era una «venta». Las ventas históricas se arman con scripts/backfill_sales.py.

Revision ID: a7c3e9f1b5d2
Revises: f1c5b9d3a7e2
Create Date: 2026-10-20 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a7c3e9f1b5d2'
down_revision = 'f1c5b9d3a7e2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sales',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=True),
        sa.Column('program_code', sa.String(length=10), nullable=True),
        sa.Column('kind', sa.String(length=20), nullable=False, server_default='new'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('sold_at', sa.DateTime(), nullable=False),
        sa.Column('closer_email', sa.String(length=255), nullable=True),
        sa.Column('setter', sa.String(length=255), nullable=True),
        sa.Column('appointment_id', sa.Integer(), nullable=True),
        sa.Column('agreed_total', sa.Float(), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=True),
        sa.Column('review_note', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_sales_client_id'), ['client_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_sales_program_code'), ['program_code'], unique=False)
        batch_op.create_index(batch_op.f('ix_sales_appointment_id'), ['appointment_id'], unique=False)

    for tabla in ('financial_sales', 'installment_plans'):
        with op.batch_alter_table(tabla, schema=None) as batch_op:
            batch_op.add_column(sa.Column('sale_id', sa.Integer(), nullable=True))
            batch_op.create_index(batch_op.f(f'ix_{tabla}_sale_id'), ['sale_id'], unique=False)
            batch_op.create_foreign_key(f'fk_{tabla}_sale_id_sales', 'sales', ['sale_id'], ['id'], ondelete='SET NULL')


def downgrade():
    for tabla in ('installment_plans', 'financial_sales'):
        with op.batch_alter_table(tabla, schema=None) as batch_op:
            batch_op.drop_constraint(f'fk_{tabla}_sale_id_sales', type_='foreignkey')
            batch_op.drop_index(batch_op.f(f'ix_{tabla}_sale_id'))
            batch_op.drop_column('sale_id')
    op.drop_table('sales')
