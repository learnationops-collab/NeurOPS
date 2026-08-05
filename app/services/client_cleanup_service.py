from datetime import datetime, timedelta
from app import db


class ClientCleanupService:
    """Arma la 'cola de limpieza diaria' del closer: un puñado de clientes cuyo registro de
    agendas/pagos tiene algo que revisar (secuencia de pago rota, llamada con oferta sin
    seguimiento, fusión reciente, descuadre entre FinancialSale y Enrollment/Payment). No es
    una alerta de que el closer hizo algo mal — la mayoría de estos huecos vienen de datos
    históricos previos a las validaciones agregadas en esta misma sesión."""

    @staticmethod
    def _closer_client_ids(closer_id, identifiers):
        from app.models import Appointment, FinancialSale

        appt_ids = {row[0] for row in db.session.query(Appointment.client_id).filter(
            Appointment.closer_id == closer_id, Appointment.client_id != None
        ).distinct().all()}

        sale_ids = set()
        if identifiers:
            sale_ids = {row[0] for row in db.session.query(FinancialSale.client_id).filter(
                FinancialSale.email_vendedor.in_(identifiers), FinancialSale.client_id != None
            ).distinct().all()}

        return appt_ids | sale_ids

    @staticmethod
    def _program_codes_for_client(client_id):
        from app.models import FinancialSale
        from app.services.sheets_service import SheetsService

        codes = set()
        for sale in FinancialSale.query.filter_by(client_id=client_id).all():
            code, _ = SheetsService.parse_tipo_pago(sale.tipo_pago)
            if code:
                codes.add(code)
        return codes or {'RR'}

    @staticmethod
    def _sequence_issue(client_id):
        from app.services.sales_consistency_service import SalesConsistencyService

        for code in ClientCleanupService._program_codes_for_client(client_id):
            state = SalesConsistencyService.get_client_payment_state(client_id, code)
            if state['has_installments'] and not state['has_first_payment']:
                return f"Tiene Cuotas registradas sin un Parcial previo en {code}"
            if state['has_renewal_or_upsell'] and not state['has_full_payment'] and state['balance_remaining'] > 0.01:
                return f"Tiene Renovación/Upsell con ${state['balance_remaining']:.2f} de saldo pendiente en {code}"
        return None

    @staticmethod
    def _offer_without_followup(closer_id):
        from app.models import Appointment
        return Appointment.query.filter(
            Appointment.closer_id == closer_id,
            Appointment.closer_result == 'Show up',
            Appointment.offer_presented == True,
            Appointment.fecha_seguimiento_cobro == None,
            Appointment.client_id != None
        ).all()

    @staticmethod
    def _payment_mismatch(client_id):
        from app.models import Enrollment, Payment, FinancialSale

        enrollments = Enrollment.query.filter_by(client_id=client_id).all()
        for e in enrollments:
            enrollment_total = sum(p.amount for p in Payment.query.filter_by(enrollment_id=e.id, status='completed').all())
            sale_total = sum(s.monto or 0.0 for s in FinancialSale.query.filter_by(client_id=client_id).all())
            if abs(enrollment_total - sale_total) > 1.0 and sale_total > 0:
                return f"Descuadre: Enrollment/Payment registra ${enrollment_total:.2f} pero FinancialSale suma ${sale_total:.2f}"
        return None

    @staticmethod
    def get_cleanup_queue(closer_id, limit=10):
        from app.models import User, Client, ClientMergeLog
        from app.services.closer_service import CloserService

        user = User.query.get(closer_id)
        identifiers = CloserService._resolve_sale_identifiers(user)
        client_ids = ClientCleanupService._closer_client_ids(closer_id, identifiers)

        items = []

        # 1. Secuencia de pagos inconsistente
        for cid in client_ids:
            issue = ClientCleanupService._sequence_issue(cid)
            if issue:
                items.append({'client_id': cid, 'reason': 'Secuencia de pagos inconsistente', 'detail': issue, 'severity': 3})

        # 2. Oferta presentada sin venta ni seguimiento de cobro
        for appt in ClientCleanupService._offer_without_followup(closer_id):
            if appt.client_id in client_ids:
                items.append({
                    'client_id': appt.client_id,
                    'reason': 'Llamada con oferta sin venta ni seguimiento registrado',
                    'detail': f"Show up con oferta presentada el {appt.start_time.strftime('%d/%m/%Y') if appt.start_time else '—'}, sin fecha de cobro ni venta declarada",
                    'severity': 2
                })

        # 3. Cliente fusionado recientemente
        cutoff = datetime.utcnow() - timedelta(days=7)
        recent_merges = ClientMergeLog.query.filter(
            ClientMergeLog.survivor_client_id.in_(client_ids), ClientMergeLog.merged_at >= cutoff
        ).all()
        for m in recent_merges:
            items.append({
                'client_id': m.survivor_client_id,
                'reason': 'Cliente fusionado recientemente',
                'detail': f"Se fusionó con el cliente #{m.merged_client_id} el {m.merged_at.strftime('%d/%m/%Y')} — revisá que los datos post-fusión estén correctos",
                'severity': 1
            })

        # 4. Descuadre Enrollment/Payment vs FinancialSale
        for cid in client_ids:
            issue = ClientCleanupService._payment_mismatch(cid)
            if issue:
                items.append({'client_id': cid, 'reason': 'Descuadre entre ventas y pagos registrados', 'detail': issue, 'severity': 2})

        # Un cliente puede aparecer por más de un motivo: nos quedamos con el de mayor severidad
        by_client = {}
        for it in items:
            existing = by_client.get(it['client_id'])
            if not existing or it['severity'] > existing['severity']:
                by_client[it['client_id']] = it

        ranked = sorted(by_client.values(), key=lambda it: -it['severity'])[:limit]

        client_map = {c.id: c for c in Client.query.filter(Client.id.in_([it['client_id'] for it in ranked])).all()}
        for it in ranked:
            client = client_map.get(it['client_id'])
            it['client_name'] = (client.full_name or client.email) if client else 'Cliente eliminado'

        return ranked

    @staticmethod
    def get_client_full_history(client_id):
        from app.models import Client, Appointment, FinancialSale, Enrollment, Payment

        client = Client.query.get(client_id)
        if not client:
            return None

        appointments = Appointment.query.filter_by(client_id=client_id).order_by(Appointment.start_time.desc()).all()
        sales = FinancialSale.query.filter_by(client_id=client_id).order_by(FinancialSale.date.desc()).all()
        enrollments = Enrollment.query.filter_by(client_id=client_id).all()

        return {
            'client': {'id': client.id, 'full_name': client.full_name, 'email': client.email, 'instagram': client.instagram, 'phone': client.phone},
            'appointments': [{
                'id': a.id, 'start_time': a.start_time.isoformat() if a.start_time else None,
                'result': a.result, 'closer_result': a.closer_result, 'origin': a.origin
            } for a in appointments],
            'financial_sales': [s.to_dict() for s in sales],
            'enrollments': [{
                'id': e.id, 'program': e.program.name if e.program else None,
                'total_paid': e.total_paid, 'program_price': e.program.price if e.program else None,
                'payments': [{'id': p.id, 'amount': p.amount, 'payment_type': p.payment_type, 'status': p.status, 'date': p.date.isoformat() if p.date else None}
                             for p in Payment.query.filter_by(enrollment_id=e.id).all()]
            } for e in enrollments]
        }
