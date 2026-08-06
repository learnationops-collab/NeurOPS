from datetime import date, datetime, time, timedelta
from app.models import User, Appointment, InstallmentPlan, Client
from app.services.closer_service import CloserService

PROGRAM_NAMES = {'AL': 'Ace Learner', 'RR': 'Residency Roadmap', 'SI': 'Specialist Initiative'}


class CloserDashboardService:
    """Analítica de performance para closers (KPIs, embudo, cash, ranking).

    Reutiliza CloserService.get_comprehensive_stats como fuente principal de
    verdad (misma lógica que ya usa el resto del sistema para ventas oficiales
    vía FinancialSale). Los campos sin respaldo real en el modelo de datos
    (fecha de vencimiento de cuotas, embudo detallado de referidos, "burpees")
    se aproximan con la mejor fuente disponible o se omiten explícitamente.
    """

    SOURCE_BUCKETS = [
        ('Workshop', ['workshop']),
        ('VSL', ['vsl']),
        ('Referido', ['referido', 'referral']),
    ]

    @staticmethod
    def _range_for_period(period):
        today = date.today()
        if period == 'hoy':
            return today, today
        if period == '7d':
            return today - timedelta(days=6), today
        if period == '30d':
            return today - timedelta(days=29), today
        if period == '90':
            return today - timedelta(days=89), today
        if period == 'mes_pasado':
            last_month_end = today.replace(day=1) - timedelta(days=1)
            return last_month_end.replace(day=1), last_month_end
        return today.replace(day=1), today

    @staticmethod
    def _comparison_range(start, end, compare):
        if compare == 'none':
            return None, None
        span_days = (end - start).days + 1
        if compare == 'month':
            prev_month_end = start.replace(day=1) - timedelta(days=1)
            prev_start = prev_month_end.replace(day=1)
            prev_end = min(prev_month_end, prev_start + timedelta(days=span_days - 1))
            return prev_start, prev_end
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=span_days - 1)
        return prev_start, prev_end

    @staticmethod
    def _pending_collections(closer_id, limit=15):
        """Cuotas por cobrar: cronograma real de cobro (InstallmentPlan), la misma
        fuente que usa el flujo de ventas del closer para declarar y cobrar cuotas.

        Antes se leía de Enrollment/Payment (sistema legado sin datos recientes,
        ver installment.py), por lo que la deuda total pendiente siempre daba $0
        aunque hubiera cuotas reales pendientes de cobro."""
        q = InstallmentPlan.query.filter(InstallmentPlan.estado != 'pagado')
        if closer_id:
            q = q.join(Appointment, InstallmentPlan.appointment_id == Appointment.id) \
                 .filter(Appointment.closer_id == closer_id)
        plans = q.all()
        if not plans:
            return [], 0.0

        client_ids = {p.client_id for p in plans if p.client_id}
        clients = {c.id: c for c in Client.query.filter(Client.id.in_(client_ids)).all()} if client_ids else {}

        rows = []
        total_pending = 0.0
        for p in plans:
            if not p.monto or p.monto <= 1:
                continue
            client = clients.get(p.client_id)
            program_name = PROGRAM_NAMES.get(p.programa_code, p.programa_code or 'Sin programa')
            rows.append({
                'client_name': (client.full_name or client.email) if client else 'Sin nombre',
                'program': f"Cuota {p.numero_cuota} · {program_name}",
                'pending_amount': round(p.monto, 2)
            })
            total_pending += p.monto

        rows.sort(key=lambda r: r['pending_amount'], reverse=True)
        return rows[:limit], round(total_pending, 2)

    @staticmethod
    def _bucket_source(origin):
        origin_l = (origin or '').lower()
        for label, keywords in CloserDashboardService.SOURCE_BUCKETS:
            if any(kw in origin_l for kw in keywords):
                return label
        return 'Setter'

    @staticmethod
    def _source_performance(closer_id, start, end):
        """Performance por fuente (aproximado): agrupa agendas reales por
        Appointment.origin en 4 categorías. No incluye ventas/cash por fuente
        porque no existe un campo de origen en FinancialSale para cruzarlo."""
        start_dt = datetime.combine(start, time.min)
        end_dt = datetime.combine(end, time.max)
        q = Appointment.query.filter(
            Appointment.start_time >= start_dt,
            Appointment.start_time <= end_dt
        )
        if closer_id:
            q = q.filter(Appointment.closer_id == closer_id)

        buckets = {'Setter': {'agendas': 0, 'asistencias': 0}, 'Workshop': {'agendas': 0, 'asistencias': 0},
                   'VSL': {'agendas': 0, 'asistencias': 0}, 'Referido': {'agendas': 0, 'asistencias': 0}}

        for appt in q.all():
            key = CloserDashboardService._bucket_source(appt.origin)
            buckets[key]['agendas'] += 1
            if (appt.closer_result or '').strip().lower() == 'show up':
                buckets[key]['asistencias'] += 1

        rows = []
        for name, vals in buckets.items():
            if vals['agendas'] == 0:
                continue
            rate = round(vals['asistencias'] / vals['agendas'] * 100, 1) if vals['agendas'] else 0
            rows.append({'name': name, 'agendas': vals['agendas'], 'asistencias': vals['asistencias'], 'show_rate': rate})

        rows.sort(key=lambda r: r['agendas'], reverse=True)
        return rows

    @staticmethod
    def _build_period_block(stats):
        g = stats['general']
        ag = stats['agendas']['totals']
        sales = stats['sales']
        pct = stats['percentages']
        fu = stats['follow_ups']

        slots = g['slots']
        agendas = ag['scheduled']
        confirmadas = max(0, agendas - ag['canceled'] - ag['rescheduled'])
        asistencias = ag['attended']
        presentaciones = min(g['offers_made'], asistencias) if asistencias else g['offers_made']
        ventas = sales['totals']['count']
        cash = sales['totals']['cash']

        def rate(n, d):
            return round(n / d * 100, 1) if d else 0

        return {
            'funnel': {
                'labels': ['Slots', 'Agendas', 'Confirmadas', 'Asistencias', 'Presentaciones', 'Ventas'],
                'values': [slots, agendas, confirmadas, asistencias, presentaciones, ventas]
            },
            'kpis': {
                'cash_collected': round(cash, 2),
                'ventas': ventas,
                'ticket_promedio': sales['general_average_ticket'],
                'close_rate_llamada': pct['close_rate'],
                'close_rate_presentacion': pct['offer_to_sale'],
                'seguimientos_hechos': fu['sent'],
                'seguimientos_respondidos': fu['replied']
            },
            'perdidas': {
                'no_show': {'count': ag['no_show'], 'rate': rate(ag['no_show'], agendas)},
                'cancelaciones': {'count': ag['canceled'], 'rate': rate(ag['canceled'], agendas)},
                'reprogramaciones': {'count': ag['rescheduled'], 'rate': rate(ag['rescheduled'], agendas)}
            },
            'rings': {
                'confirmation_rate': rate(confirmadas, agendas),
                'show_rate': pct['show_rate'],
                'show_sobre_confirmada': rate(asistencias, confirmadas),
                'pitch_rate': pct['pitch_rate'],
                'close_llamada': pct['close_rate'],
                'close_presentacion': pct['offer_to_sale']
            },
            'conversion_senas': {
                'oferta_a_sena': pct.get('offer_to_deposit', 0),
                'sena_a_venta_real': pct.get('deposit_conversion_rate', 0),
                'close_rate_promesa': pct.get('close_rate_promesa', 0)
            },
            'cash_mix': {
                'nuevas_ventas': round(sales['pif']['cash'] + sales['split']['cash'], 2),
                'cobro_cuotas': round(sales['installment']['cash'], 2),
                'depositos': round(sales['deposit']['cash'], 2),
                'upsell_renovacion': round(sales['upsell']['cash'] + sales['renovacion']['cash'], 2)
            },
            'programas': sales['program_tickets'],
            'actividad': {
                'follow_ups': {'sent': fu['sent'], 'replied': fu['replied'], 'closed': fu['closed']},
                'recoveries': {'contacted': fu['recoveries_contacted'], 'replied': fu['recoveries_replied'], 'scheduled': fu['recoveries_scheduled']}
            },
            'referidos': {
                'sourced': fu['referrals_sourced'],
                'scheduled': fu['referrals_scheduled']
            }
        }

    @staticmethod
    def _build_alerts(current, pending):
        alerts = []
        funnel_vals = current['funnel']['values']
        funnel_labels = current['funnel']['labels']
        worst_idx, worst_rate = None, 100
        for i in range(1, len(funnel_vals)):
            prev_v, v = funnel_vals[i - 1], funnel_vals[i]
            if prev_v:
                r = round(v / prev_v * 100, 1)
                if r < worst_rate:
                    worst_rate, worst_idx = r, i
        if worst_idx and worst_rate < 55:
            alerts.append({'type': 'danger' if worst_rate < 40 else 'warning', 'icon': '🩸',
                            'title': f"El mayor desperdicio está en «{funnel_labels[worst_idx]}»",
                            'text': f"Solo {worst_rate}% de {funnel_labels[worst_idx - 1].lower()} llega a {funnel_labels[worst_idx].lower()}."})

        if current['rings']['pitch_rate'] < 70:
            alerts.append({'type': 'warning', 'icon': '🎤', 'title': f"Pitch rate en {current['rings']['pitch_rate']}%",
                            'text': 'Hay asistencias que terminan sin presentación de oferta.'})

        perd = current['perdidas']
        cancel_resched_rate = perd['cancelaciones']['rate'] + perd['reprogramaciones']['rate']
        if cancel_resched_rate > 12:
            alerts.append({'type': 'warning', 'icon': '🔁', 'title': f"{round(cancel_resched_rate,1)}% entre cancelaciones y reprogramaciones",
                            'text': 'Revisar el guion de confirmación y el recordatorio previo a la llamada.'})

        if pending > 0 and pending > current['kpis']['cash_collected'] * 2:
            alerts.append({'type': 'danger', 'icon': '💰', 'title': f"${pending:,.0f} en cuotas pendientes de cobro",
                            'text': 'Saldo total adeudado por clientes (no filtrado por período). Cash comprometido que todavía no entró a caja.'})

        fu = current['actividad']['follow_ups']
        resp_rate = round(fu['replied'] / fu['sent'] * 100, 1) if fu['sent'] else 0
        if fu['sent'] > 0 and resp_rate < 45:
            alerts.append({'type': 'warning', 'icon': '💬', 'title': 'Tasa de respuesta de seguimientos baja',
                            'text': f"{resp_rate}% sobre {fu['sent']} seguimientos hechos."})

        return alerts

    @staticmethod
    def get_performance_data(closer_id=None, period='mes', compare='prev'):
        start, end = CloserDashboardService._range_for_period(period)
        prev_start, prev_end = CloserDashboardService._comparison_range(start, end, compare)

        current_stats = CloserService.get_comprehensive_stats(closer_id, start, end, agg_type='sum')
        current = CloserDashboardService._build_period_block(current_stats)

        previous = None
        if prev_start:
            previous_stats = CloserService.get_comprehensive_stats(closer_id, prev_start, prev_end, agg_type='sum')
            previous = CloserDashboardService._build_period_block(previous_stats)

        cuotas_rows, cuotas_total = CloserDashboardService._pending_collections(closer_id)
        current['kpis']['deuda_total_pendiente'] = cuotas_total

        active_closers = User.query.filter_by(role='closer', is_active=True).order_by(User.username).all()
        ranking = []
        for c in active_closers:
            c_stats = CloserService.get_comprehensive_stats(c.id, start, end, agg_type='sum')
            c_block = CloserDashboardService._build_period_block(c_stats)
            ranking.append({
                'closer_id': c.id,
                'name': c.username,
                'cash_collected': c_block['kpis']['cash_collected'],
                'ventas': c_block['kpis']['ventas'],
                'show_rate': c_block['rings']['show_rate'],
                'close_rate_presentacion': c_block['rings']['close_presentacion'],
                'ticket_promedio': c_block['kpis']['ticket_promedio'],
                'reports_status': c_stats['reports_productivity']['al_dia_pct']
            })
        ranking.sort(key=lambda r: r['cash_collected'], reverse=True)

        return {
            'dates': {'start': start.isoformat(), 'end': end.isoformat(),
                      'compare_start': prev_start.isoformat() if prev_start else None,
                      'compare_end': prev_end.isoformat() if prev_end else None},
            'current': current,
            'previous': previous,
            'reports_productivity': current_stats['reports_productivity'],
            'cuotas_por_cobrar': {'rows': cuotas_rows, 'total': cuotas_total},
            'fuente': CloserDashboardService._source_performance(closer_id, start, end),
            'ranking': ranking,
            'closers': [{'id': c.id, 'username': c.username} for c in active_closers],
            'alerts': CloserDashboardService._build_alerts(current, cuotas_total)
        }
