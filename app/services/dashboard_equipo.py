"""Las métricas del equipo comercial (closers y setters), aparte de los KPIs de admin de `dashboard_service`.
`DashboardService` las sigue exponiendo con los mismos nombres."""
from app import db
from app.models import Appointment, Availability
from datetime import datetime, date, time
from sqlalchemy import func


class MetricasEquipo:
    @staticmethod
    def get_detailed_closer_metrics(start_date, end_date, closer_id=None):
        if isinstance(start_date, date): start_date = datetime.combine(start_date, time.min)
        if isinstance(end_date, date): end_date = datetime.combine(end_date, time.max)
        
        appt_filters = [Appointment.start_time >= start_date, Appointment.start_time <= end_date]
        avail_filters = [Availability.date >= start_date.date(), Availability.date <= end_date.date()]
        
        if closer_id:
            appt_filters.append(Appointment.closer_id == closer_id)
            avail_filters.append(Availability.closer_id == closer_id)
            
        slots_defined_count = Availability.query.filter(*avail_filters).count()
        total_appts = Appointment.query.filter(*appt_filters).all()
        
        slots_used = len(total_appts)
        slots_available = max(0, slots_defined_count - slots_used)
        
        # Estructura de estadísticas base
        def empty_bucket():
            return {
                'total': 0, 
                'completed': 0, 
                'no_show': 0, 
                'canceled': 0, 
                'rescheduled': 0, 
                'scheduled': 0, 
                'confirmed': 0,
                'pending': 0 # Combinación de scheduled y confirmed
            }

        stats = {
            'total_agendas': empty_bucket(),
            'first_agendas': empty_bucket(),
            'second_agendas': empty_bucket(),
            'presentations': 0
        }
        
        def update_bucket(bucket, status):
            bucket['total'] += 1
            if status == 'completed': bucket['completed'] += 1
            elif status == 'no_show': bucket['no_show'] += 1
            elif status == 'canceled': bucket['canceled'] += 1
            elif status in ['rescheduled', 'reprogrammed']: bucket['rescheduled'] += 1
            elif status == 'scheduled': 
                bucket['scheduled'] += 1
                bucket['pending'] += 1
            elif status == 'confirmed': 
                bucket['confirmed'] += 1
                bucket['pending'] += 1
            else:
                # Manejar estados desconocidos como pendientes
                bucket['pending'] += 1
        
        def get_mapped_status(appt):
            """BUG real encontrado (31/ago/2026): esto leía `Appointment.result` — el estado de
            CONFIRMACIÓN (Pendiente/Confirmado/Cancelado/...) — buscando además valores viejos
            que ya no se escriben ('Terminada', 'No Show', 'Cancelada', 'Reprogramada') en vez de
            los actuales. El resultado REAL de la llamada de ventas vive en `closer_result`
            (Show up/No show/Cancelado/Reagendado), un campo aparte a propósito — confirmación y
            agenda son dos pasos distintos del embudo y no deben mezclarse (reportado por el
            usuario: "el show up no es muy real"). Con el campo viejo, `result == 'Terminada'`
            (la confirmación terminó, no dice nada de si asistió) marcaba como "completed" el
            72% de las citas reales, contra el ~16% real que sí tiene `closer_result == 'Show up'`
            — un show up rate inflado sin relación con la asistencia real.

            Ahora se lee primero el resultado real de la llamada; si la cita nunca llegó a
            evaluarse (sigue 'Pendiente' o fue archivada como 'Lead Perdido' sin haberse
            confirmado nunca), se cae al estado de confirmación para no perder esas filas."""
            cr = (appt.closer_result or '').strip().lower()
            if cr == 'show up':
                return 'completed'
            if cr == 'no show':
                return 'no_show'
            if cr in ('cancelado', 'cancelada'):
                return 'canceled'
            if cr in ('reagendado', 'reagendada'):
                return 'rescheduled'

            res = (appt.result or '').strip().lower()
            if res == 'cancelado' or res == 'cancelada':
                return 'canceled'
            if res in ('reagendado', 'reagendada', 'reprogramada', 'reprogramar'):
                return 'rescheduled'
            if res == 'confirmado':
                return 'confirmed'
            return 'scheduled'

        for appt in total_appts:
            status = get_mapped_status(appt)
            update_bucket(stats['total_agendas'], status)
            if status == 'completed':
                stats['presentations'] += 1
                
            # Todo se agrupa en 'Agendas' ya que no usamos tipo
            update_bucket(stats['first_agendas'], status)

        # Ventas y cash del período desde los cobros (`admin_cobros`, Etapa 2c; antes, las inscripciones):
        # una venta es un cobro completo o parcial, las señas no (30/09/2026: "el close rate no debe
        # tomar señas"); el cash, todos los cobros completados.
        from app.services import admin_cobros
        cobros = admin_cobros.cobros(start_date, end_date, [closer_id] if closer_id else None)
        sales_count = sum(1 for v in cobros if admin_cobros.programa_de_cobro(v)[2])

        def safe_div(n, d): return (n / d * 100) if d > 0 else 0
        
        m = stats['total_agendas']
        total_shows = m['completed'] + m['no_show'] # Asistencias reales + faltas
        
        # Financials
        cash_collected = sum(float(v.monto or 0) for v in cobros)
        average_ticket = (cash_collected / sales_count) if sales_count > 0 else 0.0

        kpis = {
            'closing_rate': safe_div(sales_count, m['completed']), 
            'closing_rate_presentation': safe_div(sales_count, m['completed']),
            'conversion_rate': safe_div(sales_count, m['total']), 
            'closing_rate_global': safe_div(sales_count, m['total']),
            # Cómo cuenta cada una para las tasas (se desglosan, no se mezclan en la UI):
            #   · show up / asistencia: la cancelada ENTRA en el denominador (junto al no show).
            #   · cancelación y no show: cada una sobre el total de agendas, por separado.
            'attendance_rate': safe_div(m['completed'], (m['completed'] + m['no_show'] + m['canceled'])), 
            'show_up_rate': safe_div(m['completed'], (m['completed'] + m['no_show'] + m['canceled'])),
            'cancellation_rate': safe_div(m['canceled'], m['total']),
            'rescheduling_rate': safe_div(m['rescheduled'], m['total']),
            'no_show_rate': safe_div(m['no_show'], m['total'])
        }
        
        return {
            'slots': {'total': slots_defined_count, 'available': slots_available, 'used': slots_used},
            'agendas': stats,
            'sales': sales_count,
            'financials': {
                'cash_collected': float(cash_collected),
                'average_ticket': float(average_ticket)
            },
            'kpis': kpis
        }

    @staticmethod
    def get_detailed_setter_metrics(start_date, end_date, setter_id=None):
        from app.models import SetterDailyStats
        if isinstance(start_date, date): start_date = datetime.combine(start_date, time.min)
        if isinstance(end_date, date): end_date = datetime.combine(end_date, time.max)
        
        query = db.session.query(
            func.sum(SetterDailyStats.not_lead).label('not_lead'),
            func.sum(SetterDailyStats.inbox_entrantes).label('entrantes'),
            func.sum(SetterDailyStats.stage_1_value).label('s1'),
            func.sum(SetterDailyStats.stage_2_value).label('s2'),
            func.sum(SetterDailyStats.stage_3_value).label('s3'),
            func.sum(SetterDailyStats.stage_4_value).label('s4'),
            func.sum(SetterDailyStats.stage_5_value).label('s5'),
            func.sum(SetterDailyStats.qualification_fu + SetterDailyStats.pain_fu + SetterDailyStats.offer_fu + SetterDailyStats.link_fu + SetterDailyStats.agenda_fu).label('tfu_s'),
            func.sum(SetterDailyStats.qualification_fur + SetterDailyStats.pain_fur + SetterDailyStats.offer_fur + SetterDailyStats.link_fur + SetterDailyStats.agenda_fur).label('tfu_r'),
            func.count(SetterDailyStats.id).label('report_count')
        ).filter(SetterDailyStats.date >= start_date.date(), SetterDailyStats.date <= end_date.date())
        
        if setter_id:
            query = query.filter(SetterDailyStats.setter_id == setter_id)
            
        res = query.first()
        
        def safe_div(n, d): return (n / d * 100) if d > 0 else 0
        
        # We need the stage names to be dynamic
        from app.api.setter import _get_setter_stages_ordered
        db_stages = _get_setter_stages_ordered()
        
        # Create a dynamic stages list with actual names
        stages_output = []
        stage_values = [res.s1, res.s2, res.s3, res.s4, res.s5]
        
        for i, db_stage in enumerate(db_stages[:5]):
            stages_output.append({
                "id": db_stage.id,
                "name": db_stage.name,
                "value": int(stage_values[i] or 0)
            })
            
        inbound = int(res.entrantes or 0)
        not_lead = int(res.not_lead or 0)
        qualification = int(res.s1 or 0)
        qualified = max(0, qualification - not_lead)
        
        return {
            'stats': {
                'inbound_leads': inbound,
                'not_lead': not_lead,
                'qualified_leads': qualified,
                'no_response': max(0, inbound - qualification)
            },
            'stages': stages_output,
            'kpis': {
                'conversion_rate': safe_div(float(int(res.s4 or 0)), float(inbound)),
                'opening_rate': safe_div(float(qualified), float(inbound)),
                'fu_response_rate': safe_div(float(int(res.tfu_r or 0)), float(int(res.tfu_s or 0)))
            },
            'count': int(res.report_count or 0)
        }
