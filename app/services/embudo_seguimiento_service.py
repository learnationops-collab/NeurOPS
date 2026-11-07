"""Embudo de seguimiento después de la llamada (ADR-W120).

Entra al embudo la última llamada de cada lead, ya reportada y sin venta (tomada, no show,
cancelada o reagendada sin cita nueva), desde la fecha `desde` de la configuración. Los días del
embudo (por defecto 1, 2 y 3 después de la llamada) los define la dirección para todo el equipo.

El estado de cada lead se deduce de sus `EmbudoRegistro`, sin columnas en la agenda:
  · un registro «respondio» → salió del embudo (columna Respondieron);
  · si no, está en el primer día configurado mayor que el último «no_respondio»;
  · si no queda ninguno, terminó el embudo y vuelve al pool.
Quitar un día de la configuración mueve solo a quienes estaban en él al siguiente.
Un lead que nadie registró se queda atrasado en su día: el embudo no avanza solo.
"""
import logging
from datetime import date, datetime, timedelta

import pytz
from sqlalchemy import func

from app import db
from app.models import Appointment, EmbudoConfig, EmbudoRegistro, User
from app.services.closer_followup_service import CloserFollowUpService

logger = logging.getLogger(__name__)

DIAS_POR_DEFECTO = [1, 2, 3]
DIA_MAXIMO = 14
RESPONDIO, NO_RESPONDIO = 'respondio', 'no_respondio'
VENTANA_RESPONDIERON = 7
# Una llamada sin reportar no entra: todavía está en Reportar.
SIN_REPORTAR = {'', 'pendiente'}
ROLES_QUE_EDITAN = ('admin', 'director_comercial')


def _tz(user):
    try:
        return pytz.timezone((user.timezone if user else None) or 'America/La_Paz')
    except Exception:
        return pytz.timezone('America/La_Paz')


def _fecha_local(dt_utc, tz):
    return pytz.UTC.localize(dt_utc).astimezone(tz).date() if dt_utc else None


def _inicio_dia_utc(dia, tz):
    return tz.localize(datetime.combine(dia, datetime.min.time())).astimezone(pytz.UTC).replace(tzinfo=None)


def config():
    fila = EmbudoConfig.query.first()
    if fila is None:
        fila = EmbudoConfig(dias=list(DIAS_POR_DEFECTO), desde=date.today())
        db.session.add(fila)
        db.session.commit()
    return fila


def config_dict(fila=None):
    fila = fila or config()
    return {'dias': sorted(fila.dias or DIAS_POR_DEFECTO), 'desde': fila.desde.isoformat()}


def puede_editar(usuario, rol_original=None):
    return (usuario.role in ROLES_QUE_EDITAN) or (rol_original in ROLES_QUE_EDITAN)


def guardar_config(dias, usuario, desde=None):
    """Valida y guarda los días. Devuelve (config, error)."""
    try:
        limpios = sorted({int(d) for d in (dias or [])})
    except (TypeError, ValueError):
        return None, 'Días inválidos'
    if not limpios or limpios[0] < 1 or limpios[-1] > DIA_MAXIMO:
        return None, f'Elegí entre 1 y {DIA_MAXIMO} días después de la llamada'
    fila = config()
    fila.dias = limpios
    if desde:
        try:
            fila.desde = date.fromisoformat(str(desde)[:10])
        except ValueError:
            return None, 'Fecha inválida'
    fila.updated_by_id = usuario.id
    db.session.commit()
    return fila, None


def _etapa(regs, dias):
    """(estado, dia) de un lead según sus registros: 'respondio', 'pendiente' o 'agotado'."""
    resp = [r for r in regs if r.resultado == RESPONDIO]
    if resp:
        return RESPONDIO, max(r.dia for r in resp)
    hecho = max((r.dia for r in regs if r.resultado == NO_RESPONDIO), default=0)
    siguiente = next((d for d in dias if d > hecho), None)
    return ('pendiente', siguiente) if siguiente else ('agotado', hecho)


def _candidatas(closer_id, desde_utc, ahora_utc):
    """Últimas llamadas de cada lead, ya pasadas y reportadas, que siguen en seguimiento."""
    citas = (CloserFollowUpService._base_query(closer_id)
             .filter(Appointment.start_time >= desde_utc, Appointment.start_time < ahora_utc)
             .all())
    citas = [a for a in citas if (a.closer_result or '').strip().lower() not in SIN_REPORTAR
             and CloserFollowUpService._effective_tipo(a) in ('tomada', 'no_tomada')]
    if not citas:
        return []
    clientes = {a.client_id for a in citas}
    ultima = dict(db.session.query(Appointment.client_id, func.max(Appointment.start_time))
                  .filter(Appointment.client_id.in_(clientes)).group_by(Appointment.client_id).all())
    return [a for a in citas if ultima.get(a.client_id) == a.start_time]


def _registros_de(ids):
    por_cita = {}
    if ids:
        for r in EmbudoRegistro.query.filter(EmbudoRegistro.appointment_id.in_(ids)).all():
            por_cita.setdefault(r.appointment_id, []).append(r)
    return por_cita


def _nota(a):
    texto = (a.closer_notes or '').strip().replace('\n', ' ')
    return texto[-160:] if len(texto) > 160 else texto


