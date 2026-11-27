"""Reporte único del setter: lo que cuenta el Inbox (corregible) más lo que el setter carga a mano.

Automático: `reporte_inbox.contar` (mensajes, cualificados, no leads, in-abribles, aperturas en
entrantes y sus respuestas, bienvenidas y embudo) y las agendas generadas por canal (`_precarga_por_canal`,
como el prefill de siempre). A mano: aperturas en dolor y seguimientos por etapa (sugeridos). Se guarda con `setter_reporte_v2.escribir`
en `setter_daily_stats`, así Discord, «Mis datos» y la Vista General siguen leyendo lo mismo.
"""
import logging
from types import SimpleNamespace

from app import db
from app.models import SetterDailyStats
from app.reporte_dia.comun import hora_local, pct
from app.services import setter_reporte_v2

logger = logging.getLogger(__name__)

FUENTE = 'Salen del Inbox. Lo que no ve el Inbox lo cargás vos.'
FUENTE_DETALLE = 'Inbox de Work'
DOMINGO = 6
CANALES = (('anuncios', 'ads', 'Anuncios'), ('inbound', 'inb', 'Inbound'))
INBOX_CANAL = ('entrantes', 'leads', 'no_lead', 'inabribles', 'ap_entrantes', 'ap_entrantes_resp')
AUTO_CANAL = (*INBOX_CANAL, 'agendas')
EMBUDO = (('dolor', 'funnel_pain', 'Dolor'), ('oferta', 'funnel_offer', 'Oferta'), ('link', 'funnel_link', 'Link'))
BIENVENIDAS = (('hechas', 'bnv_hechas'), ('respondidas', 'bnv_respondidas'), ('aperturas', 'bnv_aperturas'),
               ('aperturas_resp', 'bnv_aperturas_resp'))
CORREGIBLES = (tuple(f'{p}_{c}' for _, p, _ in CANALES for c in AUTO_CANAL) + tuple(col for _, col, _ in EMBUDO)
               + tuple(col for _, col in BIENVENIDAS))
ETAPAS_FU = (('entrantes', 'qualification', 'entrantes'), ('dolor', 'pain', 'dolor'),
             ('oferta', 'offer', 'oferta'), ('link', 'link', 'link'))
MANO = (
    *[(f'{p}_{c}', g, campo) for _, p, g in CANALES for c, campo in (
        ('ap_dolor', 'Aperturas en dolor'), ('ap_dolor_resp', 'Respondieron (dolor)'))],
    *[c for _, col, nombre in ETAPAS_FU for c in (
        (f'{col}_fu', 'Seguimientos', f'Enviados en {nombre}'), (f'{col}_fur', 'Seguimientos', f'Respondieron ({nombre})'))],
)
KPIS = (('agendas', 'Agendas', 'n'), ('entrantes', 'Entrantes', 'n'), ('cualificacion', 'Cualificación', '%'),
        ('respuesta', 'Respuesta', '%'))
HIST = (('agendas', 'Agendas', 'n', 'sum'), ('entrantes', 'Entrantes', 'n', 'sum'),
        ('cualificacion', 'Cualificación', '%', 'avg'))
TASAS = (('cualificacion', 'Cualificación'), ('apertura', 'Apertura'), ('respuesta', 'Respuesta'),
         ('bnv_rate', 'Bienvenidas respondidas'))
_MANO_CLAVES = tuple(m[0] for m in MANO)


def fila(user, dia):
    return SetterDailyStats.query.filter_by(setter_id=user.id, date=dia).first()


def filas_rango(user, desde, hasta):
    return {r.date: r for r in SetterDailyStats.query.filter(
        SetterDailyStats.setter_id == user.id, SetterDailyStats.date >= desde, SetterDailyStats.date <= hasta)}


def mano_de_fila(row):
    if row is None:
        return {}
    return {c: getattr(row, c) for c in _MANO_CLAVES if getattr(row, c, None) is not None}


def valores_de_fila(row):
    salida = {c: getattr(row, c, None) for c in CORREGIBLES}
    if (getattr(row, 'report_version', None) or 1) < 2:
        # Un v1 no tiene canales: todo va a anuncios, que es lo que dice el dato.
        lect = setter_reporte_v2.leer(row)['totales']
        salida.update({'ads_entrantes': lect['entrantes'], 'ads_leads': lect['cualificados'] + lect['no_lead'],
                       'ads_no_lead': lect['no_lead'], 'ads_inabribles': lect['inabribles'], 'ads_agendas': lect['agendas'],
                       'inb_entrantes': 0, 'inb_leads': 0, 'inb_no_lead': 0, 'inb_inabribles': 0, 'inb_agendas': 0})
    salida.update(mano_de_fila(row))
    return salida


