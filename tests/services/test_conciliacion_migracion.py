"""La migración de la conciliación de pasarelas (09/10/2026): crea las tres tablas y es idempotente.

Railway corre `flask db upgrade` al desplegar main; en una base que ya tiene las tablas (local o
staging, que vienen de develop) tiene que pasar sin hacer nada.
"""
import importlib.util
from pathlib import Path

import sqlalchemy as sa

MIGRACION = (Path(__file__).resolve().parents[2] / 'migrations' / 'versions'
             / '6f248427caf5_conciliacion_pasarelas.py')
TABLAS = {'conciliacion_cargas', 'conciliacion_movimientos', 'conciliacion_revisiones'}


def _migrar(conexion):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    spec = importlib.util.spec_from_file_location('migracion_conciliacion', MIGRACION)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    # Colgada de la cabeza de main, la de `transferido_a`.
    assert (modulo.revision, modulo.down_revision) == ('6f248427caf5', '132b9589504a')
    with Operations.context(MigrationContext.configure(conexion)):
        modulo.upgrade()


def test_la_migracion_crea_las_tres_tablas_y_es_idempotente():
    motor = sa.create_engine('sqlite://')
    with motor.begin() as conexion:
        conexion.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        _migrar(conexion)
        conexion.execute(sa.text(
            "INSERT INTO conciliacion_cargas (pasarela, archivo, subido_at) VALUES ('stripe', 'a.csv', '2026-10-09')"))
        _migrar(conexion)   # la segunda no hace nada: las tablas ya están y lo cargado queda

        tablas = set(sa.inspect(conexion).get_table_names())
        cargas = conexion.execute(sa.text('SELECT pasarela, filas, nuevas FROM conciliacion_cargas')).all()

    assert TABLAS <= tablas
    assert [tuple(c) for c in cargas] == [('stripe', 0, 0)]


def test_la_clave_natural_de_un_movimiento_no_se_repite():
    motor = sa.create_engine('sqlite://')
    with motor.begin() as conexion:
        conexion.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        _migrar(conexion)
        conexion.execute(sa.text(
            "INSERT INTO conciliacion_cargas (id, pasarela, subido_at) VALUES (1, 'stripe', '2026-10-09')"))
        fila = ("INSERT INTO conciliacion_movimientos (carga_id, pasarela, fecha, bruto, clave) "
                "VALUES (1, 'stripe', '2026-09-27 20:10:31', 20, 'stripe|2026-09-27T20:10:31|a@b.com|20.00')")
        conexion.execute(sa.text(fila))
        try:
            conexion.execute(sa.text(fila))
            repetida = True
        except sa.exc.IntegrityError:
            repetida = False

    assert repetida is False
