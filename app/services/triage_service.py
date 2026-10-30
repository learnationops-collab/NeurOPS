"""La llamada de triage: reporte, pase al closer, lo que muestra la ficha y las métricas.

El triage trabaja con la misma vista del closer (mazo, ficha, confirmación, seguimientos). Lo único
propio es cómo se reporta la llamada, y por eso vive acá y no en el árbol del closer:

  · asistió, no se presentó o canceló: lo mismo que reporta el closer (`ficha_acciones_service.resultado`);
  · reagenda: la misma agenda pasa a la hora nueva y vuelve a confirmarse, como la reagenda del closer;
  · si asistió, calificación económica: **calificado** (puede invertir más de 500 USD) pasa al closer
    con una agenda nueva y una nota; **descalificado** cierra con el low ticket de 100 USD;
  · del low ticket se registra si se pitcheó y cómo quedó: cerró, no cerró, seguimiento o descartado.
    «Cerró» trae la venta (monto y medio de pago): se registra como `LT - completo` a nombre del triage
    y se le da el acceso en la Academia (`_vender_low_ticket`, academy ADR-199).

Una agenda es de triage cuando su `closer_id` es una cuenta con el rol `triage`.
"""
from datetime import date, datetime

from app import db
from app.models import Appointment, User

CALIFICACIONES = ('calificado', 'descalificado')
PROGRAMA_LOW_TICKET = 'LT'
LOW_TICKET = ('no_pitch', 'cerrado', 'no_cerrado', 'seguimiento', 'descartado')
PITCHEADO = ('cerrado', 'no_cerrado', 'seguimiento', 'descartado')
ASISTENCIAS = ('asistio', 'no_show', 'cancelo')
_SEGMENTO = ('segmento', 'segmento_puntos', 'segmento_preguntas', 'segmento_confianza', 'segmento_version')
_LOW_TICKET_TEXTO = {'no_pitch': 'no se le pitcheó el low ticket', 'cerrado': 'cerró el low ticket',
                     'no_cerrado': 'no cerró el low ticket', 'seguimiento': 'low ticket en seguimiento',
                     'descartado': 'lead perdido'}


def es_de_triage(appt):
    return bool(appt and appt.closer and appt.closer.tiene_rol('triage'))


def _error(mensaje, campo=None):
    from app.services.ficha_acciones_service import ErrorDeAccion
    return ErrorDeAccion(mensaje, campo)


def _log(appt, usuario, texto):
    from app.services.booking_service import BookingService
    BookingService.log_lead_event(appt.id, usuario.id, 'triage', texto)


def _fecha_seguimiento(datos):
    valor = (datos.get('fecha_seguimiento') or '').strip()
    try:
        return date.fromisoformat(valor[:10]).isoformat()
    except ValueError:
        raise _error('Elegí la fecha del seguimiento.', 'fecha_seguimiento') from None


def _aplicar_low_ticket(appt, estado, datos):
    if estado not in LOW_TICKET:
        raise _error('Elegí qué pasó con el low ticket.', 'low_ticket')
    fecha = _fecha_seguimiento(datos) if estado == 'seguimiento' else None
    appt.triage_low_ticket = estado
    if fecha:
        # El seguimiento del triage es el mismo del closer: cae en su pestaña «Seguir».
        appt.fecha_seguimiento = fecha
        appt.seguimiento_tipo = 'tomada'
        appt.seguimiento_realizado = False
    elif appt.fecha_seguimiento:
        appt.seguimiento_realizado = True


def _venta_low_ticket(datos):
    """El monto y el medio de la venta del low ticket, validados antes de reportar nada."""
    venta = datos.get('venta') if isinstance(datos.get('venta'), dict) else {}
    try:
        monto = float(venta.get('monto') or 0)
    except (TypeError, ValueError):
        monto = 0
    if monto <= 0:
        raise _error('Escribí cuánto pagó.', 'monto')
    if not venta.get('metodo_pago'):
        raise _error('Elegí el medio de pago.', 'metodo_pago')
    return {'monto': monto, 'metodo_pago': venta['metodo_pago'], 'transferido_a': venta.get('transferido_a')}


