"""link de Fathom por agenda: fathom_url en appointments

Revision ID: 17757dc4de6d
Revises: 7c1e9a4d2b60
Create Date: 2026-10-02 15:00:00.000000

Pedido del 02/10/2026: el closer pega en el resultado de la agenda el link de Fathom con la
grabacion y la transcripcion de la llamada, y la cabecera de la ficha lo abre. Una sola columna
porque Fathom comparte las dos cosas en la misma pagina. Nullable y sin valor por defecto: las
agendas que ya existen no tienen grabacion cargada.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '17757dc4de6d'
down_revision = '7c1e9a4d2b60'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('fathom_url', sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_column('fathom_url')
