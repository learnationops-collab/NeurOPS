"""add job applications (postulacion closer + votes + clarity weights)

Revision ID: a7b8c9d0e1f2
Revises: d3e4f5a6b7c8
Create Date: 2026-09-01 00:00:00.000000

"""
from datetime import datetime
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a7b8c9d0e1f2'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None

CLARITY_CRITERIA = [
    {"criterion": "formacion", "label": "Formación como closer (pregunta 10)", "default_weight": 22},
    {"criterion": "experiencia", "label": "Experiencia y a qué se dedica (8 y 9)", "default_weight": 18},
    {"criterion": "cierre", "label": "Porcentaje de cierre medido (11)", "default_weight": 16},
    {"criterion": "video", "label": "Video y llamada (22 y 23)", "default_weight": 12},
    {"criterion": "obstaculo", "label": "Cómo resuelve un obstáculo (17)", "default_weight": 10},
    {"criterion": "ingles", "label": "Nivel de inglés (12)", "default_weight": 8},
    {"criterion": "herramientas", "label": "Herramientas y CRM (13)", "default_weight": 8},
    {"criterion": "objetivos", "label": "Objetivos a largo plazo (18)", "default_weight": 6},
]


def upgrade():
    op.create_table('job_applications',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('dedupe_key', sa.String(length=64), nullable=True),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=160), nullable=False),
    sa.Column('disclaimer', sa.String(length=10), nullable=True),
    sa.Column('whatsapp', sa.String(length=40), nullable=True),
    sa.Column('edad', sa.String(length=40), nullable=True),
    sa.Column('pais', sa.String(length=60), nullable=True),
    sa.Column('instagram', sa.String(length=80), nullable=True),
    sa.Column('dedicacion', sa.Text(), nullable=True),
    sa.Column('conocimiento', sa.String(length=60), nullable=True),
    sa.Column('formacion', sa.Text(), nullable=True),
    sa.Column('cierre', sa.String(length=10), nullable=True),
    sa.Column('ingles', sa.String(length=20), nullable=True),
    sa.Column('herramientas', sa.JSON(), nullable=True),
    sa.Column('reporte', sa.String(length=160), nullable=True),
    sa.Column('aportes', sa.JSON(), nullable=True),
    sa.Column('habilidades', sa.Text(), nullable=True),
    sa.Column('obstaculo', sa.Text(), nullable=True),
    sa.Column('objetivos', sa.Text(), nullable=True),
    sa.Column('porque', sa.JSON(), nullable=True),
    sa.Column('fuente', sa.String(length=60), nullable=True),
    sa.Column('bolsa', sa.String(length=120), nullable=True),
    sa.Column('video', sa.String(length=500), nullable=True),
    sa.Column('llamada', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_job_applications'))
    )
    with op.batch_alter_table('job_applications', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_job_applications_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_job_applications_dedupe_key'), ['dedupe_key'], unique=True)

    op.create_table('job_application_votes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('application_id', sa.Integer(), nullable=False),
    sa.Column('reviewer_id', sa.Integer(), nullable=False),
    sa.Column('vote', sa.String(length=10), nullable=False),
    sa.Column('voted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['application_id'], ['job_applications.id'], name=op.f('fk_job_application_votes_application_id_job_applications'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], name=op.f('fk_job_application_votes_reviewer_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_job_application_votes')),
    sa.UniqueConstraint('application_id', 'reviewer_id', name='uq_job_application_vote_reviewer')
    )
    with op.batch_alter_table('job_application_votes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_job_application_votes_application_id'), ['application_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_job_application_votes_reviewer_id'), ['reviewer_id'], unique=False)

    op.create_table('job_application_clarity_weights',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('criterion', sa.String(length=40), nullable=False),
    sa.Column('label', sa.String(length=160), nullable=False),
    sa.Column('weight', sa.Integer(), nullable=False),
    sa.Column('default_weight', sa.Integer(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_job_application_clarity_weights')),
    sa.UniqueConstraint('criterion', name=op.f('uq_job_application_clarity_weights_criterion'))
    )

    # Semilla de los 8 pesos por defecto del handoff (Guardar Clarity los edita después).
    conn = op.get_bind()
    now = datetime.utcnow()
    table = sa.table(
        'job_application_clarity_weights',
        sa.column('criterion', sa.String),
        sa.column('label', sa.String),
        sa.column('weight', sa.Integer),
        sa.column('default_weight', sa.Integer),
        sa.column('updated_at', sa.DateTime),
    )
    conn.execute(table.insert(), [
        {"criterion": c['criterion'], "label": c['label'], "weight": c['default_weight'], "default_weight": c['default_weight'], "updated_at": now}
        for c in CLARITY_CRITERIA
    ])


def downgrade():
    op.drop_table('job_application_clarity_weights')
    with op.batch_alter_table('job_application_votes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_job_application_votes_reviewer_id'))
        batch_op.drop_index(batch_op.f('ix_job_application_votes_application_id'))
    op.drop_table('job_application_votes')
    with op.batch_alter_table('job_applications', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_job_applications_dedupe_key'))
        batch_op.drop_index(batch_op.f('ix_job_applications_created_at'))
    op.drop_table('job_applications')
