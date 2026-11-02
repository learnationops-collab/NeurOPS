"""Qué pasó con las llamadas que el triage pasó a closing: cuántas asistieron con el closer y cuántas cerraron.

El pase es la agenda de closing con `agenda_triage_id` (`triage_service._pasar_al_closer`). Si el closer la
reagenda, la vieja queda 'Reagendado' y nace otra fila sin ese enlace: se sigue la cadena hasta la agenda
en pie, para que una reagenda no cuente como una asistencia perdida.

Asistió = `closer_result` 'Show up'. Cerró = venta de pago completo o split pay (`REAL_SALE_TIPOS`), la misma
regla del close rate: la seña no es un cierre.
"""
from app.models import Appointment


def _reagendada(a):
    return (a.closer_result or '').strip().lower().startswith('reagend')


def _sucesora(actual, candidatas, vistas):
    """La reagenda de `actual`: la primera fila posterior del mismo cliente que no sea del triage."""
    otras = [b for b in candidatas if b.id > actual.id and b.id not in vistas
             and not (b.closer and b.closer.tiene_rol('triage'))]
    return min(otras, key=lambda b: b.id) if otras else None


def _en_pie(agenda, por_cliente):
    """La agenda de closing vigente de un pase: sigue las reagendas hasta la última."""
    actual, vistas = agenda, {agenda.id}
    while _reagendada(actual):
        siguiente = _sucesora(actual, por_cliente.get(actual.client_id, []), vistas)
        if siguiente is None:
            break
        actual = siguiente
        vistas.add(actual.id)
    return actual


def pases_de(agendas_triage):
    """`{id de la agenda de triage: pase}` de las que ya pasaron al closer. Cada pase:
    `id` (agenda de closing), `closer_id`, `closer`, `fecha`, `asistio`, `cerro`, `venta_tipo`."""
    from app.services.comercial_service import ComercialService

    ids = [a.id for a in agendas_triage]
    if not ids:
        return {}
    por_pase = {}
    for c in Appointment.query.filter(Appointment.agenda_triage_id.in_(ids)).order_by(Appointment.id):
        por_pase[c.agenda_triage_id] = c
    clientes = {c.client_id for c in por_pase.values() if _reagendada(c) and c.client_id}
    por_cliente = {}
    if clientes:
        for b in Appointment.query.filter(Appointment.client_id.in_(clientes), Appointment.is_rescheduled.is_(True)):
            por_cliente.setdefault(b.client_id, []).append(b)
    vigentes = {tid: _en_pie(c, por_cliente) for tid, c in por_pase.items()}
    filas = {f['id']: f for f in ComercialService.filas_de_citas(list(vigentes.values()))}
    salida = {}
    for tid, c in vigentes.items():
        fila = filas.get(c.id, {})
        salida[tid] = {
            'id': c.id, 'closer_id': c.closer_id, 'closer': c.closer.username if c.closer else 'Sin closer',
            'fecha': c.start_time.isoformat() if c.start_time else None,
            'asistio': (c.closer_result or '').strip().lower() == 'show up',
            'cerro': bool(fila.get('con_venta')), 'venta_tipo': fila.get('venta_tipo'),
        }
    return salida
