"""Conflictos: los casos de datos que no cierran y decide una persona (vista Conflictos)

Revision ID: f7b2d4e6a8c1
Revises: e6a1c3d5f7b9
Create Date: 2026-10-27 23:30:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'f7b2d4e6a8c1'
down_revision = 'e6a1c3d5f7b9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'conflictos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('person_uuid', sa.String(36), sa.ForeignKey('people.uuid', ondelete='SET NULL'), nullable=True),
        sa.Column('tipo', sa.String(20), nullable=False, server_default='cobranza'),
        sa.Column('titulo', sa.String(255), nullable=False),
        sa.Column('detalle', sa.Text(), nullable=True),
        sa.Column('monto', sa.Float(), nullable=True),
        sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.id', ondelete='SET NULL'), nullable=True),
        sa.Column('financial_sale_id', sa.Integer(), sa.ForeignKey('financial_sales.id', ondelete='SET NULL'),
                  nullable=True),
        sa.Column('origen_fecha', sa.DateTime(), nullable=True),
        sa.Column('origen_texto', sa.String(255), nullable=True),
        sa.Column('responsable_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('estado', sa.String(20), nullable=False, server_default='abierto'),
        sa.Column('resolucion', sa.Text(), nullable=True),
        sa.Column('resuelto_por_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resuelto_at', sa.DateTime(), nullable=True),
        sa.Column('historia', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    for col in ('person_uuid', 'sale_id', 'financial_sale_id', 'responsable_id', 'estado'):
        op.create_index(f'ix_conflictos_{col}', 'conflictos', [col])


def downgrade():
    op.drop_table('conflictos')
