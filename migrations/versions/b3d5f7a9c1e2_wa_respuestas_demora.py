"""WhatsApp: la respuesta a un botón puede esperar antes de salir (demora_segundos y wa_respuestas_pendientes)

Revision ID: b3d5f7a9c1e2
Revises: a2c4e6f8b0d1
Create Date: 2026-11-26

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'b3d5f7a9c1e2'
down_revision = 'a2c4e6f8b0d1'
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columnas = {c['name'] for c in inspector.get_columns('wa_respuestas_boton')}
    if 'demora_segundos' not in columnas:
        op.add_column('wa_respuestas_boton',
                      sa.Column('demora_segundos', sa.Integer(), nullable=False, server_default='0'))
    if 'wa_respuestas_pendientes' not in set(inspector.get_table_names()):
        op.create_table(
            'wa_respuestas_pendientes',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('contacto_id', sa.Integer(), sa.ForeignKey('ig_contactos.id', ondelete='CASCADE'),
                      nullable=False, unique=True),
            sa.Column('regla_id', sa.Integer(), sa.ForeignKey('wa_respuestas_boton.id', ondelete='CASCADE'),
                      nullable=False),
            sa.Column('enviar_en', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_wa_respuestas_pendientes_enviar_en', 'wa_respuestas_pendientes', ['enviar_en'])


def downgrade():
    op.drop_table('wa_respuestas_pendientes')
    op.drop_column('wa_respuestas_boton', 'demora_segundos')
