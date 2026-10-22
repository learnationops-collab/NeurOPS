"""Agrupar y medir: lo que en la Academia hace el Board para un plan (`TablePlan::measure`), con la misma salida.

  Sin agrupar (kpi):  {"total", "value", "warnings", "porcentaje"?}
  Agrupando (cross):  {"total", "rows": [{"k", "n", "m"}], "others", "group": {"kind"}, "warnings"}

`n` es la métrica del grupo y `m` cuántas filas tiene. Las fechas se agrupan por mes; lo demás, por valor
exacto, los 12 grupos más grandes. Los avisos y sus textos son los de la Academia (BoardQuery::warnings).
"""
import math

from sqlalchemy import String, case, cast, func, select

from app.services.tablas.condiciones import coerce

TOP_ROWS = 12
SMALL_SAMPLE = 30
Z = 1.96


def number(n):
    """Como BoardCatalog::number de la Academia: 1.234 o 12,50."""
    if n is None:
        return '—'
    n = float(n)
    entero = n == math.floor(n)
    texto = f'{n:,.0f}' if entero else f'{n:,.2f}'
    return texto.replace(',', 'X').replace('.', ',').replace('X', '.')


def wilson(p, n):
    """Intervalo de Wilson al 95 % de una proporción p con n casos: (desde, hasta)."""
    if n <= 0:
        return 0.0, 1.0
    den = 1 + Z * Z / n
    center = (p + Z * Z / (2 * n)) / den
    half = Z * math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)) / den
    return max(0.0, center - half), min(1.0, center + half)


def warnings(rows, size_key, pct):
    groups = [r for r in rows if (r.get(size_key) or 0) > 0]
    out = []
    small = [r for r in groups if r[size_key] < SMALL_SAMPLE]
    if small and len(groups) > 1:
        names = [r['k'] if r['k'] is not None else '(vacío)' for r in small[:3]]
        extra = f' y {len(small) - 3} más' if len(small) > 3 else ''
        out.append(f'Muestra chica (menos de {SMALL_SAMPLE}): {", ".join(names)}{extra}.')
    if pct and len(groups) >= 2:
        ordered = sorted(groups, key=lambda r: r.get('n') or 0, reverse=True)
        hi, lo = ordered[0], ordered[-1]
        a, b = wilson((hi['n'] or 0) / 100, hi[size_key]), wilson((lo['n'] or 0) / 100, lo[size_key])
        if a[0] <= b[1]:
            out.append('La diferencia entre {} ({} %, entre {} y {}) y {} ({} %, entre {} y {}) puede ser azar.'.format(
                hi['k'] if hi['k'] is not None else '(vacío)', number(hi['n']), number(round(a[0] * 100, 1)),
                number(round(a[1] * 100, 1)), lo['k'] if lo['k'] is not None else '(vacío)', number(lo['n']),
                number(round(b[0] * 100, 1)), number(round(b[1] * 100, 1))))
    return out


def _month(expr, dialect):
    if dialect == 'postgresql':
        return func.to_char(func.date_trunc('month', expr), 'YYYY-MM')
    return func.strftime('%Y-%m', expr)


def _metric(campo, medir):
    """Expresión de la métrica sobre las filas del grupo."""
    metric = medir['metrica'] if medir else 'count'
    if metric == 'count' or not campo:
        return func.count()
    if metric == 'pct':
        target = coerce(medir['valor'], campo.kind)
        expr = campo.expr if target is not None else cast(campo.expr, String)
        target = target if target is not None else medir['valor']
        return 100 * func.avg(case((expr == target, 1), else_=0))
    return {'sum': func.sum, 'avg': func.avg, 'min': func.min, 'max': func.max}[metric](campo.expr)


def statements(fuente, where, plan, dialect):
    """Las consultas de la medición, para correrlas en la misma transacción que las filas."""
    medir = plan['medir']
    dato = fuente.fields.get(medir['dato']) if medir and medir['dato'] else None
    total = select(func.count()).select_from(fuente.table).where(where)
    if not plan['agrupar_por']:
        if medir and medir['metrica'] == 'pct':
            # Sin agrupar, "porcentaje" es cuántos tienen ese valor sobre el total (como la Academia).
            target = coerce(medir['valor'], dato.kind)
            expr, target = (dato.expr, target) if target is not None else (cast(dato.expr, String), medir['valor'])
            value = select(func.count()).select_from(fuente.table).where(where, expr == target)
        elif medir and medir['metrica'] != 'count':
            value = select(_metric(dato, medir)).select_from(fuente.table).where(where)
        else:
            value = None
        return [total] + ([value] if value is not None else [])

    campo = fuente.fields[plan['agrupar_por']]
    is_date = campo.kind in ('date', 'instant')
    k = (_month(campo.expr, dialect) if is_date else campo.expr).label('k')
    n = _metric(dato, medir).label('n')
    m = func.count().label('m')
    grouped = select(k, n, m).select_from(fuente.table).where(where).group_by(k)
    grouped = grouped.order_by(k.desc().nulls_last()) if is_date else grouped.order_by(n.desc().nulls_last(), m.desc())
    return [total, grouped.limit(TOP_ROWS)]


def _num(v):
    return None if v is None else round(float(v), 2)


def result(fuente, plan, results):
    """La medición armada desde lo que devolvieron `statements`."""
    total = int(results[0][0][0])
    medir = plan['medir']
    pct = bool(medir) and medir['metrica'] == 'pct'
    if not plan['agrupar_por']:
        out = {'total': total}
        if len(results) > 1:
            out['value'] = _num(results[1][0][0])
        else:
            out['value'] = total
        out['warnings'] = ([f'Muestra chica: son {total}. Un cambio de pocos mueve mucho el número.']
                           if 0 < total < SMALL_SAMPLE else [])
        if pct and total > 0:
            out['porcentaje'] = round(100 * (out['value'] or 0) / total, 1)
        return out

    is_date = fuente.fields[plan['agrupar_por']].kind in ('date', 'instant')
    counting = not medir or medir['metrica'] == 'count'
    rows = [{'k': None if r.k is None else str(r.k), 'n': int(r.n) if counting else _num(r.n), 'm': int(r.m)}
            for r in results[1]]
    if is_date:
        rows.sort(key=lambda r: (r['k'] is None, r['k'] or ''))  # los últimos 12 meses, en orden
    return {'total': total, 'rows': rows, 'others': total - sum(r['m'] for r in rows),
            'group': {'kind': 'date', 'bucket': 'month'} if is_date else {'kind': 'value'},
            'warnings': warnings(rows, 'm', pct)}
