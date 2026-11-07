"""Embudo de seguimiento después de la llamada (ADR-W120, ADR-W121).

Una columna por día desde la llamada (por defecto 1, 2 y 3; los define la dirección para todo el
equipo). En cada una, los leads cuya última llamada reportada fue hace exactamente esos días, con
cómo van: seguidos hoy (respondió o no), pagaron después de la llamada, tienen otra llamada
agendada o se descartaron. Un lead cambia de columna solo, con el calendario.

Cada «Le escribí» es una fila de `EmbudoRegistro` con el día desde la llamada en que se hizo.
"""
import logging
from datetime import datetime, timedelta

import pytz
from sqlalchemy import func

from app import db
from app.models import Appointment, EmbudoConfig, EmbudoRegistro, FinancialSale

logger = logging.getLogger(__name__)

DIAS_POR_DEFECTO = [1, 2, 3]
DIA_MAXIMO = 14
RESPONDIO, NO_RESPONDIO = 'respondio', 'no_respondio'
# Una llamada sin reportar (o archivada sin reporte) no entra: nadie sabe qué pasó en ella. Un no
# lead o un descalificado no se sigue.
FUERA = {'', 'pendiente', 'archivada sin reporte', 'no lead', 'descalificado', 'descalificada'}
DESCARTADO = {'lead perdido', 'perdido'}
ROLES_QUE_EDITAN = ('admin', 'director_comercial')


def _tz(user):
    try:
        return pytz.timezone((user.timezone if user else None) or 'America/La_Paz')
    except Exception:
        return pytz.timezone('America/La_Paz')


def _local(dt_utc, tz):
    return pytz.UTC.localize(dt_utc).astimezone(tz) if dt_utc else None


def _utc(dia, tz):
    """Inicio del día local `dia`, en UTC sin zona."""
    return tz.localize(datetime.combine(dia, datetime.min.time())).astimezone(pytz.UTC).replace(tzinfo=None)


def config():
    fila = EmbudoConfig.query.first()
    if fila is None:
        fila = EmbudoConfig(dias=list(DIAS_POR_DEFECTO), desde=datetime.utcnow().date())
        db.session.add(fila)
        db.session.commit()
    return fila


def dias_config(fila=None):
    return sorted((fila or config()).dias or DIAS_POR_DEFECTO)


def puede_editar(usuario, rol_original=None):
    return (usuario.role in ROLES_QUE_EDITAN) or (rol_original in ROLES_QUE_EDITAN)


def guardar_config(dias, usuario):
    """Valida y guarda los días. Devuelve (dias, error)."""
    try:
        limpios = sorted({int(d) for d in (dias or [])})
    except (TypeError, ValueError):
        return None, 'Días inválidos'
    if not limpios or limpios[0] < 1 or limpios[-1] > DIA_MAXIMO:
        return None, f'Elegí entre 1 y {DIA_MAXIMO} días después de la llamada'
    fila = config()
    fila.dias = limpios
    fila.updated_by_id = usuario.id
    db.session.commit()
    return limpios, None


def _llamadas(closer_id, desde_utc, hasta_utc):
    """La última llamada reportada de cada lead dentro de la ventana, del closer (o de todos)."""
    q = Appointment.query.filter(Appointment.start_time >= desde_utc, Appointment.start_time < hasta_utc)
    if closer_id:
        q = q.filter(Appointment.closer_id == closer_id)
    por_cliente = {}
    for a in q.order_by(Appointment.start_time.asc()).all():
        if (a.closer_result or '').strip().lower() in FUERA:
            continue
        por_cliente[a.client_id] = a
    return list(por_cliente.values())


def _proximas(client_ids, ahora_utc):
    """{client_id: start_time} de la próxima llamada agendada, si hay."""
    if not client_ids:
        return {}
    filas = (db.session.query(Appointment.client_id, func.min(Appointment.start_time))
             .filter(Appointment.client_id.in_(client_ids), Appointment.start_time >= ahora_utc)
             .group_by(Appointment.client_id).all())
    return dict(filas)


def _pago_desde(client, desde_utc):
    """La primera venta o pago del cliente desde la llamada, o None."""
    from app.services.sales_consistency_service import filtro_de_pagos
    if client is None:
        return None
    return (FinancialSale.query.filter(filtro_de_pagos(client), FinancialSale.date >= desde_utc)
            .order_by(FinancialSale.date.asc()).first())


