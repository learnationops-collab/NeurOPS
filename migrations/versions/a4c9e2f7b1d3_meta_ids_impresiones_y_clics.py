"""Meta: ids de campaña y conjunto de cada anuncio, e impresiones y clics de cada día

Para medir los workshop con lo que dice Meta (CPM, CPC, clics) y marcar sus campañas por id.

Revision ID: a4c9e2f7b1d3
Revises: c7e2f9a4d1b6
Create Date: 2026-10-15 18:30:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a4c9e2f7b1d3'
down_revision = 'c7e2f9a4d1b6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('meta_anuncios', schema=None) as batch_op:
        batch_op.add_column(sa.Column('campana_id', sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column('conjunto_id', sa.String(length=40), nullable=True))
        batch_op.create_index('ix_meta_anuncios_campana_id', ['campana_id'], unique=False)
    with op.batch_alter_table('meta_gastos_diarios', schema=None) as batch_op:
        batch_op.add_column(sa.Column('impresiones', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('clics', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('clics_enlace', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('meta_gastos_diarios', schema=None) as batch_op:
        batch_op.drop_column('clics_enlace')
        batch_op.drop_column('clics')
        batch_op.drop_column('impresiones')
    with op.batch_alter_table('meta_anuncios', schema=None) as batch_op:
        batch_op.drop_index('ix_meta_anuncios_campana_id')
        batch_op.drop_column('conjunto_id')
        batch_op.drop_column('campana_id')
