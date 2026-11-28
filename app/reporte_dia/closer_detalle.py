"""Los registros detrás de cada número del closer, para el modal de detalle.

Repite las consultas de `CloserService.compute_daily_report_fields` (mismas ventanas, mismos
criterios) para listar las filas que suman: si cambia allá, cambia acá.
"""
from sqlalchemy import func, or_

from app.models import Appointment, FinancialSale
from app.reporte_dia.comun import hora_local
from app.services.closer_service import CloserService, SALE_TIPO_TO_BUCKET
from app.services.momentum_metricas import is_momentum_call

SEGUNDA = {'2th call', '2da call', 'segunda llamada', 'segunda agenda'}
ESTADO = {'attended': 'Asistió', 'no_show': 'No show', 'canceled': 'Canceló', 'rescheduled': 'Reprogramó'}
TIPO_VENTA = {'pif': 'PIF', 'split': 'Split', 'deposit': 'Seña', 'installment': 'Cuotas', 'renewal': 'Renovación',
              'upsell': 'Upsell'}

COMO = {
    'agendas': 'Agendas del día más las de días anteriores que resolviste hoy.',
    'asistieron': 'Agendas a las que el lead se presentó (Show up).',
    'offers_made': 'Llamadas con el lead presente en las que presentaste la oferta.',
    'decision_makers': 'Llamadas con el lead presente y el decisor en la llamada.',
    'cash': 'Suma de lo cobrado hoy en tus ventas, por la fecha del pago (no la de la venta).',
    'ventas': 'Cada venta cargada hoy a tu nombre, de cualquier tipo: PIF, split, seña, cuotas, renovación o upsell.',
    'in_call_cash': 'Lo cobrado en ventas marcadas como cerradas en la llamada.',
    'out_call_cash': 'Lo cobrado en ventas cerradas fuera de la llamada.',
    'ticket_promedio': 'Cash del día ÷ ventas del día.',
    'follow_ups_sent': 'Seguimientos de leads que tomaron la llamada que contactaste hoy.',
    'follow_ups_replied': 'De esos seguimientos, los que respondieron.',
    'follow_ups_closed': 'Seguimientos que marcaste como hechos hoy.',
    'recoveries_contacted': 'Leads que no tomaron la llamada (no show, canceló) que contactaste hoy.',
    'recoveries_replied': 'De esas recuperaciones, los que respondieron.',
    'recoveries_scheduled': 'De esas recuperaciones, los que volvieron a agendar.',
    'confirmations_done': 'Agendas que pasaste a «Confirmado» hoy, sean de hoy o de otro día.',
    'referrals_sourced': 'Agendas creadas hoy que vienen de un referido.',
    'show_rate': 'Agendas a las que el lead se presentó ÷ agendas del día (sin contar las reprogramadas).',
    'pitch_rate': 'Llamadas con presentación de la oferta ÷ llamadas con el lead presente.',
    'close_promesa': 'Ventas ÷ presentaciones.',
    'close_operativo': 'Ventas ÷ llamadas con el lead presente.',
    'no_show_rate': 'Agendas en las que el lead no se presentó ÷ agendas del día.',
    'canc_reprog_rate': '(Canceladas + reprogramadas) ÷ agendas del día.',
    'slots_ocupados': 'Agendas del día ÷ slots que ofreciste.',
}


def _nombre(a):
    c = a.client
    return (c.full_name or c.email or 'Sin nombre') if c else 'Sin cliente'


def _citas(user, dia):
    ini, fin = CloserService._day_bounds_utc(user, dia)
    hoy = Appointment.query.filter(Appointment.closer_id == user.id, Appointment.start_time >= ini,
                                   Appointment.start_time <= fin).all()
    backlog = Appointment.query.filter(Appointment.closer_id == user.id, Appointment.start_time < ini,
                                       Appointment.closer_processed == True,  # noqa: E712
                                       Appointment.updated_at >= ini, Appointment.updated_at <= fin).all()
    # Sin las Momentum, como compute_daily_report_fields (ADR-W276).
    return sorted((a for a in hoy + backlog if not is_momentum_call(a)), key=lambda a: a.start_time or ini)


