"""Finanzas: estado de cada pago de la nómina y foto de saldos

Revision ID: c7d1f4a9e2b6
Revises: 8c3e1f5a7b92
Create Date: 2026-11-07

`monthly_payroll` suma el estado del pago (pendiente, en tránsito, pagado, a revisar), los pagos
parciales y descuentos, y cuándo salió la plata. `finance_liquidity` guarda los saldos de las
cuentas de cada mes con el momento en que se tomaron (ver app/models/liquidez.py).
"""
from alembic import op
import sqlalchemy as sa


revision = 'c7d1f4a9e2b6'
down_revision = '8c3e1f5a7b92'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('monthly_payroll') as batch:
        batch.add_column(sa.Column('status', sa.String(20), nullable=True))
        batch.add_column(sa.Column('movements', sa.JSON(), nullable=True))
        batch.add_column(sa.Column('sent_at', sa.DateTime(), nullable=True))
    op.create_table(
        'finance_liquidity',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('month', sa.String(7), nullable=False, unique=True),
        sa.Column('accounts', sa.JSON(), nullable=False),
        sa.Column('ads_spent', sa.Float(), nullable=True),
        sa.Column('next_income', sa.JSON(), nullable=False),
        sa.Column('taken_at', sa.DateTime(), nullable=False),
        sa.Column('updated_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )


def downgrade():
    op.drop_table('finance_liquidity')
    with op.batch_alter_table('monthly_payroll') as batch:
        batch.drop_column('sent_at')
        batch.drop_column('movements')
        batch.drop_column('status')
