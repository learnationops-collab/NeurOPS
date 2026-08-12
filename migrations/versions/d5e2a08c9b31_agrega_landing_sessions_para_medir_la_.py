"""Agrega landing_sessions para medir la permanencia en la grabacion

Una fila por visita a /replay/, actualizada por los latidos que manda la
landing cada ~15 s. Permite medir permanencia y embudo sin guardar un evento
por latido.

Revision ID: d5e2a08c9b31
Revises: c3f8b1d47e60
Create Date: 2026-08-12 04:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd5e2a08c9b31'
down_revision = 'c3f8b1d47e60'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('landing_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_key', sa.String(length=64), nullable=False),
    sa.Column('page_path', sa.String(length=255), nullable=True),
    sa.Column('referrer', sa.String(length=500), nullable=True),
    sa.Column('dispositivo', sa.String(length=16), nullable=True),
    sa.Column('utm_source', sa.String(length=64), nullable=True),
    sa.Column('utm_medium', sa.String(length=64), nullable=True),
    sa.Column('utm_campaign', sa.String(length=120), nullable=True),
    sa.Column('utm_content', sa.String(length=120), nullable=True),
    sa.Column('utm_term', sa.String(length=120), nullable=True),
    sa.Column('segundos_visible', sa.Integer(), nullable=True),
    sa.Column('segundos_video', sa.Integer(), nullable=True),
    sa.Column('abrio_gate', sa.Boolean(), nullable=True),
    sa.Column('completo_gate', sa.Boolean(), nullable=True),
    sa.Column('dio_play', sa.Boolean(), nullable=True),
    sa.Column('vio_oferta', sa.Boolean(), nullable=True),
    sa.Column('clic_agenda', sa.Boolean(), nullable=True),
    sa.Column('workshop_lead_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['workshop_lead_id'], ['workshop_leads.id'], name=op.f('fk_landing_sessions_workshop_lead_id_workshop_leads')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_landing_sessions'))
    )
    with op.batch_alter_table('landing_sessions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_landing_sessions_session_key'), ['session_key'], unique=True)
        batch_op.create_index(batch_op.f('ix_landing_sessions_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_landing_sessions_page_path'), ['page_path'], unique=False)
        batch_op.create_index(batch_op.f('ix_landing_sessions_utm_source'), ['utm_source'], unique=False)
        batch_op.create_index(batch_op.f('ix_landing_sessions_utm_campaign'), ['utm_campaign'], unique=False)


def downgrade():
    with op.batch_alter_table('landing_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_landing_sessions_utm_campaign'))
        batch_op.drop_index(batch_op.f('ix_landing_sessions_utm_source'))
        batch_op.drop_index(batch_op.f('ix_landing_sessions_page_path'))
        batch_op.drop_index(batch_op.f('ix_landing_sessions_created_at'))
        batch_op.drop_index(batch_op.f('ix_landing_sessions_session_key'))

    op.drop_table('landing_sessions')
