"""WhatsApp API propia: eventos del webhook y números conectados

Revision ID: a3c5e7f9b1d2
Revises: c4e6a8b0d2f4
Create Date: 2026-11-09

`whatsapp_webhook_eventos` guarda cada notificación de Meta tal como llegó. `whatsapp_conexiones`
guarda cada número conectado a la app (cuenta de WhatsApp, phone_number_id, token, closer).
Idempotente y no destructiva: solo crea tablas nuevas.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a3c5e7f9b1d2'
down_revision = 'c4e6a8b0d2f4'
branch_labels = None
depends_on = None


def upgrade():
    tablas = set(sa.inspect(op.get_bind()).get_table_names())

    if 'whatsapp_webhook_eventos' not in tablas:
        op.create_table(
            'whatsapp_webhook_eventos',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('recibido_en', sa.DateTime(), nullable=False),
            sa.Column('tipos', sa.String(200), nullable=False, server_default=''),
            sa.Column('payload', sa.JSON(), nullable=False),
            sa.Column('procesado_en', sa.DateTime(), nullable=True),
            sa.Column('resultado', sa.String(200), nullable=True),
        )
        op.create_index('ix_whatsapp_webhook_eventos_recibido_en', 'whatsapp_webhook_eventos', ['recibido_en'])
        op.create_index('ix_whatsapp_webhook_eventos_procesado_en', 'whatsapp_webhook_eventos', ['procesado_en'])

    if 'whatsapp_conexiones' not in tablas:
        op.create_table(
            'whatsapp_conexiones',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('waba_id', sa.String(64), nullable=False),
            sa.Column('phone_number_id', sa.String(64), nullable=False, unique=True),
            sa.Column('numero', sa.String(32), nullable=True),
            sa.Column('nombre_verificado', sa.String(200), nullable=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('token', sa.Text(), nullable=True),
            sa.Column('coexistence', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('estado', sa.String(20), nullable=False, server_default='pendiente'),
            sa.Column('conectado_en', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_whatsapp_conexiones_waba_id', 'whatsapp_conexiones', ['waba_id'])
        op.create_index('ix_whatsapp_conexiones_user_id', 'whatsapp_conexiones', ['user_id'])


def downgrade():
    tablas = set(sa.inspect(op.get_bind()).get_table_names())
    if 'whatsapp_conexiones' in tablas:
        op.drop_table('whatsapp_conexiones')
    if 'whatsapp_webhook_eventos' in tablas:
        op.drop_table('whatsapp_webhook_eventos')
