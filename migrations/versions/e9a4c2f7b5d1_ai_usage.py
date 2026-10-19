"""ai_usage: registro de cada llamada a Claude (quién, para qué, tokens y costo)

Una fila por llamada, salga bien o mal (ver app/services/claude_service.py).

Revision ID: e9a4c2f7b5d1
Revises: c6f2a8d4e1b9
Create Date: 2026-10-19 20:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e9a4c2f7b5d1'
down_revision = 'c6f2a8d4e1b9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ai_usage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('feature', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=60), nullable=False),
        sa.Column('input_tokens', sa.Integer(), nullable=False),
        sa.Column('output_tokens', sa.Integer(), nullable=False),
        sa.Column('cache_creation_input_tokens', sa.Integer(), nullable=False),
        sa.Column('cache_read_input_tokens', sa.Integer(), nullable=False),
        sa.Column('cost_usd', sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('error', sa.String(length=255), nullable=True),
        sa.Column('request_id', sa.String(length=80), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('ai_usage', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ai_usage_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_ai_usage_feature'), ['feature'], unique=False)
        batch_op.create_index(batch_op.f('ix_ai_usage_created_at'), ['created_at'], unique=False)


def downgrade():
    with op.batch_alter_table('ai_usage', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ai_usage_created_at'))
        batch_op.drop_index(batch_op.f('ix_ai_usage_feature'))
        batch_op.drop_index(batch_op.f('ix_ai_usage_user_id'))
    op.drop_table('ai_usage')
