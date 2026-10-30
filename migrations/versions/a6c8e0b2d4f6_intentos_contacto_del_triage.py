"""sched_intentos: qué hizo el triage con cada abandono (contactado o no contesta, quién y cuándo).

Revision ID: a6c8e0b2d4f6
Revises: f2a6c8e0b4d1
Create Date: 2026-10-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'a6c8e0b2d4f6'
down_revision = 'f2a6c8e0b4d1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('sched_intentos') as batch_op:
        batch_op.add_column(sa.Column('contacto_estado', sa.String(20), nullable=True))
        batch_op.add_column(sa.Column('contacto_por_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('contacto_en', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key('fk_sched_intentos_contacto_por', 'users', ['contacto_por_id'], ['id'],
                                    ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('sched_intentos') as batch_op:
        batch_op.drop_constraint('fk_sched_intentos_contacto_por', type_='foreignkey')
        batch_op.drop_column('contacto_en')
        batch_op.drop_column('contacto_por_id')
        batch_op.drop_column('contacto_estado')
