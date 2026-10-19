"""Inbox: cómo terminó calificada cada entrada al flujo (para las métricas por campaña)

Revision ID: a9d4e2b7c6f1
Revises: f2a6c8d4b1e3
Create Date: 2026-10-19 13:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a9d4e2b7c6f1'
down_revision = 'f2a6c8d4b1e3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('aut_ejecuciones', schema=None) as batch_op:
        batch_op.add_column(sa.Column('califica', sa.Boolean(), nullable=True))


def downgrade():
    with op.batch_alter_table('aut_ejecuciones', schema=None) as batch_op:
        batch_op.drop_column('califica')
