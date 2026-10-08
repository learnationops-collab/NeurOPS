"""assistant_applications: columna `aporte` y `ia_avanzado` pasa a Text

Revision ID: c7e2a9d4b158
Revises: b9d4f1a7c302
Create Date: 2026-10-07 13:00:00.000000

El formulario público (institute-site) se reescribió: agrega la pregunta
«¿qué le podés aportar al equipo?» (`aporte`) y `ia_avanzado` pasó a ser de
selección múltiple (varias frases largas unidas con " | "), que no entra en
VARCHAR(300). Hasta ahora el backend descartaba `aporte` sin avisar.

No destructivo: una columna opcional (NULL para las filas existentes) y un
ensanchamiento de tipo (String -> Text), que no pierde datos.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7e2a9d4b158'
down_revision = 'b9d4f1a7c302'
branch_labels = None
depends_on = None


def upgrade():
    # Idempotente: producción recibió el mismo cambio antes, por main (b3e6d9a1c724). Cuando esta
    # rama llegue allá, la columna ya existe y el tipo ya es Text: no hay nada que hacer.
    columnas = {c['name']: c for c in sa.inspect(op.get_bind()).get_columns('assistant_applications')}
    ya_es_text = isinstance(columnas['ia_avanzado']['type'], sa.Text)
    if 'aporte' in columnas and ya_es_text:
        return
    with op.batch_alter_table('assistant_applications', schema=None) as batch_op:
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
    with op.batch_alter_table('assistant_applications', schema=None) as batch_op:
        batch_op.alter_column(
            'ia_avanzado',
            existing_type=sa.Text(),
            type_=sa.String(length=300),
            existing_nullable=True,
        )
        batch_op.drop_column('aporte')
