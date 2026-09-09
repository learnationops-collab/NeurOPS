"""Libro de agendas del closer — pestaña "Agendas" de Mi cartera.

Lista TODAS las citas (`Appointment`) del closer dentro de un rango de días, cada una con un
único estado derivado, para que pueda corroborar cuántas agendas tiene realmente y en qué quedó
cada una. A diferencia del mazo (`/closer/deck`), que solo muestra lo pendiente de cada bandeja,
esto es el registro completo: nada se filtra por "todavía hay algo que hacer".

Los ids de período son los mismos que usa "Ver mis datos" (`CloserDashboardService.
_range_for_period` / PerformanceFilters.jsx) a propósito: "Este mes" tiene que significar lo
mismo en las dos pestañas para que el closer pueda cruzar los números. La única diferencia es
que acá el "hoy" y los límites del día se calculan en la zona horaria del closer
(`user_time_service`), no en la del servidor — la lista se lee fecha por fecha y una agenda de
las 22:00 de Caracas no puede aparecer bajo el día siguiente.
"""
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app import db
from app.models import Appointment, FinancialSale, User
from app.services.closer_followup_service import CloserFollowUpService
from app.services.user_time_service import hoy_del_usuario, limites_rango_utc, zona_del_usuario

# Un solo catálogo para el backend (clasificación y conteos) y el frontend (chips, colores,
# orden). El orden es el del ciclo de vida de una agenda: antes de la llamada, después, y
# los cierres que la sacan del circuito.
ESTADOS = [
    {'key': 'por_confirmar', 'label': 'Por confirmar', 'color': '#D9A441',
     'desc': 'La llamada todavía no llegó y no está confirmada.'},
    {'key': 'confirmada', 'label': 'Confirmada', 'color': '#4E8BD8',
     'desc': 'Confirmada, esperando la fecha de la llamada.'},
    {'key': 'sin_reportar', 'label': 'Sin reportar', 'color': '#FF3FA4',
     'desc': 'La hora ya pasó y no se reportó qué pasó en la llamada.'},
    {'key': 'show_up', 'label': 'Asistió', 'color': '#2FBF8F',
     'desc': 'Show up: el lead asistió a la llamada.'},
    {'key': 'segunda_llamada', 'label': '2da llamada', 'color': '#22D3C4',
     'desc': 'Se agendó una segunda llamada (la nueva agenda es otra fila).'},
    {'key': 'no_show', 'label': 'No show', 'color': '#E85C4A',
     'desc': 'El lead no se presentó.'},
    {'key': 'reagendada', 'label': 'Reagendada', 'color': '#8B5CF6',
     'desc': 'Se movió a otra fecha (la nueva agenda es otra fila).'},
    {'key': 'cancelada', 'label': 'Cancelada', 'color': '#94A3B8',
     'desc': 'Cancelada antes de la llamada.'},
    {'key': 'lead_perdido', 'label': 'Lead perdido', 'color': '#F97316',
     'desc': 'Marcada como lead perdido.'},
    {'key': 'no_lead', 'label': 'No lead', 'color': '#78716C',
     'desc': 'Marcada como no lead (no calificaba).'},
    {'key': 'otro', 'label': 'Otro estado', 'color': '#CBD5E1',
     'desc': 'Resultado que no encaja en ninguna categoría conocida (se muestra el valor crudo).'},
]
ESTADO_LABELS = {e['key']: e['label'] for e in ESTADOS}

# Valores crudos de `closer_result` tal como los escriben los distintos orígenes (el closer
# desde el mazo, la sincronización del Registro de Agendas en `BookingService`, cargas
# históricas). Se comparan en minúsculas y sin espacios en los bordes.
_SHOW_UP = {'show up', 'show_up', 'showup', 'cerrada', 'cerrado', 'cerrado/a', 'completada', 'terminada'}
_NO_SHOW = {'no show', 'no_show', 'noshow'}
_SEGUNDA = {'2da call', '2th call', '2da llamada', 'follow up'}
_LEAD_PERDIDO = {'lead perdido', 'perdido'}
_NO_LEAD = {'no lead'}
_CANCELADA = {'cancelado', 'cancelada'}
_REAGENDADA = {'reagendado', 'reagendada'}
_PENDIENTE = {'', 'pendiente'}

PERIODOS = ('hoy', 'ayer', '7d', '30d', 'mes', 'mes_pasado', '90', 'custom', 'proximas', 'todo')

# Tamaño de los lotes para las cláusulas IN sobre FinancialSale (SQLite viejo corta en 999
# variables por consulta; con "Todo" un closer puede tener miles de agendas).
_IN_CHUNK = 400


def _parse_iso(value):
    try:
        return date.fromisoformat(value) if value else None
    except (TypeError, ValueError):
        return None


