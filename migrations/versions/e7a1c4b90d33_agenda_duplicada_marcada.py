"""marca de agenda duplicada en financial_agendas

Revision ID: e7a1c4b90d33
Revises: 1d590aa97756
Create Date: 2026-09-26 23:10:00.000000

La fila repetida del mismo lead se marca en vez de borrarse: borrar es
irreversible y pierde el registro de lo que Calendly mando de verdad.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7a1c4b90d33'
down_revision = '1d590aa97756'
branch_labels = None
depends_on = None


COLUMNAS = [
    sa.Column('duplicada_de_id', sa.Integer(), nullable=True),
    sa.Column('descartada_at', sa.DateTime(), nullable=True),
    sa.Column('descartada_por_id', sa.Integer(), nullable=True),
    sa.Column('descartada_motivo', sa.String(length=255), nullable=True),
]

# Indice porque TODA consulta del libro de agendas y del embudo filtra por
# `duplicada_de_id IS NULL`: sin el, cada listado suma un scan de la tabla.
INDICE = 'ix_financial_agendas_duplicada_de_id'


def _es_sqlite():
    return op.get_bind().dialect.name == 'sqlite'


def upgrade():
    # SQLite (el entorno local) no sabe agregar una clave foranea con ALTER, asi que alembic
    # recrea la tabla entera -- y al hacerlo con una clave foranea de la tabla hacia si misma
    # el orden de copiado queda circular y la migracion aborta. Ahi se agregan las columnas
    # sueltas, que SQLite si soporta, y se saltean las dos claves foraneas: SQLite no las
    # aplica salvo que se enciendan a mano, asi que no cambia el comportamiento. En Postgres,
    # que es produccion, el ALTER es directo y va todo.
    if _es_sqlite():
        # Idempotente a proposito: SQLite no hace DDL transaccional, asi que un intento
        # fallido de esta misma migracion deja las columnas puestas y la version sin
        # avanzar. Sin esto, el reintento muere con "duplicate column name".
        inspector = sa.inspect(op.get_bind())
        ya_estan = {c['name'] for c in inspector.get_columns('financial_agendas')}
        for columna in COLUMNAS:
            if columna.name not in ya_estan:
                op.add_column('financial_agendas', columna)
        indices = {i['name'] for i in inspector.get_indexes('financial_agendas')}
        if INDICE not in indices:
            op.create_index(INDICE, 'financial_agendas', ['duplicada_de_id'], unique=False)
        return

    with op.batch_alter_table('financial_agendas', schema=None) as batch_op:
        for columna in COLUMNAS:
            batch_op.add_column(columna)
        batch_op.create_index(INDICE, ['duplicada_de_id'], unique=False)
        # ondelete SET NULL y no el NO ACTION por defecto: si alguien borra a mano la fila
        # que se conservo, la descartada no debe bloquear el DELETE con un IntegrityError
        # -- simplemente deja de apuntar a nadie y vuelve a verse en el libro, que es el
        # comportamiento sano cuando su referencia ya no existe.
        batch_op.create_foreign_key(
            'fk_financial_agendas_duplicada_de_id', 'financial_agendas', ['duplicada_de_id'], ['id'],
            ondelete='SET NULL')
        batch_op.create_foreign_key(
            'fk_financial_agendas_descartada_por_id', 'users', ['descartada_por_id'], ['id'])


def downgrade():
    if _es_sqlite():
        op.drop_index(INDICE, table_name='financial_agendas')
        for columna in reversed(COLUMNAS):
            op.drop_column('financial_agendas', columna.name)
        return

    with op.batch_alter_table('financial_agendas', schema=None) as batch_op:
        batch_op.drop_constraint('fk_financial_agendas_descartada_por_id', type_='foreignkey')
        batch_op.drop_constraint('fk_financial_agendas_duplicada_de_id', type_='foreignkey')
        batch_op.drop_index(INDICE)
        for columna in reversed(COLUMNAS):
            batch_op.drop_column(columna.name)
