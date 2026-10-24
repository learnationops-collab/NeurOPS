"""El plan por claves de dato: el mismo formato que `TablePlan` de la Academia (ADR-159), el que arma Learnito
y el que viaja entre sistemas por `agent/ask`.

  {
    "fuente": clave de la fuente,
    "condiciones": {"match": "all"|"any", "items": [{"field": clave, "op": ..., "value": ..., "negate": bool}
                                                    | {"concepto": clave del diccionario, "negate": bool}]},
    "columnas": [clave, ...],
    "orden": {"dato": clave, "dir": "asc"|"desc"},
    "agrupar_por": clave,                                                    (opcional)
    "periodo": day|week|month|quarter|year,       (opcional: cómo se agrupan las fechas; por defecto, month)
    "medir": {"metrica": count|avg|sum|min|max|pct, "dato": clave, "valor": texto}  (opcional)
  }
"""
from app.services.tablas import diccionario
from app.services.tablas.condiciones import OPS

METRICS = ('count', 'avg', 'sum', 'min', 'max', 'pct')
# Cómo se agrupan las fechas. La Academia, sin `periodo`, elige según el rango; Work agrupa por mes.
PERIODS = ('day', 'week', 'month', 'quarter', 'year')
DEFAULT_PERIOD = 'month'
NUMERIC_METRICS = ('avg', 'sum', 'min', 'max')
DEFAULT_COLUMNS = 6
MAX_COLUMNS = 40


def _concept(c, fuente_key, check, errors):
    """Un concepto del diccionario como condición: {"concepto": clave} (Learnito) o
    {"type": "concept", "concept": clave} (Tablas), como la Academia. Tiene que ser de esta fuente y sus datos
    tienen que existir en ella."""
    clave = str(c.get('concepto') or c.get('concept') or '')
    concepto = diccionario.concepto(clave)
    if concepto is None:
        errors.append(f'El concepto «{clave}» no existe. Buscalo con buscar_datos.')
        return None
    if concepto['fuente'] != fuente_key:
        errors.append(f'El concepto «{clave}» es de la fuente «{concepto["fuente"]}», no de «{fuente_key}».')
        return None
    for item in concepto.get('condicion') or []:
        check(item.get('field'), f'concepto {clave}')
    return {'type': 'concept', 'concept': clave, 'negate': bool(c.get('negate'))}


def _items(items, check, fuente_key, errors, depth=0):
    out = []
    for c in items if isinstance(items, list) else []:
        if not isinstance(c, dict):
            continue
        if 'items' in c and depth < 5:  # grupos anidados: la Academia no los usa, pero el motor los acepta
            out.append({'match': 'any' if c.get('match') == 'any' else 'all',
                        'items': _items(c.get('items'), check, fuente_key, errors, depth + 1),
                        'negate': bool(c.get('negate'))})
            continue
        if c.get('concepto') or c.get('type') == 'concept':
            item = _concept(c, fuente_key, check, errors)
            if item:
                out.append(item)
            continue
        if not c.get('field'):
            continue  # sin dato no filtra: si no, dejaba el resultado en cero (LEARNINGS #89 de la Academia)
        check(c.get('field'), 'condición')
        op = c.get('op') if c.get('op') in OPS else 'eq'
        out.append({'type': 'field', 'field': str(c.get('field') or ''), 'op': op,
                    'value': c.get('value', ''), 'negate': bool(c.get('negate'))})
    return out


def normalize(fuente, plan):
    """(plan completo, errores). Una clave que no existe en la fuente (o que quien pregunta no puede ver)
    vuelve como error, para que quien armó el plan lo corrija con la lista de campos."""
    errors = []

    def check(key, where):
        if key not in (None, '') and key not in fuente.fields:
            errors.append(f'El dato «{key}» ({where}) no existe en esta fuente.')

    cond = plan.get('condiciones') if isinstance(plan.get('condiciones'), dict) else {}
    items = _items(cond.get('items'), check, fuente.key, errors)

    columns = [str(k) for k in (plan.get('columnas') or []) if k] if isinstance(plan.get('columnas'), list) else []
    columns = list(dict.fromkeys(columns))
    if len(columns) > MAX_COLUMNS:
        errors.append(f'Hasta {MAX_COLUMNS} columnas.')
    for k in columns:
        check(k, 'columna')
    if not columns:
        columns = [k for k in fuente.fields if k.startswith('f.')][:DEFAULT_COLUMNS]

    group = plan.get('agrupar_por') or None
    check(group, 'agrupar')
    period = plan.get('periodo') if plan.get('periodo') in PERIODS else DEFAULT_PERIOD

    measure = None
    if plan.get('medir'):
        m = plan['medir'] if isinstance(plan['medir'], dict) else {}
        metric = m.get('metrica') if m.get('metrica') in METRICS else 'count'
        dato = m.get('dato') or None
        check(dato, 'medir')
        if metric != 'count' and not dato:
            errors.append(f'La métrica «{metric}» necesita un dato.')
        elif metric in NUMERIC_METRICS and dato in fuente.fields and fuente.fields[dato].kind != 'number':
            errors.append(f'La métrica «{metric}» necesita un dato numérico; «{dato}» no lo es.')
        measure = {'metrica': metric, 'dato': dato, 'valor': str(m.get('valor') or '')}

    order = None
    if isinstance(plan.get('orden'), dict) and plan['orden'].get('dato'):
        order = {'dato': str(plan['orden']['dato']), 'dir': 'desc' if plan['orden'].get('dir') == 'desc' else 'asc'}
        check(order['dato'], 'orden')

    return {
        'fuente': fuente.key,
        'condiciones': {'match': 'any' if cond.get('match') == 'any' else 'all', 'items': items},
        'columnas': columns,
        'orden': order,
        'agrupar_por': group,
        'periodo': period,
        'medir': measure,
    }, errors
