"""La llamada de triage: reporte, pase al closer, lo que muestra la ficha y las métricas.

El triage trabaja con la misma vista del closer (mazo, ficha, confirmación, seguimientos). Lo único
propio es cómo se reporta la llamada, y por eso vive acá y no en el árbol del closer:

  · asistió, no se presentó o canceló: lo mismo que reporta el closer (`ficha_acciones_service.resultado`);
  · si asistió, calificación económica: **calificado** (puede invertir más de 500 USD) pasa al closer
    con una agenda nueva y una nota; **descalificado** cierra con el low ticket de 100 USD;
  · del low ticket se registra si se pitcheó y cómo quedó: cerró, no cerró, seguimiento o descartado.
    Por ahora es solo estado: la venta se carga cuando exista el producto.

Una agenda es de triage cuando su `closer_id` es una cuenta con el rol `triage`.
"""
from datetime import date

from app import db
from app.models import Appointment, User

CALIFICACIONES = ('calificado', 'descalificado')
LOW_TICKET = ('no_pitch', 'cerrado', 'no_cerrado', 'seguimiento', 'descartado')
PITCHEADO = ('cerrado', 'no_cerrado', 'seguimiento', 'descartado')
ASISTENCIAS = ('asistio', 'no_show', 'cancelo')
_SEGMENTO = ('segmento', 'segmento_puntos', 'segmento_preguntas', 'segmento_confianza', 'segmento_version')
_LOW_TICKET_TEXTO = {'no_pitch': 'no se le pitcheó el low ticket', 'cerrado': 'cerró el low ticket',
                     'no_cerrado': 'no cerró el low ticket', 'seguimiento': 'low ticket en seguimiento',
                     'descartado': 'lead descartado'}


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


def _validar(appt, datos):
    asistencia = datos.get('asistencia')
    if asistencia not in ASISTENCIAS:
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
    elif datos.get('low_ticket') not in LOW_TICKET:
        raise _error('Elegí qué pasó con el low ticket.', 'low_ticket')


def _pasar_al_closer(appt, datos, usuario):
    """La agenda de closing, por el mismo camino que «Agendar otra llamada» de la ficha."""
    from app.services import ficha_acciones_service as acciones

    nueva = acciones.crear_agenda(appt, {'fecha': datos['fecha'], 'closer_id': datos['closer_id']}, usuario)
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
        if appt.triage_calificacion != 'descalificado':
            raise _error('El low ticket solo se registra en un lead descalificado.')
        _aplicar_low_ticket(appt, datos.get('low_ticket'), datos)
        db.session.commit()
        _log(appt, usuario, f'{usuario.username} actualizó el triage: {_LOW_TICKET_TEXTO[appt.triage_low_ticket]}.')
        return bloque(appt)

    _validar(appt, datos)
    nota = (datos.get('nota') or '').strip() or None
    calificacion = datos.get('calificacion') if datos['asistencia'] == 'asistio' else None

    # El pase primero: si el horario del closer está ocupado, no queda nada reportado a medias.
    closing = _pasar_al_closer(appt, datos, usuario) if calificacion == 'calificado' else None

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
    return bloque(appt)


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


def _sumar(m, a, closing_show):
    m['agendas'] += 1
    resultado = (a.closer_result or '').strip().lower()
    previo = (a.result or '').strip().lower()
    if previo == 'confirmado' or a.confirmation_stage == 'confirmado' or resultado == 'show up':
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
    return {
        'desde': desde.isoformat(), 'hasta': hasta.isoformat(), 'total': total,
        'por_persona': [{'id': p.id, 'nombre': p.username, **por_id[p.id]} for p in personas],
    }