def _vender_low_ticket(appt, venta, usuario):
    """Registra la venta del low ticket por el camino de toda venta (`ficha_acciones_service._declarar`:
    FinancialSale, suscripción de un mes y aviso a n8n) y le da el acceso en la Academia. Si el acceso
    falla, la venta queda y vuelve el aviso: declararla de nuevo la duplicaría."""
    from app.services import ficha_acciones_service as acciones

    resultado = acciones._declarar(appt, {'tipo_pago': f'{PROGRAMA_LOW_TICKET} - completo', **venta}, usuario)
    avisos = [resultado['warning']] if resultado.get('warning') else []
    acciones._despues_de_la_venta(avisos, 'Acceso a la Academia', lambda: acciones._dar_acceso_a_la_academia(
        appt.client_id, {'programa_code': PROGRAMA_LOW_TICKET, 'tipo_venta': 'completo'}, usuario))
    return avisos


def _validar(appt, datos):
    asistencia = datos.get('asistencia')
    if asistencia not in ASISTENCIAS + ('reagenda',):
        raise _error('Elegí si el lead se presentó.', 'asistencia')
    if asistencia != 'asistio':
        return
    calificacion = datos.get('calificacion')
    if calificacion not in CALIFICACIONES:
        raise _error('Elegí si el lead calificó económicamente.', 'calificacion')
    if calificacion == 'calificado':
        if not (datos.get('nota_para_closer') or '').strip():
            raise _error('Dejale una nota al closer.', 'nota_para_closer')
        if not datos.get('closer_id') or not datos.get('fecha'):
            raise _error('Elegí el closer y el horario de la llamada.', 'fecha')
    else:
        if not (datos.get('nota') or '').strip():
            raise _error('Dejá una nota de por qué no califica.', 'nota')
        if datos.get('low_ticket') not in LOW_TICKET:
            raise _error('Elegí qué pasó con el low ticket.', 'low_ticket')


def _pasar_al_closer(appt, datos, usuario):
    """La agenda de closing, por el mismo camino que «Agendar otra llamada» de la ficha."""
    from app.agendas_v2 import a_triage
    from app.services import ficha_acciones_service as acciones

    closer = db.session.get(User, int(datos['closer_id']))
    sesion = a_triage.sesion_closing_de(closer) if closer else None
    nueva = acciones.crear_agenda(appt, {'fecha': datos['fecha'], 'closer_id': datos['closer_id'], 'sesion': sesion},
                                  usuario)
    closing = db.session.get(Appointment, nueva['id'])
    closing.agenda_triage_id = appt.id
    for campo in _SEGMENTO:  # mantiene el segmento original para medir después
        setattr(closing, campo, getattr(appt, campo))
    return closing


def reportar(appt, datos, usuario):
    """El reporte de la llamada. Sin `asistencia` solo cambia el estado del low ticket de un lead ya
    descalificado (el que quedó en seguimiento y después cerró o se descartó)."""
    from app.services import ficha_acciones_service as acciones

    if not es_de_triage(appt):
        raise _error('Esta agenda no es de triage.')

    if 'asistencia' not in datos:
        # «Registrar el low ticket» de la ficha llega acá sin reporte previo: solo la venta.
        if appt.triage_calificacion == 'calificado':
            raise _error('Este lead ya pasó al closer: la venta es suya.')
        if appt.triage_calificacion != 'descalificado' and datos.get('low_ticket') != 'cerrado':
            raise _error('Reportá primero la llamada.')
        vende = datos.get('low_ticket') == 'cerrado' and appt.triage_low_ticket != 'cerrado'
        if datos.get('low_ticket') not in LOW_TICKET:
            raise _error('Elegí qué pasó con el low ticket.', 'low_ticket')
        # La venta primero: si no se puede registrar, el low ticket no queda cerrado sin venta.
        avisos = _vender_low_ticket(appt, _venta_low_ticket(datos), usuario) if vende else []
        _aplicar_low_ticket(appt, datos.get('low_ticket'), datos)
        db.session.commit()
        _log(appt, usuario, f'{usuario.username} actualizó el triage: {_LOW_TICKET_TEXTO[appt.triage_low_ticket]}.')
        return {**bloque(appt), 'avisos': avisos, 'vendio': vende}

    _validar(appt, datos)
    if datos['asistencia'] == 'reagenda':
        return _reagendar(appt, datos, usuario)
    vende = (datos['asistencia'] == 'asistio' and datos.get('calificacion') == 'descalificado'
             and datos.get('low_ticket') == 'cerrado')
    venta = _venta_low_ticket(datos) if vende else None
    nota = (datos.get('nota') or '').strip() or None
    calificacion = datos.get('calificacion') if datos['asistencia'] == 'asistio' else None

    # El pase primero: si el horario del closer está ocupado, no queda nada reportado a medias.
    closing = _pasar_al_closer(appt, datos, usuario) if calificacion == 'calificado' else None
    # Lo mismo con la venta del low ticket: si no se registra, no queda reportada como cerrada.
    avisos = _vender_low_ticket(appt, venta, usuario) if vende else []

    acciones.resultado(appt, {'resultado': datos['asistencia'], 'nota': nota}, usuario)
    appt.triage_calificacion = calificacion
    if calificacion == 'calificado':
        _nota_para_closer(appt, closing, datos['nota_para_closer'].strip(), usuario)
        appt.triage_low_ticket = None
    elif calificacion == 'descalificado':
        _aplicar_low_ticket(appt, datos['low_ticket'], datos)
    db.session.commit()

    if calificacion == 'calificado':
        _log(appt, usuario, f'{usuario.username} calificó al lead (+500 USD) y lo pasó a '
                            f'{closing.closer.username if closing.closer else "closing"}.')
    elif calificacion == 'descalificado':
        _log(appt, usuario, f'{usuario.username} lo descalificó económicamente: '
                            f'{_LOW_TICKET_TEXTO[appt.triage_low_ticket]}.')
    return {**bloque(appt), 'avisos': avisos, 'vendio': vende}


