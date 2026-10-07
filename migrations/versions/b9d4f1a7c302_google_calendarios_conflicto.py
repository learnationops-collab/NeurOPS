"""google_calendar_tokens.calendarios_conflicto: en qué calendarios se revisan los conflictos

Revision ID: b9d4f1a7c302
Revises: f2b6d8e1a357
Create Date: 2026-10-07 12:00:00.000000

Como en Calendly: el closer elige qué calendarios de su Google se miran antes de ofrecerlo a un lead
(un turno de la facultad, un evento personal). NULL = el de destino y el principal.

No destructivo: una columna opcional, NULL para todos los tokens existentes.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b9d4f1a7c302'
down_revision = 'f2b6d8e1a357'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('google_calendar_tokens', schema=None) as batch_op:
        batch_op.add_column(sa.Column('calendarios_conflicto', sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table('google_calendar_tokens', schema=None) as batch_op:
        batch_op.drop_column('calendarios_conflicto')
