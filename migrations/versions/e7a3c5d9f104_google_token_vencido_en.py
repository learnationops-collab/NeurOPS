"""google_calendar_tokens.vencido_en: cuándo Google rechazó el token

Revision ID: e7a3c5d9f104
Revises: d4e8a1c6f203
Create Date: 2026-10-06 12:00:00.000000

Un token revocado (o de otro cliente OAuth) seguía figurando como «Conectado» y el closer seguía
recibiendo agendas de Agendas 2.0 sin evento ni Meet. Ahora, cuando Google lo rechaza, se marca
la fecha y deja de contar como conectado hasta que el usuario reconecte.

No destructivo: una columna opcional, NULL para todos los tokens existentes.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7a3c5d9f104'
down_revision = 'd4e8a1c6f203'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('google_calendar_tokens', schema=None) as batch_op:
        batch_op.add_column(sa.Column('vencido_en', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('google_calendar_tokens', schema=None) as batch_op:
        batch_op.drop_column('vencido_en')
