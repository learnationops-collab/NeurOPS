"""clics al grupo de WhatsApp: evento en landing_trackings

Revision ID: 3b8f2d61c4a9
Revises: 17757dc4de6d
Create Date: 2026-10-03 13:00:00.000000

Pedido del 03/10/2026: la pestaña «Tráfico landings» del panel de talleres mide cuánta
gente de cada landing de institute-site llega al grupo de WhatsApp del evento. Esos
clics viajan por el mismo /api/v1/metrics/track-visit que las visitas, marcados con
`evento='clic_whatsapp'`. Nullable y sin valor por defecto: las filas que ya existen
son todas visitas y NULL se lee como 'visita' (agregar una columna con default
reescribiria la tabla entera en Postgres).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3b8f2d61c4a9'
down_revision = '17757dc4de6d'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('landing_trackings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('evento', sa.String(length=30), nullable=True))


def downgrade():
    with op.batch_alter_table('landing_trackings', schema=None) as batch_op:
        batch_op.drop_column('evento')
