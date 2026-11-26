"""WhatsApp: qué pasa al tocar un botón de una plantilla (wa_respuestas_boton)

Revision ID: f4b2d6a8c0e3
Revises: e3a1c5f7b9d2
Create Date: 2026-11-25

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'f4b2d6a8c0e3'
down_revision = 'e3a1c5f7b9d2'
branch_labels = None
depends_on = None


def upgrade():
    if 'wa_respuestas_boton' in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        'wa_respuestas_boton',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('plantilla', sa.String(120), nullable=False),
        sa.Column('boton', sa.String(25), nullable=False),
        sa.Column('texto', sa.Text(), nullable=True),
        sa.Column('botones', sa.JSON(), nullable=True),
        sa.Column('asignar_a', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('etiqueta', sa.String(60), nullable=True),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('plantilla', 'boton', name='uq_wa_respuestas_boton'),
    )
    op.create_index('ix_wa_respuestas_boton_plantilla', 'wa_respuestas_boton', ['plantilla'])


def downgrade():
    op.drop_table('wa_respuestas_boton')
