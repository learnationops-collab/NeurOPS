"""workshop_events: hora exacta (UTC), link de Google Meet y del grupo de WhatsApp de cada taller

Reemplazan a workshops.csv de institute-site: las landings leen los próximos talleres de
/api/public/workshops/proximos.

Revision ID: e2b9c4f7a1d8
Revises: b3d7f1a9c562
Create Date: 2026-10-15 21:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e2b9c4f7a1d8'
down_revision = 'b3d7f1a9c562'
branch_labels = None
depends_on = None


def upgrade():
    # Idempotente: llega a main antes que a develop, y develop la recibe con la mezcla.
    columnas = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('workshop_events')}
    if 'inicio_at' in columnas:
        return
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('inicio_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('meet_url', sa.String(length=300), nullable=True))
        batch_op.add_column(sa.Column('whatsapp_url', sa.String(length=300), nullable=True))


def downgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.drop_column('whatsapp_url')
        batch_op.drop_column('meet_url')
        batch_op.drop_column('inicio_at')
