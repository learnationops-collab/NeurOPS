"""add workshop goals and actions

Revision ID: 286308c75915
Revises: c5179b183943
Create Date: 2026-08-29 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '286308c75915'
down_revision = 'c5179b183943'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('workshop_goals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('meta_whatsapp', sa.Float(), nullable=True),
    sa.Column('meta_asistencia', sa.Float(), nullable=True),
    sa.Column('meta_retencion_clase', sa.Float(), nullable=True),
    sa.Column('meta_retencion_pitch', sa.Float(), nullable=True),
    sa.Column('meta_conversion_form', sa.Float(), nullable=True),
    sa.Column('meta_agendamiento', sa.Float(), nullable=True),
    sa.Column('meta_show_up_citas', sa.Float(), nullable=True),
    sa.Column('meta_close_rate', sa.Float(), nullable=True),
    sa.Column('banda_limite', sa.Float(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workshop_goals'))
    )

    op.create_table('workshop_actions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('stage_key', sa.String(length=40), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('value_score', sa.Integer(), nullable=True),
    sa.Column('speed_score', sa.Integer(), nullable=True),
    sa.Column('simplicity_score', sa.Integer(), nullable=True),
    sa.Column('urgency_score', sa.Integer(), nullable=True),
    sa.Column('target_delta_pp', sa.Float(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('created_by_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name=op.f('fk_workshop_actions_created_by_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workshop_actions'))
    )


def downgrade():
    op.drop_table('workshop_actions')
    op.drop_table('workshop_goals')
