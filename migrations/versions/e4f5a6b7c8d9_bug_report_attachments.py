"""bug report: capturas extra opcionales, link de Loom, urgencia deja de ser obligatoria

Revision ID: e4f5a6b7c8d9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e4f5a6b7c8d9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        # Capturas adicionales que el usuario pega con Ctrl+V (además de la automática que ya
        # vive en `screenshot`). Lista de data URLs, puede quedar vacía.
        batch_op.add_column(sa.Column('extra_screenshots', sa.JSON(), nullable=True))
        # Link de Loom opcional para quien prefiere grabar el problema en vez de (o además de)
        # describirlo.
        batch_op.add_column(sa.Column('loom_link', sa.String(length=500), nullable=True))
        # Se dejó de pedir en el flujo del chat (pedido del usuario): pasa a ser opcional para
        # no romper los reportes históricos, que sí lo tienen.
        batch_op.alter_column('urgency', existing_type=sa.String(length=20), nullable=True)


def downgrade():
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.alter_column('urgency', existing_type=sa.String(length=20), nullable=False)
        batch_op.drop_column('loom_link')
        batch_op.drop_column('extra_screenshots')