def _reagendar(appt, datos, usuario):
    """La misma agenda a la hora nueva, de vuelta a confirmar (la reagenda del árbol del closer)."""
    from app.services import ficha_acciones_service as acciones
    from app.services.deck_escritura_service import aplicar_cambios
    from app.services.ficha_agendas_service import _instante_utc

    inicio = _instante_utc(datos.get('fecha'))
    if inicio <= datetime.utcnow():
        raise _error('La fecha nueva tiene que ser futura.', 'fecha')
    acciones._mover_la_llamada(appt, inicio, usuario)
    aplicar_cambios(appt, {'confirm_status': 'por_confirmar', 'result': 'Pendiente'}, usuario)
    db.session.commit()
    nota = (datos.get('nota') or '').strip()
    _log(appt, usuario, f'{usuario.username} reagendó la sesión diagnóstica' + (f': «{nota}».' if nota else '.'))
    return {**bloque(appt), 'avisos': [], 'vendio': False}


def _nota_para_closer(appt, closing, texto, usuario):
    """La nota va al log de la persona, sobre la agenda del triage, y le avisa al closer de la agenda de
    closing (docs/plan_notas_avisos_settings.md)."""
    from app.services import avisos_service, lead_log_service

    entrada = lead_log_service.registrar(
        appt.person_uuid, 'nota_para_closer', texto, user_id=usuario.id, origen='appointment',
        origen_id=appt.id, payload={'agenda_closing_id': closing.id})
    db.session.flush()
    nombre = appt.client.full_name if appt.client else 'un lead'
    avisos_service.avisar('nota', 'user', closing.closer_id, f'Nota del triage: {nombre}', texto,
                          origen='log', origen_id=entrada.id, person_uuid=appt.person_uuid)


def _texto_nota(appt):
    from app.services import lead_log_service

    entrada = lead_log_service.ultima('nota_para_closer', 'appointment', appt.id)
    return entrada.description if entrada else None


# --- Lo que muestra la ficha ------------------------------------------------------------------

def _iso(valor):
    return valor.isoformat() if valor else None


def bloque(appt):
    """El bloque `triage` de la ficha: el reporte de una agenda de triage, o el sello de una agenda de
    closing que viene del triage. None si no es ninguna de las dos."""
    if appt is None:
        return None
    if es_de_triage(appt):
        closing = Appointment.query.filter_by(agenda_triage_id=appt.id).order_by(Appointment.id.desc()).first()
        return {
            'es_triage': True,
            # Un «Asistió» marcado desde la tarjeta del mazo todavía no dice si calificó: sigue abierta.
            'reportada': bool(appt.triage_calificacion)
            or (appt.closer_result or 'Pendiente') not in ('Pendiente', '', 'Show up'),
            'asistencia': appt.closer_result,
            'calificacion': appt.triage_calificacion,
            'low_ticket': appt.triage_low_ticket,
            'nota_para_closer': _texto_nota(appt),
            'fecha_seguimiento': appt.fecha_seguimiento,
            'closing': closing and {'id': closing.id, 'fecha': _iso(closing.start_time),
                                    'closer': closing.closer.username if closing.closer else None},
        }
    if appt.agenda_triage_id:
        origen = db.session.get(Appointment, appt.agenda_triage_id)
        if origen:
            return {
                'es_triage': False,
                'viene_de_triage': {
                    'por': origen.closer.username if origen.closer else None,
                    'fecha': _iso(origen.start_time),
                    'nota': _texto_nota(origen),
                    'segmento': origen.segmento,
                },
            }
    return None


