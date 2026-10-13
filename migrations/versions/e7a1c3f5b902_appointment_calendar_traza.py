"""appointment_calendar_traza: el evento de Google Calendar de cada agenda, para seguirla

Revision ID: e7a1c3f5b902
Revises: d4f8b2c6e915
Create Date: 2026-10-12 18:00:00.000000

Cuál es el evento de cada agenda en el Calendar del closer y en qué calendario está, y cómo se vinculó
('propio': lo creó NeurOPS; 'email' o 'nombre': el de n8n/Calendly a esa hora con el lead). Aparte de
google_event_id, que NeurOPS borra al cancelar: esto solo se lee. No destructivo: solo agrega columnas.

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'e7a1c3f5b902'
down_revision = 'd4f8b2c6e915'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('appointments') as batch:
        batch.add_column(sa.Column('calendar_evento_id', sa.String(length=255), nullable=True))
        batch.add_column(sa.Column('calendar_id', sa.String(length=255), nullable=True))
        batch.add_column(sa.Column('calendar_vinculo', sa.String(length=10), nullable=True))


def downgrade():
    with op.batch_alter_table('appointments') as batch:
        batch.drop_column('calendar_vinculo')
        batch.drop_column('calendar_id')
        batch.drop_column('calendar_evento_id')
