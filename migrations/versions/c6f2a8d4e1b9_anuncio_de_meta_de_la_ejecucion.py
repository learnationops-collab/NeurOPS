"""Inbox: cada ejecución guarda el anuncio de Meta del que vino el DM

El DM que llega al tocar un anuncio de Conversaciones trae `referral.ad_id`: queda en la ejecución
(`meta_ad_id`, el mismo id que `meta_anuncios.meta_ad_id`).

Revision ID: c6f2a8d4e1b9
Revises: b5e1c7f3a8d2
Create Date: 2026-10-19 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c6f2a8d4e1b9'
down_revision = 'b5e1c7f3a8d2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('aut_ejecuciones', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meta_ad_id', sa.String(length=40), nullable=True))
        batch_op.create_index(batch_op.f('ix_aut_ejecuciones_meta_ad_id'), ['meta_ad_id'], unique=False)


def downgrade():
    with op.batch_alter_table('aut_ejecuciones', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_aut_ejecuciones_meta_ad_id'))
        batch_op.drop_column('meta_ad_id')