def _clasificar(a):
    """('1.ª'|'2.ª', estado|None) como en compute_daily_report_fields."""
    r = (a.result or '').strip().lower()
    cr = (a.closer_result or '').strip().lower()
    llamada = '2.ª' if (r in SEGUNDA or cr == '2da call') else '1.ª'
    if cr == 'show up':
        return llamada, 'attended'
    if cr == 'no show':
        return llamada, 'no_show'
    if cr in ('cancelado', 'cancelada') or r in ('cancelado', 'cancelada'):
        return llamada, 'canceled'
    if cr in ('reagendado', 'reagendada') or r in ('reagendado', 'reagendada') or a.is_rescheduled:
        return llamada, 'rescheduled'
    return llamada, None


def _fila_cita(user, a, extra=None):
    llamada, est = _clasificar(a)
    fila = [_nombre(a), hora_local(user, a.start_time), llamada, ESTADO.get(est, 'Sin resultado')]
    return fila + ([extra] if extra is not None else [])


def _ventas(user, dia):
    from app.services.sheets_service import SheetsService
    ini, fin = CloserService._day_bounds_utc(user, dia)
    ids = CloserService._resolve_sale_identifiers(user)
    q = FinancialSale.query.filter(
        FinancialSale.date >= ini, FinancialSale.date <= fin, FinancialSale.email_vendedor.in_(ids),
        or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == ''))  # noqa: E711
    mapa = dict(SALE_TIPO_TO_BUCKET, renovacion='renewal')
    salida = []
    for s in q.order_by(FinancialSale.date).all():
        bucket = mapa.get(SheetsService.parse_tipo_pago(s.tipo_pago)[1])
        if bucket:
            salida.append((bucket, s))
    return salida


def _fila_venta(user, bucket, s):
    return [s.nombre_cliente or 'Sin nombre', TIPO_VENTA[bucket], f"US$ {float(s.monto or 0):,.0f}".replace(',', '.'),
            hora_local(user, s.date), 'En llamada' if s.sold_in_call else 'Fuera de llamada']


def _contactos(user, dia):
    from app.services.closer_followup_service import CloserFollowUpService
    ini, fin = CloserService._day_bounds_utc(user, dia)
    salida = []
    for a in Appointment.query.filter(Appointment.closer_id == user.id, Appointment.last_contact_at >= ini,
                                      Appointment.last_contact_at <= fin,
                                      Appointment.last_contact_outcome.isnot(None)).all():
        tipo = CloserFollowUpService._effective_tipo(a) or a.seguimiento_tipo
        salida.append((tipo, a))
    return salida


def _resp(a):
    return 'Respondió' if a.last_contact_outcome != 'no_resp' else 'Sin respuesta'


