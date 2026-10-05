"""tablas sched_* de Agendas 2.0 (Thalamus)

Revision ID: a5c2e9d71b04
Revises: c4e8a2d17f93
Create Date: 2026-10-05 12:00:00.000000

Paso 2 del plan de Agendas 2.0: el modulo nuevo guarda en tablas propias y no toca
financial_agendas ni appointments. Solo crea tablas nuevas, asi que no hay datos que migrar y
el downgrade las borra sin afectar nada mas.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a5c2e9d71b04'
down_revision = 'c4e8a2d17f93'
branch_labels = None
depends_on = None


DOCUMENTOS = ['sched_funnels', 'sched_formularios', 'sched_grupos', 'sched_eventos', 'sched_roles', 'sched_personas']


def _columnas_de_documento():
    return [
        sa.Column('id', sa.String(length=40), primary_key=True),
        sa.Column('datos', sa.JSON(), nullable=False),
        sa.Column('orden', sa.Float(), nullable=False, server_default='0'),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_por_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    ]


def upgrade():
    for tabla in DOCUMENTOS:
        extra = []
        if tabla == 'sched_personas':
            extra = [
                sa.Column('email', sa.String(length=120), nullable=True),
                sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            ]
        op.create_table(tabla, *_columnas_de_documento(), *extra)
    op.create_index('ix_sched_personas_email', 'sched_personas', ['email'])
    op.create_index('ix_sched_personas_user_id', 'sched_personas', ['user_id'])

    op.create_table(
        'sched_config',
        sa.Column('clave', sa.String(length=40), primary_key=True),
        sa.Column('datos', sa.JSON(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'sched_perfiles',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('datos', sa.JSON(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
    )
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


def downgrade():
    op.drop_table('sched_reservas')
    op.drop_table('sched_perfiles')
    op.drop_table('sched_config')
    for tabla in reversed(DOCUMENTOS):
        op.drop_table(tabla)
