"""Reporte único (ADR-W203): tabla daily_closes, el cierre del día de cada persona

Revision ID: b3d5f7a9c2e4
Revises: a8c2e4f6b1d3
Create Date: 2026-11-23

Idempotente: lo que ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'b3d5f7a9c2e4'
down_revision = 'a8c2e4f6b1d3'
branch_labels = None
depends_on = None


def _insp():
    return sa.inspect(op.get_bind())


def upgrade():
    if 'daily_closes' in set(_insp().get_table_names()):
        return
    op.create_table(
        'daily_closes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('victory', sa.JSON(), nullable=True),
        sa.Column('tomorrow', sa.Text(), nullable=True),
        sa.Column('platform_issue', sa.Text(), nullable=True),
        sa.Column('workflow', sa.Text(), nullable=True),
        sa.Column('is_non_working_day', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('status', sa.String(length=15), nullable=False, server_default='en_curso'),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('user_id', 'date', name='_daily_close_user_date_uc'),
    )
    op.create_index('ix_daily_closes_user_id', 'daily_closes', ['user_id'])
    op.create_index('ix_daily_closes_closed_at', 'daily_closes', ['closed_at'])


def downgrade():
    op.drop_index('ix_daily_closes_closed_at', table_name='daily_closes')
    op.drop_index('ix_daily_closes_user_id', table_name='daily_closes')
    op.drop_table('daily_closes')
