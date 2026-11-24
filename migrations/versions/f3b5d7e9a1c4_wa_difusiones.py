"""WhatsApp: difusiones (broadcast con tope diario) y sus destinos

Revision ID: f3b5d7e9a1c4
Revises: e8f0a2c4b6d1
Create Date: 2026-11-24

Idempotente: lo que ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'f3b5d7e9a1c4'
down_revision = 'e8f0a2c4b6d1'
branch_labels = None
depends_on = None


def upgrade():
    tablas = set(sa.inspect(op.get_bind()).get_table_names())
    if 'wa_difusiones' not in tablas:
        op.create_table(
            'wa_difusiones',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('nombre', sa.String(150), nullable=False),
            sa.Column('plantilla', sa.String(120), nullable=False),
            sa.Column('idioma', sa.String(10), nullable=False, server_default='es'),
            sa.Column('con_nombre', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('destino', sa.String(20), nullable=False, server_default='setting'),
            sa.Column('tope_diario', sa.Integer(), nullable=False, server_default='30'),
            sa.Column('estado', sa.String(20), nullable=False, server_default='pausada'),
            sa.Column('creado_en', sa.DateTime(), nullable=False),
            sa.Column('creado_por_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        )
    if 'wa_difusion_destinos' not in tablas:
        op.create_table(
            'wa_difusion_destinos',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('difusion_id', sa.Integer(), sa.ForeignKey('wa_difusiones.id', ondelete='CASCADE'), nullable=False),
            sa.Column('telefono', sa.String(20), nullable=False),
            sa.Column('nombre', sa.String(150), nullable=True),
            sa.Column('estado', sa.String(20), nullable=False, server_default='pendiente'),
            sa.Column('wamid', sa.String(200), nullable=True, unique=True),
            sa.Column('enviado_en', sa.DateTime(), nullable=True),
            sa.Column('actualizado_en', sa.DateTime(), nullable=True),
            sa.Column('error', sa.String(300), nullable=True),
            sa.Column('contacto_id', sa.Integer(), sa.ForeignKey('ig_contactos.id', ondelete='SET NULL'), nullable=True),
            sa.UniqueConstraint('difusion_id', 'telefono', name='uq_wa_difusion_telefono'),
        )
        op.create_index('ix_wa_difusion_destinos_difusion_id', 'wa_difusion_destinos', ['difusion_id'])
        op.create_index('ix_wa_difusion_destinos_telefono', 'wa_difusion_destinos', ['telefono'])
        op.create_index('ix_wa_difusion_destinos_estado', 'wa_difusion_destinos', ['estado'])
        op.create_index('ix_wa_difusion_destinos_enviado_en', 'wa_difusion_destinos', ['enviado_en'])


def downgrade():
    op.drop_table('wa_difusion_destinos')
    op.drop_table('wa_difusiones')
