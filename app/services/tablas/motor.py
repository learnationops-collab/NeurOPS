"""Corre un plan por claves (plan.py) y devuelve el paquete de agentes pares, con el mismo formato que la
Academia en /api/v1/agent/ask (su API.md §2.14):

  {"success", "metodo", "magnitud": small|large|heavy, "total", "pagina", "siguiente",
   "columnas": [{"clave", "nombre", "tipo"}], "filas": [{"clave", "fila", "persona", <clave>: valor}],
   "medicion"?, "nota"?, "as_of"}

Todo sale de SQLAlchemy Core: nombres de tabla y columna de los modelos, valores como parámetros. Las
consultas de un pedido corren juntas en una transacción de solo lectura con tiempo máximo; si existe
DATABASE_READONLY_URL (un rol con solo SELECT), usan esa conexión.
"""
import json
import logging
import os
import unicodedata
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import and_, create_engine, func, literal, select, text
from sqlalchemy.exc import OperationalError

from app import db
from app.services.tablas import alcance, catalogo, diccionario, medir
from app.services.tablas.condiciones import CondicionError, compile_tree
from app.services.tablas.plan import normalize

logger = logging.getLogger(__name__)

# Magnitud del resultado, como la Academia: hasta 500 filas van enteras, hasta 20.000 por páginas de 500.
PAGE = 500
LARGE = 20000
SAMPLE = 50
TIMEOUT_MS = int(os.environ.get('TABLAS_TIMEOUT_MS', 5000))

_readonly_engine = None


class MotorError(CondicionError):
    """Un plan que no se puede correr. `errores` va en la respuesta (422), como en la Academia."""

    def __init__(self, errores):
        self.errores = errores if isinstance(errores, list) else [errores]
        super().__init__(' '.join(self.errores))


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
                                 'Filtrá con condiciones o pedí menos columnas.') from e
            raise
        finally:
            conn.rollback()


COMPARACIONES = {
    'eq': 'es igual a', 'neq': 'no es igual a', 'contains': 'contiene', 'in': 'es uno de (lista o separados por coma)',
    'gt': 'mayor que', 'gte': 'mayor o igual que', 'lt': 'menor que', 'lte': 'menor o igual que',
    'empty': 'está vacío', 'notempty': 'tiene un valor', 'within_days': 'en los últimos N días',
    'older_days': 'hace más de N días', 'next_days': 'en los próximos N días',
}


def _plano(texto):
    return ''.join(c for c in unicodedata.normalize('NFKD', texto or '') if not unicodedata.combining(c)).casefold()


def catalog(user, fuente=True, buscar=None):
    """El catálogo, con el formato del de la Academia (agent/ask con `catalogo`):
      - `fuente=True`: [{clave, nombre, categoria, descripcion}];
      - `fuente="sales"`: {fuente, datos: [{clave, nombre, grupo, tipo, detalle}], comparaciones}; `buscar` acota.
    Los tipos son date | instant | number | text: un sí/no va como texto (true/false)."""
    if fuente is True:
        return [{'clave': f.key, 'nombre': f.label, 'categoria': f.category, 'descripcion': f.description}
                for f in catalogo.sources(user).values()]
    src = catalogo.source(user, fuente)
    if src is None:
        raise MotorError(f'La fuente «{fuente}» no existe. Pedí la lista de fuentes.')
    datos = [{'clave': c.key, 'nombre': c.label, 'grupo': c.group, 'tipo': 'text' if c.kind == 'bool' else c.kind,
              'detalle': c.detail + (' (true o false)' if c.kind == 'bool' else '')} for c in src.fields.values()]
    if buscar:
        q = _plano(str(buscar))
        datos = [d for d in datos if q in _plano(f"{d['clave']} {d['nombre']} {d['grupo']} {d['detalle']}")]
    head = {'clave': src.key, 'nombre': src.label, 'categoria': src.category, 'descripcion': src.description}
    dicc = diccionario.tabla(src.key) or {}
    conceptos = [{'clave': c['clave'], 'nombre': c['nombre'], 'significado': c.get('significado', '')}
                 for c in dicc.get('conceptos') or [] if _concepto_visible(c, src)]
    out = {'fuente': head, 'datos': datos, 'comparaciones': COMPARACIONES,
           'que_es': dicc.get('significado'), 'fila': dicc.get('fila'), 'fecha': dicc.get('fecha'),
           'conceptos': conceptos, 'trampas': dicc.get('notas')}
    return {k: v for k, v in out.items() if v not in (None, [])}


