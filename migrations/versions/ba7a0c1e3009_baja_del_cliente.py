"""baja del cliente: fecha, motivo y quien, y las bajas que ya se habian dado

Revision ID: ba7a0c1e3009
Revises: acad3a5f07e1
Create Date: 2026-09-30 12:00:00.000000

Hasta ahora «Dar de baja» (la accion de la ficha) solo cerraba el seguimiento con
`seguimiento_sub = 'Baja: <motivo>'` y dejaba un comentario en el hilo del cliente: la
deuda seguia en pie y el cliente seguia en todas las listas de cobro. La baja pasa a ser
un estado del cliente (`clients.baja_*`, ver `app/services/baja_service.py`).

La migracion ademas marca a los clientes que ya se habian dado de baja con la accion
vieja (`recuperar_bajas_viejas`): sin eso, las bajas anteriores a hoy seguirian debiendo.
Es idempotente — solo toca clientes sin `baja_at` — y no importa nada de `app/`, para que
la migracion no se rompa el dia que el servicio cambie.
"""
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ba7a0c1e3009'
down_revision = 'acad3a5f07e1'
branch_labels = None
depends_on = None


COLUMNAS = [
    sa.Column('baja_at', sa.DateTime(), nullable=True),
    sa.Column('baja_motivo', sa.String(length=255), nullable=True),
    sa.Column('baja_por_id', sa.Integer(), nullable=True),
]

# Indice porque las listas de cobro preguntan "¿esta de baja?" por cada cliente comprado.
INDICE = 'ix_clients_baja_at'
FK = 'fk_clients_baja_por_id'

# Lo que escribia la accion vieja, y el comentario que dejaba en el hilo del cliente (de ahi se
# sacan la fecha y el autor, que la agenda no guardaba).
PREFIJO = 'Baja:'
COMENTARIO = 'Cliente dado de baja por %'


def _es_sqlite():
    return op.get_bind().dialect.name == 'sqlite'


def recuperar_bajas_viejas(bind):
    """Marca como dados de baja a los clientes que se dieron de baja con la accion vieja.

    El criterio es el que dejaba esa accion: una agenda del cliente con `seguimiento_sub` que
    empieza con 'Baja:'. Si el cliente tiene varias, manda la ultima que se toco. La fecha y quien
    la dio salen del comentario «Cliente dado de baja por …» del hilo del cliente; sin comentario,
    la fecha es la ultima modificacion de la agenda.

    Se saltea al cliente que PAGO despues de esa fecha: volvio a pagar, asi que en los hechos no se
    fue, y marcarlo lo sacaria de la cola de cobro con una deuda viva. Y a la agenda cuyo
    seguimiento se volvio a programar despues de la baja ya no la encuentra: su `seguimiento_sub`
    dice otra cosa, y es un cliente que alguien sigue trabajando.

    Devuelve (marcados, salteados_por_pago).
    """
    agendas = sa.table('appointments', sa.column('id'), sa.column('client_id'),
                       sa.column('seguimiento_sub'), sa.column('updated_at'))
    clientes = sa.table('clients', sa.column('id'), sa.column('baja_at'),
                        sa.column('baja_motivo'), sa.column('baja_por_id'))
    comentarios = sa.table('client_comments', sa.column('client_id'), sa.column('author_id'),
                           sa.column('text'), sa.column('created_at'))
    inscripciones = sa.table('enrollments', sa.column('id'), sa.column('client_id'))
    pagos = sa.table('payments', sa.column('enrollment_id'), sa.column('date'),
                     sa.column('status'))

    filas = bind.execute(
        sa.select(agendas.c.id, agendas.c.client_id, agendas.c.seguimiento_sub,
                  agendas.c.updated_at)
        .where(agendas.c.seguimiento_sub.like(f'{PREFIJO}%'), agendas.c.client_id.isnot(None))
        .order_by(agendas.c.updated_at, agendas.c.id)
    ).fetchall()
    ultima = {}
    for fila in filas:
        ultima[fila.client_id] = fila   # el orden ascendente deja la mas reciente al final

    marcados, salteados = 0, 0
    for client_id, fila in ultima.items():
        ya = bind.execute(sa.select(clientes.c.baja_at).where(clientes.c.id == client_id)).first()
        if ya is None or ya.baja_at is not None:
            continue

        comentario = bind.execute(
            sa.select(comentarios.c.author_id, comentarios.c.created_at)
            .where(comentarios.c.client_id == client_id, comentarios.c.text.like(COMENTARIO))
            .order_by(comentarios.c.created_at.desc())
            .limit(1)
        ).first()
        fecha = (comentario.created_at if comentario and comentario.created_at
                 else fila.updated_at) or datetime.utcnow()

        pago_posterior = bind.execute(
            sa.select(pagos.c.enrollment_id)
            .select_from(pagos.join(inscripciones, pagos.c.enrollment_id == inscripciones.c.id))
            .where(inscripciones.c.client_id == client_id, pagos.c.status == 'completed',
                   pagos.c.date > fecha)
            .limit(1)
        ).first()
        if pago_posterior:
            salteados += 1
            continue

        motivo = (fila.seguimiento_sub or '')[len(PREFIJO):].strip()[:255] or None
        bind.execute(
            clientes.update()
            .where(clientes.c.id == client_id, clientes.c.baja_at.is_(None))
            .values(baja_at=fecha, baja_motivo=motivo,
                    baja_por_id=comentario.author_id if comentario else None))
        marcados += 1
    return marcados, salteados


def upgrade():
    if _es_sqlite():
        # SQLite (el entorno local) no sabe agregar una clave foranea con ALTER y recrear
        # `clients` —la tabla a la que apunta media base— es justo lo que no hay que hacer en una
        # migracion. Se agregan las columnas sueltas y se saltea la clave foranea: SQLite no las
        # aplica salvo que se enciendan a mano, asi que no cambia el comportamiento. En Postgres,
        # que es produccion, el ALTER es directo y va todo.
        #
        # Idempotente a proposito: SQLite no hace DDL transaccional, asi que un intento fallido
        # deja las columnas puestas y la version sin avanzar (mismo criterio que e7a1c4b90d33).
        inspector = sa.inspect(op.get_bind())
        ya_estan = {c['name'] for c in inspector.get_columns('clients')}
        for columna in COLUMNAS:
            if columna.name not in ya_estan:
                op.add_column('clients', columna)
        indices = {i['name'] for i in inspector.get_indexes('clients')}
        if INDICE not in indices:
            op.create_index(INDICE, 'clients', ['baja_at'], unique=False)
    else:
        with op.batch_alter_table('clients', schema=None) as batch_op:
            for columna in COLUMNAS:
                batch_op.add_column(columna)
            batch_op.create_index(INDICE, ['baja_at'], unique=False)
            batch_op.create_foreign_key(FK, 'users', ['baja_por_id'], ['id'])

    recuperar_bajas_viejas(op.get_bind())


def downgrade():
    if _es_sqlite():
        op.drop_index(INDICE, table_name='clients')
        for columna in reversed(COLUMNAS):
            op.drop_column('clients', columna.name)
        return

    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.drop_constraint(FK, type_='foreignkey')
        batch_op.drop_index(INDICE)
        for columna in reversed(COLUMNAS):
            batch_op.drop_column(columna.name)
