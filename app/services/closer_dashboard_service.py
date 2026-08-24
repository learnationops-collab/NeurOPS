from datetime import date, datetime, time, timedelta
from sqlalchemy import func
from app import db
from app.models import User, Appointment, InstallmentPlan, Client, CloserDailyReport
from app.services.closer_service import CloserService
from app.services.closer_pending_service import CloserPendingService

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
    def _parse_iso(value):
        """Fecha ISO ('YYYY-MM-DD') o None. Nunca levanta: un valor invalido se ignora y el
        periodo cae al preset por defecto."""
        if not value:
            return None
        try:
            return date.fromisoformat(str(value)[:10])
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _range_for_period(period, start_date=None, end_date=None):
        """Rango del periodo. `custom` usa las fechas que mando el usuario (rango libre); si
        alguna falta o no parsea, cae al mes en curso como cualquier otro periodo desconocido.
        Las fechas invertidas se dan vuelta en vez de devolver un rango vacio."""
        today = date.today()
        if period == 'custom':
            start = CloserDashboardService._parse_iso(start_date)
            end = CloserDashboardService._parse_iso(end_date)
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
            last_month_end = today.replace(day=1) - timedelta(days=1)
            return last_month_end.replace(day=1), last_month_end
        return today.replace(day=1), today

    @staticmethod
    def _shift_year(d, years=1):
        """Misma fecha del anio anterior. El 29 de febrero cae al 28 en anios no bisiestos."""
        try:
            return d.replace(year=d.year - years)
        except ValueError:
            return d.replace(year=d.year - years, day=28)

    @staticmethod
    def _comparison_range(start, end, compare, compare_start=None, compare_end=None):
        """Rango contra el que se compara:

        - `prev`: el periodo inmediatamente anterior, del mismo largo. Si se filtra una semana
          compara contra la semana anterior; si se filtran 3 dias, contra los 3 dias previos.
        - `month`: el mismo rango corrido un mes atras (acotado al largo real de ese mes).
        - `year`: el mismo rango corrido un anio atras.
        - `custom`: dos fechas libres, elegidas a mano. No tiene por que medir lo mismo que el
          periodo filtrado (comparar un mes contra una semana es una lectura valida: "cuanto de
          todo el mes se hizo en esa semana"), asi que no se recorta ni se ajusta el largo.
        - `none`: sin comparacion.
        """
        if compare == 'none':
            return None, None
        if compare == 'custom':
            c_start = CloserDashboardService._parse_iso(compare_start)
            c_end = CloserDashboardService._parse_iso(compare_end)
            if not (c_start and c_end):
                # Sin las dos puntas no hay contra que comparar. Se devuelve "sin comparacion"
                # en vez de caer a `prev`: mostrar el periodo anterior bajo la etiqueta "rango
                # personalizado" seria mentirle al usuario sobre que esta viendo.
                return None, None
            return (c_end, c_start) if c_start > c_end else (c_start, c_end)
        span_days = (end - start).days + 1
        if compare == 'month':
            prev_month_end = start.replace(day=1) - timedelta(days=1)
            prev_start = prev_month_end.replace(day=1)
            prev_end = min(prev_month_end, prev_start + timedelta(days=span_days - 1))
            return prev_start, prev_end
        if compare == 'year':
            return CloserDashboardService._shift_year(start), CloserDashboardService._shift_year(end)
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=span_days - 1)
        return prev_start, prev_end

    @staticmethod
    def _pending_collections(closer_id, limit=15):
        """Deuda por cobrar, **por cliente**: lo que cada cliente todavía debe de su(s)
        inscripción(es) — precio del programa menos lo efectivamente pagado, la misma definición
        que usa `CloserFollowUpService._client_debt` en el pool de "Llamadas cerradas" desde donde
        el closer efectivamente cobra.

        Antes esto leía **solo** `InstallmentPlan` (el cronograma de cuotas), y en todo el sistema
        existen 22 planes: 196 de los 204 clientes con saldo nunca tuvieron uno armado, así que
        eran invisibles acá. El resultado era que el dashboard y la propia lista de trabajo del
        closer mostraban dos números distintos para lo mismo — a Marlon el dashboard le decía $0
        por cobrar mientras su pool listaba 75 clientes debiendo $47.256. Lo reportó el usuario
        ("creo que la deuda no es correcta") y era exactamente eso.

        El total se descompone en tres, que es lo que hace accionable el número:
          - **vencido**: cuotas con fecha de vencimiento ya pasada y sin pagar. Plata que había
            que cobrar y no se cobró.
          - **por vencer**: cuotas con fecha futura. Cronograma normal, no es un problema.
          - **sin plan**: saldo que no tiene ninguna cuota programada. No está vencido ni por
            vencer: directamente nadie le armó un cronograma de cobro, que es el agujero
            operativo real (la enorme mayoría de la deuda del sistema hoy).

        Atribución: al **dueño actual de la agenda** del cliente (decisión del usuario), no a quien
        firmó la venta."""
        from app.models import Enrollment, Payment

        hoy = date.today()
        empty = {'total': 0.0, 'vencido': 0.0, 'por_vencer': 0.0, 'sin_plan': 0.0,
                 'count': 0, 'count_vencido': 0, 'count_sin_plan': 0}

        # 1. Deuda por cliente: precio del programa − pagos completados, sobre sus inscripciones.
        pagado_por_enrollment = dict(
            db.session.query(Payment.enrollment_id, func.sum(Payment.amount))
            .filter(Payment.status == 'completed').group_by(Payment.enrollment_id).all()
        )
        deuda_por_cliente, programas_por_cliente = {}, {}
        for e in Enrollment.query.all():
            if not e.program or not e.client_id:
                continue
            saldo = (e.program.price or 0) - float(pagado_por_enrollment.get(e.id) or 0)
            if saldo <= 0.01:
                continue
            deuda_por_cliente[e.client_id] = deuda_por_cliente.get(e.client_id, 0.0) + saldo
            programas_por_cliente.setdefault(e.client_id, []).append(e.program.name)

        if not deuda_por_cliente:
            return [], empty

        # 2. Atribución: el closer de la agenda más reciente de cada cliente.
        dueño = {}
        filas = db.session.query(Appointment.client_id, Appointment.closer_id, Appointment.start_time) \
            .filter(Appointment.client_id.in_(deuda_por_cliente.keys())) \
            .order_by(Appointment.start_time.asc()).all()
        for client_id, owner_id, _ in filas:
            dueño[client_id] = owner_id  # el orden ascendente deja el más reciente al final

        # 3. Cronograma de cobro, donde exista: cuotas pendientes por cliente.
        cuotas_por_cliente = {}
        for p in InstallmentPlan.query.filter(InstallmentPlan.estado != 'pagado').all():
            cid = p.client_id
            if not cid or not p.monto or p.monto <= 1:
                continue
            cuotas_por_cliente.setdefault(cid, []).append(p)

        clientes = {c.id: c for c in Client.query.filter(Client.id.in_(deuda_por_cliente.keys())).all()}

        rows, totals = [], dict(empty)
        for client_id, deuda in deuda_por_cliente.items():
            if closer_id and dueño.get(client_id) != closer_id:
                continue

            cuotas = cuotas_por_cliente.get(client_id, [])
            vencido = sum(c.monto for c in cuotas if c.fecha_vencimiento and c.fecha_vencimiento < hoy)
            por_vencer = sum(c.monto for c in cuotas if not c.fecha_vencimiento or c.fecha_vencimiento >= hoy)
            # El cronograma puede sumar MÁS que la deuda real (cuotas armadas sobre un precio que
            # después cambió, o pagos aplicados sin marcar la cuota como pagada). Se acota contra
            # la deuda, priorizando lo vencido —que es la plata que importa— para que los tres
            # estados sumen exactamente el total y la tarjeta no se contradiga sola.
            vencido = min(vencido, deuda)
            por_vencer = min(por_vencer, deuda - vencido)
            sin_plan = round(deuda - vencido - por_vencer, 2)

            cliente = clientes.get(client_id)
            proxima = min(
                (c for c in cuotas if c.fecha_vencimiento),
                key=lambda c: c.fecha_vencimiento, default=None
            )
            esta_vencida = bool(proxima and proxima.fecha_vencimiento < hoy)
            programas = programas_por_cliente.get(client_id, [])

            rows.append({
                'client_name': (cliente.full_name or cliente.email) if cliente else 'Sin nombre',
                'program': ' · '.join(dict.fromkeys(programas)) or 'Sin programa',
                'pending_amount': round(deuda, 2),
                'due_date': proxima.fecha_vencimiento.isoformat() if proxima else None,
                'is_overdue': esta_vencida,
                'days_overdue': (hoy - proxima.fecha_vencimiento).days if esta_vencida else 0,
                # Sin cronograma armado: no está atrasado, pero nadie lo va a cobrar solo.
                'sin_plan': not cuotas
            })
            totals['total'] += deuda
            totals['count'] += 1
            totals['vencido'] += vencido
            totals['por_vencer'] += por_vencer
            totals['sin_plan'] += sin_plan
            if esta_vencida:
                totals['count_vencido'] += 1
            if not cuotas:
                totals['count_sin_plan'] += 1

        # Lo vencido primero (y lo más atrasado antes), después lo más grande: es el orden en que
        # conviene ponerse a cobrar.
        rows.sort(key=lambda r: (not r['is_overdue'], -r['days_overdue'], -r['pending_amount']))
        for k in ('total', 'vencido', 'por_vencer', 'sin_plan'):
            totals[k] = round(totals[k], 2)
        return rows[:limit], totals

    @staticmethod
    def _reports_coverage(closer_id, start, end, active_closers):
        """Cuántos días del período tienen reporte diario enviado, por closer.

        Es el dato que hace falta para poder leer el embudo sin confundirse: los pasos
        Agendas → Confirmadas → Asistencias → Presentaciones salen SOLO de los reportes diarios
        (`CloserDailyReport`), mientras que las Ventas salen de `FinancialSale`, que cubre el
        período entero haya o no reporte. Un día sin reporte le saca presentaciones al
        denominador pero no le saca ventas al numerador — por eso un closer con reportes
        faltantes puede mostrar un close rate por encima del 100% sin que haya ningún error de
        cálculo. El corte es contra hoy: los días futuros del mes en curso no se cuentan como
        faltantes."""
        last_day = min(end, date.today())
        if last_day < start:
            return None

        dias_periodo = (last_day - start).days + 1
        closers = [c for c in active_closers if not closer_id or c.id == closer_id]
        if not closers:
            return None

        reported = CloserDailyReport.query.with_entities(
            CloserDailyReport.closer_id, CloserDailyReport.date
        ).filter(
            CloserDailyReport.closer_id.in_([c.id for c in closers]),
            CloserDailyReport.date >= start,
            CloserDailyReport.date <= last_day
        ).all()

        # Todos los días del período hasta hoy, para poder decir CUÁLES faltan y no solo cuántos:
        # con la lista concreta el closer puede ir directo a cada día en vez de tener que
        # descubrir a mano cuáles no mandó.
        todos_los_dias = [start + timedelta(days=i) for i in range(dias_periodo)]

        por_closer = {}
        for c in closers:
            con_reporte = {d for cid, d in reported if cid == c.id}
            dias = len(con_reporte)
            por_closer[c.id] = {
                'closer_id': c.id,
                'name': c.username,
                'dias_con_reporte': dias,
                'dias_periodo': dias_periodo,
                'faltantes': dias_periodo - dias,
                'pct': round(dias / dias_periodo * 100, 1) if dias_periodo else 0,
                'dias_faltantes': [d.isoformat() for d in todos_los_dias if d not in con_reporte]
            }

        total_esperados = dias_periodo * len(closers)
        total_con_reporte = sum(r['dias_con_reporte'] for r in por_closer.values())
        rows = sorted(por_closer.values(), key=lambda r: r['faltantes'], reverse=True)

        return {
            'dias_periodo': dias_periodo,
            'dias_con_reporte': total_con_reporte,
            'dias_esperados': total_esperados,
            'pct': round(total_con_reporte / total_esperados * 100, 1) if total_esperados else 0,
            'faltantes': total_esperados - total_con_reporte,
            # Solo cuando el dashboard está acotado a UN closer: es la lista que el frontend
            # convierte en accesos directos a cada día. Con "todos los closers" no hay una lista
            # única que tenga sentido (cada uno debe los suyos), así que queda vacía.
            'dias_faltantes': rows[0]['dias_faltantes'] if (closer_id and len(rows) == 1) else [],
            'detalle': rows
        }

    @staticmethod
    def _confirmations(closer_id, start, end):
        """Confirmaciones separadas en dos cosas que no son lo mismo (pedido del usuario):

        - `del_periodo`: agendas **cuya llamada cae dentro del período** y que llegaron a
          'Confirmado'. Es el paso real del embudo: de las agendas de estos días, cuántas se
          confirmaron. `result` se queda en 'Confirmado' después de la llamada (el resultado
          real vive en `closer_result`), así que sigue siendo válido para agendas ya pasadas.
        - `proximas`: agendas con fecha **posterior al período**, ya confirmadas. No pertenecen a
          este embudo — son pipeline hacia adelante. Mezclarlas con las de arriba infla el
          confirmation rate del período con trabajo que todavía no se llamó.

        Se lee de `Appointment` y no de los reportes diarios porque ahí no existe ningún campo de
        confirmaciones: el embudo venía aproximando «Confirmadas» como `agendas − canceladas −
        reprogramadas`, que no es una confirmación sino "todo lo que no se cayó" (daba 97,9% de
        confirmation rate en agosto contra 55,8% real)."""
        start_dt = datetime.combine(start, time.min)
        end_dt = datetime.combine(end, time.max)

        def base():
            q = Appointment.query
            return q.filter(Appointment.closer_id == closer_id) if closer_id else q

        confirmado = func.lower(func.coalesce(Appointment.result, '')) == 'confirmado'

        agendas_periodo = base().filter(
            Appointment.start_time >= start_dt, Appointment.start_time <= end_dt).count()
        del_periodo = base().filter(
            Appointment.start_time >= start_dt, Appointment.start_time <= end_dt, confirmado).count()
        agendas_proximas = base().filter(Appointment.start_time > end_dt).count()
        proximas = base().filter(Appointment.start_time > end_dt, confirmado).count()

        def rate(n, d):
            return round(n / d * 100, 1) if d else 0

        return {
            'del_periodo': del_periodo,
            'agendas_periodo': agendas_periodo,
            'rate_periodo': rate(del_periodo, agendas_periodo),
            'proximas': proximas,
            'agendas_proximas': agendas_proximas,
            'rate_proximas': rate(proximas, agendas_proximas)
        }

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
    def _build_period_block(stats, confirmaciones=None):
        g = stats['general']
        ag = stats['agendas']['totals']
        sales = stats['sales']
        pct = stats['percentages']
        fu = stats['follow_ups']

        slots = g['slots']
        agendas = ag['scheduled']
        # «Confirmadas» sale del conteo real de agendas confirmadas del período (ver
        # _confirmations). Antes se aproximaba como `agendas − canceladas − reprogramadas`, que no
        # es una confirmación sino "todo lo que no se cayó": daba 97,9% de confirmation rate en
        # agosto contra 55,8% real. El fallback viejo queda solo para las llamadas sin
        # `confirmaciones` (el período de comparación se calcula con sus propias confirmaciones).
        confirmadas = confirmaciones['del_periodo'] if confirmaciones else max(0, agendas - ag['canceled'] - ag['rescheduled'])
        asistencias = ag['attended']
        presentaciones = min(g['offers_made'], asistencias) if asistencias else g['offers_made']
        ventas = sales['totals']['count']
        cash = sales['totals']['cash']
        dep = sales['deposit']
        conv = sales['deposit_conversions']

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
                # Mismo numerador Y denominador que la tarjeta de Confirmaciones (ambos de
                # Appointment), para no mostrar dos "confirmation rate" que difieren por decimales
                # solo porque uno divide por las agendas de los reportes y el otro por las reales.
                'confirmation_rate': confirmaciones['rate_periodo'] if confirmaciones else rate(confirmadas, agendas),
                'show_rate': pct['show_rate'],
                'show_sobre_confirmada': rate(asistencias, confirmadas),
                'pitch_rate': pct['pitch_rate'],
                'close_llamada': pct['close_rate'],
                'close_presentacion': pct['offer_to_sale']
            },
            # Confirmaciones del período vs. de agendas posteriores al período: son dos cosas
            # distintas y solo la primera pertenece a este embudo (ver _confirmations).
            'confirmaciones': confirmaciones,
            # Las señas se analizan aparte porque no son ventas: son reservas. Lo que importa es
            # con qué frecuencia se consiguen (sobre presentaciones y sobre llamadas asistidas) y
            # en qué terminan (pago completo, split, o nada todavía).
            'senas': {
                'count': dep['count'],
                'cash': round(dep['cash'], 2),
                'ticket_promedio': round(dep['cash'] / dep['count'], 2) if dep['count'] else 0,
                'por_presentacion': pct.get('offer_to_deposit', 0),
                'por_llamada': pct.get('deposit_rate_llamada', 0),
                'presentaciones': presentaciones,
                'asistencias': asistencias,
                'seguidas': conv.get('total', 0),
                'a_pif': conv.get('to_pif', 0),
                'a_pif_rate': conv.get('rate_pif', 0),
                'a_split': conv.get('to_split', 0),
                'a_split_rate': conv.get('rate_split', 0),
                'pendientes': conv.get('pending', 0),
                'pendientes_rate': conv.get('rate_pending', 0),
                'conversion_total': conv.get('rate', 0),
                'close_rate_promesa': pct.get('close_rate_promesa', 0)
            },
            # Cada bucket lleva su cantidad de pagos además del monto: sin eso no se puede
            # distinguir "poco cash porque hubo pocos pagos" de "poco cash porque los pagos
            # fueron chicos" (pedido del usuario para las señas, aplicado a las 5 categorías).
            'cash_mix': {
                'nuevas_ventas': {
                    'cash': round(sales['pif']['cash'] + sales['split']['cash'], 2),
                    'count': sales['pif']['count'] + sales['split']['count']
                },
                'cobro_cuotas': {'cash': round(sales['installment']['cash'], 2), 'count': sales['installment']['count']},
                'senas': {'cash': round(sales['deposit']['cash'], 2), 'count': sales['deposit']['count']},
                'upsell_renovacion': {
                    'cash': round(sales['upsell']['cash'] + sales['renovacion']['cash'], 2),
                    'count': sales['upsell']['count'] + sales['renovacion']['count']
                },
                'otros': {'cash': round(sales.get('otros', {}).get('cash', 0), 2), 'count': sales.get('otros', {}).get('count', 0)}
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
    def _build_alerts(current, pending, coverage=None):
        alerts = []

        # Close rate imposible: hay más ventas registradas que presentaciones reportadas. No es un
        # error de cálculo — es que las ventas salen de FinancialSale (período completo) y las
        # presentaciones de los reportes diarios (solo los días efectivamente reportados).
        ventas = current['kpis']['ventas']
        presentaciones = current['funnel']['values'][4]
        if ventas > presentaciones:
            # Desde que el embudo se lee de la bandeja, esto ya no puede ser un desfase de fuentes
            # (ventas del período completo contra presentaciones solo de los días reportados): es
            # el check de "presentó la oferta" que no se está marcando al cerrar la llamada.
            alerts.append({
                'type': 'danger', 'icon': '📉',
                'title': f"Close rate s/ presentación por encima del 100% ({current['kpis']['close_rate_presentacion']}%)",
                'text': (f"Hay {ventas:g} venta(s) contra {presentaciones:g} presentación(es) registrada(s). "
                         f"No se puede vender sin presentar: falta tildar «presentó la oferta» al registrar el "
                         f"resultado de esas llamadas en la bandeja.")
            })

        # Los slots son lo único del dashboard que sigue dependiendo del reporte diario, así que
        # el aviso apunta a eso y no a "te falta el reporte": el resto del embudo ya sale de la
        # bandeja y no le falta nada.
        slots = current['funnel']['values'][0]
        agendas_funnel = current['funnel']['values'][1]
        if coverage and coverage['faltantes'] > 0 and slots < agendas_funnel:
            alerts.append({
                'type': 'warning', 'icon': '📅',
                'title': f"Faltan los cupos de agenda de {coverage['faltantes']} día(s)",
                'text': (f"Hay {agendas_funnel:g} agenda(s) contra {slots:g} cupo(s) declarado(s), que es imposible: "
                         f"un cupo agendado sigue siendo un cupo. Los cupos son el único dato que el sistema no puede "
                         f"deducir solo — cargá los días que faltan para que el primer paso del embudo sea real.")
            })

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

        # La alerta de deuda se dispara por lo VENCIDO, no por el total: un total alto puede ser
        # simplemente un plan de cuotas recién firmado con todo su cronograma a futuro, que no es
        # un problema. Lo vencido sí: es plata que había que cobrar y no se cobró.
        vencido = pending.get('vencido', 0)
        if vencido > 0:
            alerts.append({'type': 'danger', 'icon': '💰',
                            'title': f"${vencido:,.0f} en cuotas vencidas sin cobrar",
                            'text': f"{pending.get('count_vencido', 0)} cliente(s) con una cuota cuya fecha ya pasó. "
                                    f"Del saldo total pendiente (${pending.get('total', 0):,.0f}, no filtrado por período)."})

        # Saldo sin ningún cronograma de cobro armado. Hoy es la mayor parte de la deuda del
        # sistema y no aparecía en ningún lado: no está vencido (no tiene fecha), así que la
        # alerta anterior nunca lo mencionaba, y nadie lo va a cobrar por sí solo.
        sin_plan = pending.get('sin_plan', 0)
        if sin_plan > 0:
            alerts.append({'type': 'warning', 'icon': '🗓️',
                            'title': f"${sin_plan:,.0f} de deuda sin plan de cobro",
                            'text': f"{pending.get('count_sin_plan', 0)} cliente(s) deben plata pero no tienen ninguna "
                                    f"cuota programada: no figuran como vencidos porque no tienen fecha. Armales el "
                                    f"plan de cuotas desde el historial del cliente para poder cobrarles."})

        fu = current['actividad']['follow_ups']
        resp_rate = round(fu['replied'] / fu['sent'] * 100, 1) if fu['sent'] else 0
        if fu['sent'] > 0 and resp_rate < 45:
            alerts.append({'type': 'warning', 'icon': '💬', 'title': 'Tasa de respuesta de seguimientos baja',
                            'text': f"{resp_rate}% sobre {fu['sent']} seguimientos hechos."})

        return alerts

    @staticmethod
    def get_performance_data(closer_id=None, period='mes', compare='prev', start_date=None, end_date=None,
                             compare_start=None, compare_end=None):
        start, end = CloserDashboardService._range_for_period(period, start_date, end_date)
        prev_start, prev_end = CloserDashboardService._comparison_range(
            start, end, compare, compare_start, compare_end)

        current_stats = CloserService.get_comprehensive_stats(closer_id, start, end, agg_type='sum')
        current = CloserDashboardService._build_period_block(
            current_stats, CloserDashboardService._confirmations(closer_id, start, end))

        previous = None
        if prev_start:
            previous_stats = CloserService.get_comprehensive_stats(closer_id, prev_start, prev_end, agg_type='sum')
            previous = CloserDashboardService._build_period_block(
                previous_stats, CloserDashboardService._confirmations(closer_id, prev_start, prev_end))

        cuotas_rows, cuotas_totals = CloserDashboardService._pending_collections(closer_id)
        current['kpis']['deuda_total_pendiente'] = cuotas_totals['total']
        current['kpis']['deuda_vencida'] = cuotas_totals['vencido']

        active_closers = User.query.filter_by(role='closer', is_active=True).order_by(User.username).all()
        coverage = CloserDashboardService._reports_coverage(closer_id, start, end, active_closers)
        cupos_faltantes = len(CloserService.get_missing_slots_days(closer_id, start, end)) if closer_id else 0
        coverage_by_closer = {r['closer_id']: r for r in (coverage or {}).get('detalle', [])}

        ranking = []
        for c in active_closers:
            c_stats = CloserService.get_comprehensive_stats(c.id, start, end, agg_type='sum')
            c_block = CloserDashboardService._build_period_block(
                c_stats, CloserDashboardService._confirmations(c.id, start, end))
            c_coverage = coverage_by_closer.get(c.id) or CloserDashboardService._reports_coverage(
                c.id, start, end, active_closers)
            ranking.append({
                'closer_id': c.id,
                'name': c.username,
                'cash_collected': c_block['kpis']['cash_collected'],
                'ventas': c_block['kpis']['ventas'],
                'show_rate': c_block['rings']['show_rate'],
                'close_rate_presentacion': c_block['rings']['close_presentacion'],
                'ticket_promedio': c_block['kpis']['ticket_promedio'],
                # Cobertura de reportes de ESTE closer en el período. Antes esta columna mostraba
                # `reports_productivity.al_dia_pct`, que se calcula sobre todos los closers activos
                # sin filtrar: cada fila del ranking repetía el mismo número global.
                'reports_status': (c_coverage or {}).get('pct', 0),
                # Presentaciones del período: sirve para leer el close rate del ranking sin
                # confundirse cuando supera el 100% por reportes faltantes.
                'presentaciones': c_block['funnel']['values'][4],
                'reportes_faltantes': (c_coverage or {}).get('faltantes', 0)
            })
        ranking.sort(key=lambda r: r['cash_collected'], reverse=True)

        return {
            'dates': {'start': start.isoformat(), 'end': end.isoformat(),
                      'compare_start': prev_start.isoformat() if prev_start else None,
                      'compare_end': prev_end.isoformat() if prev_end else None},
            'current': current,
            'previous': previous,
            'reports_productivity': current_stats['reports_productivity'],
            'reports_coverage': coverage,
            'cuotas_por_cobrar': {'rows': cuotas_rows, **cuotas_totals},
            'fuente': CloserDashboardService._source_performance(closer_id, start, end),
            # Trabajo pendiente del closer, a hoy y NO acotado al período filtrado (ver
            # CloserPendingService): esconder una agenda sin reportar de hace tres semanas
            # porque el filtro dice "últimos 7 días" es justo lo contrario de lo que hace falta.
            'pendientes': CloserPendingService.get_pending_work(closer_id, coverage, cupos_faltantes),
            'ranking': ranking,
            'closers': [{'id': c.id, 'username': c.username} for c in active_closers],
            'alerts': CloserDashboardService._build_alerts(current, cuotas_totals, coverage)
        }
