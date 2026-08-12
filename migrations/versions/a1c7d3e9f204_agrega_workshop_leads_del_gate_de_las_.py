"""Agrega workshop_leads del gate de las landings publicas

Revision ID: a1c7d3e9f204
Revises: b40bb66b18bc
Create Date: 2026-08-12 02:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1c7d3e9f204'
down_revision = 'b40bb66b18bc'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('workshop_leads',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=80), nullable=False),
    sa.Column('apellido', sa.String(length=80), nullable=True),
    sa.Column('phone', sa.String(length=24), nullable=True),
    sa.Column('phone_country', sa.String(length=8), nullable=True),
    sa.Column('profesion', sa.String(length=60), nullable=True),
    sa.Column('etapa', sa.String(length=60), nullable=True),
    sa.Column('examen', sa.String(length=40), nullable=True),
    sa.Column('page_path', sa.String(length=255), nullable=True),
    sa.Column('utm_source', sa.String(length=64), nullable=True),
    sa.Column('utm_medium', sa.String(length=64), nullable=True),
    sa.Column('utm_campaign', sa.String(length=120), nullable=True),
    sa.Column('utm_content', sa.String(length=120), nullable=True),
    sa.Column('utm_term', sa.String(length=120), nullable=True),
    sa.Column('referrer', sa.String(length=500), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('promoted_client_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['promoted_client_id'], ['clients.id'], name=op.f('fk_workshop_leads_promoted_client_id_clients')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workshop_leads'))
    )
    with op.batch_alter_table('workshop_leads', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_workshop_leads_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_workshop_leads_phone'), ['phone'], unique=False)
        batch_op.create_index(batch_op.f('ix_workshop_leads_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_workshop_leads_utm_source'), ['utm_source'], unique=False)


def downgrade():
    with op.batch_alter_table('workshop_leads', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_workshop_leads_utm_source'))
        batch_op.drop_index(batch_op.f('ix_workshop_leads_status'))
        batch_op.drop_index(batch_op.f('ix_workshop_leads_phone'))
        batch_op.drop_index(batch_op.f('ix_workshop_leads_created_at'))

    op.drop_table('workshop_leads')
