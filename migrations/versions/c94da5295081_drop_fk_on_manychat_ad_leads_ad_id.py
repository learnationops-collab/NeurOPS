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
        # Eliminar FK que vincula manychat_ad_leads.ad_id -> ads.id
        try:
            op.drop_constraint('fk_manychat_ad_leads_ad_id_ads', 'manychat_ad_leads', type_='foreignkey')
        except Exception:
            pass
        # Probar nombre alternativo por si Alembic lo generó distinto
        try:
            op.drop_constraint('manychat_ad_leads_ad_id_fkey', 'manychat_ad_leads', type_='foreignkey')
        except Exception:
            pass


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.create_foreign_key(
            'fk_manychat_ad_leads_ad_id_ads',
            'manychat_ad_leads', 'ads',
            ['ad_id'], ['id']
        )

