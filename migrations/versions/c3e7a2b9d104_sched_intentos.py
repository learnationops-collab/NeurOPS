"""sched_intentos: los leads que dejaron sus datos en un link y no agendaron (Stats)

Revision ID: c3e7a2b9d104
Revises: c7e2a9d4b158
Create Date: 2026-10-07 18:00:00.000000

Un registro por lead y evento desde que completa el contacto, con sus respuestas y hasta qué paso
llegó. Si agenda se borra (pasa a ser la Appointment). No destructivo: solo agrega la tabla.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3e7a2b9d104'
down_revision = 'c7e2a9d4b158'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sched_intentos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('evento_id', sa.String(length=40), nullable=False),
        sa.Column('funnel_id', sa.String(length=40), nullable=True),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('paso', sa.Integer(), nullable=False),
        sa.Column('resp', sa.JSON(), nullable=False),
        sa.Column('origen', sa.String(length=60), nullable=True),
        sa.Column('setter_user_id', sa.Integer(), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['setter_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('sched_intentos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_sched_intentos_evento_id'), ['evento_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_sched_intentos_email'), ['email'], unique=False)
        batch_op.create_index(batch_op.f('ix_sched_intentos_creado_en'), ['creado_en'], unique=False)


def downgrade():
    with op.batch_alter_table('sched_intentos', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_sched_intentos_creado_en'))
        batch_op.drop_index(batch_op.f('ix_sched_intentos_email'))
        batch_op.drop_index(batch_op.f('ix_sched_intentos_evento_id'))
    op.drop_table('sched_intentos')
