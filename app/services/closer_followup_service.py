import logging
from datetime import date, datetime, time, timedelta
from app import db
from app.models import Appointment, Enrollment, Program, Payment, FinancialSale, User
from sqlalchemy import or_, func

logger = logging.getLogger(__name__)

# Cadencia automática de reintentos (días desde el intento anterior), igual al prototipo v7.
CADENCIA = [0, 3, 7, 14]
META_DIARIA = 50

TIPOS_SEGUIMIENTO = {
    'no_tomada': {'label': 'Llamadas no tomadas', 'desc': 'No shows, cancelaciones y reprogramaciones', 'icon': '📵'},
    'tomada': {'label': 'Llamadas tomadas', 'desc': 'Asistieron y quedó una decisión o una 2ª llamada', 'icon': '🎤'},
    'cerrada': {'label': 'Llamadas cerradas', 'desc': 'Clientes: cobranza, renovación y upsell', 'icon': '💰'},
}

PROGRAM_CODE_NAMES = {'AL': 'Ace Learners', 'RR': 'Residency Roadmap', 'SI': 'Specialist Initiative'}

# closer_result que implican "no_tomada" aunque el closer nunca haya programado explícitamente
# un seguimiento (ej. reportó la llamada como No Show pero cerró el modal sin asignar fecha).
DERIVABLE_NO_TOMADA = {'no show', 'cancelado', 'cancelada'}


