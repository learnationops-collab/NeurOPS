"""Agenda C/D desplazada por un lead A o B: appointments.desplazada_por_id (app/agendas_v2/desplazar.py)

Revision ID: d7b3e9a1f4c2
Revises: d7a3e1b9c5f2
Create Date: 2026-10-26 19:30:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd7b3e9a1f4c2'
down_revision = 'd7a3e1b9c5f2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('desplazada_por_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_appointments_desplazada_por_id', ['desplazada_por_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_appointments_desplazada_por_id', 'appointments', ['desplazada_por_id'], ['id'], ondelete='SET NULL',
        )


def downgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_constraint('fk_appointments_desplazada_por_id', type_='foreignkey')
        batch_op.drop_index('ix_appointments_desplazada_por_id')
        batch_op.drop_column('desplazada_por_id')
