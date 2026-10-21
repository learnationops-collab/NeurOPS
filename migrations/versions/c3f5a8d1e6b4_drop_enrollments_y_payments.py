"""Se borran enrollments y payments, el espejo viejo de las ventas (Etapa 2c, partes 5 y 6)

Las ventas son `sales` y sus pagos `financial_sales`; la deuda, la fecha de ingreso, «Mis ventas» y los
dashboards ya salen de ahí. `payment_methods` y `programs` se quedan: los siguen usando el ABM de medios de
pago de admin, la venta rápida del closer, el importador y la comisión.

Correr SOLO con la aprobación de Santiago y cuando ya no quede código que los lea: la comisión del 10% de
`closer_service` (espera una decisión), `person_service.TABLAS` (fusionar mueve `Enrollment`),
`client_dedup_service`, `database_service`, `admin_ops_service.clear_business_data` y los modelos
`Enrollment`/`Payment` (con las relaciones `Client.enrollments` y `Program.enrollments`). El downgrade vuelve a
crear las tablas vacías: lo que tenían no vuelve.

Revision ID: c3f5a8d1e6b4
Revises: b8e4f0d2a5c3
Create Date: 2026-10-21 16:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c3f5a8d1e6b4'
down_revision = 'b8e4f0d2a5c3'
branch_labels = None
depends_on = None


def upgrade():
    # Primero payments: tiene la FK a enrollments.
    op.drop_table('payments')
    op.drop_table('enrollments')


def downgrade():
    op.create_table(
        'enrollments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=False, index=True),
        sa.Column('program_id', sa.Integer(), sa.ForeignKey('programs.id'), nullable=False, index=True),
        sa.Column('closer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('enrollment_date', sa.DateTime(), nullable=True),
        sa.Column('person_uuid', sa.String(length=36), sa.ForeignKey('people.uuid', ondelete='SET NULL'), nullable=True,
                  index=True),
    )
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('enrollment_id', sa.Integer(), sa.ForeignKey('enrollments.id'), nullable=False, index=True),
        sa.Column('payment_method_id', sa.Integer(), sa.ForeignKey('payment_methods.id'), nullable=True, index=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=True),
        sa.Column('payment_type', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
    )
