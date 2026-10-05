"""agendas 2.0 escribe en la operacion: payloads en appointments y clients, fuera sched_reservas

Revision ID: d4e8a1c6f203
Revises: a5c2e9d71b04
Create Date: 2026-10-05 21:00:00.000000

Fase 2 de Agendas 2.0: una reserva tomada desde el link publico es una Appointment (con su espejo
en financial_agendas, como cualquier agenda) y ya no una fila de sched_reservas.

No destructivo para la operacion: solo agrega dos columnas JSON opcionales. Lo unico que se borra
es sched_reservas, que solo tuvo reservas de prueba del sistema nuevo (nunca llego a produccion).
El downgrade quita las columnas y vuelve a crear sched_reservas vacia.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e8a1c6f203'
down_revision = 'a5c2e9d71b04'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('appointments') as t:
        t.add_column(sa.Column('agenda_payload', sa.JSON(), nullable=True))
    with op.batch_alter_table('clients') as t:
        t.add_column(sa.Column('formulario_payload', sa.JSON(), nullable=True))
    op.drop_table('sched_reservas')


def downgrade():
    op.create_table(
        'sched_reservas',
        sa.Column('id', sa.String(length=40), primary_key=True),
        sa.Column('evento_id', sa.String(length=40), nullable=False),
        sa.Column('funnel_id', sa.String(length=40), nullable=True),
        sa.Column('closer_id', sa.String(length=40), nullable=True),
        sa.Column('inicio', sa.DateTime(), nullable=True),
        sa.Column('fin', sa.DateTime(), nullable=True),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('origen', sa.String(length=80), nullable=True),
        sa.Column('setter_id', sa.String(length=40), nullable=True),
        sa.Column('prioridad_id', sa.String(length=40), nullable=True),
        sa.Column('nota', sa.Float(), nullable=True),
        sa.Column('lead_nombre', sa.String(length=120), nullable=True),
        sa.Column('lead_email', sa.String(length=120), nullable=True),
        sa.Column('lead_telefono', sa.String(length=40), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('creada_en', sa.DateTime(), nullable=False),
        sa.Column('cancelada_en', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_sched_reservas_evento_id', 'sched_reservas', ['evento_id'])
    op.create_index('ix_sched_reservas_estado', 'sched_reservas', ['estado'])
    op.create_index('ix_sched_reservas_lead_email', 'sched_reservas', ['lead_email'])
    op.create_index('ix_sched_reservas_closer_inicio', 'sched_reservas', ['closer_id', 'inicio'])
    with op.batch_alter_table('clients') as t:
        t.drop_column('formulario_payload')
    with op.batch_alter_table('appointments') as t:
        t.drop_column('agenda_payload')
