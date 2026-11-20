"""Programas y segmentos › por segmento (Leadership 1403, ADR-W177): CAC y ROAS de Setting por segmento A/B/C/D.

Meta no conoce el segmento del lead, así que el gasto de Setting se REPARTE: a cada segmento le toca la parte del
gasto igual a su parte de las agendas de Setting del período (decisión 839, opción a: reparto por agendas). Es una
estimación y la pantalla lo dice. «Sin segmento» recibe su parte como cualquier otro, así los cinco suman el gasto.

Las cifras salen de los hechos de Marketing › Segmentos (`segmentos_marketing_service.hechos`, base alta) y el gasto
de `meta_ads_service.gasto_por_embudo` (embudo `setting`), así que agendas, ventas y cash son los de esa vista.
Workshop no entra: sus leads son clics anónimos y no se pueden segmentar. Por construcción el costo por agenda es el
mismo en todos los segmentos; lo que cambia entre ellos es cuánto vende cada uno. Sin costo por lead: con el reparto
por agendas, «sin segmento» (quien no llenó el formulario: casi todos los leads, pocas agendas) daría centavos.

Marketing › Segmentos y el filtro de segmento del resto de Marketing siguen sin gasto (`SIN_SEGMENTO_POSIBLE`).
"""
from app.services import fuentes_registros_service, meta_ads_service, segmentos_marketing_service as smk
from app.services.marketing_formulas import dividir
from app.services.segmentos_lectura import ETIQUETAS, ORDEN, parsear

FUENTE = 'setting'
METRICAS = ('leads', 'agendas', 'reportadas', 'show_up', 'ventas', 'compradores', 'new_cash', 'cash_total', 'gasto')


def _gasto_setting(desde, hasta):
    return next((e['gasto'] for e in meta_ads_service.gasto_por_embudo(desde, hasta) if e['embudo'] == FUENTE), 0.0)


def _cifras(hs, gasto, agendas_total):
    agendas = sum(1 for h in hs if smk.PERTENECE['agendas'](h))
    ventas = [h for h in hs if smk.PERTENECE['ventas'](h)]
    asignado = round(gasto * agendas / agendas_total, 2) if agendas_total else None
    fila = {
        'leads': sum(1 for h in hs if smk.PERTENECE['leads'](h)),
        'agendas': agendas,
        'reportadas': sum(1 for h in hs if smk.PERTENECE['reportadas'](h)),
        'show_up': sum(1 for h in hs if smk.PERTENECE['show_up'](h)),
        'ventas': len(ventas),
        'compradores': len({h.get('cliente') or h['id'] for h in ventas}),
        'new_cash': round(sum(h['monto'] for h in ventas), 2),
        'cash_total': round(sum(h['monto'] for h in hs if smk.PERTENECE['cash_total'](h)), 2),
        'pct_agendas': dividir(agendas * 100, agendas_total, 1),
        'gasto': asignado,
    }
    con_gasto = bool(asignado)
    fila['cac'] = dividir(asignado, fila['compradores']) if con_gasto else None
    fila['roas_new_cash'] = dividir(fila['new_cash'], asignado) if con_gasto else None
    fila['roas_total'] = dividir(fila['cash_total'], asignado) if con_gasto else None
    fila['pct_show_up'] = dividir(fila['show_up'] * 100, fila['reportadas'], 1)
    return fila


def _de_setting(desde, hasta):
    hs, _clics = smk.hechos(desde, hasta)
    return [h for h in hs if h['fuente'] == FUENTE]


def resumen(desde, hasta):
    """{gasto, agendas, filas: [una por segmento, con `gasto` repartido], total}."""
    hs = _de_setting(desde, hasta)
    gasto = round(_gasto_setting(desde, hasta), 2)
    agendas_total = sum(1 for h in hs if smk.PERTENECE['agendas'](h))
    filas = [{'segmento': s, 'label': ETIQUETAS[s], **_cifras([h for h in hs if h['seg'] == s], gasto, agendas_total)}
             for s in ORDEN]
    return {'gasto': gasto, 'agendas': agendas_total, 'filas': filas,
            'total': {'segmento': None, 'label': 'Total de Setting', **_cifras(hs, gasto, agendas_total)}}


def registros(desde, hasta, metrica, segmento=''):
    """{columnas, filas, resumen} de lo que suma `metrica` en Setting para `segmento` (A…D, sin; vacío = todos).
    `gasto` es la lista de anuncios de Setting entera: lo que se reparte, no la parte del segmento."""
    if metrica not in METRICAS:
        raise ValueError('Esa cifra todavía no tiene lista.')
    if metrica == 'gasto':
        return fuentes_registros_service.registros(FUENTE, 'gasto', desde, hasta)
    if metrica != 'compradores':
        return smk.registros(desde, hasta, metrica, segmento, FUENTE, 'ninguno', None)
    lista = smk.registros(desde, hasta, 'ventas', segmento, FUENTE, 'ninguno', None)
    cliente_de = {h['id']: h.get('cliente') or h['id'] for h in _de_setting(desde, hasta) if h['t'] == 'cobro'}
    unicas = {}
    for fila in lista['filas']:
        unicas.setdefault(cliente_de.get(str(fila['id']), fila['id']), fila)
    elegidos = parsear(segmento)
    nombre = ' + '.join(ETIQUETAS[s] for s in ORDEN if s in elegidos) if elegidos else 'todos los segmentos'
    return {**lista, 'filas': list(unicas.values()), 'resumen': f"{len(unicas)} compradores · {nombre}"}
