"""add lead_name to manychat_ad_leads

Revision ID: 97c99e2248b8
Revises: c94da5295081
Create Date: 2026-03-11 17:48:30.484056

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '97c99e2248b8'
down_revision = 'c94da5295081'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('manychat_ad_leads', sa.Column('lead_name', sa.String(length=150), nullable=True))


def downgrade():
    op.drop_column('manychat_ad_leads', 'lead_name')
