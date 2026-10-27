"""Inbox de setters con lo de Kommo: notas y eventos, tareas, respuestas rápidas, audios, lecturas, y en
la conversación la sub-etapa del embudo y el setter asignado a mano.

Revision ID: d5f7a9c1e3b6
Revises: c4e8a2f6b1d9
Create Date: 2026-10-27 23:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd5f7a9c1e3b6'
down_revision = 'c4e8a2f6b1d9'
branch_labels = None
depends_on = None


def _usuario(nombre):
    return sa.ForeignKeyConstraint([nombre], ['users.id'], ondelete='SET NULL')


def upgrade():
    op.create_table(
        'notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('target_type', sa.String(length=30), nullable=False),
        sa.Column('target_id', sa.String(length=64), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        _usuario('created_by'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notes_target', 'notes', ['target_type', 'target_id'])
    op.create_table(
        'tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('target_type', sa.String(length=30), nullable=False),
        sa.Column('target_id', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('due_at', sa.DateTime(), nullable=True),
        sa.Column('assigned_to', sa.Integer(), nullable=True),
        sa.Column('done_at', sa.DateTime(), nullable=True),
        sa.Column('done_by', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        _usuario('assigned_to'), _usuario('done_by'), _usuario('created_by'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tasks_target', 'tasks', ['target_type', 'target_id'])
    op.create_index('ix_tasks_assigned_open', 'tasks', ['assigned_to', 'done_at'])
    op.create_table(
        'quick_replies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shortcut', sa.String(length=40), nullable=False),
        sa.Column('title', sa.String(length=80), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        _usuario('created_by'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shortcut'),
    )
    op.create_table(
        'audio_clips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('mime', sa.String(length=60), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('duration_s', sa.Integer(), nullable=True),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        _usuario('created_by'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'inbox_reads',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('read_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['contact_id'], ['ig_contactos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'contact_id'),
    )
    with op.batch_alter_table('ig_contactos') as t:
        t.add_column(sa.Column('etapa', sa.String(length=20), nullable=True))
        t.add_column(sa.Column('setter_id', sa.Integer(), nullable=True))
        t.add_column(sa.Column('asignado_en', sa.DateTime(), nullable=True))
        t.create_foreign_key('fk_ig_contactos_setter', 'users', ['setter_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('ig_contactos') as t:
        t.drop_constraint('fk_ig_contactos_setter', type_='foreignkey')
        t.drop_column('asignado_en')
        t.drop_column('setter_id')
        t.drop_column('etapa')
    op.drop_table('inbox_reads')
    op.drop_table('audio_clips')
    op.drop_table('quick_replies')
    op.drop_index('ix_tasks_assigned_open', table_name='tasks')
    op.drop_index('ix_tasks_target', table_name='tasks')
    op.drop_table('tasks')
    op.drop_index('ix_notes_target', table_name='notes')
    op.drop_table('notes')
