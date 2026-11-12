"""Inbox: campaña por defecto

La campaña marcada atiende el primer mensaje de un contacto nuevo que no es ninguna palabra clave
vigente (ADR-W135).

Revision ID: c7d9e1f3a5b8
Revises: f3a5c7e9b1d4
Create Date: 2026-11-12 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c7d9e1f3a5b8'
down_revision = 'f3a5c7e9b1d4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('aut_campanas', schema=None) as batch_op:
        batch_op.add_column(sa.Column('por_defecto', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('aut_campanas', schema=None) as batch_op:
        batch_op.drop_column('por_defecto')
