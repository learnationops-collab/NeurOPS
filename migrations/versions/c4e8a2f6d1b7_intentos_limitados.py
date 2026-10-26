"""Límite de intentos en el login y los formularios públicos: una fila por intento (app/models/intento_limitado.py)

Revision ID: c4e8a2f6d1b7
Revises: b8d2f4a6c1e3
Create Date: 2026-10-26 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c4e8a2f6d1b7'
down_revision = 'b8d2f4a6c1e3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'intentos_limitados',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clave', sa.String(length=200), nullable=False),
        sa.Column('creado', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('intentos_limitados', schema=None) as batch_op:
        batch_op.create_index('ix_intentos_limitados_clave', ['clave'], unique=False)
        batch_op.create_index('ix_intentos_limitados_creado', ['creado'], unique=False)


def downgrade():
    with op.batch_alter_table('intentos_limitados', schema=None) as batch_op:
        batch_op.drop_index('ix_intentos_limitados_creado')
        batch_op.drop_index('ix_intentos_limitados_clave')
    op.drop_table('intentos_limitados')
