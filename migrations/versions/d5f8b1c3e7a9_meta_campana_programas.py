"""El programa de cada campaña de Meta: meta_campana_programas (ADR-W177, Leadership 1395)

Revision ID: d5f8b1c3e7a9
Revises: c4e7a9d1f3b2
Create Date: 2026-11-18

Idempotente: si la tabla ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'd5f8b1c3e7a9'
down_revision = 'c4e7a9d1f3b2'
branch_labels = None
depends_on = None


def _tablas():
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade():
    if 'meta_campana_programas' in _tablas():
        return
    op.create_table(
        'meta_campana_programas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('campana_id', sa.String(length=40), nullable=False),
        sa.Column('programa', sa.String(length=10), nullable=False),
        sa.Column('actualizado_por', sa.String(length=255), nullable=True),
        sa.Column('actualizado_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('campana_id', name='uq_meta_campana_programas_campana_id'),
    )


def downgrade():
    if 'meta_campana_programas' in _tablas():
        op.drop_table('meta_campana_programas')
