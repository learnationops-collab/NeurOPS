"""Las filas del reporte del triage: por closer y lead por lead (salen de `triage_service.metricas`), y el
destino de cada llamada, que es de donde salen tanto la cuenta como la lista de cada cifra."""
from datetime import datetime

_REAGENDA = ('reagend', 'reprogram')
# El contador de `triage_service._sumar` que suma cada destino. Los cinco primeros hacen la base del % de
# asistencia, la misma de closing (ADR-W145); «por ocurrir» y «fuera» no cuentan en ella.
CONTADOR = {'asistio': 'asistencias', 'no_show': 'no_show', 'cancelo': 'canceladas', 'reagendo': 'reagendadas',
            'sin_reporte': 'sin_reporte', 'por_ocurrir': 'por_ocurrir', 'fuera': 'fuera'}


def destino_de(a, ahora):
    """El destino de una llamada de triage, uno solo por agenda: asistió, no show, canceló, reprogramó, sin
    reportar (ya pasó), por ocurrir, o «fuera» (descalificada, lead perdido, archivada sin reporte: un estado
    que no es un destino). La cancelación también vale si se marcó desde Confirmación (`result`)."""
    resultado = (a.closer_result or '').strip().lower()
    previo = (a.result or '').strip().lower()
    if resultado == 'show up':
        return 'asistio'
    if resultado == 'no show':
        return 'no_show'
    if resultado.startswith('cancel') or previo.startswith('cancel'):
        return 'cancelo'
    if resultado.startswith(_REAGENDA):
        return 'reagendo'
    if resultado in ('', 'pendiente'):
        if previo.startswith(_REAGENDA):
            return 'reagendo'
        return 'por_ocurrir' if a.start_time > ahora else 'sin_reporte'
    return 'fuera'


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


def leads(agendas, pases, ahora=None, motivos=None):
    """El reporte del período, lead por lead: cómo quedó, su pase al closing y sus dos notas (la de la llamada
    y la del closer). Las notas salen del log en una sola consulta. `destino` es el de `destino_de` con el
    mismo `ahora` de las cuentas: la lista de cada cifra tiene tantas filas como dice la cifra."""
    from app.models import LeadEventLog

    notas, ahora, motivos = {}, ahora or datetime.utcnow(), motivos or {}
    for e in (LeadEventLog.query.filter(LeadEventLog.origen == 'appointment',
                                        LeadEventLog.origen_id.in_([a.id for a in agendas] or [0]),
                                        LeadEventLog.action_type.in_(('nota_llamada', 'nota_para_closer')))
              .order_by(LeadEventLog.created_at, LeadEventLog.id)):
        notas[(e.origen_id, e.action_type)] = e.description
    return [{
        'id': a.id, 'cliente': a.client.full_name if a.client else None, 'client_id': a.client_id,
        'hora': _iso(a.start_time), 'ya_paso': bool(a.start_time and a.start_time <= ahora), 'triage': a.closer.username if a.closer else None,
        'asistencia': a.closer_result, 'destino': destino_de(a, ahora), 'closing': pases.get(a.id),
        'calificacion': a.triage_calificacion, 'low_ticket': a.triage_low_ticket, 'motivo': motivos.get(a.id),
        'fecha_seguimiento': a.fecha_seguimiento,
        'nota': notas.get((a.id, 'nota_llamada')), 'nota_para_closer': notas.get((a.id, 'nota_para_closer')),
    } for a in sorted(agendas, key=lambda a: a.start_time)]

