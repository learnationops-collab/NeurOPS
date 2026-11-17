"""Workshop: tipo del taller (frío / caliente), grupos de WhatsApp por conjunto y utm_term de las visitas (ADR-W146)

Revision ID: b8d0f2a4c6e1
Revises: c7d9e1f3a5b8
Create Date: 2026-11-17

Idempotente: lo que ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'b8d0f2a4c6e1'
down_revision = 'c7d9e1f3a5b8'
branch_labels = None
depends_on = None

GRUPOS = 'workshop_grupos'


def _columnas(tabla):
    return {c['name'] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def _tablas():
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade():
    if 'tipo' not in _columnas('workshop_events'):
        with op.batch_alter_table('workshop_events') as t:
            t.add_column(sa.Column('tipo', sa.String(10), nullable=True))
    if 'utm_term' not in _columnas('landing_trackings'):
        with op.batch_alter_table('landing_trackings') as t:
            t.add_column(sa.Column('utm_term', sa.String(100), nullable=True))
    if GRUPOS not in _tablas():
        op.create_table(
            GRUPOS,
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('event_id', sa.Integer(), sa.ForeignKey('workshop_events.id', ondelete='CASCADE'), nullable=False),
            sa.Column('nombre', sa.String(80), nullable=False),
            sa.Column('codigo', sa.String(40), nullable=True),
            sa.Column('whatsapp_url', sa.String(300), nullable=False),
            sa.Column('conjunto_id', sa.String(40), nullable=True),
            sa.Column('conjunto_nombre', sa.String(255), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.UniqueConstraint('event_id', 'nombre', name='uq_workshop_grupo_nombre'),
            sa.UniqueConstraint('event_id', 'conjunto_id', name='uq_workshop_grupo_conjunto'),
        )
        op.create_index('ix_workshop_grupos_event_id', GRUPOS, ['event_id'])


def downgrade():
    if GRUPOS in _tablas():
        op.drop_index('ix_workshop_grupos_event_id', table_name=GRUPOS)
        op.drop_table(GRUPOS)
    if 'utm_term' in _columnas('landing_trackings'):
        with op.batch_alter_table('landing_trackings') as t:
            t.drop_column('utm_term')
    if 'tipo' in _columnas('workshop_events'):
        with op.batch_alter_table('workshop_events') as t:
            t.drop_column('tipo')
