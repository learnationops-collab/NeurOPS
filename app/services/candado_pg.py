"""Que una tarea de fondo corra en un solo proceso aunque gunicorn levante varios workers.

Cada worker arranca su scheduler, pero antes de cada vuelta pregunta `soy_lider(clave)`. El primero que
toma el candado de Postgres (`pg_try_advisory_lock`) lo retiene en una conexión propia mientras viva; los
demás no hacen nada. Si el líder muere o se cae su conexión, Postgres suelta el candado y otro worker lo
toma en su próxima vuelta.
"""
import logging

from sqlalchemy import text

from app import db

logger = logging.getLogger(__name__)

# clave -> conexión que retiene el candado en este proceso
_retenidos = {}


def soy_lider(clave):
    if db.engine.dialect.name != 'postgresql':
        return True
    conexion = _retenidos.get(clave)
    if conexion is not None:
        try:
            conexion.execute(text('SELECT 1'))
            return True
        except Exception as e:
            logger.error(f'[CANDADO] Se perdió la conexión del candado {clave}: {e}')
            _retenidos.pop(clave, None)
            try:
                conexion.close()
            except Exception as e2:
                logger.error(f'[CANDADO] No se pudo cerrar la conexión caída: {e2}')
    conexion = db.engine.connect()
    tengo = conexion.execute(text('SELECT pg_try_advisory_lock(:k)'), {'k': clave}).scalar()
    conexion.commit()
    if tengo:
        _retenidos[clave] = conexion
        return True
    conexion.close()
    return False
