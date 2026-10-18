"""El anuncio de las ventas de cada cliente, elegido por el setter

`clients.anuncio_ventas_id`: la palabra clave que el setter le pone a las ventas de un cliente en
«Mis agendas». Manda sobre ManyChat para todos sus pagos, y por eso se puede cambiar si estaba mal.

Revision ID: c4e8a2f6d1b3
Revises: a3f9c1e7b2d4
Create Date: 2026-10-18 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c4e8a2f6d1b3'
down_revision = 'a3f9c1e7b2d4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.add_column(sa.Column('anuncio_ventas_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_clients_anuncio_ventas_id_ads', 'ads', ['anuncio_ventas_id'], ['id'])


def downgrade():
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.drop_constraint('fk_clients_anuncio_ventas_id_ads', type_='foreignkey')
        batch_op.drop_column('anuncio_ventas_id')
