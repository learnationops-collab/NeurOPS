"""add training videos (documentacion en video con quiz de comprension)

Revision ID: ad569b0263be
Revises: b4c5d6e7f8a9
Create Date: 2026-09-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ad569b0263be'
down_revision = 'b4c5d6e7f8a9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('training_videos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('loom_link', sa.String(length=500), nullable=False),
    sa.Column('target_roles', sa.JSON(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_by_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name=op.f('fk_training_videos_created_by_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_training_videos'))
    )
    with op.batch_alter_table('training_videos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_training_videos_created_at'), ['created_at'], unique=False)

    op.create_table('training_video_questions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('video_id', sa.Integer(), nullable=False),
    sa.Column('question_text', sa.Text(), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['video_id'], ['training_videos.id'], name=op.f('fk_training_video_questions_video_id_training_videos'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_training_video_questions'))
    )
    with op.batch_alter_table('training_video_questions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_training_video_questions_video_id'), ['video_id'], unique=False)

    op.create_table('training_video_options',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('question_id', sa.Integer(), nullable=False),
    sa.Column('option_text', sa.String(length=500), nullable=False),
    sa.Column('is_correct', sa.Boolean(), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['question_id'], ['training_video_questions.id'], name=op.f('fk_training_video_options_question_id_training_video_questions'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_training_video_options'))
    )
    with op.batch_alter_table('training_video_options', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_training_video_options_question_id'), ['question_id'], unique=False)

    op.create_table('training_video_completions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('video_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['video_id'], ['training_videos.id'], name=op.f('fk_training_video_completions_video_id_training_videos'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_training_video_completions_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_training_video_completions')),
    sa.UniqueConstraint('video_id', 'user_id', name='uq_training_video_completion')
    )
    with op.batch_alter_table('training_video_completions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_training_video_completions_video_id'), ['video_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_training_video_completions_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('training_video_completions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_training_video_completions_user_id'))
        batch_op.drop_index(batch_op.f('ix_training_video_completions_video_id'))
    op.drop_table('training_video_completions')

    with op.batch_alter_table('training_video_options', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_training_video_options_question_id'))
    op.drop_table('training_video_options')

    with op.batch_alter_table('training_video_questions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_training_video_questions_video_id'))
    op.drop_table('training_video_questions')

    with op.batch_alter_table('training_videos', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_training_videos_created_at'))
    op.drop_table('training_videos')
