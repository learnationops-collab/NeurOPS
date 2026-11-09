"""Marketing: miniatura y publicación de Instagram de cada anuncio de Meta

Revision ID: f3a5c7e9b1d4
Revises: e8b2c4d6f1a3
Create Date: 2026-11-09

`meta_anuncios.miniatura` (la del creativo, URL firmada que refresca cada sincronización) y
`publicacion_url` (el permalink de Instagram), para ver el anuncio en la pestaña Meta Ads.
"""
from alembic import op
import sqlalchemy as sa


revision = 'f3a5c7e9b1d4'
down_revision = 'e8b2c4d6f1a3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('meta_anuncios') as batch:
        batch.add_column(sa.Column('miniatura', sa.Text(), nullable=True))
        batch.add_column(sa.Column('publicacion_url', sa.String(500), nullable=True))


def downgrade():
    with op.batch_alter_table('meta_anuncios') as batch:
        batch.drop_column('publicacion_url')
        batch.drop_column('miniatura')