def _tarjeta(a, estado, dia, hoy, tz, ahora_utc, regs):
    from app.services.formulario_lead import form_data_de
    fecha_llamada = _fecha_local(a.start_time, tz)
    vence = fecha_llamada + timedelta(days=dia) if (fecha_llamada and estado == 'pendiente') else None
    ultimo = max(regs, key=lambda r: r.created_at) if regs else None
    return {
        'id': a.id,
        'client_id': a.client_id,
        'person_uuid': a.client.person_uuid if a.client else None,
        'lead_name': (a.client.full_name or a.client.email) if a.client else 'Sin nombre',
        'instagram': a.client.instagram if a.client else '',
        'phone': a.client.phone if a.client else '',
        'examen': a.examen or '',
        'origin': a.origin or '',
        'closer_result': a.closer_result or '',
        'tipo': CloserFollowUpService._effective_tipo(a),
        'closer_notes': a.closer_notes or '',
        'nota': _nota(a),
        'call_date': a.start_time.isoformat() if a.start_time else None,
        'minutos_desde_llamada': int((ahora_utc - a.start_time).total_seconds() // 60) if a.start_time else None,
        'dia': dia,
        'vence': vence.isoformat() if vence else None,
        'atrasado': bool(vence and hoy > vence),
        'proximo': bool(vence and hoy < vence),
        'segmento': a.segmento,
        'segmento_puntos': a.segmento_puntos,
        'with_decision_maker': a.with_decision_maker,
        'form_data': form_data_de(a.client, a) if a.client else {},
        'setter_name': a.setter.username if a.setter else None,
        'closer_name': a.closer.username if a.closer else None,
        'registrado_at': ultimo.created_at.isoformat() if ultimo else None,
    }


def tablero(usuario, closer_id):
    fila = config()
    dias = sorted(fila.dias or DIAS_POR_DEFECTO)
    tz = _tz(usuario)
    ahora_utc = datetime.utcnow()
    hoy = _fecha_local(ahora_utc, tz)
    citas = _candidatas(closer_id, _inicio_dia_utc(fila.desde, tz), ahora_utc)
    regs = _registros_de([a.id for a in citas])

    columnas = {d: [] for d in dias}
    respondieron, agotados = [], 0
    limite_resp = ahora_utc - timedelta(days=VENTANA_RESPONDIERON)
    for a in citas:
        suyos = regs.get(a.id, [])
        estado, dia = _etapa(suyos, dias)
        if estado == 'pendiente':
            columnas[dia].append(_tarjeta(a, estado, dia, hoy, tz, ahora_utc, suyos))
        elif estado == RESPONDIO:
            if max(r.created_at for r in suyos if r.resultado == RESPONDIO) >= limite_resp:
                respondieron.append(_tarjeta(a, estado, dia, hoy, tz, ahora_utc, suyos))
        else:
            agotados += 1

    for lista in columnas.values():
        # Atrasados primero; después, el que lleva más tiempo esperando.
        lista.sort(key=lambda t: (not t['atrasado'], t['proximo'], t['call_date'] or ''))
    respondieron.sort(key=lambda t: t['registrado_at'] or '', reverse=True)

    pendientes = [t for d in dias for t in columnas[d]]
    para_hoy = [t for t in pendientes if not t['proximo']]
    resueltos_hoy = (EmbudoRegistro.query
                     .filter(EmbudoRegistro.user_id == usuario.id,
                             EmbudoRegistro.created_at >= _inicio_dia_utc(hoy, tz))
                     .count())
    total = len(pendientes) + len(respondieron) + agotados
    return {
        'config': config_dict(fila),
        'columnas': [{'dia': d, 'tarjetas': columnas[d]} for d in dias],
        'respondieron': respondieron,
        'resumen': {
            'resueltos_hoy': resueltos_hoy,
            'para_hoy': len(para_hoy),
            'pendientes': len(pendientes),
            'atrasados': sum(1 for t in pendientes if t['atrasado']),
            'respondieron': len(respondieron),
            'agotados': agotados,
            'total': total,
        },
    }


def registrar(appt, usuario, resultado):
    """Registra el seguimiento del día en que está el lead. Devuelve (registro, error)."""
    if resultado not in (RESPONDIO, NO_RESPONDIO):
        return None, 'Resultado inválido'
    dias = sorted(config().dias or DIAS_POR_DEFECTO)
    estado, dia = _etapa(EmbudoRegistro.query.filter_by(appointment_id=appt.id).all(), dias)
    if estado != 'pendiente':
        return None, 'Este lead ya no está en el embudo'
    reg = EmbudoRegistro(appointment_id=appt.id, user_id=usuario.id, dia=dia, resultado=resultado)
    db.session.add(reg)
    from app.services import lead_log_service
    texto = (f'Embudo · Día {dia}: respondió' if resultado == RESPONDIO
             else f'Embudo · Día {dia}: no respondió')
    lead_log_service.evento(appt, 'seguimiento', texto, usuario=usuario)
    db.session.commit()
    return reg, None


def deshacer(reg_id, usuario):
    """Borra un registro propio de hoy (el «Deshacer» del tablero o el «Devolver» de un respondido)."""
    reg = db.session.get(EmbudoRegistro, reg_id)
    if reg is None:
        return 'No existe'
    if reg.user_id != usuario.id and usuario.role not in ROLES_QUE_EDITAN:
        return 'Solo quien lo registró puede deshacerlo'
    db.session.delete(reg)
    db.session.commit()
    return None


def devolver(appt, usuario):
    """Un lead que figuraba como «respondió» vuelve a su día del embudo."""
    regs = EmbudoRegistro.query.filter_by(appointment_id=appt.id, resultado=RESPONDIO).all()
    if not regs:
        return 'Este lead no figura como respondido'
    for r in regs:
        db.session.delete(r)
    db.session.commit()
    return None
