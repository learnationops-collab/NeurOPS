"""Close rate real por closer para Comparativas (24/10/2026).

Va aparte del resto de la fila porque rastrea cada cobro hasta su llamada (`cierres_reales`) y eso
no se paga en cada carga: el frontend lo pide solo cuando alguien elige «Close rate · real».
"""
from app.services.cierres_reales import cierres_reales
from app.services.comercial_analitica import delta
from app.services.comercial_service import ROL_CLOSERS, ComercialService


def _real_de(start, end, closer_id=None, closer_nombre=None):
    """El % del cierre real de una persona (o del equipo si no se pasa ninguna) en un período."""
    agendas = ComercialService.agendas(start, end, closer_id=closer_id)
    ventas = ComercialService.ventas(start, end, closer_nombre=closer_nombre)
    asistieron = ComercialService.totales_agendas(agendas)['asistieron']
    reales = cierres_reales(start, end, ventas, asistieron, closer_nombre=closer_nombre)
    return reales['pct'], reales['cierres'], reales['base']


def reales_por_closer(start, end, prev_start=None, prev_end=None):
    """`{filas: {id: {...}}, equipo: {...}}` con el valor, el cierre y su base, y el delta."""
    def armar(closer_id=None, closer_nombre=None):
        valor, cierres, base = _real_de(start, end, closer_id, closer_nombre)
        salida = {'close_rate_real': valor, 'cierres_reales': cierres, 'base_real': base, 'deltas': {}}
        if prev_start:
            previo, _, _ = _real_de(prev_start, prev_end, closer_id, closer_nombre)
            d = delta(valor, previo, 'pts')
            if d:
                salida['deltas']['close_rate_real'] = d
        return salida

    return {
        'filas': {m['id']: armar(m['id'], m['nombre']) for m in ComercialService.miembros(ROL_CLOSERS)},
        'equipo': armar(),
    }
