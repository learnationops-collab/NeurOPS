"""El anuncio de cada agenda, elegido por el setter

`appointments.anuncio_id`: la palabra clave que el setter le pone a una agenda en «Mis agendas». Manda
sobre ManyChat para Marketing y la bandeja, y por eso se puede cambiar si estaba mal.

Revision ID: d7a3f1c9e5b8
Revises: c4e8a2f6d1b3
Create Date: 2026-10-18 15:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd7a3f1c9e5b8'
down_revision = 'c4e8a2f6d1b3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('anuncio_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_appointments_anuncio_id_ads', 'ads', ['anuncio_id'], ['id'])


def downgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_constraint('fk_appointments_anuncio_id_ads', type_='foreignkey')
        batch_op.drop_column('anuncio_id')
