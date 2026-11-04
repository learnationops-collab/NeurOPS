"""Resumen que ve el closer al tocar «Enviar reporte del día»: lo que se hizo y lo que falta arreglar.

Sale de las MISMAS filas que la lista de Mi cartera (`ComercialService.agendas`), así que lo que el
resumen dice que falta es exactamente lo que la lista muestra al tocar «Corregir».
"""
from app.models import LeadEventLog
from app.services.comercial_service import ComercialService
from app.services.user_time_service import limites_dia_utc


def _tocadas_hoy(user, dia):
    """Ids de agendas que este closer guardó ese día (para decir «la reportaste y volvió a Pendiente»)."""
    inicio, fin = limites_dia_utc(user, dia)
    filas = LeadEventLog.query.with_entities(LeadEventLog.appointment_id).filter(
        LeadEventLog.user_id == user.id,
        LeadEventLog.created_at >= inicio, LeadEventLog.created_at <= fin).distinct().all()
    return {f[0] for f in filas}


def resumen_del_dia(user, dia):
    """{totales, sin_resultado, por_ocurrir}: las agendas del `dia` del closer, resumidas."""
    filas = ComercialService.agendas(dia, dia, closer_id=user.id)
    tocadas = _tocadas_hoy(user, dia)
    pendientes = [f for f in filas if f['post_call']['key'] == 'pendiente']
    sin_resultado = [f for f in pendientes if f['ya_paso']]
    return {
        'date': dia.isoformat(),
        'totales': {
            'agendas': len(filas),
            'con_resultado': sum(1 for f in filas if f['realizada']),
            'asistieron': sum(1 for f in filas if f['asistio']),
            'ventas': sum(1 for f in filas if f['post_call']['key'] == 'venta'),
        },
        'sin_resultado': [{
            'id': f['id'], 'cliente': f['cliente'], 'fecha': f['fecha'],
            'reportada_hoy': f['id'] in tocadas,
        } for f in sin_resultado],
        'por_ocurrir': len(pendientes) - len(sin_resultado),
    }
