"""users.roles_extra: roles adicionales de una misma cuenta

Revision ID: c4e8a2d17f93
Revises: b7d3f1a96c52
Create Date: 2026-10-05 17:00:00.000000

Una persona con varios roles puede tener UNA cuenta: `users.role` sigue siendo el rol principal y
`roles_extra` guarda los demás, separados por comas. Columna nueva y nullable: ninguna cuenta
existente cambia y el downgrade solo la quita.

"""

from alembic import op
import sqlalchemy as sa


revision = 'c4e8a2d17f93'
down_revision = 'b7d3f1a96c52'
branch_labels = None
depends_on = None


def upgrade():
    # Idempotente: ver la nota de `b7d3f1a96c52` (esta revisión llegó a `main` antes que a `develop`).
    if 'roles_extra' in {c['name'] for c in sa.inspect(op.get_bind()).get_columns('users')}:
        return
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('roles_extra', sa.String(length=120), nullable=True))


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('roles_extra')
