"""meta_anuncios.destino: adónde lleva cada anuncio (el link del creativo)

Kerwin (15/10/2026): el embudo de un anuncio es adónde lleva. El texto no alcanza: hay anuncios que
dicen «Pide gratis al DM» y llevan a la landing de la clase. La próxima sincronización lo completa.

Revision ID: a1c7e4b9d3f2
Revises: f7a2c9d4e1b3
Create Date: 2026-10-16 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a1c7e4b9d3f2'
down_revision = 'f7a2c9d4e1b3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('meta_anuncios', schema=None) as batch_op:
        batch_op.add_column(sa.Column('destino', sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table('meta_anuncios', schema=None) as batch_op:
        batch_op.drop_column('destino')
