"""Corre una definición del motor y devuelve el paquete del contrato entre sistemas.

Definición:
  {"source": "appointments", "conditions": {...}, "fields": ["f.status", "p.closer_id.username"],
   "sort": "f.start_time", "dir": "desc", "limit": 100, "cursor": null}

Respuesta:
  {"rows": [{"key", "label", <campo>: valor}], "columns": [{"key", "label", "kind"}], "method",
   "size": "small|large|heavy", "total", "next", "as_of"}

Todo es una sola consulta de SQLAlchemy Core: nombres de tabla y columna salen de los modelos y los
valores van como parámetros. Corre en una transacción de solo lectura con tiempo máximo; si existe
DATABASE_READONLY_URL (un rol con solo SELECT), usa esa conexión.
"""
import logging
import os
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import OperationalError

from app import db
from app.services.tablas import catalogo
from app.services.tablas.condiciones import CondicionError, compile_tree

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 100
MAX_LIMIT = 500
MAX_FIELDS = 40
DEFAULT_FIELDS = 6
# Magnitud del resultado, como en la Academia: hasta 500 va entero, hasta 20.000 por páginas.
SMALL_ROWS = 500
LARGE_ROWS = 20000
TIMEOUT_MS = int(os.environ.get('TABLAS_TIMEOUT_MS', 5000))

_readonly_engine = None


class MotorError(CondicionError):
    """Una definición que no se puede correr: vuelve como 400 con este texto."""


def _engine():
    global _readonly_engine
    url = os.environ.get('DATABASE_READONLY_URL')
    if not url:
        return db.engine
    if _readonly_engine is None:
        _readonly_engine = create_engine(url, pool_size=2, max_overflow=2, pool_pre_ping=True)
    return _readonly_engine


def _value(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    return v


def _int(value, default, low, high):
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, n))


def _execute(statements):
    """Corre las consultas en una transacción de solo lectura y con tiempo máximo. Devuelve sus filas."""
    engine = _engine()
    with engine.connect() as conn:
        try:
            if engine.dialect.name == 'postgresql':
                conn.execute(text('SET TRANSACTION READ ONLY'))
                conn.execute(text(f'SET LOCAL statement_timeout = {TIMEOUT_MS}'))
            return [conn.execute(s).all() for s in statements]
        except OperationalError as e:
            if 'statement timeout' in str(e) or 'canceling statement' in str(e):
                raise MotorError(f'La consulta tardó más de {TIMEOUT_MS // 1000} s. '
                                 'Agregá condiciones o pedí menos campos.') from e
            raise
        finally:
            conn.rollback()


def _size(total):
    return 'small' if total <= SMALL_ROWS else 'large' if total <= LARGE_ROWS else 'heavy'


def describe(user, key=None):
    """Sin clave: las fuentes. Con clave: los campos de esa fuente."""
    if key is None:
        return [{'key': f.key, 'label': f.label} for f in catalogo.sources(user).values()]
    fuente = catalogo.source(user, key)
    if fuente is None:
        raise MotorError(f'No existe la fuente «{key}» o no tenés acceso.')
    fields = [{'key': c.key, 'label': c.label, 'group': c.group, 'kind': c.kind} for c in fuente.fields.values()]
    return {'key': fuente.key, 'label': fuente.label, 'fields': fields}


def run(user, definition):
    if not isinstance(definition, dict):
        raise MotorError('La definición tiene que ser un objeto.')
    fuente = catalogo.source(user, definition.get('source'))
    if fuente is None:
        raise MotorError(f'No existe la fuente «{definition.get("source")}» o no tenés acceso.')

    keys = definition.get('fields') or [k for k in fuente.fields if k.startswith('f.')][:DEFAULT_FIELDS]
    if not isinstance(keys, list) or len(keys) > MAX_FIELDS:
        raise MotorError(f'fields tiene que ser una lista de hasta {MAX_FIELDS} campos.')
    unknown = [k for k in keys if k not in fuente.fields]
    if unknown:
        raise MotorError(f'Campos que no existen o que no podés ver: {", ".join(map(str, unknown))}.')
    campos = [fuente.fields[k] for k in keys]

    where = compile_tree(definition.get('conditions'), fuente.fields)
    limit = _int(definition.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
    offset = _int(definition.get('cursor'), 0, 0, LARGE_ROWS)

    stmt = (select(fuente.pk.label('__key'), fuente.label_expr.label('__label'),
                   *[c.expr.label(f'c{i}') for i, c in enumerate(campos)])
            .select_from(fuente.table).where(where))
    sort = definition.get('sort')
    if sort:
        if sort not in fuente.fields:
            raise MotorError(f'No se puede ordenar por «{sort}»: no existe o no podés verlo.')
        expr = fuente.fields[sort].expr
        stmt = stmt.order_by((expr.desc() if definition.get('dir') == 'desc' else expr.asc()).nulls_last())
    stmt = stmt.order_by(fuente.pk).limit(limit).offset(offset)
    count = select(func.count()).select_from(fuente.table).where(where)

    filas, (total_row,) = _execute([stmt, count])
    total = total_row[0]
    rows = [{'key': _value(f[0]), 'label': _value(f[1]), **{c.key: _value(f[i + 2]) for i, c in enumerate(campos)}}
            for f in filas]
    nxt = offset + limit
    n_cond = len((definition.get('conditions') or {}).get('items') or [])
    return {
        'rows': rows,
        'columns': [{'key': c.key, 'label': c.label, 'kind': c.kind} for c in campos],
        'method': (f'Filas de {fuente.key} que cumplen {n_cond} condición(es) de primer nivel'
                   f'{f", ordenadas por {sort}" if sort else ""}; total con COUNT exacto.'),
        'size': _size(total),
        'total': total,
        'next': str(nxt) if nxt < min(total, LARGE_ROWS) else None,
        'as_of': datetime.utcnow().isoformat(timespec='seconds') + 'Z',
    }