def registros(user, dia, clave):
    """{cols, filas, como} de un número del closer, o None si la clave no es suya."""
    cols_cita = ['Lead', 'Hora', 'Llamada', 'Resultado']
    if clave.startswith(('first_call_', 'second_call_')):
        llamada = '1.ª' if clave.startswith('first') else '2.ª'
        est = clave.split('_call_')[1]
        filas = [_fila_cita(user, a) for a in _citas(user, dia)
                 if _clasificar(a)[0] == llamada and (est == 'scheduled' or _clasificar(a)[1] == est)]
        return {'cols': cols_cita, 'filas': filas}
    if clave in ('agendas', 'asistieron', 'offers_made', 'decision_makers', 'show_rate', 'no_show_rate',
                 'canc_reprog_rate', 'pitch_rate', 'close_operativo', 'slots_ocupados'):
        citas = _citas(user, dia)
        if clave == 'asistieron':
            citas = [a for a in citas if _clasificar(a)[1] == 'attended']
        elif clave in ('offers_made', 'pitch_rate'):
            citas = [a for a in citas if _clasificar(a)[1] == 'attended']
            if clave == 'offers_made':
                citas = [a for a in citas if a.offer_presented is True]
        elif clave == 'decision_makers':
            citas = [a for a in citas if _clasificar(a)[1] == 'attended' and a.with_decision_maker is True]
        elif clave == 'show_rate':
            citas = [a for a in citas if _clasificar(a)[1] != 'rescheduled']
        elif clave == 'close_operativo':
            citas = [a for a in citas if _clasificar(a)[1] == 'attended']
        cols, filas = cols_cita, [_fila_cita(user, a) for a in citas]
        si = {'show_rate': ('attended', 'Asistió', 'No asistió'), 'no_show_rate': ('no_show', 'No show', 'Asistió u otro'),
              'pitch_rate': (None, 'Presentó', 'Sin presentación')}.get(clave)
        if si:
            cols = cols_cita[:-1] + ['Resultado']
            filas = []
            for a in citas:
                ok = (a.offer_presented is True) if clave == 'pitch_rate' else (_clasificar(a)[1] == si[0])
                filas.append(_fila_cita(user, a)[:-1] + [si[1] if ok else si[2]])
        return {'cols': cols, 'filas': filas}
    if clave in ('cash', 'ventas', 'in_call_cash', 'out_call_cash', 'ticket_promedio', 'close_promesa') \
            or clave.endswith(('_cash_collected', '_count', '_in_call_cash', '_in_call_count')):
        ventas = _ventas(user, dia)
        base = clave.split('_')[0]
        if base in TIPO_VENTA:
            ventas = [(b, s) for b, s in ventas if b == base]
        if clave == 'in_call_cash' or clave.endswith(('_in_call_cash', '_in_call_count')):
            ventas = [(b, s) for b, s in ventas if s.sold_in_call]
        elif clave == 'out_call_cash':
            ventas = [(b, s) for b, s in ventas if not s.sold_in_call]
        return {'cols': ['Lead', 'Tipo', 'Monto', 'Hora', 'Dónde'], 'filas': [_fila_venta(user, b, s) for b, s in ventas]}
    if clave.startswith(('follow_ups_', 'recoveries_')):
        if clave == 'follow_ups_closed':
            ini, fin = CloserService._day_bounds_utc(user, dia)
            citas = Appointment.query.filter(Appointment.closer_id == user.id, Appointment.seguimiento_realizado == True,  # noqa: E712
                                             Appointment.last_contact_at >= ini, Appointment.last_contact_at <= fin).all()
            return {'cols': ['Lead', 'Contacto', 'Resultado'],
                    'filas': [[_nombre(a), hora_local(user, a.last_contact_at), 'Seguimiento hecho'] for a in citas]}
        tipo = 'tomada' if clave.startswith('follow_ups_') else 'no_tomada'
        lista = [a for t, a in _contactos(user, dia) if t == tipo]
        if clave.endswith('_replied'):
            lista = [a for a in lista if a.last_contact_outcome != 'no_resp']
        elif clave == 'recoveries_scheduled':
            lista = [a for a in lista if a.last_contact_outcome == 'agendo']
        return {'cols': ['Lead', 'Contacto', 'Resultado'],
                'filas': [[_nombre(a), hora_local(user, a.last_contact_at), _resp(a)] for a in lista]}
    if clave == 'confirmations_done':
        ini, fin = CloserService._day_bounds_utc(user, dia)
        citas = Appointment.query.filter(Appointment.closer_id == user.id,
                                         func.lower(func.coalesce(Appointment.result, '')) == 'confirmado',
                                         Appointment.updated_at >= ini, Appointment.updated_at <= fin).all()
        return {'cols': ['Lead', 'Llamada', 'Estado'],
                'filas': [[_nombre(a), (a.start_time and hora_local(user, a.start_time)) or '', 'Confirmada'] for a in citas]}
    if clave in ('referrals_sourced', 'referrals_scheduled'):
        ini, fin = CloserService._day_bounds_utc(user, dia)
        citas = Appointment.query.filter(Appointment.closer_id == user.id, Appointment.created_at >= ini,
                                         Appointment.created_at <= fin, Appointment.origin.like('Referido de%')).all()
        return {'cols': ['Lead', 'Origen', 'Creada'],
                'filas': [[_nombre(a), a.origin or '', hora_local(user, a.created_at)] for a in citas]}
    return None


def como(clave):
    return COMO.get(clave)

