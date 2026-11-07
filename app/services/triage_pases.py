"""Qué pasó con las llamadas que el triage pasó a closing: cuántas asistieron con el closer y cuántas cerraron.

El pase es la agenda de closing con `agenda_triage_id` (`triage_service._pasar_al_closer`). Si el closer la
reagenda, la vieja queda 'Reagendado' y nace otra fila sin ese enlace: se sigue la cadena hasta la agenda
en pie, para que una reagenda no cuente como una asistencia perdida.

Asistió = `closer_result` 'Show up' (o un estado de la agenda que implique que hubo llamada). `estado` del pase:
asistio / no_asistio (no show, canceló, descartada) / pendiente (la llamada aún no ocurre o se reagendó sin nueva
fecha) / sin_reporte (la llamada ya pasó y el closer no la reportó). `sena` y `cobrado` salen de los pagos del lead
desde la llamada. Cerró = venta de pago completo o split pay (`REAL_SALE_TIPOS`), la misma
regla del close rate: la seña no es un cierre.

`origen_de` hace el camino inverso para el embudo de Closing: de una agenda de closing, si llegó directa o desde triage.
"""
from datetime import datetime, timedelta

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


def _estado_del_pase(c, fila, asistio, ahora):
    """asistio / no_asistio / pendiente / sin_reporte de la agenda de closing `c` (ver el docstring del módulo)."""
    if asistio:
        return 'asistio'
    clave = (fila.get('post_call') or {}).get('key')
    if clave in ('pendiente', 'reagendo', None):
        ya_paso = bool(c.start_time and c.start_time <= ahora)
        return 'sin_reporte' if clave == 'pendiente' and ya_paso else 'pendiente'
    return 'no_asistio'


def _cobrado_de(citas):
    """`{id de la agenda: monto}` de los pagos de venta o seña de su lead desde el día de la llamada
    (los de su persona y los atados a su cliente; el mismo margen de un día de `ventas_previas`)."""
    from app import db
    from app.models import FinancialSale
    from app.services.closer_service import REAL_SALE_TIPOS
    from app.services.sheets_service import SheetsService
    from app.services.ventas_previas import TOLERANCIA_DIAS, _VIGENTES

    personas = sorted({c.person_uuid for c in citas if c.person_uuid})
    clientes = sorted({c.client_id for c in citas if c.client_id})
    pagos = {}
    columnas = (FinancialSale.id, FinancialSale.person_uuid, FinancialSale.client_id, FinancialSale.tipo_pago,
                FinancialSale.estado, FinancialSale.date, FinancialSale.monto)
    for columna, valores in ((FinancialSale.person_uuid, personas), (FinancialSale.client_id, clientes)):
        for i in range(0, len(valores), _LOTE):
            for fila in db.session.query(*columnas).filter(columna.in_(valores[i:i + _LOTE])):
                pagos[fila[0]] = fila
    tipos = REAL_SALE_TIPOS + ('seña',)
    salida = {}
    for c in citas:
        if not c.start_time:
            continue
        limite = c.start_time.date() - timedelta(days=TOLERANCIA_DIAS)
        salida[c.id] = round(sum(
            f[6] or 0 for f in pagos.values()
            if ((c.person_uuid and f[1] == c.person_uuid) or (c.client_id and f[2] == c.client_id))
            and (f[4] or '').strip().lower() in _VIGENTES and f[5] and f[5].date() >= limite
            and SheetsService.parse_tipo_pago(f[3])[1] in tipos), 2)
    return salida


