"""El diccionario de datos de Work (docs/MODELO/TABLAS.md §Diccionario, como el de la Academia, su ADR-172): qué es
cada tabla, qué significa cada columna y cada valor, los datos calculados (`d.{clave}`, SQL sobre la fila) y los
conceptos del equipo ("venta nueva", "no show") como condiciones exactas. Vive en diccionario.json, armado desde el
código y validado contra la base; lo leen las fuentes del motor, las condiciones, el buscador (buscar.py) y
Learnito.

Mismo formato que database/data/table_dictionary.json de la Academia: por tabla `significado`, `uso`, `area`, `fila`,
`autor`, `fecha`, `palabras`, `notas`, `columnas` {col: {significado, valores: {v: {label, significado}}}},
`derivados` [{clave, nombre, significado, sql, tipo, palabras}] y `conceptos` [{clave, nombre, fuente, match, condicion,
significado, ejemplo, palabras}]. En `sql`, `{t}` es la tabla de la fila.
"""
import json
import os

_RUTA = os.path.join(os.path.dirname(__file__), 'diccionario.json')
_datos = None
_conceptos = None


def todo():
    global _datos
    if _datos is None:
        try:
            with open(_RUTA, encoding='utf-8') as f:
                _datos = json.load(f)
        except FileNotFoundError:
            _datos = {}
    return _datos


def tabla(nombre):
    return todo().get(nombre)


def columna(nombre, col):
    return ((todo().get(nombre) or {}).get('columnas') or {}).get(col)


def derivados(nombre):
    """{clave: derivado} de una tabla."""
    return {d['clave']: d for d in (todo().get(nombre) or {}).get('derivados') or []}


def conceptos():
    """{clave: concepto} de todas las tablas."""
    global _conceptos
    if _conceptos is None:
        _conceptos = {c['clave']: c for t in todo().values() for c in t.get('conceptos') or []}
    return _conceptos


def concepto(clave):
    return conceptos().get(clave)


def detalle_columna(nombre, col, limite=12):
    """El significado de una columna con sus valores ("Valores: show = Show up, …"), o None si no está explicada."""
    c = columna(nombre, col)
    if not c:
        return None
    valores = c.get('valores') or {}
    lista = ', '.join(f"{k} = {v.get('label')}" if v.get('label') and v.get('label') != k else k
                      for k, v in list(valores.items())[:limite])
    return c.get('significado', '') + (f' Valores: {lista}.' if lista else '')
