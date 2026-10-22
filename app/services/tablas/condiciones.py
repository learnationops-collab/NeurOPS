"""Las condiciones del contrato con la Academia, compiladas a SQLAlchemy:

  {"match": "all"|"any", "items": [
     {"type": "field", "field": "f.status", "op": "in", "value": ["a", "b"], "negate": false},
     {"match": "any", "items": [...]}            # grupos anidados
  ]}

Operadores: eq neq contains in gt gte lt lte empty notempty within_days older_days next_days.
Un campo que no existe, o que quien mira no puede ver, no deja pasar a nadie (como en la Academia).
"""
from datetime import date, datetime, timedelta

from sqlalchemy import String, and_, cast, false, not_, or_, true

OPS = {'eq', 'neq', 'contains', 'in', 'gt', 'gte', 'lt', 'lte', 'empty', 'notempty',
       'within_days', 'older_days', 'next_days'}
MAX_ITEMS = 50


class CondicionError(ValueError):
    """Una condición mal armada: vuelve como 400 con este texto."""


def _number(value):
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _when(value, kind):
    """Fecha o instante de un texto ISO; None si no lo es."""
    if isinstance(value, (date, datetime)):
        return value
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace('Z', '+00:00'))
    except ValueError:
        return None
    return parsed.date() if kind == 'date' else parsed.replace(tzinfo=None)


def coerce(value, kind):
    """El valor en el tipo del campo, o None si no se puede comparar así."""
    if kind == 'number':
        return _number(value)
    if kind == 'bool':
        if isinstance(value, bool):
            return value
        text = str(value).strip().lower()
        return True if text in ('true', '1', 'si', 'sí') else False if text in ('false', '0', 'no') else None
    if kind in ('date', 'instant'):
        return _when(value, kind)
    return None if value is None else str(value)


def _compare(expr, kind, op, value):
    # Según el tipo del campo: número, fecha o texto. Un valor que no encaja se compara como texto.
    target = coerce(value, kind) if kind != 'bool' else None
    if target is None:
        target, expr = str(value), cast(expr, String)
    return {'gt': expr > target, 'gte': expr >= target, 'lt': expr < target, 'lte': expr <= target}[op]


def _days(value):
    n = _number(value)
    if n is None or n < 0:
        raise CondicionError('Los días tienen que ser un número positivo.')
    return timedelta(days=n)


def _now(kind):
    # Los instantes se guardan en UTC sin zona.
    return date.today() if kind == 'date' else datetime.utcnow()


def _item(campo, op, value):
    expr, kind = campo.expr, campo.kind
    if op == 'empty':
        return or_(expr.is_(None), cast(expr, String) == '') if kind == 'text' else expr.is_(None)
    if op == 'notempty':
        return and_(expr.isnot(None), cast(expr, String) != '') if kind == 'text' else expr.isnot(None)
    if op in ('within_days', 'older_days', 'next_days'):
        if kind not in ('date', 'instant'):
            raise CondicionError(f'«{campo.label}» no es una fecha.')
        now, delta = _now(kind), _days(value)
        if op == 'within_days':
            return and_(expr >= now - delta, expr <= now)
        if op == 'older_days':
            return expr < now - delta
        return and_(expr >= now, expr <= now + delta)
    if op == 'contains':
        return cast(expr, String).icontains(str(value or ''), autoescape=True)
    if op == 'in':
        values = value if isinstance(value, list) else [v.strip() for v in str(value or '').split(',') if v.strip()]
        coerced = [c for c in (coerce(v, kind) for v in values) if c is not None]
        return expr.in_(coerced) if coerced else false()
    if op in ('gt', 'gte', 'lt', 'lte'):
        return _compare(expr, kind, op, value)
    target = coerce(value, kind)
    if target is None:
        return false() if op == 'eq' else true()
    return expr == target if op == 'eq' else or_(expr != target, expr.is_(None))


def compile_tree(tree, fields, depth=0):
    """Expresión booleana del árbol de condiciones sobre los campos de la fuente."""
    if not tree:
        return true()
    if not isinstance(tree, dict) or depth > 5:
        raise CondicionError('Las condiciones tienen que ser {"match", "items"}, con hasta 5 niveles.')
    items = tree.get('items') or []
    if len(items) > MAX_ITEMS:
        raise CondicionError(f'Máximo {MAX_ITEMS} condiciones por grupo.')
    parts = []
    for it in items:
        if not isinstance(it, dict):
            raise CondicionError('Cada condición tiene que ser un objeto.')
        if 'items' in it:
            part = compile_tree(it, fields, depth + 1)
        elif it.get('type') == 'field':
            op = it.get('op')
            if op not in OPS:
                raise CondicionError(f'Operador desconocido: {op}.')
            campo = fields.get(it.get('field'))
            if campo is None:
                parts.append(false())  # ni negada deja pasar a alguien
                continue
            part = _item(campo, op, it.get('value'))
        else:
            raise CondicionError(f'Tipo de condición desconocido: {it.get("type")}.')
        parts.append(not_(part) if it.get('negate') else part)
    if not parts:
        return true()
    return or_(*parts) if tree.get('match') == 'any' else and_(*parts)
