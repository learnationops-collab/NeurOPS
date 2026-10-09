"""users.mascota: el personaje que cada persona eligió para su avatar del dock

Revision ID: a4c8e2f6b913
Revises: d6f1a3b5c7e9
Create Date: 2026-10-08 03:00:00.000000

El avatar del menú de sesión pasa de las iniciales a un personaje (page-mascot) que la persona
elige entre 10 desde el mismo menú.

No destructivo: una columna opcional, NULL para todos (el frontend asigna uno según el id).

Idempotente: la misma columna llegó a producción antes por main (`ee63a37b67f3`). Cuando esta rama
llegue allá, la columna ya existe y no hay nada que hacer.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a4c8e2f6b913'
down_revision = 'd6f1a3b5c7e9'
branch_labels = None
depends_on = None


def upgrade():
    if 'mascota' in {c['name'] for c in sa.inspect(op.get_bind()).get_columns('users')}:
        return
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('mascota', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('mascota')
