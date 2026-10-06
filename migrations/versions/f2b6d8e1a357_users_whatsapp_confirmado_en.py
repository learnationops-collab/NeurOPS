"""users.whatsapp_confirmado_en: el closer confirmó que le llega el WhatsApp de prueba

Revision ID: f2b6d8e1a357
Revises: e7a3c5d9f104
Create Date: 2026-10-06 18:00:00.000000

Agendas 2.0 avisa cada agenda nueva al WhatsApp del closer (Whatchimp). Para recibir agendas, el
closer confirma su número desde Configuración con un mensaje de prueba.

No destructivo: una columna opcional, NULL para todos.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2b6d8e1a357'
down_revision = 'e7a3c5d9f104'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('whatsapp_confirmado_en', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('whatsapp_confirmado_en')