def _concepto_visible(concepto, src):
    """Un concepto se ofrece solo si quien mira ve todos sus datos (un monto oculto lo dejaría sin filas)."""
    return all(c.get('field') in src.fields for c in concepto.get('condicion') or [])


def prepare(user, raw):
    """(fuente, plan normalizado). Un plan con errores levanta MotorError con la lista."""
    if not isinstance(raw, dict):
        raise MotorError('El plan tiene que ser un objeto.')
    fuente = catalogo.source(user, raw.get('fuente'))
    if fuente is None:
        raise MotorError(f'La fuente «{raw.get("fuente")}» no existe. Pedí la lista de fuentes.')
    plan, errores = normalize(fuente, raw)
    if errores:
        raise MotorError(errores)
    return fuente, plan


def _rows_statement(fuente, plan, where, limit, offset):
    campos = [fuente.fields[k] for k in plan['columnas']]
    has_person = fuente.person_expr is not None
    person = fuente.person_expr if has_person else literal(None)
    alumno = catalogo.alumno_expr(fuente.person_expr) if has_person else literal(None)
    stmt = (select(fuente.pk.label('__key'), fuente.label_expr.label('__label'), person.label('__person'),
                   alumno.label('__alumno'), *[c.expr.label(f'c{i}') for i, c in enumerate(campos)])
            .select_from(fuente.table).where(where))
    if plan['orden']:
        expr = fuente.fields[plan['orden']['dato']].expr
        stmt = stmt.order_by((expr.desc() if plan['orden']['dir'] == 'desc' else expr.asc()).nulls_last())
    return stmt.order_by(fuente.pk).limit(limit).offset(offset), campos


def _alumno_id(v):
    # La identidad se guarda como texto; la Academia manda su alumno_id como número.
    return int(v) if isinstance(v, str) and v.isdigit() else v


def _row(r, campos):
    """`persona` es el people.uuid; `alumno_id`, su id en la Academia (el mismo `alumno_id` de las filas de allá)."""
    return {'clave': _value(r[0]), 'fila': _value(r[1]), 'persona': _value(r[2]), 'alumno_id': _alumno_id(r[3]),
            **{c.key: _value(r[i + 4]) for i, c in enumerate(campos)}}


def columns(fuente, plan):
    return [{'clave': k, 'nombre': fuente.fields[k].label,
             'tipo': 'text' if fuente.fields[k].kind == 'bool' else fuente.fields[k].kind} for k in plan['columnas']]


def run(user, raw, pagina=1, por_pagina=PAGE, con_medicion=True):
    """El paquete completo de un plan: una página de filas, el total y, si agrupa o mide, la medición."""
    fuente, plan = prepare(user, raw)
    where = compile_tree(plan['condiciones'], fuente.fields)
    # Fuera de la dirección, las filas son las suyas y la medición que agrupa es del equipo (alcance.py).
    suyas = alcance.filtro(user, fuente)
    medicion_propia = suyas is not None and alcance.propia(fuente, plan)
    filas_where = where if suyas is None else and_(where, suyas)
    pagina = max(1, int(pagina or 1))
    rows_stmt, campos = _rows_statement(fuente, plan, filas_where, por_pagina, (pagina - 1) * por_pagina)
    count = select(func.count()).select_from(fuente.table).where(filas_where)
    measured = con_medicion and bool(plan['agrupar_por'] or plan['medir'])
    measure_stmts = (medir.statements(fuente, filas_where if medicion_propia else where, plan, _engine().dialect.name)
                     if measured else [])

    results = _execute([count, rows_stmt, *measure_stmts])
    total = int(results[0][0][0])
    size = 'small' if total <= PAGE else 'large' if total <= LARGE else 'heavy'
    out = {
        'success': True,
        'metodo': 'Motor de tablas de Work, sin IA. Plan: ' + json.dumps(plan, ensure_ascii=False, default=str),
        'magnitud': size,
        'total': total,
        'pagina': None if size == 'heavy' else pagina,
        'siguiente': pagina + 1 if size == 'large' and pagina * por_pagina < total else None,
        'columnas': columns(fuente, plan),
        'filas': [] if size == 'heavy' else [_row(r, campos) for r in results[1]],
        'medicion': medir.result(fuente, plan, results[2:]) if measured else None,
        'nota': (f'Más de {LARGE} filas: no se listan. Agrupá (agrupar_por) o filtrá con condiciones.'
                 if size == 'heavy' else None),
        'alcance': alcance.nota(medicion_propia) if suyas is not None else None,
        'as_of': datetime.utcnow().isoformat(timespec='seconds') + 'Z',
    }
    return {k: v for k, v in out.items() if v is not None}
