"""Las filas del reporte del triage: por closer y lead por lead (salen de `triage_service.metricas`)."""
from datetime import datetime


def _iso(valor):
    return valor.isoformat() if valor else None


def por_closer(agendas, pases):
    """Un renglón por triage y por closer de lo que pasó al closing: cuántas llamadas, cuántas asistieron y
    cuántas cerraron. La pantalla los suma para «todas» las personas o se queda con una."""
    filas = {}
    for a in agendas:
        pase = pases.get(a.id)
        if not pase:
            continue
        f = filas.setdefault((a.closer_id, pase['closer_id']), {
            'triage_id': a.closer_id, 'closer_id': pase['closer_id'], 'closer': pase['closer'],
            'pasaron': 0, 'asistieron': 0, 'cerraron': 0, 'senas': 0, 'cobrado': 0.0,
            'no_asistieron': 0})
        f['pasaron'] += 1
        f['asistieron'] += 1 if pase['asistio'] else 0
        f['cerraron'] += 1 if pase['cerro'] else 0
        f['no_asistieron'] += 1 if pase.get('estado') == 'no_asistio' else 0
        f['senas'] += 1 if pase.get('sena') else 0
        f['cobrado'] = round(f['cobrado'] + pase.get('cobrado', 0), 2)
    return sorted(filas.values(), key=lambda f: (f['closer'], f['triage_id']))


def leads(agendas, pases):
    """El reporte del período, lead por lead: cómo quedó, su pase al closing y sus dos notas (la de la llamada
    y la del closer). Las notas salen del log en una sola consulta."""
    from app.models import LeadEventLog

    notas, ahora = {}, datetime.utcnow()
    for e in (LeadEventLog.query.filter(LeadEventLog.origen == 'appointment',
                                        LeadEventLog.origen_id.in_([a.id for a in agendas] or [0]),
                                        LeadEventLog.action_type.in_(('nota_llamada', 'nota_para_closer')))
              .order_by(LeadEventLog.created_at, LeadEventLog.id)):
        notas[(e.origen_id, e.action_type)] = e.description
    return [{
        'id': a.id, 'cliente': a.client.full_name if a.client else None, 'client_id': a.client_id,
        'hora': _iso(a.start_time), 'ya_paso': bool(a.start_time and a.start_time <= ahora), 'triage': a.closer.username if a.closer else None,
        'asistencia': a.closer_result, 'closing': pases.get(a.id),
        'calificacion': a.triage_calificacion, 'low_ticket': a.triage_low_ticket,
        'fecha_seguimiento': a.fecha_seguimiento,
        'nota': notas.get((a.id, 'nota_llamada')), 'nota_para_closer': notas.get((a.id, 'nota_para_closer')),
    } for a in sorted(agendas, key=lambda a: a.start_time)]

