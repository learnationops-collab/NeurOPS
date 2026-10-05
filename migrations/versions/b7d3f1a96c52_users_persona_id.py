"""users.persona_id: cuentas de una misma persona con varios roles

Revision ID: b7d3f1a96c52
Revises: 3b8f2d61c4a9
Create Date: 2026-10-05 15:00:00.000000

Una persona con varios roles (p. ej. administrador comercial y closer) conserva una cuenta por
rol, con su historial intacto, y las cuentas se enlazan con el mismo `persona_id`. Es una
columna nueva y nullable: ninguna cuenta existente cambia, el downgrade solo la quita.

Es idempotente (no falla si la columna o el índice ya existen) porque esta revisión nació en
`develop` encadenada tras otra y se reencadenó acá, en `main`, para llegar antes a producción: así
el merge posterior de `develop` no choca con una base que ya la aplicó.

"""

from alembic import op
import sqlalchemy as sa


revision = 'b7d3f1a96c52'
down_revision = '3b8f2d61c4a9'
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columnas = {c['name'] for c in inspector.get_columns('users')}
    indices = {i['name'] for i in inspector.get_indexes('users')}
    with op.batch_alter_table('users') as batch:
        if 'persona_id' not in columnas:
            batch.add_column(sa.Column('persona_id', sa.Integer(), nullable=True))
        if 'ix_users_persona_id' not in indices:
            batch.create_index('ix_users_persona_id', ['persona_id'])


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_index('ix_users_persona_id')
        batch.drop_column('persona_id')
