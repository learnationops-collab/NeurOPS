"""workshop_actions.event_id: el próximo taller en el que hay que cumplir cada acción

Planificar junta los próximos talleres, el simulador y las acciones: una acción nacida de un cambio
simulado se asigna a un taller concreto. Las acciones de antes quedan sin taller (NULL).

Revision ID: d4a8e2c6f1b7
Revises: 8efcff59c55b
Create Date: 2026-10-16 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd4a8e2c6f1b7'
down_revision = '8efcff59c55b'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('workshop_actions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('event_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_workshop_actions_event_id', ['event_id'], unique=False)
        batch_op.create_foreign_key('fk_workshop_actions_event_id', 'workshop_events', ['event_id'], ['id'],
                                    ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('workshop_actions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_workshop_actions_event_id', type_='foreignkey')
        batch_op.drop_index('ix_workshop_actions_event_id')
        batch_op.drop_column('event_id')
