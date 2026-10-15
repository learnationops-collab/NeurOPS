"""Anuncios por palabra clave de ManyChat y gasto diario de Meta Ads

`ads.clave` (la palabra clave normalizada) y `ads.ad_set_id` opcional: el anuncio se crea solo cuando
ManyChat manda una palabra clave nueva, sin campaña ni conjunto. Las dos tablas de Meta guardan los
anuncios publicados y lo que gastó cada uno por día.

Revision ID: d3f7a1c9e5b2
Revises: a8c3e5f71b24
Create Date: 2026-10-14 18:00:00.000000

"""
import re
import unicodedata

import sqlalchemy as sa
from alembic import op

revision = 'd3f7a1c9e5b2'
down_revision = 'a8c3e5f71b24'
branch_labels = None
depends_on = None


def _clave(texto):
    """Copia congelada de `app.models.marketing.clave_de_palabra` (una migración no importa la app)."""
    if not isinstance(texto, str):
        return None
    sin_tildes = ''.join(c for c in unicodedata.normalize('NFKD', texto) if not unicodedata.combining(c))
    limpio = re.sub(r'[^A-Z0-9]+', ' ', sin_tildes.upper()).strip()
    return limpio[:100] or None


def upgrade():
    with op.batch_alter_table('ads', schema=None) as batch_op:
        batch_op.add_column(sa.Column('clave', sa.String(length=100), nullable=True))
        batch_op.alter_column('ad_set_id', existing_type=sa.Integer(), nullable=True)
        batch_op.create_index('ix_ads_clave', ['clave'])

    conexion = op.get_bind()
    for ad_id, keyword, nombre in conexion.execute(sa.text('SELECT id, keyword, name FROM ads')).fetchall():
        clave = _clave(keyword) or _clave(nombre)
        if clave:
            conexion.execute(sa.text('UPDATE ads SET clave = :clave WHERE id = :id'), {'clave': clave, 'id': ad_id})

    op.create_table(
        'meta_anuncios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('meta_ad_id', sa.String(length=40), nullable=False),
        sa.Column('cuenta_id', sa.String(length=40), nullable=True),
        sa.Column('nombre', sa.String(length=255), nullable=True),
        sa.Column('campana', sa.String(length=255), nullable=True),
        sa.Column('conjunto', sa.String(length=255), nullable=True),
        sa.Column('creative_id', sa.String(length=40), nullable=True),
        sa.Column('texto', sa.Text(), nullable=True),
        sa.Column('estado', sa.String(length=40), nullable=True),
        sa.Column('clave', sa.String(length=100), nullable=True),
        sa.Column('mapeo', sa.String(length=10), nullable=True),
        sa.Column('creado_at', sa.DateTime(), nullable=True),
        sa.Column('actualizado_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meta_ad_id', name='uq_meta_anuncios_meta_ad_id'),
    )
    op.create_index('ix_meta_anuncios_clave', 'meta_anuncios', ['clave'])

    op.create_table(
        'meta_gastos_diarios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('meta_ad_id', sa.String(length=40), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('gasto', sa.Float(), nullable=False),
        sa.Column('moneda', sa.String(length=3), nullable=True),
        sa.Column('actualizado_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meta_ad_id', 'fecha', name='uq_meta_gasto_anuncio_dia'),
    )
    op.create_index('ix_meta_gastos_diarios_meta_ad_id', 'meta_gastos_diarios', ['meta_ad_id'])
    op.create_index('ix_meta_gastos_diarios_fecha', 'meta_gastos_diarios', ['fecha'])


def downgrade():
    op.drop_index('ix_meta_gastos_diarios_fecha', table_name='meta_gastos_diarios')
    op.drop_index('ix_meta_gastos_diarios_meta_ad_id', table_name='meta_gastos_diarios')
    op.drop_table('meta_gastos_diarios')
    op.drop_index('ix_meta_anuncios_clave', table_name='meta_anuncios')
    op.drop_table('meta_anuncios')
    # `ad_set_id` no vuelve a ser obligatorio: los anuncios creados por palabra clave no tienen conjunto.
    with op.batch_alter_table('ads', schema=None) as batch_op:
        batch_op.drop_index('ix_ads_clave')
        batch_op.drop_column('clave')
