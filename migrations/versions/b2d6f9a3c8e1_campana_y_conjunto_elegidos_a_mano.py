"""ads.agrupado_a_mano: la campaña y el conjunto de la palabra clave los eligió alguien en Marketing

Sin la marca, el conjunto de un anuncio es el de la carga vieja (o ninguno) y la tabla usa el de sus anuncios de Meta.

Revision ID: b2d6f9a3c8e1
Revises: e5b8d2f4a1c7
Create Date: 2026-10-15 13:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b2d6f9a3c8e1'
down_revision = 'e5b8d2f4a1c7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('ads', schema=None) as batch_op:
        batch_op.add_column(sa.Column('agrupado_a_mano', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('ads', schema=None) as batch_op:
        batch_op.drop_column('agrupado_a_mano')
