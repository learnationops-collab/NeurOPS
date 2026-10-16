"""meta_anuncios.embudo: a qué embudo va cada anuncio (setting, workshop…); fuera las campañas marcadas

Kerwin (15/10/2026): el texto del anuncio dice adónde va («al DM» es setting, «clase gratis» es
workshop), y la inversión de cada workshop sale de los anuncios de workshop, no de campañas enteras
marcadas a mano (`meta_campanas_workshop`, que existió solo en develop y staging unas horas). El
embudo lo completa la próxima sincronización con Meta (`meta_ads_service.mapear_automatico`).

Revision ID: d8f2b6c4a9e1
Revises: c3e8a5d9f2b6
Create Date: 2026-10-15 23:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd8f2b6c4a9e1'
down_revision = 'c3e8a5d9f2b6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('meta_anuncios', schema=None) as batch_op:
        batch_op.add_column(sa.Column('embudo', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('embudo_mapeo', sa.String(length=10), nullable=True))
        batch_op.create_index('ix_meta_anuncios_embudo', ['embudo'], unique=False)
    op.drop_table('meta_campanas_workshop')


def downgrade():
    op.create_table(
        'meta_campanas_workshop',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('campana_id', sa.String(length=40), nullable=False),
        sa.Column('nombre', sa.String(length=255), nullable=True),
        sa.Column('creado_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campana_id'),
    )
    with op.batch_alter_table('meta_anuncios', schema=None) as batch_op:
        batch_op.drop_index('ix_meta_anuncios_embudo')
        batch_op.drop_column('embudo_mapeo')
        batch_op.drop_column('embudo')
