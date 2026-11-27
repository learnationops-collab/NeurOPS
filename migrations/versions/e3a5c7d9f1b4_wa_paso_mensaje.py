"""WhatsApp: un paso del flujo de un taller puede ser un mensaje común dentro de la ventana de 24 h

Revision ID: e3a5c7d9f1b4
Revises: c1e3a5b7d9f2
Create Date: 2026-11-27

wa_pasos_taller.tipo y .mensaje, wa_envios.mensaje. Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'e3a5c7d9f1b4'
down_revision = 'c1e3a5b7d9f2'
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    pasos = {c['name'] for c in inspector.get_columns('wa_pasos_taller')}
    if 'tipo' not in pasos:
        op.add_column('wa_pasos_taller', sa.Column('tipo', sa.String(10), nullable=False, server_default='plantilla'))
    if 'mensaje' not in pasos:
        op.add_column('wa_pasos_taller', sa.Column('mensaje', sa.JSON(), nullable=True))
    if 'mensaje' not in {c['name'] for c in inspector.get_columns('wa_envios')}:
        op.add_column('wa_envios', sa.Column('mensaje', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('wa_envios', 'mensaje')
    op.drop_column('wa_pasos_taller', 'mensaje')
    op.drop_column('wa_pasos_taller', 'tipo')
