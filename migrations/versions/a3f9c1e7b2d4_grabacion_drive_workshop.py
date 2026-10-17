"""Grabación del taller en Google Drive

El link del Meet grabado de cada taller, aparte del Loom de la landing: el registro de lo que se dio.

Revision ID: a3f9c1e7b2d4
Revises: e7b3c9a1d5f2
Create Date: 2026-10-17 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a3f9c1e7b2d4'
down_revision = 'e7b3c9a1d5f2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('grabacion_url', sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table('workshop_events', schema=None) as batch_op:
        batch_op.drop_column('grabacion_url')
