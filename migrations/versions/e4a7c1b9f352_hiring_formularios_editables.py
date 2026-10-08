"""Hiring: formularios editables, configuración de la búsqueda y respuestas extra

Tablas `hiring_forms` y `hiring_config`; columnas `form_id` y `respuestas_extra` en
`assistant_applications`.

Revision ID: e4a7c1b9f352
Revises: d8c2f5a7e913
Create Date: 2026-10-08 18:00:00.000000

El formulario público de Asistente deja de estar escrito a mano en institute-site:
sus preguntas se guardan como JSON en `hiring_forms` y se editan desde el panel. Cada
postulación recuerda con qué formulario se contestó (`form_id`) y guarda en
`respuestas_extra` las respuestas a preguntas nuevas que no tienen columna.

No siembra nada: el primer formulario (copia de las 35 preguntas actuales) lo crea la
app la primera vez que alguien lo pide (ver `asegurar_semilla` en
app/services/hiring_forms.py), así esta migración no depende del código de la app.

Idempotente, igual que las anteriores de Hiring: cuelga de la cabeza de main y
develop la va a recibir por un merge; si la tabla o la columna ya existe, no la crea.
No destructiva: dos tablas nuevas y dos columnas opcionales.
"""
from alembic import op
import sqlalchemy as sa


revision = 'e4a7c1b9f352'
down_revision = 'd8c2f5a7e913'
branch_labels = None
depends_on = None

TABLA_POSTULACIONES = 'assistant_applications'
FK_FORM = 'fk_assistant_applications_form_id_hiring_forms'
IX_FORM = 'ix_assistant_applications_form_id'


def _inspector():
    return sa.inspect(op.get_bind())


def upgrade():
    tablas = set(_inspector().get_table_names())

    if 'hiring_forms' not in tablas:
        op.create_table(
            'hiring_forms',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('nombre', sa.String(length=120), nullable=False),
            sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('preguntas', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('created_by_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'hiring_config' not in tablas:
        op.create_table(
            'hiring_config',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('puesto', sa.String(length=160), nullable=False),
            sa.Column('cierre', sa.Date(), nullable=True),
            sa.Column('presupuesto_min', sa.Integer(), nullable=False),
            sa.Column('presupuesto_max', sa.Integer(), nullable=False),
            sa.Column('tasa_brl', sa.Float(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )

    columnas = {c['name'] for c in _inspector().get_columns(TABLA_POSTULACIONES)}
    indices = {i['name'] for i in _inspector().get_indexes(TABLA_POSTULACIONES)}
    if 'form_id' in columnas and 'respuestas_extra' in columnas and IX_FORM in indices:
        return

    with op.batch_alter_table(TABLA_POSTULACIONES, schema=None) as batch_op:
        if 'form_id' not in columnas:
            batch_op.add_column(sa.Column('form_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                FK_FORM, 'hiring_forms', ['form_id'], ['id'], ondelete='SET NULL')
        if 'respuestas_extra' not in columnas:
            batch_op.add_column(sa.Column('respuestas_extra', sa.JSON(), nullable=True))
        if IX_FORM not in indices:
            batch_op.create_index(IX_FORM, ['form_id'], unique=False)


def downgrade():
    with op.batch_alter_table(TABLA_POSTULACIONES, schema=None) as batch_op:
        batch_op.drop_index(IX_FORM)
        batch_op.drop_constraint(FK_FORM, type_='foreignkey')
        batch_op.drop_column('respuestas_extra')
        batch_op.drop_column('form_id')
    op.drop_table('hiring_config')
    op.drop_table('hiring_forms')
