"""Reporte único del closer: números, pendientes, candidatos y guardado en `closer_daily_reports`.

Los números salen de `CloserService.compute_daily_report_fields` (las mismas ~40 columnas del reporte de
siempre) y de `get_daily_activity_summary` (referidos). Lo único a mano son los slots.
"""
import logging
from datetime import datetime

from app import db
from app.models import CloserDailyReport
from app.reporte_dia.comun import hora_local, pct, plural
from app.services.closer_service import CloserService

logger = logging.getLogger(__name__)

FUENTE = 'Salen de tus agendas y ventas en Work.'
FUENTE_DETALLE = 'Agendas y ventas de Work'
MANO = (('slots', 'Slots', 'Slots disponibles'),)
CORREGIBLES = ()
# `auto` no usa el contexto (agendas de la cartera): el promedio de 7 días no lo pide.
AUTO_USA_CONTEXTO = False
OPCIONES = ['Show up', 'No show', 'Reagendado', 'Cancelado']
TIPOS_VENTA = (('pif', 'PIF'), ('deposit', 'Seña'), ('split', 'Split'), ('installment', 'Cuotas'),
               ('renewal', 'Renovación'), ('upsell', 'Upsell'))
COLUMNAS = tuple(c.name for c in CloserDailyReport.__table__.columns
                 if c.name not in ('id', 'closer_id', 'date', 'is_non_working_day', 'created_at',
                                   'reflection_victory', 'reflection_opportunity', 'reflections'))
# Lo que se muestra en el historial y en el promedio de 7 días.
HIST = (('cash', 'Cash', 'usd', 'sum'), ('ventas', 'Ventas', 'n', 'sum'), ('show_rate', 'Show up', '%', 'avg'))


def fila(user, dia):
    return CloserDailyReport.query.filter_by(closer_id=user.id, date=dia).first()


def filas_rango(user, desde, hasta):
    return {r.date: r for r in CloserDailyReport.query.filter(
        CloserDailyReport.closer_id == user.id, CloserDailyReport.date >= desde, CloserDailyReport.date <= hasta)}


def mano_de_fila(row):
    return {'slots': row.slots} if row is not None and row.slots else {}


def valores_de_fila(row):
    return {c: (getattr(row, c) or 0) for c in COLUMNAS}


def contexto(user, dia):
    """Las agendas del día (las filas de Mi cartera) y el atraso de días anteriores."""
    from app.services.comercial_service import ComercialService
    ctx = {'filas': [], 'atraso': None}
    try:
        ctx['filas'] = ComercialService.agendas(dia, dia, closer_id=user.id)
    except Exception as e:
        logger.error(f"[reporte closer] agendas de {user.id} {dia}: {e}")
        db.session.rollback()
    try:
        ctx['atraso'] = CloserService.get_previous_days_pending(user.id, dia)
    except Exception as e:
        logger.error(f"[reporte closer] atraso de {user.id} {dia}: {e}")
        db.session.rollback()
    return ctx


def auto(user, dia, ctx):
    vals = dict(CloserService.compute_daily_report_fields(user.id, dia))
    vals.pop('slots', None)
    actividad = CloserService.get_daily_activity_summary(user.id, dia)
    vals['referrals_sourced'] = actividad.get('referidos_capturados', 0)
    vals['referrals_scheduled'] = actividad.get('referidos_capturados', 0)
    return vals


def sugeridos(user, dia, ctx, vals):
    """Slots: el último valor que cargó; si nunca cargó, las agendas del día."""
    previo = CloserDailyReport.query.filter(
        CloserDailyReport.closer_id == user.id, CloserDailyReport.date < dia,
        CloserDailyReport.slots.isnot(None), CloserDailyReport.slots > 0,
    ).order_by(CloserDailyReport.date.desc()).first()
    if previo:
        return {'slots': previo.slots}
    agendas = derivados(vals)['agendas']
    return {'slots': agendas} if agendas else {}


def derivados(v):
    g = lambda k: v.get(k) or 0  # noqa: E731
    agendas = g('first_call_scheduled') + g('second_call_scheduled')
    asistieron = g('first_call_attended') + g('second_call_attended')
    no_show = g('first_call_no_show') + g('second_call_no_show')
    reprog = g('first_call_rescheduled') + g('second_call_rescheduled')
    canc = g('first_call_canceled') + g('second_call_canceled')
    ventas = sum(g(f'{k}_count') for k, _ in TIPOS_VENTA)
    cash = sum(g(f'{k}_cash_collected') for k, _ in TIPOS_VENTA)
    en_llamada = sum(g(f'{k}_in_call_cash') for k, _ in TIPOS_VENTA)
    return {
        'agendas': agendas, 'asistieron': asistieron, 'no_show': no_show, 'reprogramadas': reprog,
        'canceladas': canc, 'ventas': ventas, 'cash': round(cash, 2), 'in_call_cash': round(en_llamada, 2),
        'out_call_cash': round(cash - en_llamada, 2), 'ticket_promedio': round(cash / ventas, 2) if ventas else 0,
        'show_rate': pct(asistieron, agendas - reprog),
        'pitch_rate': pct(g('offers_made'), asistieron),
        'close_promesa': pct(ventas, g('offers_made')),
        'close_operativo': pct(ventas, asistieron),
        'no_show_rate': pct(no_show, agendas),
        'canc_reprog_rate': pct(canc + reprog, agendas),
        'slots_ocupados': pct(agendas, v.get('slots')),
    }


