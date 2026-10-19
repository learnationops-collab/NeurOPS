"""Inbox: reparto de las entradas de cada campaña entre los setters

La campaña elige cómo reparte (distribuido o sin reparto), quiénes participan y si solo entre conectados
(guardado, sin efecto hasta que haya presencia). Cada entrada guarda el setter que le tocó.

Revision ID: b5e1c7f3a8d2
Revises: a9d4e2b7c6f1
Create Date: 2026-10-19 16:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b5e1c7f3a8d2'
down_revision = 'a9d4e2b7c6f1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('aut_campanas', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reparto', sa.String(length=20), nullable=False, server_default='distribuido'))
        batch_op.add_column(sa.Column('solo_conectados', sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_table(
        'aut_campana_setters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('campana_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['campana_id'], ['aut_campanas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campana_id', 'user_id', name='uq_aut_campana_setters'),
    )
    with op.batch_alter_table('aut_campana_setters', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_aut_campana_setters_campana_id'), ['campana_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_aut_campana_setters_user_id'), ['user_id'], unique=False)

    with op.batch_alter_table('aut_ejecuciones', schema=None) as batch_op:
        batch_op.add_column(sa.Column('setter_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_aut_ejecuciones_setter_id'), ['setter_id'], unique=False)
        batch_op.create_foreign_key('fk_aut_ejecuciones_setter_id_users', 'users',
                                    ['setter_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('aut_ejecuciones', schema=None) as batch_op:
        batch_op.drop_constraint('fk_aut_ejecuciones_setter_id_users', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_aut_ejecuciones_setter_id'))
        batch_op.drop_column('setter_id')
    op.drop_table('aut_campana_setters')
    with op.batch_alter_table('aut_campanas', schema=None) as batch_op:
        batch_op.drop_column('solo_conectados')
        batch_op.drop_column('reparto')
