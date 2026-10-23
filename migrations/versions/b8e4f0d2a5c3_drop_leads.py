"""borra la tabla leads (Etapa 2c de docs/plan_personas.md)

Nadie la lee: sus leads ya tienen persona y conversación (scripts/migrar_conversaciones.py), el webhook
viejo /api/webhooks/manychat escribe ManychatLead y la agenda ya no le crea filas. Se corre después del
pase a producción y de migrar_conversaciones en esa base: si no, sus leads se quedan sin conversación.

Va después de a7d3e9c1f4b2 (columnas de clients, frente L de 2c): las dos ramas de 2c entran juntas.

Revision ID: b8e4f0d2a5c3
Revises: a7d3e9c1f4b2
Create Date: 2026-10-21 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b8e4f0d2a5c3'
down_revision = 'a7d3e9c1f4b2'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('leads')


def downgrade():
    op.create_table(
        'leads',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('manychat_id', sa.String(length=50), nullable=False, unique=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=True),
        sa.Column('instagram_username', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('stage_id', sa.Integer(), sa.ForeignKey('pipeline_stages.id'), nullable=True),
        sa.Column('ad_source', sa.String(length=255), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('funnel_step', sa.String(length=255), nullable=True),
        sa.Column('last_stage', sa.Integer(), nullable=True),
        sa.Column('person_uuid', sa.String(length=36), sa.ForeignKey('people.uuid', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_leads_person_uuid', 'leads', ['person_uuid'])
