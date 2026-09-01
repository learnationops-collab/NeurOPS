"""Agrega confirmations_done a CloserDailyReport

Cuenta cuántas agendas confirmó el closer ese día en el pipeline «① Confirmaciones»
(ver CloserService.compute_daily_report_fields). Escrita a mano porque el autogenerate
de Alembic falla en este repo por un problema preexistente ajeno a este cambio (una FK
de `ads.ad_set_id` que referencia una tabla `ad_groups` inexistente en el esquema local).

Revision ID: c5179b183943
Revises: f3b8d5c07a41
Create Date: 2026-08-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c5179b183943'
down_revision = 'f3b8d5c07a41'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('closer_daily_reports', schema=None) as batch_op:
        batch_op.add_column(sa.Column('confirmations_done', sa.Integer(), server_default='0', nullable=True))


def downgrade():
    with op.batch_alter_table('closer_daily_reports', schema=None) as batch_op:
        batch_op.drop_column('confirmations_done')
