"""Gasto de Meta por hora, para cortar los talleres al terminar el anterior

El link del grupo de WhatsApp cambia cuando termina cada taller: los leads (y el gasto) de un taller
son los de esa franja, no días enteros. Se guarda por anuncio y hora, solo de las campañas de workshop.

Revision ID: f2a6c8e0b4d1
Revises: b4d6f8a0c2e3
Create Date: 2026-10-29 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'f2a6c8e0b4d1'
down_revision = 'b4d6f8a0c2e3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'meta_gastos_horarios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('meta_ad_id', sa.String(length=40), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('desde_utc', sa.DateTime(), nullable=False),
        sa.Column('gasto', sa.Float(), nullable=False),
        sa.Column('impresiones', sa.Integer(), nullable=False),
        sa.Column('clics', sa.Integer(), nullable=False),
        sa.Column('clics_enlace', sa.Integer(), nullable=False),
        sa.Column('leads', sa.Integer(), nullable=False),
        sa.Column('actualizado_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meta_ad_id', 'desde_utc', name='uq_meta_gasto_hora_anuncio'),
    )
    with op.batch_alter_table('meta_gastos_horarios', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meta_gastos_horarios_meta_ad_id'), ['meta_ad_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meta_gastos_horarios_fecha'), ['fecha'], unique=False)
        batch_op.create_index(batch_op.f('ix_meta_gastos_horarios_desde_utc'), ['desde_utc'], unique=False)


def downgrade():
    with op.batch_alter_table('meta_gastos_horarios', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meta_gastos_horarios_desde_utc'))
        batch_op.drop_index(batch_op.f('ix_meta_gastos_horarios_fecha'))
        batch_op.drop_index(batch_op.f('ix_meta_gastos_horarios_meta_ad_id'))
    op.drop_table('meta_gastos_horarios')
