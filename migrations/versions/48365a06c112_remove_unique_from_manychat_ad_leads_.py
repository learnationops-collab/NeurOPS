"""remove unique from manychat_ad_leads.manychat_id

Revision ID: 48365a06c112
Revises: 97c99e2248b8
Create Date: 2026-03-12 12:59:13.284650

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '48365a06c112'
down_revision = '97c99e2248b8'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        bind.execute(sa.text(
            "ALTER TABLE manychat_ad_leads DROP CONSTRAINT IF EXISTS manychat_ad_leads_manychat_id_key"
        ))
        bind.execute(sa.text(
            "ALTER TABLE manychat_ad_leads DROP CONSTRAINT IF EXISTS uq_manychat_ad_leads_manychat_id"
        ))
    else:
        with op.batch_alter_table('manychat_ad_leads', schema=None) as batch_op:
            batch_op.drop_constraint('uq_manychat_ad_leads_manychat_id', type_='unique')

def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        bind.execute(sa.text(
            "ALTER TABLE manychat_ad_leads ADD CONSTRAINT manychat_ad_leads_manychat_id_key UNIQUE (manychat_id)"
        ))
    else:
        pass
