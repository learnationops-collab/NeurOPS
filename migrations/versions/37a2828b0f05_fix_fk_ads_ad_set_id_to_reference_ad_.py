"""fix FK ads ad_set_id to reference ad_sets

Revision ID: 37a2828b0f05
Revises: e50741211157
Create Date: 2026-03-11 16:37:52.579189

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '37a2828b0f05'
down_revision = 'e50741211157'
branch_labels = None
depends_on = None


def upgrade():
    # La FK 'fk_ads_ad_set_id_ad_groups' apunta a la tabla vieja 'ad_groups'.
    # Necesitamos corregirla para que apunte a 'ad_sets'.
    bind = op.get_bind()

    if bind.dialect.name == 'postgresql':
        bind.execute(sa.text(
            "ALTER TABLE ads DROP CONSTRAINT IF EXISTS fk_ads_ad_set_id_ad_groups"
        ))
        inspector = sa.inspect(bind)
        fk_names = [fk.get('name') for fk in inspector.get_foreign_keys('ads')]
        if 'fk_ads_ad_set_id_ad_sets' not in fk_names:
            op.create_foreign_key(
                'fk_ads_ad_set_id_ad_sets', 'ads', 'ad_sets',
                ['ad_set_id'], ['id']
            )


def downgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        try:
            op.drop_constraint('fk_ads_ad_set_id_ad_sets', 'ads', type_='foreignkey')
        except Exception:
            pass

        op.create_foreign_key(
            'fk_ads_ad_set_id_ad_groups', 'ads', 'ad_groups',
            ['ad_set_id'], ['id']
        )