def _fila(a, dia, regs, proxima, pago, inicio_hoy_utc, tz):
    from app.services.formulario_lead import form_data_de
    hoy_regs = [r for r in regs if r.created_at >= inicio_hoy_utc]
    ultimo = max(regs, key=lambda r: r.created_at) if regs else None
    sin_resp = sum(1 for r in regs if r.resultado == NO_RESPONDIO)
    cr = (a.closer_result or '').strip().lower()
    if pago is not None:
        estado = 'pago'
    elif a.seguimiento_realizado and cr in DESCARTADO:
        estado = 'descartado'
    elif proxima is not None:
        estado = 'agendado'
    elif hoy_regs:
        estado = 'seguido_hoy'
    else:
        estado = 'pendiente'
    c = a.client
    return {
        'id': a.id,
        'client_id': a.client_id,
        'person_uuid': c.person_uuid if c else None,
        'lead_name': (c.full_name or c.email) if c else 'Sin nombre',
        'instagram': c.instagram if c else '',
        'phone': c.phone if c else '',
        'examen': a.examen or '',
        'origin': a.origin or '',
        'closer_result': a.closer_result or '',
        'closer_notes': a.closer_notes or '',
        'call_date': a.start_time.isoformat() if a.start_time else None,
        'dia': dia,
        'segmento': a.segmento,
        'segmento_puntos': a.segmento_puntos,
        'form_data': form_data_de(c, a) if c else {},
        'closer_name': a.closer.username if a.closer else None,
        'estado': estado,
        'hoy': ultimo.resultado if (ultimo and hoy_regs) else None,
        'ultimo': {'resultado': ultimo.resultado, 'dia': ultimo.dia, 'id': ultimo.id} if ultimo else None,
        'respondio': any(r.resultado == RESPONDIO for r in regs),
        'sin_respuesta': sin_resp,
        'proxima_llamada': _local(proxima, tz).isoformat() if proxima else None,
        'pago': {'monto': pago.monto,
                 'fecha': pago.date.isoformat() if pago.date else None} if pago is not None else None,
    }


def tablero(usuario, closer_id):
    fila = config()
    dias = dias_config(fila)
    tz = _tz(usuario)
    ahora_utc = datetime.utcnow()
    hoy = _local(ahora_utc, tz).date()
    inicio_hoy = _utc(hoy, tz)
    citas = _llamadas(closer_id, _utc(hoy - timedelta(days=dias[-1]), tz), inicio_hoy)
    # El día desde la llamada, en la zona del usuario; solo los días del embudo.
    con_dia = [(a, (hoy - _local(a.start_time, tz).date()).days) for a in citas]
    con_dia = [(a, d) for a, d in con_dia if d in dias]
    ids = [a.id for a, _ in con_dia]
    regs = {}
    if ids:
        for r in EmbudoRegistro.query.filter(EmbudoRegistro.appointment_id.in_(ids)).all():
            regs.setdefault(r.appointment_id, []).append(r)
    proximas = _proximas([a.client_id for a, _ in con_dia], ahora_utc)

    columnas = {d: [] for d in dias}
    for a, d in con_dia:
        # Desde el inicio del día de la llamada: una venta se fecha por día, sin hora.
        pago = _pago_desde(a.client, _utc(_local(a.start_time, tz).date(), tz))
        columnas[d].append(_fila(a, d, regs.get(a.id, []), proximas.get(a.client_id), pago, inicio_hoy, tz))

    orden = {'pendiente': 0, 'seguido_hoy': 1, 'agendado': 2, 'pago': 3, 'descartado': 4}
    for lista in columnas.values():
        lista.sort(key=lambda f: (orden[f['estado']], -(f['segmento_puntos'] or 0)))

    todas = [f for d in dias for f in columnas[d]]
    return {
        'dias': dias,
        'columnas': [{'dia': d, 'filas': columnas[d]} for d in dias],
        'resumen': {
            'total': len(todas),
            'seguidos_hoy': sum(1 for f in todas if f['hoy']),
            'por_seguir': sum(1 for f in todas if f['estado'] == 'pendiente'),
            'respondieron': sum(1 for f in todas if f['respondio']),
            'pagaron': sum(1 for f in todas if f['estado'] == 'pago'),
        },
    }


def registrar(appt, usuario, resultado):
    """«Le escribí»: respondió o no. Guarda el día desde la llamada. Devuelve (registro, error)."""
    if resultado not in (RESPONDIO, NO_RESPONDIO):
        return None, 'Resultado inválido'
    if not appt.start_time:
        return None, 'La agenda no tiene fecha'
    tz = _tz(usuario)
    dia = (_local(datetime.utcnow(), tz).date() - _local(appt.start_time, tz).date()).days
    if dia < 0:
        return None, 'La llamada todavía no pasó'
    reg = EmbudoRegistro(appointment_id=appt.id, user_id=usuario.id, dia=dia, resultado=resultado)
    db.session.add(reg)
    from app.services import lead_log_service
    texto = (f'Seguimiento · día {dia} desde la llamada: le escribió y respondió' if resultado == RESPONDIO
             else f'Seguimiento · día {dia} desde la llamada: le escribió y no respondió')
    lead_log_service.evento(appt, 'seguimiento', texto, usuario=usuario)
    db.session.commit()
    return reg, None


def deshacer(reg_id, usuario):
    """Borra un registro (el «Deshacer»): solo quien lo hizo, o la dirección."""
    reg = db.session.get(EmbudoRegistro, reg_id)
    if reg is None:
        return 'No existe'
    if reg.user_id != usuario.id and usuario.role not in ROLES_QUE_EDITAN:
        return 'Solo quien lo registró puede deshacerlo'
    db.session.delete(reg)
    db.session.commit()
    return None