def contexto(user, dia):
    from app.api.public.setter import _precarga_por_canal
    from app.automatizaciones import reporte_inbox
    from app.services.comercial_service import ComercialService
    ctx = {'inbox': None, 'generadas': [], 'por_canal': None}
    try:
        ctx['inbox'] = reporte_inbox.contar(user.id, dia, user.timezone)
    except Exception as e:
        logger.error(f"[reporte setter] inbox de {user.id} {dia}: {e}")
        db.session.rollback()
    try:
        ctx['generadas'] = ComercialService.generadas(dia, dia, setter_id=user.id)
        ctx['por_canal'] = _precarga_por_canal([], ctx['generadas'])
    except Exception as e:
        logger.error(f"[reporte setter] agendas de {user.id} {dia}: {e}")
        db.session.rollback()
    return ctx


def auto(user, dia, ctx):
    inbox, por_canal = ctx.get('inbox'), ctx.get('por_canal') or {}
    vals = {}
    for canal, p, _ in CANALES:
        del_canal = (inbox or {}).get(canal) or {}
        for c in INBOX_CANAL:
            vals[f'{p}_{c}'] = del_canal.get(c) if inbox else None
        vals[f'{p}_agendas'] = (por_canal.get(canal) or {}).get('agendas', 0)
    bnv = (inbox or {}).get('bienvenidas') or {}
    for k, col in BIENVENIDAS:
        vals[col] = bnv.get(k) if inbox else None
    embudo = (inbox or {}).get('embudo') or {}
    for k, col, _ in EMBUDO:
        vals[col] = embudo.get(k)
    return vals


def sugeridos(user, dia, ctx, vals):
    """Los seguimientos que contó el Inbox (si tiene fases marcadas): el setter los confirma o corrige."""
    inbox = ctx.get('inbox') or {}
    fu, fur = inbox.get('followups'), inbox.get('followups_respondidos')
    if fu is None:
        return {}
    salida = {}
    for k, col, _ in ETAPAS_FU:
        salida[f'{col}_fu'] = fu.get(k, 0)
        salida[f'{col}_fur'] = (fur or {}).get(k, 0)
    return salida


def _g(v, k):
    return v.get(k) or 0


def derivados(v):
    entrantes = _g(v, 'ads_entrantes') + _g(v, 'inb_entrantes')
    cualificados = _g(v, 'ads_leads') + _g(v, 'inb_leads')
    aperturas = sum(_g(v, f'{p}_{c}') for _, p, _ in CANALES for c in ('ap_entrantes', 'ap_dolor'))
    respondidas = sum(_g(v, f'{p}_{c}_resp') for _, p, _ in CANALES for c in ('ap_entrantes', 'ap_dolor'))
    agendas = _g(v, 'ads_agendas') + _g(v, 'inb_agendas')
    return {
        'entrantes': entrantes, 'cualificados': cualificados, 'aperturas': aperturas, 'respondidas': respondidas,
        'agendas': agendas, 'cualificacion': pct(cualificados, entrantes), 'apertura': pct(aperturas, cualificados),
        'respuesta': pct(respondidas, aperturas), 'bnv_rate': pct(_g(v, 'bnv_respondidas'), _g(v, 'bnv_hechas')),
    }


def kpis_de(vals):
    d = derivados(vals)
    return {k: d[k] for k in ('agendas', 'entrantes', 'cualificacion', 'respuesta')}


def hubo_trabajo(vals, dia=None):
    return dia is None or dia.weekday() != DOMINGO


def datos_v2(vals, close):
    """Los valores del día en la forma de `setter_reporte_v2.vacio()`, para `escribir`."""
    from app.reporte_dia.comun import texto_victoria
    d = {}
    for canal, p, _ in CANALES:
        d[canal] = {c: vals.get(f'{p}_{c}') or 0 for c in ('entrantes', 'no_lead', 'inabribles', 'ap_entrantes',
                                                          'ap_dolor', 'agendas')}
        for c in ('leads', 'ap_entrantes_resp', 'ap_dolor_resp'):
            d[canal][c] = vals.get(f'{p}_{c}')
    d['bienvenidas'] = {'hechas': vals.get('bnv_hechas'), 'respondidas': vals.get('bnv_respondidas'),
                        'aperturas': vals.get('bnv_aperturas'), 'aperturas_resp': vals.get('bnv_aperturas_resp')}
    d['embudo'] = {k: vals.get(col) or 0 for k, col, _ in EMBUDO}
    d['followups'] = {k: vals.get(f'{col}_fu') or 0 for k, col, _ in ETAPAS_FU}
    d['followups_respondidos'] = {k: vals.get(f'{col}_fur') or 0 for k, col, _ in ETAPAS_FU}
    d['reflexion'] = {'flujo_trabajo': (close.workflow if close else '') or '',
                      'win_del_dia': texto_victoria(close) if close else ''}
    d['is_non_working_day'] = bool(close.is_non_working_day) if close else False
    return d


