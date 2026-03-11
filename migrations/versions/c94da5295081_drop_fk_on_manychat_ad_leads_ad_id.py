"""drop FK on manychat_ad_leads.ad_id

Revision ID: c94da5295081
Revises: 37a2828b0f05
Create Date: 2026-03-11 16:49:54.039090

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c94da5295081'
down_revision = '37a2828b0f05'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        # Usar IF EXISTS para evitar que una excepción aborte la transacción
        bind.execute(sa.text(
            "ALTER TABLE manychat_ad_leads DROP CONSTRAINT IF EXISTS fk_manychat_ad_leads_ad_id_ads"
        ))
        bind.execute(sa.text(
            "ALTER TABLE manychat_ad_leads DROP CONSTRAINT IF EXISTS manychat_ad_leads_ad_id_fkey"
        ))


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.create_foreign_key(
            'fk_manychat_ad_leads_ad_id_ads',
            'manychat_ad_leads', 'ads',
            ['ad_id'], ['id']
        )

