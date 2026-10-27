"""Etiquetas genéricas: `tag_groups` (el grupo, p. ej. «Temperatura») y `tags` (una etiqueta puesta
sobre algo por `target_type` + `target_id`). Hoy las usan los setters en las conversaciones del Inbox.

Revision ID: c4e8a2f6b1d9
Revises: b8d4f1a6c3e7
Create Date: 2026-10-27 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'c4e8a2f6b1d9'
down_revision = 'b8d4f1a6c3e7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tag_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=60), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=True),
        sa.Column('exclusive', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tag_group_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=60), nullable=False),
        sa.Column('target_type', sa.String(length=30), nullable=False),
        sa.Column('target_id', sa.String(length=64), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tag_group_id'], ['tag_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('target_type', 'target_id', 'tag_group_id', 'name', name='uq_tags_target_group_name'),
    )
    op.create_index('ix_tags_target', 'tags', ['target_type', 'target_id'])
    op.create_index('ix_tags_group_name', 'tags', ['tag_group_id', 'name'])


def downgrade():
    op.drop_index('ix_tags_group_name', table_name='tags')
    op.drop_index('ix_tags_target', table_name='tags')
    op.drop_table('tags')
    op.drop_table('tag_groups')
