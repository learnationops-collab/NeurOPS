"""Qué pasó con las llamadas que el triage pasó a closing: cuántas asistieron con el closer y cuántas cerraron.

El pase es la agenda de closing con `agenda_triage_id` (`triage_service._pasar_al_closer`). Si el closer la
reagenda, la vieja queda 'Reagendado' y nace otra fila sin ese enlace: se sigue la cadena hasta la agenda
en pie, para que una reagenda no cuente como una asistencia perdida.

Asistió = `closer_result` 'Show up'. Cerró = venta de pago completo o split pay (`REAL_SALE_TIPOS`), la misma
regla del close rate: la seña no es un cierre.

`origen_de` hace el camino inverso para el embudo de Closing: de una agenda de closing, si llegó directa o desde triage.
"""
from sqlalchemy.orm import joinedload

from app.models import Appointment

DIRECTA, DESDE_TRIAGE = 'directa', 'triage'
_LOTE = 400


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


# --- Origen de una agenda de closing --------------------------------------------------------------

def _del_triage(a):
    return bool(a.closer and a.closer.tiene_rol('triage'))


def _viene_de_triage(cita, previas):
    """¿La reagenda `cita` (sin enlace propio) cuelga de un pase del triage? Camina hacia atrás por las reagendadas del
    mismo cliente (la misma cadena que `_en_pie` recorre hacia adelante) hasta dar con un enlace o con una agenda
    que no es reagenda: ahí termina la cadena y era directa."""
    actual = cita
    while True:
        anteriores = [b for b in previas if b.id < actual.id and _reagendada(b) and not _del_triage(b)]
        if not anteriores:
            return False
        actual = max(anteriores, key=lambda b: b.id)
        if actual.agenda_triage_id:
            return True
        if not actual.is_rescheduled:
            return False


def origen_de(citas):
    """`{id: 'directa' | 'triage'}` de unas agendas de closing. Desde triage = la agenda que generó el pase
    (`agenda_triage_id`) o una reagenda suya: al reagendar, la fila nueva no lleva el enlace y sin seguirla las
    reagendadas pasarían por directas. Directa = todo lo demás, incluidas las agendas de las propias personas de triage.
    `citas`: cualquier objeto con `id`, `agenda_triage_id`, `is_rescheduled` y `client_id`."""
    citas = list(citas)
    salida = {c.id: DESDE_TRIAGE if c.agenda_triage_id else DIRECTA for c in citas}
    sueltas = [c for c in citas if not c.agenda_triage_id and c.is_rescheduled and c.client_id]
    if not sueltas:
        return salida
    previas = {}
    clientes = sorted({c.client_id for c in sueltas})
    for i in range(0, len(clientes), _LOTE):
        for b in (Appointment.query.options(joinedload(Appointment.closer))
                  .filter(Appointment.client_id.in_(clientes[i:i + _LOTE]))):
            previas.setdefault(b.client_id, []).append(b)
    for c in sueltas:
        if _viene_de_triage(c, previas.get(c.client_id, [])):
            salida[c.id] = DESDE_TRIAGE
    return salida



def partir_por_canal(filas):
    """`{'directa': n, 'triage': n}`: cuántas de esas filas de agenda (cada una con su `canal`) son de cada canal.
    Siempre suman `len(filas)`."""
    cuenta = {DIRECTA: 0, DESDE_TRIAGE: 0}
    for f in filas:
        cuenta[f['canal']] += 1
    return cuenta
