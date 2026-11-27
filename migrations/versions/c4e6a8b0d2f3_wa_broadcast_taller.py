"""WhatsApp: el broadcast de cada taller (wa_planes_taller, wa_pasos_taller y paso_id/parametros/vence_en en wa_envios)

Revision ID: c4e6a8b0d2f3
Revises: f4b6d8a0c2e5
Create Date: 2026-11-26

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'c4e6a8b0d2f3'
down_revision = 'f4b6d8a0c2e5'
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    tablas = set(inspector.get_table_names())
    if 'wa_planes_taller' not in tablas:
        op.create_table(
            'wa_planes_taller',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('event_id', sa.Integer(), sa.ForeignKey('workshop_events.id', ondelete='CASCADE'),
                      nullable=True, unique=True),
            sa.Column('etiqueta', sa.String(60), nullable=True),
            sa.Column('descartes', sa.JSON(), nullable=True),
            sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        )
    if 'wa_pasos_taller' not in tablas:
        op.create_table(
            'wa_pasos_taller',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('plan_id', sa.Integer(), sa.ForeignKey('wa_planes_taller.id', ondelete='CASCADE'), nullable=False),
            sa.Column('orden', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('nombre', sa.String(60), nullable=True),
            sa.Column('modo', sa.String(10), nullable=False, server_default='relativo'),
            sa.Column('minutos', sa.Integer(), nullable=True),
            sa.Column('dias', sa.Integer(), nullable=True),
            sa.Column('hora', sa.String(5), nullable=True),
            sa.Column('plantilla', sa.String(120), nullable=True),
            sa.Column('idioma', sa.String(10), nullable=False, server_default='es'),
            sa.Column('parametros', sa.JSON(), nullable=True),
            sa.Column('a_quien', sa.String(20), nullable=False, server_default='todos'),
            sa.Column('valor', sa.String(60), nullable=True),
            sa.Column('excluir', sa.JSON(), nullable=True),
            sa.Column('estado', sa.String(15), nullable=False, server_default='borrador'),
            sa.Column('lote', sa.String(36), nullable=True),
            sa.Column('lanzado_en', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_wa_pasos_taller_plan_id', 'wa_pasos_taller', ['plan_id'])
        op.create_index('ix_wa_pasos_taller_estado', 'wa_pasos_taller', ['estado'])
    columnas = {c['name'] for c in inspector.get_columns('wa_envios')}
    with op.batch_alter_table('wa_envios') as tabla:
        if 'paso_id' not in columnas:
            tabla.add_column(sa.Column('paso_id', sa.Integer(), nullable=True))
            tabla.create_foreign_key('fk_wa_envios_paso_id', 'wa_pasos_taller', ['paso_id'], ['id'], ondelete='SET NULL')
            tabla.create_index('ix_wa_envios_paso_id', ['paso_id'])
        if 'parametros' not in columnas:
            tabla.add_column(sa.Column('parametros', sa.JSON(), nullable=True))
        if 'vence_en' not in columnas:
            tabla.add_column(sa.Column('vence_en', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('wa_envios') as tabla:
        tabla.drop_index('ix_wa_envios_paso_id')
        tabla.drop_constraint('fk_wa_envios_paso_id', type_='foreignkey')
        tabla.drop_column('paso_id')
        tabla.drop_column('parametros')
        tabla.drop_column('vence_en')
    op.drop_table('wa_pasos_taller')
    op.drop_table('wa_planes_taller')
