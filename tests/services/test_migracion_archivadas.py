"""La migración que pasa a 'Archivada sin reporte' las agendas que el barrido dejó como 'Lead
Perdido' (10/10/2026).

Solo toca las que siguen como las dejó el barrido —'Lead Perdido' con la firma en las notas—, es
idempotente y el downgrade las devuelve. Se corre sobre SQLite con la tabla mínima, como la de la
conciliación.
"""
import importlib.util
from pathlib import Path

import sqlalchemy as sa

MIGRACION = (Path(__file__).resolve().parents[2] / 'migrations' / 'versions'
             / 'a3f6c9e2b815_agendas_archivadas_sin_reporte.py')
FIRMA = '[Sistema] Archivado automáticamente: sin confirmar ni procesar tras 30+ días desde su fecha.'

FILAS = [
    # (id, closer_result, closer_notes)
    (1, 'Lead Perdido', FIRMA),                                  # la dejó el barrido: pasa
    (2, 'Lead Perdido', f'Le escribí dos veces\n{FIRMA}'),       # con notas de antes: pasa
    (3, 'Lead Perdido', 'No le interesa, lo descarto'),          # la descartó un closer: queda
    (4, 'Lead Perdido', None),                                   # sin notas: queda
    (5, 'Show up', f'{FIRMA}\n[Corrección manual] pagó'),        # reportada después: queda
    (6, 'Pendiente', None),
]


def _modulo():
    spec = importlib.util.spec_from_file_location('migracion_archivadas', MIGRACION)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    assert modulo.revision == 'a3f6c9e2b815'
    return modulo


def _correr(conexion, paso):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    with Operations.context(MigrationContext.configure(conexion)):
        getattr(_modulo(), paso)()


def _estados(conexion):
    return dict(conexion.execute(sa.text('SELECT id, closer_result FROM appointments ORDER BY id')).all())


def _base(conexion):
    conexion.execute(sa.text('CREATE TABLE appointments (id INTEGER PRIMARY KEY, '
                             'closer_result VARCHAR(100), closer_notes TEXT)'))
    for fila in FILAS:
        conexion.execute(sa.text('INSERT INTO appointments VALUES (:i, :r, :n)'),
                         {'i': fila[0], 'r': fila[1], 'n': fila[2]})


def test_pasa_solo_las_que_dejo_el_barrido_y_es_idempotente():
    motor = sa.create_engine('sqlite://')
    with motor.begin() as conexion:
        _base(conexion)
        _correr(conexion, 'upgrade')
        una_vez = _estados(conexion)
        _correr(conexion, 'upgrade')
        dos_veces = _estados(conexion)

    assert una_vez == dos_veces == {
        1: 'Archivada sin reporte', 2: 'Archivada sin reporte', 3: 'Lead Perdido',
        4: 'Lead Perdido', 5: 'Show up', 6: 'Pendiente'}


def test_el_downgrade_las_devuelve_a_lead_perdido():
    motor = sa.create_engine('sqlite://')
    with motor.begin() as conexion:
        _base(conexion)
        antes = _estados(conexion)
        _correr(conexion, 'upgrade')
        _correr(conexion, 'downgrade')

        assert _estados(conexion) == antes


def test_la_firma_es_la_que_escribe_el_barrido():
    """La migración no importa código de la app y lleva la firma escrita a mano: si el barrido la
    cambia, la migración dejaría de reconocer las suyas sin avisar."""
    from app.services.closer_agendas_service import ARCHIVADA_SIN_REPORTE, NOTA_ARCHIVADA

    modulo = _modulo()

    assert modulo.FIRMA == f'%{NOTA_ARCHIVADA}%'
    assert modulo.ARCHIVADA == ARCHIVADA_SIN_REPORTE
