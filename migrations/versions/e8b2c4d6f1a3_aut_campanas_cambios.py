"""Inbox: log de cambios de cada campaña

Revision ID: e8b2c4d6f1a3
Revises: c7d1f4a9e2b6
Create Date: 2026-11-09

`aut_campanas.cambios` guarda, solo agregando, quién cambió qué y cuándo (palabras, campañas de Meta,
flujo, fechas, reparto): cuando una palabra pasa de una campaña a otra queda la traza en las dos.
"""
from alembic import op
import sqlalchemy as sa


revision = 'e8b2c4d6f1a3'
down_revision = 'c7d1f4a9e2b6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('aut_campanas') as batch:
        batch.add_column(sa.Column('cambios', sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table('aut_campanas') as batch:
        batch.drop_column('cambios')
