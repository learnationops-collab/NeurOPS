"""sched_gracias: las páginas de gracias de Thalamus (videos después de agendar)

Revision ID: d4f8b2c6e915
Revises: b7e4c2a9d561
Create Date: 2026-10-12 10:00:00.000000

Un documento de Thalamus más, con la misma forma que las otras tablas sched_*. Los archivos de video
no van a la base: viven en el volumen (AGENDAS_VIDEOS_DIR). No destructivo: solo agrega la tabla.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4f8b2c6e915'
down_revision = 'b7e4c2a9d561'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sched_gracias',
        sa.Column('id', sa.String(length=40), nullable=False),
        sa.Column('datos', sa.JSON(), nullable=False),
        sa.Column('orden', sa.Float(), nullable=False, server_default='0'),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_por_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['actualizado_por_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('sched_gracias')
