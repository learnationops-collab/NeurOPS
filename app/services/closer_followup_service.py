from datetime import date, datetime, time, timedelta
from app import db
from app.models import Appointment, Enrollment, Program, Payment, FinancialSale
from sqlalchemy import or_, func

# Cadencia automática de reintentos (días desde el intento anterior), igual al prototipo v7.
CADENCIA = [0, 3, 7, 14]
META_DIARIA = 50

TIPOS_SEGUIMIENTO = {
    'no_tomada': {'label': 'Llamadas no tomadas', 'desc': 'No shows, cancelaciones y reprogramaciones', 'icon': '📵'},
    'tomada': {'label': 'Llamadas tomadas', 'desc': 'Asistieron y quedó una decisión o una 2ª llamada', 'icon': '🎤'},
    'cerrada': {'label': 'Llamadas cerradas', 'desc': 'Clientes: cobranza, renovación y upsell', 'icon': '💰'},
}

PROGRAM_CODE_NAMES = {'AL': 'Ace Learners', 'RR': 'Residency Roadmap', 'SI': 'Specialist Initiative'}


class CloserFollowUpService:
    @staticmethod
    def next_cadence_date(intento, base_date=None):
        base = base_date or date.today()
        idx = min(3, max(0, (intento or 1) - 1))
        return (base + timedelta(days=CADENCIA[idx])).isoformat()

    @staticmethod
    def _base_query(closer_id):
        q = Appointment.query.filter(
            Appointment.seguimiento_tipo.isnot(None),
            or_(Appointment.seguimiento_realizado == False, Appointment.seguimiento_realizado.is_(None))
        )
        if closer_id:
            q = q.filter(Appointment.closer_id == closer_id)
        return q

    @staticmethod
    def _client_debt(client_id):
        """Deuda real pendiente del cliente: Program.price - total pagado, sobre sus inscripciones."""
        if not client_id:
            return 0.0
        enrollments = Enrollment.query.filter_by(client_id=client_id).all()
        if not enrollments:
            return 0.0
        e_ids = [e.id for e in enrollments]
        paid_rows = db.session.query(Payment.enrollment_id, func.sum(Payment.amount)) \
            .filter(Payment.enrollment_id.in_(e_ids), Payment.status == 'completed') \
            .group_by(Payment.enrollment_id).all()
        paid_map = {eid: float(total or 0) for eid, total in paid_rows}
        total_debt = 0.0
        for e in enrollments:
            if not e.program:
                continue
            paid = paid_map.get(e.id, 0.0)
            total_debt += max(0.0, (e.program.price or 0.0) - paid)
        return round(total_debt, 2)

    @staticmethod
    def _client_program_code(client_id):
        """Codigo de programa (AL/RR/SI) resuelto desde la ultima venta oficial del cliente en FinancialSale."""
        if not client_id:
            return None
        from app.models import Client
        client = Client.query.get(client_id)
        if not client:
            return None
        filters = []
        if client.email:
            filters.append(func.lower(FinancialSale.mail_cliente) == client.email.strip().lower())
        if client.instagram:
            ig = client.instagram.strip().lstrip('@').lower()
            filters.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == ig)
        if not filters:
            return None
        sale = FinancialSale.query.filter(or_(*filters)).order_by(FinancialSale.date.desc()).first()
        if not sale or not sale.tipo_pago:
            return None
        code = sale.tipo_pago.split('-')[0].strip().upper()
        return code if code in PROGRAM_CODE_NAMES else None

    @staticmethod
    def _serialize(a, include_debt=False):
        days_since_call = (date.today() - a.start_time.date()).days if a.start_time else None
        data = {
            'id': a.id,
            'lead_name': a.client.full_name or a.client.email if a.client else 'Sin Nombre',
            'instagram': a.client.instagram if a.client else '',
            'origin': a.origin or '',
            'examen': a.examen or '',
            'seguimiento_tipo': a.seguimiento_tipo,
            'seguimiento_sub': a.seguimiento_sub or '',
            'seguimiento_intento': a.seguimiento_intento or 1,
            'fecha_seguimiento': a.fecha_seguimiento or None,
            'call_date': a.start_time.isoformat() if a.start_time else None,
            'days_since_call': days_since_call,
            'closer_notes': a.closer_notes or ''
        }
        if include_debt:
            data['deuda'] = CloserFollowUpService._client_debt(a.client_id)
            data['programa_code'] = CloserFollowUpService._client_program_code(a.client_id)
            data['programa_nombre'] = PROGRAM_CODE_NAMES.get(data['programa_code'])
        return data

    @staticmethod
    def get_today_grouped(closer_id, selected_date_str):
        q = CloserFollowUpService._base_query(closer_id).filter(
            Appointment.fecha_seguimiento.isnot(None),
            Appointment.fecha_seguimiento != '',
            Appointment.fecha_seguimiento <= selected_date_str
        )
        items = q.order_by(Appointment.fecha_seguimiento.asc()).all()
        grouped = {'no_tomada': [], 'tomada': [], 'cerrada': []}
        for a in items:
            key = a.seguimiento_tipo if a.seguimiento_tipo in grouped else 'no_tomada'
            grouped[key].append(CloserFollowUpService._serialize(a, include_debt=(key == 'cerrada')))
        return grouped

    @staticmethod
    def get_pool(closer_id, tipo=None, sub=None, days_since=None, programa=None, deuda=None):
        q = CloserFollowUpService._base_query(closer_id).filter(
            or_(Appointment.fecha_seguimiento == None, Appointment.fecha_seguimiento == '')
        )
        if tipo:
            q = q.filter(Appointment.seguimiento_tipo == tipo)
        if sub:
            q = q.filter(Appointment.seguimiento_sub == sub)

        items = q.order_by(Appointment.start_time.desc()).all()
        include_debt = (tipo == 'cerrada')
        serialized = [CloserFollowUpService._serialize(a, include_debt=include_debt) for a in items]

        if days_since:
            def matches_days(d):
                if d is None:
                    return False
                if days_since == '14':
                    return d <= 14
                if days_since == '30':
                    return d <= 30
                if days_since == '+30':
                    return d > 30
                return True
            serialized = [s for s in serialized if matches_days(s['days_since_call'])]

        if programa:
            serialized = [s for s in serialized if s.get('programa_code') == programa]

        if deuda:
            def matches_deuda(s):
                debt = s.get('deuda', 0)
                if deuda == 'con':
                    return debt > 0
                if deuda == 'sin':
                    return debt <= 0
                return True
            serialized = [s for s in serialized if matches_deuda(s)]

        return serialized

    @staticmethod
    def get_pool_counts(closer_id):
        q = CloserFollowUpService._base_query(closer_id).filter(
            or_(Appointment.fecha_seguimiento == None, Appointment.fecha_seguimiento == '')
        )
        counts = {'no_tomada': 0, 'tomada': 0, 'cerrada': 0}
        for a in q.all():
            key = a.seguimiento_tipo if a.seguimiento_tipo in counts else 'no_tomada'
            counts[key] += 1
        return counts

    @staticmethod
    def get_daily_goal_progress(closer_id, selected_date_str):
        try:
            selected_date = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        except ValueError:
            selected_date = date.today()
        start_dt = datetime.combine(selected_date, time.min)
        end_dt = datetime.combine(selected_date, time.max)

        q = Appointment.query.filter(
            Appointment.seguimiento_realizado == True,
        )
        if closer_id:
            q = q.filter(Appointment.closer_id == closer_id)
        hechos = q.count()

        return {
            'hechos': hechos,
            'meta': META_DIARIA,
            'faltan': max(0, META_DIARIA - hechos),
            'pct': min(100, round(hechos / META_DIARIA * 100, 1)) if META_DIARIA else 0
        }

    @staticmethod
    def schedule_followup(appointment, tipo, sub, fecha_seguimiento, notes=None, intento=None):
        """Crea/actualiza la categorización de un seguimiento sobre una cita existente."""
        appointment.seguimiento_tipo = tipo
        appointment.seguimiento_sub = sub
        appointment.seguimiento_intento = intento or 1
        appointment.fecha_seguimiento = fecha_seguimiento or None
        appointment.seguimiento_realizado = False
        if notes:
            appointment.closer_notes = notes
