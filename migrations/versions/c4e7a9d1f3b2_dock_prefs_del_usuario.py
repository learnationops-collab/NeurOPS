"""El dock de cada usuario en el servidor: users.dock_prefs (ADR-W164)

Revision ID: c4e7a9d1f3b2
Revises: b8d0f2a4c6e1
Create Date: 2026-11-17

Idempotente: si la columna ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'c4e7a9d1f3b2'
down_revision = 'b8d0f2a4c6e1'
branch_labels = None
depends_on = None


def _columnas(tabla):
    return {c['name'] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade():
    if 'dock_prefs' not in _columnas('users'):
        op.add_column('users', sa.Column('dock_prefs', sa.JSON(), nullable=True))


def downgrade():
    if 'dock_prefs' in _columnas('users'):
        op.drop_column('users', 'dock_prefs')