def kpis_de(vals):
    """{clave: v} de lo que va en los kpis y en el historial (para el promedio de 7 días)."""
    d = derivados(vals)
    return {'cash': d['cash'], 'ventas': d['ventas'], 'show_rate': d['show_rate'],
            'close_operativo': d['close_operativo']}


def hubo_trabajo(vals, dia=None):
    return derivados(vals)['agendas'] > 0


def _sin_resultado(ctx):
    # Mismo criterio que cierre_dia_service.resumen_del_dia: ya pasó y sigue «pendiente».
    return [f for f in ctx['filas'] if f['post_call']['key'] == 'pendiente' and f['ya_paso']]


def pendientes(user, dia, ctx, vals):
    agendas = []
    for f in _sin_resultado(ctx):
        llamada = 'Segunda llamada' if f.get('tipo_llamada') == 'segunda' else 'Primera llamada'
        agendas.append({'id': f['id'], 'nombre': f['cliente'], 'hora': hora_local(user, f['fecha']),
                        'detalle': f'{llamada} sin resultado', 'opciones': list(OPCIONES)})
    avisos = []
    a = ctx.get('atraso') or {}
    for clave, uno, varios in (('confirmaciones_pendientes', 'confirmación atrasada', 'confirmaciones atrasadas'),
                               ('llamadas_sin_registrar', 'llamada sin registrar', 'llamadas sin registrar'),
                               ('seguimientos_sin_realizar', 'seguimiento atrasado', 'seguimientos atrasados')):
        if a.get(clave):
            avisos.append({'titulo': plural(a[clave], uno, varios), 'detalle': 'De días anteriores. No bloquea el cierre.'})
    return {'agendas': agendas, 'avisos': avisos}


def _meta_seguimientos(user, dia):
    from app.services.closer_followup_service import CloserFollowUpService
    try:
        return CloserFollowUpService.get_daily_goal_progress(user.id, dia.isoformat()).get('faltan')
    except Exception as e:
        logger.error(f"[reporte closer] meta de seguimientos de {user.id}: {e}")
        return None


def numeros(user, dia, ctx, vals, kpis):
    d = derivados(vals)
    g = lambda k: vals.get(k) or 0  # noqa: E731
    celda = lambda k: {'clave': k, 'v': g(k)}  # noqa: E731
    filas_llamadas = [{'l': l, 'celdas': [celda(f'first_call_{k}'), celda(f'second_call_{k}')]}
                      for l, k in (('Agendas', 'scheduled'), ('Asistencias', 'attended'), ('No show', 'no_show'),
                                   ('Reprogramaciones', 'rescheduled'), ('Cancelaciones', 'canceled'))]
    partes = [{'clave': f'{k}_cash_collected', 'l': l, 'v': g(f'{k}_cash_collected'),
               'sub': plural(g(f'{k}_count'), 'venta', 'ventas') if g(f'{k}_count') else ''} for k, l in TIPOS_VENTA]
    limpio = not _sin_resultado(ctx) and not (ctx.get('atraso') or {}).get('total')
    faltan_seg = _meta_seguimientos(user, dia)
    return {
        'fuente': FUENTE,
        'kpis': kpis,
        'embudo': {'tit': 'Del día', 'unidad': 'n', 'pasos': [
            {'clave': 'agendas', 'l': 'Agendas', 'v': d['agendas']},
            {'clave': 'asistieron', 'l': 'Asistieron', 'v': d['asistieron']},
            {'clave': 'offers_made', 'l': 'Presentaciones', 'v': g('offers_made')},
            {'clave': 'ventas', 'l': 'Ventas', 'v': d['ventas']}]},
        'bloques': [
            {'t': 'comparar', 'tit': 'Llamadas', 'cols': ['1.ª', '2.ª'], 'corr': False, 'conv': False,
             'filas': filas_llamadas},
            {'t': 'mix', 'tit': 'Ventas', 'f': 'usd', 'total': {'clave': 'cash', 'v': d['cash']},
             'sub': f"en {plural(d['ventas'], 'venta', 'ventas')}", 'partes': partes,
             'pie': [{'clave': 'in_call_cash', 'l': 'En llamada', 'v': d['in_call_cash'], 'f': 'usd'},
                     {'clave': 'out_call_cash', 'l': 'Fuera de llamada', 'v': d['out_call_cash'], 'f': 'usd'},
                     {'clave': 'ticket_promedio', 'l': 'Ticket promedio', 'v': d['ticket_promedio'], 'f': 'usd'}]},
            {'t': 'pasos', 'tit': 'Seguimiento y recuperación', 'series': [
                {'nombre': 'Seguimientos', 'pasos': [
                    {'clave': 'follow_ups_sent', 'l': 'Contactados', 'v': g('follow_ups_sent')},
                    {'clave': 'follow_ups_replied', 'l': 'Respondieron', 'v': g('follow_ups_replied')},
                    {'clave': 'follow_ups_closed', 'l': 'Cerrados', 'v': g('follow_ups_closed')}]},
                {'nombre': 'Recuperaciones', 'pasos': [
                    {'clave': 'recoveries_contacted', 'l': 'Contactados', 'v': g('recoveries_contacted')},
                    {'clave': 'recoveries_replied', 'l': 'Respuestas', 'v': g('recoveries_replied')},
                    {'clave': 'recoveries_scheduled', 'l': 'Agendas', 'v': g('recoveries_scheduled')}]}]},
            {'t': 'cifras', 'tit': 'Agenda y llamada', 'en_embudo': True, 'items': [
                {'clave': 'slots', 'l': 'Slots disponibles', 'v': vals.get('slots'), 'mano': True, 'suf': ''},
                {'clave': 'decision_makers', 'l': 'Decisores', 'v': g('decision_makers'), 'suf': ''},
                {'clave': 'referrals_sourced', 'l': 'Referidos', 'v': g('referrals_sourced'), 'suf': ''},
                {'clave': 'confirmations_done', 'l': 'Confirmaciones', 'v': g('confirmations_done'),
                 'suf': f"de {d['agendas']}" if d['agendas'] else ''}]},
        ],
        'tasas': [{'clave': k, 'l': l, 'v': d[k]} for k, l in TASAS],
        'logros': [{'l': 'Primer cobro', 'si': d['ventas'] > 0},
                   {'l': 'Día limpio', 'si': limpio},
                   {'l': 'Meta de seguimientos', 'si': faltan_seg == 0}],
    }


