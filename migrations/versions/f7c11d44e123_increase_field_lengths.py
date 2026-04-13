"""increase field lengths

Revision ID: f7c11d44e123
Revises: e6b97d0358e1
Create Date: 2026-04-13 15:17:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f7c11d44e123'
down_revision = 'e6b97d0358e1'
branch_labels = None
depends_on = None


def upgrade():
    # Aumentar longitudes en financial_sales
    with op.batch_alter_table('financial_sales', schema=None) as batch_op:
        batch_op.alter_column('email_vendedor', type_=sa.String(length=255))
        batch_op.alter_column('nombre_cliente', type_=sa.String(length=255))
        batch_op.alter_column('telefono', type_=sa.String(length=255))
        batch_op.alter_column('mail_cliente', type_=sa.String(length=255))
        batch_op.alter_column('tipo_pago', type_=sa.String(length=255))
        batch_op.alter_column('segundo_pago', type_=sa.String(length=255))
        batch_op.alter_column('metodo_pago', type_=sa.String(length=255))
        batch_op.alter_column('examen', type_=sa.String(length=255))
        batch_op.alter_column('instagram', type_=sa.String(length=255))
        batch_op.alter_column('setter', type_=sa.String(length=255))
        batch_op.alter_column('marca_temporal', type_=sa.String(length=255))

    # Aumentar longitudes en financial_agendas
    with op.batch_alter_table('financial_agendas', schema=None) as batch_op:
        batch_op.alter_column('nombre', type_=sa.String(length=255))
        batch_op.alter_column('registro', type_=sa.String(length=255))
        batch_op.alter_column('fecha_meet', type_=sa.String(length=255))
        batch_op.alter_column('whatsapp', type_=sa.String(length=255))
        batch_op.alter_column('zona_geografica', type_=sa.String(length=255))
        batch_op.alter_column('closer', type_=sa.String(length=255))
        batch_op.alter_column('lead', type_=sa.String(length=255))
        batch_op.alter_column('mail', type_=sa.String(length=255))
        batch_op.alter_column('instagram', type_=sa.String(length=255))


def downgrade():
    pass
