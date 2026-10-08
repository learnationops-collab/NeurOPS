"""assistant_applications: columna `aporte` y `ia_avanzado` pasa a Text (versión de main)

Revision ID: b3e6d9a1c724
Revises: a9d3c5e7f142
Create Date: 2026-10-08 12:00:00.000000

Es el mismo cambio que `c7e2a9d4b158` de develop, colgado de la cabeza de main para
que llegue a producción antes que el resto de develop (que encadena esa migración
detrás de las de Agendas v2). Por eso es idempotente: cuando develop pase a main,
`c7e2a9d4b158` corre sobre una base que ya tiene la columna y no hace nada, y al
revés.

El formulario público (institute-site) agrega la pregunta «¿qué le podés aportar
al equipo?» (`aporte`) y `ia_avanzado` pasó a ser de selección múltiple (varias
frases largas unidas con " | "), que no entra en VARCHAR(300).

No destructivo: una columna opcional y un ensanchamiento de tipo (String -> Text).
"""
from alembic import op
import sqlalchemy as sa


revision = 'b3e6d9a1c724'
down_revision = 'a9d3c5e7f142'
branch_labels = None
depends_on = None

TABLA = 'assistant_applications'


def _columnas():
    return {c['name']: c for c in sa.inspect(op.get_bind()).get_columns(TABLA)}


def upgrade():
    columnas = _columnas()
    ya_es_text = isinstance(columnas['ia_avanzado']['type'], sa.Text)
    if 'aporte' in columnas and ya_es_text:
        return
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        if 'aporte' not in columnas:
            batch_op.add_column(sa.Column('aporte', sa.Text(), nullable=True))
        if not ya_es_text:
            batch_op.alter_column(
                'ia_avanzado',
                existing_type=sa.String(length=300),
                type_=sa.Text(),
                existing_nullable=True,
            )


def downgrade():
    with op.batch_alter_table(TABLA, schema=None) as batch_op:
        batch_op.alter_column(
            'ia_avanzado',
            existing_type=sa.Text(),
            type_=sa.String(length=300),
            existing_nullable=True,
        )
        batch_op.drop_column('aporte')
