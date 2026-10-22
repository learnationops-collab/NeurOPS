"""system_logs y la verificación de cada pago contra el banco

`system_logs`: bitácora general (título y descripción) de eventos del sistema, con la fila a la que se
refiere. `financial_sales.transaction_*`: cuándo impactó el pago en el banco o la pasarela, su número de
operación, dónde, cuánto entró de verdad, los archivos del volumen que lo respaldan y si está
verificado (todos empiezan en 'pending').

Revision ID: 4bfb690c63bc
Revises: f6a2c8e4b1d3
Create Date: 2026-10-22 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = '4bfb690c63bc'
down_revision = 'f6a2c8e4b1d3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'system_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('entity_type', sa.String(length=40), nullable=True),
        sa.Column('entity_id', sa.String(length=64), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_system_logs_entity', 'system_logs', ['entity_type', 'entity_id'], unique=False)
    op.create_index('ix_system_logs_created_at', 'system_logs', ['created_at'], unique=False)

    with op.batch_alter_table('financial_sales', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transaction_date', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('transaction_id', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('transaction_source', sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column('transaction_amount', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('transaction_evidence', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('transaction_status', sa.String(length=20), nullable=False,
                                      server_default='pending'))
        batch_op.create_index('ix_financial_sales_transaction_id', ['transaction_id'], unique=False)


def downgrade():
    with op.batch_alter_table('financial_sales', schema=None) as batch_op:
        batch_op.drop_index('ix_financial_sales_transaction_id')
        batch_op.drop_column('transaction_status')
        batch_op.drop_column('transaction_evidence')
        batch_op.drop_column('transaction_amount')
        batch_op.drop_column('transaction_source')
        batch_op.drop_column('transaction_id')
        batch_op.drop_column('transaction_date')
    op.drop_index('ix_system_logs_created_at', table_name='system_logs')
    op.drop_index('ix_system_logs_entity', table_name='system_logs')
    op.drop_table('system_logs')
