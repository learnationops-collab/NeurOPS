"""Arma el día del reporte único (el JSON de `GET /api/reporte/dia`).

Cada rol tiene su módulo (`closer`, `setter`, `triage`) con la misma forma: `fila`, `filas_rango`,
`contexto`, `auto`, `sugeridos`, `valores_de_fila`, `mano_de_fila`, `kpis_de`, `pendientes`, `numeros`,
`candidatos`, `persistir`, `discord`, `MANO`, `CORREGIBLES`, `KPIS`, `HIST`.
"""
from app.reporte_dia import closer, setter, triage
from app.reporte_dia.comun import (cierra_en, cierre_de, datos, ultimo_dia_cerrable, victoria_de)
from app.reporte_dia.estado import estado_de, faltan, semana
from app.reporte_dia.promedios import kpis as kpis_del_dia
from app.services.user_time_service import hoy_del_usuario

MODULOS = {'closer': closer, 'setter': setter, 'triage': triage}


def modulo(rol):
    return MODULOS[rol]


def _congelado(user, dia, close, row):
    """¿Los números del día salen de la fila guardada? Sí si ya se cerró (o es del flujo viejo)."""
    if row is None:
        return False
    if close is None:
        return dia <= ultimo_dia_cerrable(user)
    return bool(close.closed_at)


def valores(user, dia, rol, close, ctx, recalcular=False):
    """(vals, mano, auto): los números del día con correcciones y datos a mano aplicados.

    `recalcular` (al guardar) vuelve a contar un día cerrado, salvo que sea del flujo viejo (`legado`):
    esos números los cargó la persona y el conteo de hoy no los conoce."""
    m = modulo(rol)
    d = datos(close)
    row = m.fila(user, dia)
    congelado = row is not None and (d.get('legado') or (not recalcular and _congelado(user, dia, close, row)))
    base = m.valores_de_fila(row) if congelado else m.auto(user, dia, ctx)
    automaticos = dict(base)
    for clave, v in d['correcciones'].items():
        if clave in m.CORREGIBLES and v is not None:
            base[clave] = v
    mano_cargada = dict(d['mano'])
    if close is None and congelado:
        mano_cargada = {**m.mano_de_fila(row), **mano_cargada}
    faltantes = [c for c, _, _ in m.MANO if c not in mano_cargada]
    sug = m.sugeridos(user, dia, ctx, base) if faltantes and not congelado else {}
    mano = []
    for clave, grupo, campo in m.MANO:
        sugerido = False
        if clave in mano_cargada:
            valor = mano_cargada[clave]
        elif clave in sug:
            valor, sugerido = sug[clave], True
        else:
            valor = base.get(clave) if congelado else None
        base[clave] = valor
        mano.append({'clave': clave, 'grupo': grupo, 'campo': campo, 'valor': valor, 'sugerido': sugerido})
    return base, mano, automaticos


def calcular(user, dia, rol, close=None, ctx=None, recalcular=False):
    """Todo lo que depende de los datos del día: {ctx, vals, mano, auto, pendientes, faltan}."""
    m = modulo(rol)
    ctx = ctx if ctx is not None else m.contexto(user, dia)
    vals, mano, automaticos = valores(user, dia, rol, close, ctx, recalcular)
    pend = m.pendientes(user, dia, ctx, vals)
    pend['mano'] = mano
    return {'ctx': ctx, 'vals': vals, 'mano': mano, 'auto': automaticos, 'pendientes': pend,
            'faltan': faltan(victoria_de(close), close, pend)}


def _manana(close):
    return {'mejor': (close.tomorrow if close else '') or '', 'traba': (close.platform_issue if close else '') or '',
            'flujo': (close.workflow if close else '') or ''}


def armar(user, dia, rol, calc=None):
    m = modulo(rol)
    close = cierre_de(user, dia)
    calc = calc or calcular(user, dia, rol, close)
    hoy = hoy_del_usuario(user)
    row = m.fila(user, dia)
    kpis = kpis_del_dia(user, rol, m, dia, calc['vals'])
    return {
        'fecha': dia.isoformat(), 'hoy': hoy.isoformat(), 'rol': rol,
        'estado': estado_de(user, dia, close, row),
        'cierra_en': cierra_en(user, dia),
        'no_laborable': bool(close.is_non_working_day) if close else bool(getattr(row, 'is_non_working_day', False)),
        'faltan': calc['faltan'],
        'victoria': victoria_de(close),
        'manana': _manana(close),
        'candidatos': m.candidatos(user, calc['ctx']),
        'pendientes': calc['pendientes'],
        'numeros': m.numeros(user, dia, calc['ctx'], calc['vals'], kpis),
        'semana': semana(user, m, hoy),
    }
