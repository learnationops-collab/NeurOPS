"""Formulario de Closer editable desde Talent › Forms: hiring_forms.puesto y, en
job_applications, form_id y respuestas_extra (ADR-W280)

Revision ID: d4f6a8c0e2b1
Revises: c7e1a9d3b5f2
Create Date: 2026-11-27

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'd4f6a8c0e2b1'
down_revision = 'c7e1a9d3b5f2'
branch_labels = None
depends_on = None


def _columnas(tabla):
    return {c['name'] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade():
    if 'puesto' not in _columnas('hiring_forms'):
        op.add_column('hiring_forms', sa.Column('puesto', sa.String(20), nullable=False, server_default='asistente'))
    cols = _columnas('job_applications')
    with op.batch_alter_table('job_applications') as batch:
        if 'form_id' not in cols:
            batch.add_column(sa.Column('form_id', sa.Integer(), nullable=True))
            batch.create_foreign_key('fk_job_applications_form_id', 'hiring_forms', ['form_id'], ['id'])
        if 'respuestas_extra' not in cols:
            batch.add_column(sa.Column('respuestas_extra', sa.JSON(), nullable=True))


def downgrade():
    cols = _columnas('job_applications')
    with op.batch_alter_table('job_applications') as batch:
        if 'form_id' in cols:
            batch.drop_constraint('fk_job_applications_form_id', type_='foreignkey')
            batch.drop_column('form_id')
        if 'respuestas_extra' in cols:
            batch.drop_column('respuestas_extra')
    if 'puesto' in _columnas('hiring_forms'):
        op.drop_column('hiring_forms', 'puesto')
