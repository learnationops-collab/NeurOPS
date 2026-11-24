"""Reporte único del triage: las agendas de hoy y las futuras (corregibles) más las recuperaciones a mano.

Cuenta con `triage_reporte_service` (el mismo prefill de `/public/triage-report/prefill`) y guarda en
`triage_daily_reports` con `triage_name = user.username`.
"""
import logging

from app import db
from app.models import TriageDailyReport
from app.reporte_dia.comun import hora_local, pct, plural
from app.services import triage_reporte_service as conteo

logger = logging.getLogger(__name__)

FUENTE = 'Salen de las agendas de Work. Si algo no coincide, tocá «Corregir».'
FUENTE_DETALLE = 'Agendas de Work'
ESTADOS = (('agendas', 'Agendas'), ('contacted', 'Contactadas'), ('confirmed', 'Confirmadas'),
           ('canceled', 'Canceladas'), ('rescheduled', 'Reagendadas'))
CORREGIBLES = tuple(f'{p}_{k}' for p in ('today', 'future') for k, _ in ESTADOS)
MANO = (('recoveries_contacted', 'Recuperaciones', 'Contactados'),
        ('recoveries_replied', 'Recuperaciones', 'Respuestas'),
        ('recoveries_scheduled', 'Recuperaciones', 'Agendas'))
KPIS = (('today_confirmed', 'Confirmadas', 'n'), ('confirm_today', 'Confirmación hoy', '%'),
        ('today_rescheduled', 'Reagendadas', 'n'), ('recoveries_scheduled', 'Recuperaciones', 'n'))
HIST = (('today_confirmed', 'Confirmadas', 'n', 'sum'), ('confirm_today', 'Confirmación', '%', 'avg'),
        ('recoveries_scheduled', 'Recuperaciones', 'n', 'sum'))
TASAS = (('confirm_today', 'Confirmación hoy'), ('confirm_future', 'Confirmación futuro'),
         ('recovery_rate', 'Conversión de recuperación'))
COMO = {
    'confirm_today': 'Agendas de hoy confirmadas ÷ agendas de hoy.',
    'confirm_future': 'Agendas para otro día creadas hoy y confirmadas ÷ esas agendas.',
    'recovery_rate': 'Recuperaciones que agendaron ÷ recuperaciones contactadas.',
    'today': 'Agendas a tu cargo cuya llamada es hoy',
    'future': 'Agendas a tu cargo creadas hoy para otro día',
}


def fila(user, dia):
    return TriageDailyReport.query.filter_by(triage_name=user.username, date=dia).first()


def filas_rango(user, desde, hasta):
    return {r.date: r for r in TriageDailyReport.query.filter(
        TriageDailyReport.triage_name == user.username, TriageDailyReport.date >= desde, TriageDailyReport.date <= hasta)}


def mano_de_fila(row):
    if row is None:
        return {}
    return {c: getattr(row, c) for c, _, _ in MANO if getattr(row, c, None)}


def valores_de_fila(row):
    salida = {c: getattr(row, c) or 0 for c in CORREGIBLES}
    salida.update(mano_de_fila(row))
    return salida


def contexto(user, dia):
    ctx = {'hoy': [], 'futuras': []}
    try:
        ctx['hoy'], ctx['futuras'] = conteo.agendas(user.username, dia)
    except Exception as e:
        logger.error(f"[reporte triage] agendas de {user.username} {dia}: {e}")
        db.session.rollback()
    return ctx


def auto(user, dia, ctx):
    salida = {}
    for pre, lista in (('today', ctx['hoy']), ('future', ctx['futuras'])):
        salida[f'{pre}_agendas'] = len(lista)
        for k in conteo.KW:
            salida[f'{pre}_{k}'] = sum(1 for a in lista if conteo.tiene_estado(a, k))
    return salida


def sugeridos(user, dia, ctx, vals):
    return {}


def _g(v, k):
    return v.get(k) or 0


def derivados(v):
    return {
        'confirm_today': pct(_g(v, 'today_confirmed'), _g(v, 'today_agendas')),
        'confirm_future': pct(_g(v, 'future_confirmed'), _g(v, 'future_agendas')),
        'recovery_rate': pct(v.get('recoveries_scheduled'), _g(v, 'recoveries_contacted')),
    }


def kpis_de(vals):
    d = derivados(vals)
    return {'today_confirmed': _g(vals, 'today_confirmed'), 'confirm_today': d['confirm_today'],
            'today_rescheduled': _g(vals, 'today_rescheduled'), 'recoveries_scheduled': vals.get('recoveries_scheduled')}


