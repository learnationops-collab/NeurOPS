"""financial_sales.payer_person_uuid: quién pagó, solo si no es quien compró

Ver docs/plan_personas.md (decisión del 20/10/2026: en los pagos solo quedan uuid; el pagador existe
como persona solo cuando es otra que el comprador).

Revision ID: e5c9a3f7b2d1
Revises: d4b8e2f6a1c9
Create Date: 2026-10-21 00:30:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e5c9a3f7b2d1'
down_revision = 'd4b8e2f6a1c9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('financial_sales', schema=None) as batch_op:
        batch_op.add_column(sa.Column('payer_person_uuid', sa.String(length=36), nullable=True))
        batch_op.create_index('ix_financial_sales_payer_person_uuid', ['payer_person_uuid'], unique=False)
        batch_op.create_foreign_key('fk_financial_sales_payer_person_uuid', 'people', ['payer_person_uuid'], ['uuid'],
                                    ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('financial_sales', schema=None) as batch_op:
        batch_op.drop_constraint('fk_financial_sales_payer_person_uuid', type_='foreignkey')
        batch_op.drop_index('ix_financial_sales_payer_person_uuid')
        batch_op.drop_column('payer_person_uuid')
