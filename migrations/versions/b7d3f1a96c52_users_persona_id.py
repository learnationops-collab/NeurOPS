"""users.persona_id: cuentas de una misma persona con varios roles

Revision ID: b7d3f1a96c52
Revises: a5c2e9d71b04
Create Date: 2026-10-05 15:00:00.000000

Una persona con varios roles (p. ej. administrador comercial y closer) conserva una cuenta por
rol, con su historial intacto, y las cuentas se enlazan con el mismo `persona_id`. Es una
columna nueva y nullable: ninguna cuenta existente cambia, el downgrade solo la quita.

"""

from alembic import op
import sqlalchemy as sa


revision = 'b7d3f1a96c52'
down_revision = 'a5c2e9d71b04'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('persona_id', sa.Integer(), nullable=True))
        batch.create_index('ix_users_persona_id', ['persona_id'])


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_index('ix_users_persona_id')
        batch.drop_column('persona_id')