def _rango_de_periodo(period, today, start_date=None, end_date=None):
    """(inicio, fin) como fechas calendario del usuario. `None` en una punta = sin límite.
    Misma tabla que `CloserDashboardService._range_for_period`, más 'proximas' y 'todo'."""
    if period == 'todo':
        return None, None
    if period == 'proximas':
        return today, None
    if period == 'custom':
        start, end = _parse_iso(start_date), _parse_iso(end_date)
        if start and end:
            return (end, start) if start > end else (start, end)
    if period == 'hoy':
        return today, today
    if period == 'ayer':
        ayer = today - timedelta(days=1)
        return ayer, ayer
    if period == '7d':
        return today - timedelta(days=6), today
    if period == '30d':
        return today - timedelta(days=29), today
    if period == '90':
        return today - timedelta(days=89), today
    if period == 'mes_pasado':
        fin_mes_pasado = today.replace(day=1) - timedelta(days=1)
        return fin_mes_pasado.replace(day=1), fin_mes_pasado
    return today.replace(day=1), today


def _clean_email(value):
    v = (value or '').strip().lower()
    return v if v and v != 'n/a' and '@' in v else None


def _clean_ig(value):
    v = (value or '').strip().lstrip('@').lower()
    return v if v and v != 'n/a' else None


def derivar_estado(appt, now_utc):
    """Un solo estado por agenda, a partir de `closer_result` (lo que reportó el closer o
    sincronizó el Registro de Agendas), `result` (etapa de confirmación) y la hora de la cita.

    `is_rescheduled` NO entra acá: se marca en la agenda NUEVA que nace de una reagenda (ver
    `CloserService.process_agenda`), no en la que se movió — la movida queda con
    `closer_result='Reagendado'`. Tratarlo como "reagendada" pondría en ese estado a la cita
    vigente, que en realidad está por confirmar."""
    cr = (appt.closer_result or '').strip().lower()
    res = (appt.result or '').strip().lower()

    if cr in _SHOW_UP:
        return 'show_up'
    if cr in _NO_SHOW:
        return 'no_show'
    if cr in _SEGUNDA:
        return 'segunda_llamada'
    if cr in _LEAD_PERDIDO:
        return 'lead_perdido'
    if cr in _NO_LEAD:
        return 'no_lead'
    if cr in _CANCELADA or res in _CANCELADA:
        return 'cancelada'
    if cr in _REAGENDADA or res in _REAGENDADA:
        return 'reagendada'
    if cr not in _PENDIENTE:
        return 'otro'
    # Sin resultado del closer todavía: depende de si la llamada ya pasó.
    if appt.start_time and appt.start_time > now_utc:
        return 'confirmada' if res == 'confirmado' else 'por_confirmar'
    return 'sin_reportar'