TASAS = (('show_rate', 'Show'), ('pitch_rate', 'Pitch'), ('close_promesa', 'Close promesa'),
         ('close_operativo', 'Close operativo'), ('no_show_rate', 'No show'), ('canc_reprog_rate', 'Canc. + reprog.'),
         ('slots_ocupados', 'Slots ocupados'))
KPIS = (('cash', 'Cash del día', 'usd'), ('ventas', 'Ventas', 'n'), ('show_rate', 'Show up', '%'),
        ('close_operativo', 'Close operativo', '%'))


def candidatos(user, ctx):
    """Las personas del día para la victoria: primero las que compraron, después las que asistieron."""
    orden = {'venta': 0, 'sena': 1, 'asistio': 2, 'seguimiento': 2, 'segunda_llamada': 3}
    filas = sorted(ctx['filas'], key=lambda f: (orden.get(f['post_call']['key'], 9), f['fecha'] or ''))
    salida = []
    for f in filas:
        clave = f['post_call']['key']
        que = {'venta': 'Cerró la venta', 'sena': 'Dejó seña'}.get(clave, f['post_call']['label'])
        if clave == 'pendiente':
            que = 'Segunda llamada' if f.get('tipo_llamada') == 'segunda' else 'Primera llamada'
        hora = hora_local(user, f['fecha'])
        salida.append({'id': f"appt:{f['id']}", 'nombre': f['cliente'], 'detalle': f"{que} · {hora}" if hora else que})
    return salida


def persistir(user, dia, close, vals):
    """Vuelca los números en `closer_daily_reports` (la fila que leen Discord y la dirección)."""
    from app.reporte_dia.comun import texto_victoria
    row = fila(user, dia)
    if row is None:
        row = CloserDailyReport(closer_id=user.id, date=dia)
        db.session.add(row)
    for c in COLUMNAS:
        if c in vals:
            setattr(row, c, vals[c] if vals[c] is not None else 0)
    row.slots = vals.get('slots') or 0
    row.is_non_working_day = bool(close.is_non_working_day)
    victoria = texto_victoria(close)
    row.reflection_victory = victoria or None
    row.reflection_opportunity = close.tomorrow or None
    row.reflections = {'victory': victoria, 'opportunity': close.tomorrow or '',
                       'platform_issue': close.platform_issue or ''}
    # «Enviado»: la última vez que la persona escribió (si fue a la mañana siguiente, sale tarde).
    row.created_at = close.updated_at or datetime.utcnow()
    return row


def discord(row):
    from app.api.public.closer import _trigger_closer_report_discord
    _trigger_closer_report_discord(row)


def ventana(user, dia):
    """(inicio, fin) UTC del día del closer, como lo usa compute_daily_report_fields."""
    return CloserService._day_bounds_utc(user, dia)