class CloserFollowUpService:
    @staticmethod
    def next_cadence_date(intento, base_date=None):
        base = base_date or date.today()
        idx = min(3, max(0, (intento or 1) - 1))
        return (base + timedelta(days=CADENCIA[idx])).isoformat()

    @staticmethod
    def _client_has_sale(client):
        """True si el cliente ya tiene una venta registrada en FinancialSale (mismo cruce
        email/instagram que _client_program_code)."""
        if not client:
            return False
        filters = []
        if client.email:
            filters.append(func.lower(FinancialSale.mail_cliente) == client.email.strip().lower())
        if client.instagram:
            ig = client.instagram.strip().lstrip('@').lower()
            filters.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == ig)
        if not filters:
            return False
        return FinancialSale.query.filter(or_(*filters)).first() is not None

    @staticmethod
    def _effective_tipo(a):
        """Categoría del seguimiento: la explícitamente etiquetada, o derivada del resultado
        real de la llamada si el closer nunca llegó a programar un seguimiento para esta cita
        (caso más común: cerró el reporte de "No Show" sin pasar por la pantalla de seguimiento).
        'cerrada' NO se deriva acá: sigue atada exclusivamente al flujo de declarar venta con
        cobro pendiente (fecha_seguimiento_cobro), no a "cualquier cliente que alguna vez compró"."""
        if a.seguimiento_tipo:
            return a.seguimiento_tipo
        cr = (a.closer_result or '').strip().lower()
        if cr in DERIVABLE_NO_TOMADA:
            return 'no_tomada'
        if cr == 'show up' and not CloserFollowUpService._client_has_sale(a.client):
            return 'tomada'
        return None

    @staticmethod
    def _base_query(closer_id):
        q = Appointment.query.filter(
            or_(Appointment.seguimiento_realizado == False, Appointment.seguimiento_realizado.is_(None)),
            or_(
                Appointment.seguimiento_tipo.isnot(None),
                func.lower(Appointment.closer_result).in_(DERIVABLE_NO_TOMADA | {'show up'})
            )
        )
        if closer_id:
            # Además de las propias, se incluyen las de closers dados de baja (User.is_active ==
            # False): quedan huérfanas en la práctica —nadie las va a seguir— así que cualquier
            # closer activo puede tomarlas. Distinto de "sin asignar": closer_id es NOT NULL en
            # la base, un lead sin dueño no puede existir como fila.
            inactive_closer_ids = db.session.query(User.id).filter(User.role == 'closer', User.is_active == False)
            q = q.filter(or_(Appointment.closer_id == closer_id, Appointment.closer_id.in_(inactive_closer_ids)))
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
            'seguimiento_tipo': CloserFollowUpService._effective_tipo(a),
            'seguimiento_sub': a.seguimiento_sub or '',
            'seguimiento_intento': a.seguimiento_intento or 1,
            'fecha_seguimiento': a.fecha_seguimiento or None,
            'call_date': a.start_time.isoformat() if a.start_time else None,
            'days_since_call': days_since_call,
            'closer_notes': a.closer_notes or '',
            # Solo relevante cuando el pool incluyó leads de un closer dado de baja (ver
            # _base_query) — permite mostrar "de {owner_closer_name}" en vez de que parezca
            # propio. None cuando el closer sigue activo (caso normal).
            'owner_closer_name': a.closer.username if (a.closer and a.closer.is_active is False) else None
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
            key = CloserFollowUpService._effective_tipo(a) or 'no_tomada'
            grouped[key].append(CloserFollowUpService._serialize(a, include_debt=(key == 'cerrada')))
        return grouped

    @staticmethod
    def send_due_reminders(selected_date_str=None):
        """Recorre TODOS los seguimientos pendientes para hoy (vencidos + de hoy, mismo criterio
        que get_today_grouped) de TODOS los closers activos, y le avisa a cada closer por
        WhatsApp (Whatchimp) los que todavía no tienen recordatorio enviado hoy — pensado para
        que un cron externo llame a este método varias veces al día sin reenviar spam: cada cita
        se marca (`followup_reminder_sent_at`) apenas se envía, y no se vuelve a tocar hasta que
        cambie de día. Si el closer no tiene `two_chat_number` configurado (ver Gestión de
        Equipo), se cuenta como omitido en vez de fallar todo el lote."""
        from app.services.whatchimp_service import WhatchimpService

        selected_date_str = selected_date_str or date.today().isoformat()
        today = date.today()

        q = CloserFollowUpService._base_query(None).filter(
            Appointment.fecha_seguimiento.isnot(None),
            Appointment.fecha_seguimiento != '',
            Appointment.fecha_seguimiento <= selected_date_str
        )
        items = q.all()

        sent, skipped_no_phone, failed, already_sent = 0, 0, 0, 0
        for a in items:
            if a.followup_reminder_sent_at and a.followup_reminder_sent_at.date() == today:
                already_sent += 1
                continue

            closer = a.closer
            if not closer or not closer.is_active or not closer.two_chat_number:
                skipped_no_phone += 1
                continue

            tipo_key = CloserFollowUpService._effective_tipo(a) or 'no_tomada'
            lead_name = a.client.full_name or a.client.email if a.client else 'Sin Nombre'
            lead_phone = a.client.phone if a.client else None

            try:
                WhatchimpService.send_followup_reminder(
                    closer_name=closer.username,
                    tipo_key=tipo_key,
                    lead_name=lead_name,
                    lead_phone=lead_phone,
                    closer_phone=closer.two_chat_number
                )
                # datetime.now() (hora local del servidor), no utcnow(): se compara contra
                # date.today() (también local) más abajo — mezclar local y UTC hacía que la
                # comparación de "día" fallara cerca de medianoche UTC y reenviara el mismo
                # recordatorio en cada corrida (bug encontrado en la verificación de esta pasada).
                a.followup_reminder_sent_at = datetime.now()
                db.session.commit()
                sent += 1
            except Exception as e:
                db.session.rollback()
                failed += 1
                logger.error(f"[Whatchimp Reminder] Error enviando a {closer.username} (appt {a.id}): {e}")

        return {
            "sent": sent,
            "already_sent_today": already_sent,
            "skipped_no_phone": skipped_no_phone,
            "failed": failed,
            "total_pending": len(items)
        }

    @staticmethod
    def _cerrada_pool_items(closer_id):
        """"Llamadas cerradas" del pool: TODO cliente al que este closer le haya vendido algo
        (FinancialSale.email_vendedor resuelto por CloserService._resolve_sale_identifiers),
        con su deuda y programa — no solo los que alguna vez se etiquetaron explícitamente como
        `seguimiento_tipo='cerrada'` (que dependía de pasar por el flujo de cobro pendiente al
        declarar la venta, dejando afuera a la enorme mayoría de clientes ya cerrados). Antes de
        este fix la pestaña "Llamadas cerradas" quedaba casi siempre vacía — el usuario lo
        reportó: "no hay ningún registro para poder agregarle seguimiento"."""
        from app.models import User, Client, FinancialSale
        from app.services.closer_service import CloserService

        if not closer_id:
            return []
        user = User.query.get(closer_id)
        identifiers = CloserService._resolve_sale_identifiers(user)
        if not identifiers:
            return []

        sales = FinancialSale.query.filter(
            FinancialSale.email_vendedor.in_(identifiers),
            or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == '')
        ).all()

        # FinancialSale.client_id debería estar poblado (backfill de una pasada anterior de esta
        # sesión) pero en esta copia local de la base la gran mayoría quedó en NULL — en vez de
        # depender ciegamente de esa columna, se resuelve el cliente con el mismo cruce
        # email/instagram/teléfono que usa el resto del sistema (BookingService.find_or_create_client),
        # sin crear nada nuevo (solo lectura).
        def resolve_client(sale):
            if sale.client_id:
                return Client.query.get(sale.client_id)
            email_clean = sale.mail_cliente.strip().lower() if sale.mail_cliente and '@' in sale.mail_cliente else None
            ig_clean = sale.instagram.strip().replace('@', '').lower() if sale.instagram and sale.instagram.lower() not in ('n/a', '') else None
            phone_clean = sale.telefono.strip() if sale.telefono and sale.telefono.lower() not in ('n/a', '') else None
            if email_clean:
                c = Client.query.filter(func.lower(Client.email) == email_clean).first()
                if c:
                    return c
            if ig_clean:
                c = Client.query.filter(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean).first()
                if c:
                    return c
            if phone_clean and len(phone_clean) >= 8:
                c = Client.query.filter(Client.phone.like(f"%{phone_clean[-8:]}%")).first()
                if c:
                    return c
            return None

        client_ids = set()
        for s in sales:
            c = resolve_client(s)
            if c:
                client_ids.add(c.id)

        from app.models import InstallmentPlan

        items = []
        for cid in client_ids:
            client = Client.query.get(cid)
            if not client:
                continue
            appt = Appointment.query.filter_by(client_id=cid).order_by(Appointment.start_time.desc()).first()
            if not appt:
                continue
            days_since_call = (date.today() - appt.start_time.date()).days if appt.start_time else None

            # El recordatorio de cobro vive acá: la próxima cuota pendiente de este cliente (la
            # más próxima a vencer primero), para que el closer sepa exactamente qué y cuándo
            # cobrar sin tener que abrir el historial completo del cliente.
            next_cuota = InstallmentPlan.query.filter_by(client_id=cid, estado='pendiente') \
                .order_by(InstallmentPlan.fecha_vencimiento.asc()).first()
            deuda_val = CloserFollowUpService._client_debt(cid)
            proxima_cuota = None
            if next_cuota:
                proxima_cuota = {
                    'id': next_cuota.id,
                    'numero_cuota': next_cuota.numero_cuota,
                    'monto': next_cuota.monto,
                    'fecha_vencimiento': next_cuota.fecha_vencimiento.isoformat(),
                    'vencida': next_cuota.fecha_vencimiento < date.today(),
                    'sin_plan': False
                }
            elif deuda_val > 0.01:
                # Debe dinero pero nunca se le armó un plan de cuotas (InstallmentPlan) — pasa
                # cuando el Parcial se declaró sin pasar por el armador de cronograma, algo muy
                # común en ventas históricas. Reportado por el usuario: "todos los que deben
                # dinero [deberían] tener cuotas pendientes" — sin esto, esos clientes se veían
                # como "sin cuotas pendientes" pese a deber, invisibles para el recordatorio.
                proxima_cuota = {
                    'id': None,
                    'numero_cuota': None,
                    'monto': deuda_val,
                    'fecha_vencimiento': None,
                    'vencida': False,
                    'sin_plan': True
                }

            items.append({
                'id': appt.id,
                'client_id': cid,
                'lead_name': client.full_name or client.email or 'Sin Nombre',
                'instagram': client.instagram or '',
                'origin': appt.origin or '',
                'examen': appt.examen or '',
                'seguimiento_tipo': 'cerrada',
                'seguimiento_sub': appt.seguimiento_sub or '',
                'seguimiento_intento': appt.seguimiento_intento or 1,
                'fecha_seguimiento': appt.fecha_seguimiento or None,
                'call_date': appt.start_time.isoformat() if appt.start_time else None,
                'days_since_call': days_since_call,
                'closer_notes': appt.closer_notes or '',
                'owner_closer_name': None,
                'deuda': deuda_val,
                'programa_code': CloserFollowUpService._client_program_code(cid),
                'programa_nombre': PROGRAM_CODE_NAMES.get(CloserFollowUpService._client_program_code(cid)),
                'proxima_cuota': proxima_cuota
            })

        # Ordenar por urgencia de cobro: cuotas vencidas primero (las más atrasadas primero),
        # luego las próximas a vencer, luego deuda sin plan de cuotas armado, y al final los
        # clientes al día (sin nada pendiente de cobrar).
        def urgency_key(item):
            pc = item.get('proxima_cuota')
            if not pc:
                return (3, '')
            if pc.get('sin_plan'):
                return (2, '')
            return (0 if pc['vencida'] else 1, pc['fecha_vencimiento'])
        items.sort(key=urgency_key)

        return items

    @staticmethod
    def get_pool(closer_id, tipo=None, sub=None, days_since=None, programa=None, deuda=None):
        if tipo == 'cerrada':
            serialized = CloserFollowUpService._cerrada_pool_items(closer_id)
            if sub:
                serialized = [s for s in serialized if (s.get('seguimiento_sub') or '') == sub]
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
                def matches_deuda_c(s):
                    debt = s.get('deuda', 0)
                    if deuda == 'con':
                        return debt > 0
                    if deuda == 'sin':
                        return debt <= 0
                    return True
                serialized = [s for s in serialized if matches_deuda_c(s)]
            return serialized

        q = CloserFollowUpService._base_query(closer_id).filter(
            or_(Appointment.fecha_seguimiento == None, Appointment.fecha_seguimiento == '')
        )
        items = q.order_by(Appointment.start_time.desc()).all()

        # El tipo puede venir etiquetado en la cita o derivado de closer_result (ver _effective_tipo),
        # así que el filtro se aplica en Python sobre el tipo efectivo, no en la query SQL.
        if tipo:
            items = [a for a in items if CloserFollowUpService._effective_tipo(a) == tipo]
        if sub:
            items = [a for a in items if (a.seguimiento_sub or '') == sub]

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
            key = CloserFollowUpService._effective_tipo(a)
            if key in counts and key != 'cerrada':
                counts[key] += 1
        counts['cerrada'] = len(CloserFollowUpService._cerrada_pool_items(closer_id))
        return counts

    @staticmethod
    def get_daily_goal_progress(closer_id, selected_date_str):
        try:
            selected_date = datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        except ValueError:
            selected_date = date.today()

        # Ventana del día en UTC, en la zona horaria del propio closer (mismo criterio que
        # CloserService._day_bounds_utc). Antes esta función calculaba start_dt/end_dt pero
        # nunca los usaba para filtrar la query — contaba TODOS los seguimientos marcados como
        # hechos en la historia completa del closer, no solo los del día (bug real: llegó a
        # mostrar "196 de 50" con meta "cumplida" en un día sin ningún seguimiento hecho).
        import pytz
        user = User.query.get(closer_id) if closer_id else None
        try:
            tz = pytz.timezone((user.timezone if user else None) or 'America/La_Paz')
        except Exception:
            tz = pytz.timezone('America/La_Paz')
        start_utc = tz.localize(datetime.combine(selected_date, time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
        end_utc = tz.localize(datetime.combine(selected_date, time.max)).astimezone(pytz.UTC).replace(tzinfo=None)

        q = Appointment.query.filter(
            Appointment.seguimiento_realizado == True,
            Appointment.last_contact_at >= start_utc,
            Appointment.last_contact_at <= end_utc
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
