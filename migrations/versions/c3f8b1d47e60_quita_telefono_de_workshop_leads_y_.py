"""Quita telefono de workshop_leads y agrega dedupe_key

El gate de la landing dejo de pedir el numero de WhatsApp, asi que las columnas
phone/phone_country quedan sin uso. Se eliminan en vez de dejarlas nulas: son
datos personales y no tiene sentido arrastrar columnas de PII vacias.

La deduplicacion del alta se apoyaba en el telefono. Se reemplaza por
dedupe_key, un identificador aleatorio que genera el navegador por cada
completada del gate y que no lleva ningun dato personal.

Revision ID: c3f8b1d47e60
Revises: a1c7d3e9f204
Create Date: 2026-08-12 03:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3f8b1d47e60'
down_revision = 'a1c7d3e9f204'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('workshop_leads', schema=None) as batch_op:
        batch_op.add_column(sa.Column('dedupe_key', sa.String(length=64), nullable=True))
        batch_op.create_index(batch_op.f('ix_workshop_leads_dedupe_key'), ['dedupe_key'], unique=True)
        batch_op.drop_index(batch_op.f('ix_workshop_leads_phone'))
        batch_op.drop_column('phone_country')
        batch_op.drop_column('phone')


def downgrade():
    with op.batch_alter_table('workshop_leads', schema=None) as batch_op:
        batch_op.add_column(sa.Column('phone', sa.String(length=24), nullable=True))
        batch_op.add_column(sa.Column('phone_country', sa.String(length=8), nullable=True))
        batch_op.create_index(batch_op.f('ix_workshop_leads_phone'), ['phone'], unique=False)
        batch_op.drop_index(batch_op.f('ix_workshop_leads_dedupe_key'))
        batch_op.drop_column('dedupe_key')
