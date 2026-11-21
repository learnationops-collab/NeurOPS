"""Postulaciones de closer archivadas (ADR-W193): job_applications.archivada_at

Revision ID: f7b9d1e3a5c7
Revises: e6a1c3f5b7d9
Create Date: 2026-11-21

Idempotente: lo que ya existe no se toca.
"""
import sqlalchemy as sa
from alembic import op

revision = 'f7b9d1e3a5c7'
down_revision = 'e6a1c3f5b7d9'
branch_labels = None
depends_on = None


def _insp():
    return sa.inspect(op.get_bind())


def upgrade():
    columnas = {c['name'] for c in _insp().get_columns('job_applications')}
    if 'archivada_at' not in columnas:
        op.add_column('job_applications', sa.Column('archivada_at', sa.DateTime(), nullable=True))
    indices = {i['name'] for i in _insp().get_indexes('job_applications')}
    if 'ix_job_applications_archivada_at' not in indices:
        op.create_index('ix_job_applications_archivada_at', 'job_applications', ['archivada_at'])


def downgrade():
    indices = {i['name'] for i in _insp().get_indexes('job_applications')}
    if 'ix_job_applications_archivada_at' in indices:
        op.drop_index('ix_job_applications_archivada_at', table_name='job_applications')
    columnas = {c['name'] for c in _insp().get_columns('job_applications')}
    if 'archivada_at' in columnas:
        op.drop_column('job_applications', 'archivada_at')
