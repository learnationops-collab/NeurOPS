"""add manual resolucion (preseleccionada/baja) to job_applications

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('job_applications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('resolucion', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('resuelto_por_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('resuelto_at', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key(
            batch_op.f('fk_job_applications_resuelto_por_id_users'), 'users', ['resuelto_por_id'], ['id']
        )


def downgrade():
    with op.batch_alter_table('job_applications', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_job_applications_resuelto_por_id_users'), type_='foreignkey')
        batch_op.drop_column('resuelto_at')
        batch_op.drop_column('resuelto_por_id')
        batch_op.drop_column('resolucion')
