"""Inbox: peso de cada setter en el reparto de una campaña

Antes el reparto era parejo. Con `peso` cada participante recibe una parte proporcional (70 y 30:
70 % y 30 %). Las filas que ya existen quedan en 1, o sea, siguen repartiendo parejo.

Revision ID: d7a3f1c9e5b4
Revises: e5b1c3d7f9a2
Create Date: 2026-10-23 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd7a3f1c9e5b4'
down_revision = 'e5b1c3d7f9a2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('aut_campana_setters', schema=None) as batch_op:
        batch_op.add_column(sa.Column('peso', sa.Integer(), nullable=False, server_default='1'))


def downgrade():
    with op.batch_alter_table('aut_campana_setters', schema=None) as batch_op:
        batch_op.drop_column('peso')