class CloserAgendasService:

    @staticmethod
    def _ventas_por_contacto(appts, identifiers):
        """Cruce en lote cita→venta con el mismo criterio que `CloserFollowUpService.
        _client_has_sale` (email o instagram del cliente contra FinancialSale), pero en una sola
        pasada para toda la lista en vez de una consulta por fila. Devuelve dos diccionarios
        {email → es_propia} e {instagram → es_propia}; "propia" = `email_vendedor` es de este
        closer (mismo mapeo que usan Mi cartera y las estadísticas)."""
        emails = {e for e in (_clean_email(a.client.email) for a in appts if a.client) if e}
        igs = {i for i in (_clean_ig(a.client.instagram) for a in appts if a.client) if i}
        por_email, por_ig = {}, {}
        if not emails and not igs:
            return por_email, por_ig

        def _chunks(values):
            values = sorted(values)
            for i in range(0, len(values), _IN_CHUNK):
                yield values[i:i + _IN_CHUNK]

        columnas = (FinancialSale.mail_cliente, FinancialSale.instagram, FinancialSale.email_vendedor)
        rows = []
        for lote in _chunks(emails):
            rows += db.session.query(*columnas).filter(func.lower(FinancialSale.mail_cliente).in_(lote)).all()
        for lote in _chunks(igs):
            rows += db.session.query(*columnas).filter(
                func.lower(func.replace(FinancialSale.instagram, '@', '')).in_(lote)).all()

        for mail, ig, vendedor in rows:
            propia = (vendedor or '').strip().lower() in identifiers
            mail_c, ig_c = _clean_email(mail), _clean_ig(ig)
            if mail_c in emails:
                por_email[mail_c] = por_email.get(mail_c, False) or propia
            if ig_c in igs:
                por_ig[ig_c] = por_ig.get(ig_c, False) or propia
        return por_email, por_ig

    @staticmethod
    def _fase_modal(appt, estado, venta):
        """Con qué flujo abrir el modal del lead al hacer clic en la fila (mismo criterio que
        `CloserFollowUpService.get_client_lead_stage`, pero para ESTA cita puntual)."""
        if estado in ('por_confirmar', 'confirmada'):
            return 'confirm', None
        if estado == 'sin_reportar':
            return 'call', None
        if not appt.seguimiento_realizado:
            tipo = CloserFollowUpService._effective_tipo(appt, has_sale=venta)
            if tipo in ('tomada', 'no_tomada'):
                return 'seg', tipo
        # Ya reportada y sin seguimiento pendiente: se abre en modo reporte para revisar/corregir.
        return 'call', None

    @staticmethod
    def _serialize(appt, estado, venta, venta_propia):
        client = appt.client
        fase, tipo = CloserAgendasService._fase_modal(appt, estado, venta)
        return {
            'id': appt.id,
            'client_id': appt.client_id,
            'lead_name': (client.full_name or client.email or 'Sin Nombre') if client else 'Sin Cliente',
            'instagram': (client.instagram or '') if client else '',
            'phone': (client.phone or '') if client else '',
            'email': (client.email or '') if client else '',
            'grupo': (client.grupo if client else None) or None,
            'start_time': appt.start_time.isoformat() if appt.start_time else None,
            'created_at': appt.created_at.isoformat() if appt.created_at else None,
            'updated_at': appt.updated_at.isoformat() if appt.updated_at else None,
            'origin': appt.origin or '',
            'setter_name': appt.setter.username if appt.setter else '',
            'examen': appt.examen or '',
            'result': appt.result or '',
            'closer_result': appt.closer_result or '',
            'closer_processed': bool(appt.closer_processed),
            'is_rescheduled': bool(appt.is_rescheduled),
            'estado': estado,
            'estado_label': ESTADO_LABELS[estado],
            'seguimiento_tipo': appt.seguimiento_tipo or tipo,
            'fecha_seguimiento': appt.fecha_seguimiento or None,
            'seguimiento_realizado': bool(appt.seguimiento_realizado),
            'closer_notes': appt.closer_notes or '',
            'venta': venta,
            'venta_propia': venta_propia,
            'fase': fase,
            'tipo': tipo,
        }

    @staticmethod
    def get_ledger(closer_id, period='mes', start_date=None, end_date=None):
        from app.services.closer_service import CloserService

        user = User.query.get(closer_id) if closer_id else None
        if period not in PERIODOS:
            period = 'mes'
        vacio = {
            'items': [], 'estados': ESTADOS,
            'counts': {'total': 0, 'por_estado': {e['key']: 0 for e in ESTADOS}, 'con_venta': 0, 'venta_propia': 0},
            'rango': {'period': period, 'start': None, 'end': None, 'timezone': None, 'hoy': None},
        }
        if not user:
            return vacio

        today = hoy_del_usuario(user)
        start, end = _rango_de_periodo(period, today, start_date, end_date)

        query = Appointment.query.options(joinedload(Appointment.client), joinedload(Appointment.setter)) \
            .filter(Appointment.closer_id == user.id)
        if start and end:
            inicio_utc, fin_utc = limites_rango_utc(user, start, end)
            query = query.filter(Appointment.start_time >= inicio_utc, Appointment.start_time <= fin_utc)
        elif start:
            inicio_utc, _ = limites_rango_utc(user, start, start)
            query = query.filter(Appointment.start_time >= inicio_utc)

        appts = query.order_by(Appointment.start_time.desc(), Appointment.id.desc()).all()

        identifiers = {e.lower() for e in CloserService._resolve_sale_identifiers(user)}
        ventas_email, ventas_ig = CloserAgendasService._ventas_por_contacto(appts, identifiers)

        now_utc = datetime.utcnow()
        items = []
        counts = {'total': 0, 'por_estado': {e['key']: 0 for e in ESTADOS}, 'con_venta': 0, 'venta_propia': 0}
        for a in appts:
            estado = derivar_estado(a, now_utc)
            mail_c = _clean_email(a.client.email) if a.client else None
            ig_c = _clean_ig(a.client.instagram) if a.client else None
            venta = (mail_c in ventas_email) or (ig_c in ventas_ig)
            venta_propia = bool(ventas_email.get(mail_c) or ventas_ig.get(ig_c))
            items.append(CloserAgendasService._serialize(a, estado, venta, venta_propia))
            counts['total'] += 1
            counts['por_estado'][estado] += 1
            counts['con_venta'] += 1 if venta else 0
            counts['venta_propia'] += 1 if venta_propia else 0

        return {
            'items': items,
            'estados': ESTADOS,
            'counts': counts,
            'rango': {
                'period': period,
                'start': start.isoformat() if start else None,
                'end': end.isoformat() if end else None,
                'timezone': zona_del_usuario(user).zone,
                'hoy': today.isoformat(),
            },
        }

