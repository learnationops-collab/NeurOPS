"""Los registros detrás de cada número del setter: las conversaciones que contó el Inbox
(`reporte_inbox.contar`, su `detalle`) y las agendas generadas del día."""
from app.reporte_dia.comun import hora_local

CANAL = {'ads': 'anuncios', 'inb': 'inbound'}
NOMBRE_CANAL = {'anuncios': 'Anuncios', 'inbound': 'Inbound'}
EMBUDO = {'funnel_pain': 'dolor', 'funnel_offer': 'oferta', 'funnel_link': 'link'}
COLS = ['Lead', 'Canal', 'Último mensaje', 'Etapa']

COMO = {
    'entrantes': 'Conversaciones cuyo primer mensaje del lead cayó hoy, en tus dos canales.',
    'entrantes_canal': 'Conversaciones cuyo primer mensaje del lead cayó hoy, en este canal.',
    'leads': 'De los nuevos mensajes, los que contestaron algo (al bot o a vos) y no son in-abribles. Incluye a los no leads.',
    'no_lead': 'De los nuevos mensajes, los marcados como no lead o que el bot dio por no calificados.',
    'inabribles': 'De los nuevos mensajes, los marcados como in-abribles.',
    'agendas': 'Agendas que reservaste hoy (por la fecha en que se creó la agenda, no la de la llamada).',
    'embudo': 'Conversaciones que llegaron hoy por primera vez a esta etapa (lo que marcás en el Inbox).',
    'cualificados': 'Entrantes cualificados de tus dos canales.',
    'cualificacion': 'Entrantes cualificados ÷ nuevos mensajes.',
    'apertura': 'Aperturas ÷ entrantes cualificados.',
    'respuesta': 'Leads que respondieron a una apertura ÷ aperturas.',
    'bnv_rate': 'Bienvenidas respondidas ÷ bienvenidas hechas.',
}


def _filas(user, detalle, claves):
    salida = []
    for clave in claves:
        canal = clave.split('.')[0]
        for q in detalle.get(clave, []):
            salida.append([q['quien'], NOMBRE_CANAL.get(canal, ''), hora_local(user, q.get('en')), q.get('fase') or ''])
    return salida


def _agendas(user, ctx):
    return {'cols': ['Lead', 'Agendada', 'Llamada'],
            'filas': [[a['cliente'], hora_local(user, a.get('creada')), (a.get('fecha') or '')[:10]]
                      for a in ctx.get('generadas') or []]}


def registros(user, dia, clave, ctx):
    """{cols, filas, como} de un número del setter, o None si no tiene registros (lo a mano)."""
    det = (ctx.get('inbox') or {}).get('detalle') or {}
    pre, _, campo = clave.partition('_')
    if pre in CANAL and campo in ('entrantes', 'leads', 'no_lead', 'inabribles'):
        como = COMO['entrantes_canal' if campo == 'entrantes' else campo]
        return {'cols': COLS, 'filas': _filas(user, det, [f'{CANAL[pre]}.{campo}']), 'como': como}
    if clave in ('ads_agendas', 'inb_agendas', 'agendas'):
        r = _agendas(user, ctx)
        r['como'] = COMO['agendas'] + (' Se muestran las de los dos canales.' if clave != 'agendas' else '')
        return r
    if clave in EMBUDO:
        return {'cols': COLS, 'filas': _filas(user, det, [f'embudo.{EMBUDO[clave]}']), 'como': COMO['embudo']}
    if clave in ('entrantes', 'cualificados'):
        campo = 'entrantes' if clave == 'entrantes' else 'leads'
        return {'cols': COLS, 'filas': _filas(user, det, [f'{c}.{campo}' for c in ('anuncios', 'inbound')]),
                'como': COMO[clave]}
    if clave == 'cualificacion':
        filas = []
        for canal in ('anuncios', 'inbound'):
            leads = {q['id'] for q in det.get(f'{canal}.leads', [])}
            for q in det.get(f'{canal}.entrantes', []):
                filas.append([q['quien'], NOMBRE_CANAL[canal], hora_local(user, q.get('en')),
                              'Cualificado' if q['id'] in leads else 'No califica'])
        return {'cols': COLS[:-1] + ['Resultado'], 'filas': filas, 'como': COMO['cualificacion']}
    if clave in COMO:
        return {'cols': [], 'filas': [], 'como': COMO[clave]}
    return None
