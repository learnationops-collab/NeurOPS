"""WhatsApp: una sola tabla de envíos (wa_envios) en lugar de wa_difusiones + wa_difusion_destinos (ADR-W229)

Revision ID: b8d0f2a4c6e1
Revises: a7c9e1f3b5d8
Create Date: 2026-11-25

Las dos tablas viejas estaban vacías en producción (25/11/2026). Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'b8d0f2a4c6e1'
down_revision = 'a7c9e1f3b5d8'
branch_labels = None
depends_on = None


def upgrade():
    tablas = set(sa.inspect(op.get_bind()).get_table_names())
    if 'wa_envios' not in tablas:
        op.create_table(
            'wa_envios',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('lote', sa.String(36), nullable=False),
            sa.Column('plantilla', sa.String(120), nullable=False),
            sa.Column('idioma', sa.String(10), nullable=False, server_default='es'),
            sa.Column('con_nombre', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('telefono', sa.String(20), nullable=False),
            sa.Column('nombre', sa.String(150), nullable=True),
            sa.Column('estado', sa.String(20), nullable=False, server_default='pendiente'),
            sa.Column('wamid', sa.String(200), nullable=True, unique=True),
            sa.Column('creado_en', sa.DateTime(), nullable=False),
            sa.Column('enviado_en', sa.DateTime(), nullable=True),
            sa.Column('actualizado_en', sa.DateTime(), nullable=True),
            sa.Column('error', sa.String(300), nullable=True),
            sa.Column('respuesta', sa.String(200), nullable=True),
            sa.Column('enviado_por_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('contacto_id', sa.Integer(), sa.ForeignKey('ig_contactos.id', ondelete='SET NULL'), nullable=True),
        )
        op.create_index('ix_wa_envios_lote', 'wa_envios', ['lote'])
        op.create_index('ix_wa_envios_telefono', 'wa_envios', ['telefono'])
        op.create_index('ix_wa_envios_estado', 'wa_envios', ['estado'])
        op.create_index('ix_wa_envios_enviado_en', 'wa_envios', ['enviado_en'])
    if 'wa_difusion_destinos' in tablas:
        op.drop_table('wa_difusion_destinos')
    if 'wa_difusiones' in tablas:
        op.drop_table('wa_difusiones')


def downgrade():
    op.drop_table('wa_envios')
