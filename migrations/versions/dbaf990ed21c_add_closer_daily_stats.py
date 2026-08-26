"""add_closer_daily_stats

Revision ID: dbaf990ed21c
Revises: bf217e9343c3
Create Date: 2026-01-15 22:34:02.684079

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dbaf990ed21c'
down_revision = 'bf217e9343c3'
branch_labels = None
depends_on = None


def upgrade():
    try:
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        fk_names = [fk.get('name') for fk in inspector.get_foreign_keys('lead_profiles')]
        if 'fk_lead_profiles_assigned_closer_id_users' not in fk_names:
            with op.batch_alter_table('lead_profiles', schema=None) as batch_op:
                batch_op.create_foreign_key('fk_lead_profiles_assigned_closer_id_users', 'users', ['assigned_closer_id'], ['id'])
    except Exception:
        pass


def downgrade():
    pass