def pendientes(user, dia, ctx, vals):
    lectura = setter_reporte_v2.leer(setter_reporte_v2.escribir(
        SimpleNamespace(setter_id=user.id, date=dia, is_non_working_day=False), datos_v2(vals, None)))
    avisos = [{'titulo': a['msg'], 'detalle': 'Revisá el número. No bloquea el cierre.'}
              for a in setter_reporte_v2.avisos(lectura)]
    return {'agendas': [], 'avisos': avisos}


def numeros(user, dia, ctx, vals, kpis):
    d = derivados(vals)
    celda = lambda k, mano=False: {'clave': k, 'v': vals.get(k), **({'mano': True} if mano else {})}  # noqa: E731
    por_canal = [{'l': l, 'celdas': [celda(f'ads_{c}'), celda(f'inb_{c}')]}
                 for l, c in (('Nuevos mensajes', 'entrantes'), ('Cualificados', 'leads'), ('No leads', 'no_lead'),
                              ('In-abribles', 'inabribles'), ('Agendas', 'agendas'))]
    aperturas = [{'l': l, 'celdas': [celda(f'ads_{c}', mano), celda(f'inb_{c}', mano)]}
                 for l, c, mano in (('En entrantes', 'ap_entrantes', False), ('Respondieron', 'ap_entrantes_resp', False),
                                    ('En dolor', 'ap_dolor', True), ('Respondieron (dolor)', 'ap_dolor_resp', True))]
    seguimientos = [{'l': nombre.capitalize(), 'celdas': [celda(f'{col}_fu', True), celda(f'{col}_fur', True)]}
                    for _, col, nombre in ETAPAS_FU]
    return {
        'fuente': FUENTE,
        'kpis': kpis,
        'embudo': {'tit': 'Del día', 'unidad': 'n', 'pasos': [
            {'clave': 'cualificados', 'l': 'Cualificados', 'v': d['cualificados']},
            *[{'clave': col, 'l': l, 'v': vals.get(col)} for _, col, l in EMBUDO],
            {'clave': 'agendas', 'l': 'Agendas', 'v': d['agendas']}]},
        'bloques': [
            {'t': 'comparar', 'tit': 'Por canal', 'cols': ['Anuncios', 'Inbound'], 'corr': True, 'conv': False,
             'filas': por_canal},
            {'t': 'comparar', 'tit': 'Aperturas', 'cols': ['Anuncios', 'Inbound'], 'corr': True, 'conv': False,
             'filas': aperturas},
            {'t': 'comparar', 'tit': 'Bienvenidas', 'cols': ['Enviadas', 'Respondieron'], 'corr': True, 'conv': True,
             'filas': [{'l': 'Bienvenidas', 'celdas': [celda('bnv_hechas'), celda('bnv_respondidas')]},
                       {'l': 'Aperturas', 'celdas': [celda('bnv_aperturas'), celda('bnv_aperturas_resp')]}]},
            {'t': 'comparar', 'tit': 'Seguimientos por etapa', 'cols': ['Enviados', 'Respondieron'], 'corr': False,
             'conv': True, 'filas': seguimientos},
        ],
        'tasas': [{'clave': k, 'l': l, 'v': d[k]} for k, l in TASAS],
        'logros': [],
    }


def candidatos(user, ctx):
    salida = [{'id': f"appt:{a['id']}", 'nombre': a['cliente'],
               'detalle': f"Agendó · {hora_local(user, a.get('creada'))}"} for a in ctx.get('generadas') or []]
    vistos = {c['nombre'] for c in salida}
    detalle = (ctx.get('inbox') or {}).get('detalle') or {}
    for canal, _, _ in CANALES:
        for q in detalle.get(f'{canal}.leads', []):
            if q['quien'] in vistos:
                continue
            vistos.add(q['quien'])
            salida.append({'id': f"ig:{q['id']}", 'nombre': q['quien'], 'detalle': f"Calificada · {hora_local(user, q['en'])}"})
    return salida


def persistir(user, dia, close, vals):
    row = fila(user, dia)
    if row is None:
        row = SetterDailyStats(setter_id=user.id, date=dia)
        db.session.add(row)
    setter_reporte_v2.escribir(row, datos_v2(vals, close))
    return row


def discord(row):
    from app.api.setter import _trigger_setter_report_webhook
    _trigger_setter_report_webhook(row)
