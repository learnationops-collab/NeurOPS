"""replace flat training videos with the playbook hierarchy (roadmap/module/lesson)

Revision ID: 4c64ef2c0f18
Revises: c2d3e4f5a6b7
Create Date: 2026-09-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4c64ef2c0f18'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    # En desarrollo local pudieron existir las tablas de la versión preliminar de
    # "training_videos", pero en producción (Railway) nunca se crearon. Se eliminan
    # solo si existen.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    for tbl in [
        'training_video_completions',
        'training_video_options',
        'training_video_questions',
        'training_videos',
    ]:
        if tbl in existing_tables:
            op.drop_table(tbl)

    op.create_table('playbook_roadmaps',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('accent', sa.String(length=20), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_playbook_roadmaps'))
    )

    op.create_table('playbook_modules',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('roadmap_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['roadmap_id'], ['playbook_roadmaps.id'], name=op.f('fk_playbook_modules_roadmap_id_playbook_roadmaps'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_playbook_modules'))
    )
    with op.batch_alter_table('playbook_modules', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_playbook_modules_roadmap_id'), ['roadmap_id'], unique=False)

    op.create_table('playbook_lessons',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('module_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('loom_link', sa.String(length=500), nullable=False),
    sa.Column('duration_minutes', sa.Integer(), nullable=True),
    sa.Column('transcript', sa.Text(), nullable=True),
    sa.Column('target_roles', sa.JSON(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.Column('created_by_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name=op.f('fk_playbook_lessons_created_by_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['module_id'], ['playbook_modules.id'], name=op.f('fk_playbook_lessons_module_id_playbook_modules'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_playbook_lessons'))
    )
    with op.batch_alter_table('playbook_lessons', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_playbook_lessons_module_id'), ['module_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_playbook_lessons_created_at'), ['created_at'], unique=False)

    op.create_table('playbook_questions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('lesson_id', sa.Integer(), nullable=False),
    sa.Column('question_text', sa.Text(), nullable=False),
    sa.Column('question_type', sa.String(length=20), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['lesson_id'], ['playbook_lessons.id'], name=op.f('fk_playbook_questions_lesson_id_playbook_lessons'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_playbook_questions'))
    )
    with op.batch_alter_table('playbook_questions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_playbook_questions_lesson_id'), ['lesson_id'], unique=False)

    op.create_table('playbook_options',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('question_id', sa.Integer(), nullable=False),
    sa.Column('option_text', sa.String(length=500), nullable=False),
    sa.Column('is_correct', sa.Boolean(), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['question_id'], ['playbook_questions.id'], name=op.f('fk_playbook_options_question_id_playbook_questions'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_playbook_options'))
    )
    with op.batch_alter_table('playbook_options', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_playbook_options_question_id'), ['question_id'], unique=False)

    op.create_table('playbook_lesson_progress',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('lesson_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('video_watched_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['lesson_id'], ['playbook_lessons.id'], name=op.f('fk_playbook_lesson_progress_lesson_id_playbook_lessons'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_playbook_lesson_progress_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_playbook_lesson_progress')),
    sa.UniqueConstraint('lesson_id', 'user_id', name='uq_playbook_lesson_progress')
    )
    with op.batch_alter_table('playbook_lesson_progress', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_playbook_lesson_progress_lesson_id'), ['lesson_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_playbook_lesson_progress_user_id'), ['user_id'], unique=False)

    op.create_table('playbook_completions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('lesson_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['lesson_id'], ['playbook_lessons.id'], name=op.f('fk_playbook_completions_lesson_id_playbook_lessons'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_playbook_completions_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_playbook_completions')),
    sa.UniqueConstraint('lesson_id', 'user_id', name='uq_playbook_completion')
    )
    with op.batch_alter_table('playbook_completions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_playbook_completions_lesson_id'), ['lesson_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_playbook_completions_user_id'), ['user_id'], unique=False)


def downgrade():
    op.drop_table('playbook_completions')
    op.drop_table('playbook_lesson_progress')
    op.drop_table('playbook_options')
    op.drop_table('playbook_questions')
    op.drop_table('playbook_lessons')
    op.drop_table('playbook_modules')
    op.drop_table('playbook_roadmaps')
