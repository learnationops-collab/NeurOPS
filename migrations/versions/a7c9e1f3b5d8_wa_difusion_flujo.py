"""WhatsApp: la difusión puede seguir con un flujo (botones de la plantilla)

Revision ID: a7c9e1f3b5d8
Revises: f3b5d7e9a1c4
Create Date: 2026-11-24

Idempotente: si la columna ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'a7c9e1f3b5d8'
down_revision = 'f3b5d7e9a1c4'
branch_labels = None
depends_on = None


def upgrade():
    columnas = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('wa_difusiones')}
    if 'flujo_id' not in columnas:
        with op.batch_alter_table('wa_difusiones') as tabla:
            tabla.add_column(sa.Column('flujo_id', sa.Integer(), nullable=True))
            tabla.create_foreign_key('fk_wa_difusiones_flujo', 'aut_flujos', ['flujo_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('wa_difusiones') as tabla:
        tabla.drop_constraint('fk_wa_difusiones_flujo', type_='foreignkey')
        tabla.drop_column('flujo_id')
