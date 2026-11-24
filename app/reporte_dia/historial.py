"""`GET /api/reporte/historial`: los días de un período con su estado, su victoria y sus números."""
from datetime import timedelta

from app.reporte_dia.comun import texto_victoria, ultimo_dia_cerrable
from app.reporte_dia.dia import calcular, modulo
from app.reporte_dia.estado import cierres_rango, estado_de
from app.services.user_time_service import hoy_del_usuario

COMPLETOS = ('completo', 'no_laborable')


def _rango(periodo, hoy):
    if periodo == 'mes':
        desde = hoy.replace(day=1)
    else:
        desde = hoy - timedelta(days=(30 if periodo == '30' else 7) - 1)
    largo = (hoy - desde).days + 1
    return desde, largo


def _dias(user, rol, desde, hasta, hoy):
    """[{fecha, estado, close, kpis}] del período, del más viejo al más nuevo."""
    m = modulo(rol)
    cierres = cierres_rango(user, desde, hasta)
    filas = m.filas_rango(user, desde, hasta)
    corte = ultimo_dia_cerrable(user)
    salida = []
    d = desde
    while d <= hasta:
        close, row = cierres.get(d), filas.get(d)
        estado = estado_de(user, d, close, row, corte)
        if estado == 'en_curso' and d >= hoy - timedelta(days=1):
            vals = calcular(user, d, rol, close)['vals']
            kpis = m.kpis_de(vals)
        elif row is not None:
            vals = m.valores_de_fila(row)
            if close is not None:
                vals.update({k: v for k, v in ((close.data or {}).get('mano') or {}).items() if v is not None})
            kpis = m.kpis_de(vals)
        else:
            kpis = {}
        salida.append({'fecha': d, 'estado': estado, 'close': close, 'row': row, 'kpis': kpis})
        d += timedelta(days=1)
    return salida


def _victoria_vieja(row):
    """La victoria de un reporte del flujo viejo (closer: `reflection_victory`; setter: `win_del_dia`)."""
    if row is None:
        return ''
    if getattr(row, 'reflection_victory', None):
        return row.reflection_victory
    r = getattr(row, 'reflections', None)
    return (r.get('win_del_dia') or r.get('victory') or '') if isinstance(r, dict) else ''


def _agregar(valores, modo):
    nums = [v for v in valores if v is not None]
    if not nums:
        return None
    total = sum(nums)
    return round(total, 2) if modo == 'sum' else round(total / len(nums), 1)


def armar(user, rol, periodo):
    m = modulo(rol)
    hoy = hoy_del_usuario(user)
    desde, largo = _rango(periodo, hoy)
    dias = _dias(user, rol, desde, hoy, hoy)
    prev_hasta = desde - timedelta(days=1)
    previos = _dias(user, rol, prev_hasta - timedelta(days=largo - 1), prev_hasta, hoy)

    def completos(lista):
        return sum(1 for x in lista if x['estado'] in COMPLETOS)

    kpis = [{'clave': 'dias_completos', 'l': 'Días completos', 'v': completos(dias), 'f': 'n',
             'de': sum(1 for x in dias if x['estado'] != 'en_curso'), 'prev': completos(previos)}]
    for clave, l, f, modo in m.HIST:
        serie = [x['kpis'].get(clave) for x in dias]
        kpis.append({'clave': clave, 'l': l, 'v': _agregar(serie, modo), 'f': f, 'modo': modo,
                     'prev': _agregar([x['kpis'].get(clave) for x in previos], modo), 'serie': serie})
    clave, l, f, _ = m.HIST[0]
    return {
        'kpis': kpis,
        'barras': {'clave': clave, 'l': l, 'f': f, 'dias': [
            {'fecha': x['fecha'].isoformat(), 'v': x['kpis'].get(clave), 'estado': x['estado']} for x in dias]},
        'dias': [{
            'fecha': x['fecha'].isoformat(), 'estado': x['estado'],
            'victoria': texto_victoria(x['close']) if x['close'] else _victoria_vieja(x['row']),
            'manana': (x['close'].tomorrow or '') if x['close'] else '',
            'numeros': [{'clave': c, 'l': lab, 'v': x['kpis'].get(c), 'f': fmt} for c, lab, fmt, _ in m.HIST],
        } for x in reversed(dias)],
    }
