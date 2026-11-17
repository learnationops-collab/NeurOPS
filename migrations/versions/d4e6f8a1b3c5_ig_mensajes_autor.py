"""Inbox: quién del equipo mandó cada mensaje

El setter escribe desde el Inbox (17/11/2026): el mensaje guarda su autor. Lo que llega por eco de
Kommo o ManyChat queda sin autor.

Revision ID: d4e6f8a1b3c5
Revises: c7d9e1f3a5b8
Create Date: 2026-11-17 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd4e6f8a1b3c5'
down_revision = 'c7d9e1f3a5b8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('ig_mensajes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('autor_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_ig_mensajes_autor_id', 'users', ['autor_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('ig_mensajes', schema=None) as batch_op:
        batch_op.drop_constraint('fk_ig_mensajes_autor_id', type_='foreignkey')
        batch_op.drop_column('autor_id')