# --- Métricas ---------------------------------------------------------------------------------

def _vacias():
    return {k: 0 for k in ('agendas', 'confirmadas', 'asistencias', 'no_show', 'canceladas', 'sin_reporte',
                           'calificados', 'descalificados', 'pitch_low_ticket', 'no_pitch', 'cerrado',
                           'no_cerrado', 'seguimiento', 'descartado', 'pasadas_asistieron')}


def _confirmada(a):
    """Confirmó la llamada, o ya asistió (que la confirmó de hecho)."""
    resultado = (a.closer_result or '').strip().lower()
    previo = (a.result or '').strip().lower()
    return previo == 'confirmado' or a.confirmation_stage == 'confirmado' or resultado == 'show up'


def _sumar(m, a, closing_show):
    m['agendas'] += 1
    resultado = (a.closer_result or '').strip().lower()
    previo = (a.result or '').strip().lower()
    if _confirmada(a):
        m['confirmadas'] += 1
    if resultado == 'show up':
        m['asistencias'] += 1
    elif resultado == 'no show':
        m['no_show'] += 1
    elif resultado.startswith('cancel') or previo.startswith('cancel'):
        m['canceladas'] += 1
    elif resultado in ('', 'pendiente'):
        m['sin_reporte'] += 1
    if a.triage_calificacion == 'calificado':
        m['calificados'] += 1
        m['pasadas_asistieron'] += 1 if a.id in closing_show else 0
    elif a.triage_calificacion == 'descalificado':
        m['descalificados'] += 1
        lt = a.triage_low_ticket
        if lt in PITCHEADO:
            m['pitch_low_ticket'] += 1
        if lt in LOW_TICKET:
            m[lt] += 1


def triages(solo=None):
    q = User.query.filter(User.role == 'triage', User.is_active.is_(True))
    if solo is not None:
        q = q.filter(User.id == solo)
    return q.order_by(User.username).all()


def metricas(desde, hasta, solo=None):
    """El embudo del triage entre `desde` y `hasta` (datetimes UTC naive, por la hora de la llamada):
    agendas → confirmadas → asistencias → calificados / descalificados → pitch del low ticket → cómo
    quedó. `solo`: el id de una triage (la que mira lo suyo); si no, todas y el detalle por persona."""
    personas = triages(solo)
    ids = [p.id for p in personas]
    agendas = Appointment.query.filter(
        Appointment.closer_id.in_(ids or [0]),
        Appointment.start_time >= desde, Appointment.start_time < hasta,
    ).all()
    pasadas = Appointment.query.filter(
        Appointment.agenda_triage_id.in_([a.id for a in agendas] or [0])).all()
    closing_show = {c.agenda_triage_id for c in pasadas if (c.closer_result or '').lower() == 'show up'}

    total, por_id = _vacias(), {p.id: _vacias() for p in personas}
    for a in agendas:
        _sumar(total, a, closing_show)
        _sumar(por_id[a.closer_id], a, closing_show)
    from app.agendas_v2 import abandonos

    return {
        'desde': desde.isoformat(), 'hasta': hasta.isoformat(), 'total': total,
        'abandonos': abandonos.resumen(desde, hasta),
        'por_persona': [{'id': p.id, 'nombre': p.username, **por_id[p.id]} for p in personas],
        'leads': _leads(agendas),
    }


def _leads(agendas):
    """El reporte del período, lead por lead: cómo quedó y sus dos notas (la de la llamada y la del closer).
    Las notas salen del log en una sola consulta."""
    from app.models import LeadEventLog

    notas = {}
    for e in (LeadEventLog.query.filter(LeadEventLog.origen == 'appointment',
                                        LeadEventLog.origen_id.in_([a.id for a in agendas] or [0]),
                                        LeadEventLog.action_type.in_(('nota_llamada', 'nota_para_closer')))
              .order_by(LeadEventLog.created_at, LeadEventLog.id)):
        notas[(e.origen_id, e.action_type)] = e.description
    return [{
        'id': a.id, 'cliente': a.client.full_name if a.client else None, 'client_id': a.client_id,
        'hora': _iso(a.start_time), 'triage': a.closer.username if a.closer else None,
        'confirmada': _confirmada(a), 'asistencia': a.closer_result,
        'calificacion': a.triage_calificacion, 'low_ticket': a.triage_low_ticket,
        'fecha_seguimiento': a.fecha_seguimiento,
        'nota': notas.get((a.id, 'nota_llamada')), 'nota_para_closer': notas.get((a.id, 'nota_para_closer')),
    } for a in sorted(agendas, key=lambda a: a.start_time)]