def meta_de(vals):
    """La meta del kpi de confirmadas: todas las agendas de hoy."""
    return {'today_confirmed': _g(vals, 'today_agendas')}


def hubo_trabajo(vals, dia=None):
    return (_g(vals, 'today_agendas') + _g(vals, 'future_agendas')) > 0


def pendientes(user, dia, ctx, vals):
    sin_estado = [a for a in ctx['hoy'] if not (a.estado or '').strip() or (a.estado or '').strip().lower() == 'pendiente']
    avisos = []
    if sin_estado:
        a = sin_estado[0]
        quien = f"{a.nombre or 'Sin nombre'} · {hora_local(user, a.date)}" + (f" con {a.closer}" if a.closer else '')
        extra = f" y {plural(len(sin_estado) - 1, 'más', 'más')}" if len(sin_estado) > 1 else ''
        avisos.append({'titulo': plural(len(sin_estado), 'agenda de hoy sin estado', 'agendas de hoy sin estado'),
                       'detalle': f"{quien}{extra}. Se cuenta como no contactada."})
    return {'agendas': [], 'avisos': avisos}


def numeros(user, dia, ctx, vals, kpis):
    d = derivados(vals)
    filas = [{'l': l, 'celdas': [{'clave': f'today_{k}', 'v': _g(vals, f'today_{k}')},
                                 {'clave': f'future_{k}', 'v': _g(vals, f'future_{k}')}]} for k, l in ESTADOS]
    return {
        'fuente': FUENTE,
        'kpis': kpis,
        'embudo': {'tit': 'Agendas de hoy', 'unidad': 'n', 'pasos': [
            {'clave': 'today_agendas', 'l': 'Agendas del día', 'v': _g(vals, 'today_agendas')},
            {'clave': 'today_contacted', 'l': 'Contactadas', 'v': _g(vals, 'today_contacted')},
            {'clave': 'today_confirmed', 'l': 'Confirmadas', 'v': _g(vals, 'today_confirmed')}]},
        'bloques': [
            {'t': 'comparar', 'tit': 'Confirmaciones', 'cols': ['Hoy', 'Futuras'], 'corr': True, 'conv': False,
             'filas': filas},
            {'t': 'pasos', 'tit': 'Recuperaciones', 'series': [{'nombre': '', 'pasos': [
                {'clave': c, 'l': campo, 'v': vals.get(c), 'mano': True} for c, _, campo in MANO]}]},
        ],
        'tasas': [{'clave': k, 'l': l, 'v': d[k]} for k, l in TASAS],
        'logros': [],
    }


def candidatos(user, ctx):
    salida = []
    for a in ctx['hoy'] + ctx['futuras']:
        estado = (a.estado or 'Pendiente').strip()
        salida.append({'id': f"agenda:{a.id}", 'nombre': a.nombre or 'Sin nombre',
                       'detalle': f"{estado} · {hora_local(user, a.date)}"})
    return salida


def registros(user, dia, clave, ctx):
    pre, _, estado = clave.partition('_')
    if pre in ('today', 'future'):
        lista = ctx['hoy'] if pre == 'today' else ctx['futuras']
        if estado != 'agendas':
            lista = [a for a in lista if conteo.tiene_estado(a, estado)]
        return {'cols': ['Lead', 'Hora', 'Closer', 'Estado'],
                'filas': [[a.nombre or 'Sin nombre', hora_local(user, a.date), a.closer or '', a.estado or 'Pendiente']
                          for a in lista],
                'como': f"{COMO[pre]}{'' if estado == 'agendas' else ' con estado «' + dict(ESTADOS)[estado].lower() + '»'}."}
    if clave in ('confirm_today', 'confirm_future'):
        lista = ctx['hoy'] if clave == 'confirm_today' else ctx['futuras']
        return {'cols': ['Lead', 'Hora', 'Closer', 'Resultado'],
                'filas': [[a.nombre or 'Sin nombre', hora_local(user, a.date), a.closer or '',
                           'Confirmada' if conteo.tiene_estado(a, 'confirmed') else 'Sin confirmar'] for a in lista],
                'como': COMO[clave]}
    if clave in COMO:
        return {'cols': [], 'filas': [], 'como': COMO[clave]}
    return None


def persistir(user, dia, close, vals):
    row = fila(user, dia)
    if row is None:
        row = TriageDailyReport(triage_name=user.username, date=dia)
        db.session.add(row)
    for c in CORREGIBLES + tuple(m[0] for m in MANO):
        setattr(row, c, vals.get(c) or 0)
    row.is_non_working_day = bool(close.is_non_working_day)
    return row


def discord(row):
    from app.api.public.triage import _trigger_triage_report_webhook
    _trigger_triage_report_webhook(row)