def pases_de(agendas_triage):
    """`{id de la agenda de triage: pase}` de las que ya pasaron al closer. Cada pase:
    `id` (agenda de closing), `closer_id`, `closer`, `fecha`, `asistio`, `estado`, `cerro`, `venta_tipo`,
    `sena` (dejó una seña, la haya completado o no) y `cobrado` (lo cobrado de ese lead desde la llamada)."""
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
    cobrado = _cobrado_de(list(vigentes.values()))
    ahora = datetime.utcnow()
    salida = {}
    for tid, c in vigentes.items():
        fila = filas.get(c.id, {})
        asistio = (c.closer_result or '').strip().lower() == 'show up' or bool(fila.get('asistio'))
        salida[tid] = {
            'id': c.id, 'closer_id': c.closer_id, 'closer': c.closer.username if c.closer else 'Sin closer',
            'fecha': c.start_time.isoformat() if c.start_time else None,
            'asistio': asistio, 'estado': _estado_del_pase(c, fila, asistio, ahora),
            'cerro': bool(fila.get('con_venta')), 'venta_tipo': fila.get('venta_tipo'),
            'sena': bool(fila.get('con_sena')), 'cobrado': cobrado.get(c.id, 0.0),
        }
    return salida


# --- Origen de una agenda de closing --------------------------------------------------------------

def _del_triage(a):
    return bool(a.closer and a.closer.tiene_rol('triage'))


def _viene_de_triage(cita, previas):
    """El `agenda_triage_id` del pase del que cuelga la reagenda `cita` (sin enlace propio), o None. Camina hacia atrás
    por las reagendadas del mismo cliente (la misma cadena que `_en_pie` recorre hacia adelante) hasta dar con un
    enlace o con una agenda que no es reagenda: ahí termina la cadena y era directa."""
    actual = cita
    while True:
        anteriores = [b for b in previas if b.id < actual.id and _reagendada(b) and not _del_triage(b)]
        if not anteriores:
            return None
        actual = max(anteriores, key=lambda b: b.id)
        if actual.agenda_triage_id:
            return actual.agenda_triage_id
        if not actual.is_rescheduled:
            return None


def _pase_de(citas):
    """`{id: agenda_triage_id | None}`: la agenda de triage de la que viene cada agenda de closing (la suya o, en una
    reagenda, la de su cadena; ver `_viene_de_triage`)."""
    citas = list(citas)
    salida = {c.id: c.agenda_triage_id for c in citas}
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
        salida[c.id] = _viene_de_triage(c, previas.get(c.client_id, []))
    return salida


def origen_de(citas, pases=None):
    """`{id: 'directa' | 'triage'}` de unas agendas de closing. Desde triage = la agenda que generó el pase
    (`agenda_triage_id`) o una reagenda suya: al reagendar, la fila nueva no lleva el enlace y sin seguirla las
    reagendadas pasarían por directas. Directa = todo lo demás, incluidas las agendas de las propias personas de triage.
    `citas`: cualquier objeto con `id`, `agenda_triage_id`, `is_rescheduled` y `client_id`. `pases`: el `_pase_de` ya
    calculado, si lo hay."""
    pases = _pase_de(citas) if pases is None else pases
    return {cid: DESDE_TRIAGE if tid else DIRECTA for cid, tid in pases.items()}


def quien_triage(pases):
    """`{id: nombre | None}`: quién hizo el triage de cada agenda (la persona de la agenda de triage del pase), de un
    `_pase_de`. None si llegó directa (06/11/2026: la columna Triage de Revisar)."""
    ids = sorted({tid for tid in pases.values() if tid})
    nombres = {}
    for i in range(0, len(ids), _LOTE):
        for t in Appointment.query.options(joinedload(Appointment.closer)).filter(Appointment.id.in_(ids[i:i + _LOTE])):
            nombres[t.id] = t.closer.username if t.closer else 'Sin persona'
    return {cid: nombres.get(tid) if tid else None for cid, tid in pases.items()}



def partir_por_canal(filas):
    """`{'directa': n, 'triage': n}`: cuántas de esas filas de agenda (cada una con su `canal`) son de cada canal.
    Siempre suman `len(filas)`."""
    cuenta = {DIRECTA: 0, DESDE_TRIAGE: 0}
    for f in filas:
        cuenta[f['canal']] += 1
    return cuenta
