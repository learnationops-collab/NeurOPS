"""Leads de Meta: por anuncio y día, y la suma de cada workshop

«Leads totales» del taller es la columna Leads de Meta Ads (el evento Lead del píxel en la landing)
de los anuncios de workshop: coincide con lo cargado a mano (19/09: 179 y 179). Se trae con la
sincronización como la inversión y reemplaza al cargado a mano mientras haya datos.

Revision ID: e7b3c9a1d5f2
Revises: d4a8e2c6f1b7
Create Date: 2026-10-16 21:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e7b3c9a1d5f2'
down_revision = 'd4a8e2c6f1b7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('meta_gastos_diarios', schema=None) as batch_op:
        batch_op.add_column(sa.Column('leads', sa.Integer(), nullable=True))
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meta_leads', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.drop_column('meta_leads')
    with op.batch_alter_table('meta_gastos_diarios', schema=None) as batch_op:
        batch_op.drop_column('leads')
