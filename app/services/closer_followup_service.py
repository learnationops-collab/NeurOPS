import logging
import os
from datetime import date, datetime, time, timedelta
from app import db
from app.models import Appointment, Enrollment, Program, Payment, FinancialSale, User
from sqlalchemy import or_, and_, func

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


def reminders_enabled():
    """Interruptor global de los recordatorios de seguimiento por WhatsApp.

    Encendido por defecto desde el 16/08/2026. Estuvo apagado entre el 14 y el 16 porque el
    mecanismo de entonces avisaba de todos los seguimientos automáticamente y saturaba; ahora
    cada aviso lo pide el closer explícitamente al programar su seguimiento
    (`followup_reminder_enabled` + `followup_reminder_time`), así que el interruptor global pasa
    a ser solo un freno de emergencia: `FOLLOWUP_REMINDERS_ENABLED=false` corta todo sin tocar
    código. Se lee en cada llamada para que cambiarlo en el hosting surta efecto con reiniciar."""
    return os.environ.get('FOLLOWUP_REMINDERS_ENABLED', 'true').strip().lower() in ('true', '1', 'yes')


def parse_reminder_time(valor):
    """Normaliza la hora del aviso a 'HH:MM', o None si no es una hora válida.

    Llega del `<input type="time">` del navegador, que manda 'HH:MM' o a veces 'HH:MM:SS'."""
    if not valor:
        return None
    texto = str(valor).strip()
    for formato in ('%H:%M', '%H:%M:%S'):
        try:
            return datetime.strptime(texto, formato).strftime('%H:%M')
        except ValueError:
            continue
    return None


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
    def _resolve_closer_for_email_vendedor(email_vendedor):
        """Inverso de `CloserService._resolve_sale_identifiers`: dado un `email_vendedor` de
        FinancialSale, encuentra qué closer lo vendió. Coincidencia directa por email primero
        (más barata), y si no matchea, recorre los alias conocidos de cada closer."""
        from app.services.closer_service import CloserService
        if not email_vendedor:
            return None
        direct = User.query.filter(func.lower(User.email) == email_vendedor.strip().lower()).first()
        if direct:
            return direct
        email_lower = email_vendedor.strip().lower()
        for closer in User.query.filter_by(role='closer').all():
            identifiers = CloserService._resolve_sale_identifiers(closer)
            if any(email_lower == i.strip().lower() for i in identifiers if i):
                return closer
        return None

    @staticmethod
    def _ensure_appointment_for_client(client):
        """Devuelve la Appointment más reciente de este cliente, creando una "ancla" mínima si no
        tiene ninguna. Todo el módulo de seguimientos (guardar cobro, marcar Pagó, el pool de
        "Llamadas cerradas") cuelga de un `Appointment.id` real — pero hay clientes con venta
        completada en FinancialSale que nunca tuvieron una fila en Appointment (569 ventas
        históricas/importadas resueltas a 549 clientes en la base local, 129 de ellos sin ninguna
        cita). Sin esto, `get_client_lead_stage` devolvía `appointment_id: None` para esos
        clientes, y el frontend terminaba llamando a `POST /closer/deck/null` — el cierre en falso
        que reportó el usuario ("el botón para registrar el cobro no funciona") con Jonathan
        Aparicio (client_id 7232 en la base local), que tiene 6 ventas y cero citas.

        `seguimiento_realizado=True` y `closer_processed=True` desde el arranque: esta ancla no es
        una llamada real, así que no debe aparecer en los pools de "no tomadas"/"tomadas" de
        `_base_query` (que sí la tomaría como agenda vencida sin procesar) — solo existe para que
        el resto del flujo de cobro tenga un id donde guardar."""
        appt = Appointment.query.filter_by(client_id=client.id).order_by(Appointment.start_time.desc()).first()
        if appt:
            return appt

        sale = FinancialSale.query.filter(
            or_(
                func.lower(FinancialSale.mail_cliente) == (client.email or '').strip().lower(),
                func.lower(func.replace(FinancialSale.instagram, '@', '')) == (client.instagram or '').strip().lstrip('@').lower()
            )
        ).order_by(FinancialSale.date.asc()).first()

        closer = CloserFollowUpService._resolve_closer_for_email_vendedor(sale.email_vendedor) if sale else None
        if not closer:
            closer = User.query.filter_by(role='closer', is_active=True).first()
        if not closer:
            return None

        appt = Appointment(
            closer_id=closer.id,
            client_id=client.id,
            start_time=(sale.date if sale and sale.date else datetime.utcnow()),
            origin='Venta histórica sin agenda',
            last_stage='Nueva',
            closer_processed=True,
            closer_result='Show up',
            seguimiento_realizado=True,
            closer_notes='[Sistema] Cita creada automáticamente: este cliente tenía venta(s) registrada(s) sin ninguna agenda asociada.'
        )
        db.session.add(appt)
        db.session.commit()
        return appt

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
        # Agenda vencida (la fecha de la cita ya pasó) que el closer nunca llegó a procesar
        # (mismo criterio que CloserService.archive_stale_backlog, sin esperar los 30 días de
        # ese barrido de mantenimiento): cuenta como "no tomada" — nadie la reportó, así que hay
        # que hacer seguimiento igual que a un No Show.
        if cr in ('', 'pendiente') and not a.closer_processed and a.start_time and a.start_time < datetime.utcnow():
            return 'no_tomada'
        return None

    @staticmethod
    def _base_query(closer_id):
        q = Appointment.query.filter(
            or_(Appointment.seguimiento_realizado == False, Appointment.seguimiento_realizado.is_(None)),
            or_(
                Appointment.seguimiento_tipo.isnot(None),
                func.lower(Appointment.closer_result).in_(DERIVABLE_NO_TOMADA | {'show up'}),
                # Agendas vencidas nunca procesadas por el closer (ver _effective_tipo) — mismo
                # criterio de datos que CloserService.archive_stale_backlog, sin el corte de 30
                # días de ese barrido.
                and_(
                    Appointment.start_time < datetime.utcnow(),
                    Appointment.closer_processed == False,
                    or_(Appointment.closer_result == 'Pendiente', Appointment.closer_result == None, Appointment.closer_result == '')
                )
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
    def _client_enrollment_date(client_id):
        """Fecha de ingreso real del cliente al programa (Enrollment más reciente) — distinta
        de la fecha de la cita/agenda. None si el cliente nunca se inscribió formalmente."""
        if not client_id:
            return None
        enrollment = Enrollment.query.filter_by(client_id=client_id).order_by(Enrollment.enrollment_date.desc()).first()
        return enrollment.enrollment_date if enrollment else None

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
    def _dias_retraso(fecha_seguimiento, reference_date=None):
        """Días de retraso de un seguimiento: cuántos días pasaron desde la fecha en que estaba
        agendado. Positivo = atrasado, 0 = toca hoy, negativo = todavía no le toca. None si la
        cita no tiene fecha de seguimiento asignada (todo el pool sin fecha) o si el valor
        guardado no es una fecha ISO válida (`fecha_seguimiento` es texto libre en la base)."""
        if not fecha_seguimiento:
            return None
        try:
            programada = date.fromisoformat(str(fecha_seguimiento)[:10])
        except ValueError:
            return None
        return ((reference_date or date.today()) - programada).days

    @staticmethod
    def _serialize(a, include_debt=False, reference_date=None):
        days_since_call = (date.today() - a.start_time.date()).days if a.start_time else None
        data = {
            'id': a.id,
            'client_id': a.client_id,
            'lead_name': a.client.full_name or a.client.email if a.client else 'Sin Nombre',
            'instagram': a.client.instagram if a.client else '',
            'phone': a.client.phone if a.client else '',
            'origin': a.origin or '',
            'examen': a.examen or '',
            'seguimiento_tipo': CloserFollowUpService._effective_tipo(a),
            'seguimiento_sub': a.seguimiento_sub or '',
            'seguimiento_intento': a.seguimiento_intento or 1,
            'fecha_seguimiento': a.fecha_seguimiento or None,
            # Días de retraso respecto de la fecha en que estaba agendado el seguimiento (no de
            # la fecha de la call, que es `days_since_call`): es lo que le dice al closer cuánto
            # hace que debería haber contactado a este lead.
            'dias_retraso': CloserFollowUpService._dias_retraso(a.fecha_seguimiento, reference_date),
            'followup_reminder_enabled': bool(a.followup_reminder_enabled),
            'followup_reminder_time': a.followup_reminder_time or None,
            'call_date': a.start_time.isoformat() if a.start_time else None,
            'days_since_call': days_since_call,
            'closer_notes': a.closer_notes or '',
            # Solo relevante cuando el pool incluyó leads de un closer dado de baja (ver
            # _base_query) — permite mostrar "de {owner_closer_name}" en vez de que parezca
            # propio. None cuando el closer sigue activo (caso normal).
            'owner_closer_name': a.closer.username if (a.closer and a.closer.is_active is False) else None,
            # Closer dueño actual, para el selector de "Reasignar a otro closer" en el modal.
            'closer_id': a.closer_id,
            'closer_name': a.closer.username if a.closer else None
        }
        if include_debt:
            data['deuda'] = CloserFollowUpService._client_debt(a.client_id)
            data['programa_code'] = CloserFollowUpService._client_program_code(a.client_id)
            data['programa_nombre'] = PROGRAM_CODE_NAMES.get(data['programa_code'])
            enrollment_dt = CloserFollowUpService._client_enrollment_date(a.client_id)
            data['enrollment_date'] = enrollment_dt.isoformat() if enrollment_dt else None
        return data

    @staticmethod
    def get_today_grouped(closer_id, selected_date_str):
        q = CloserFollowUpService._base_query(closer_id).filter(
            Appointment.fecha_seguimiento.isnot(None),
            Appointment.fecha_seguimiento != '',
            Appointment.fecha_seguimiento <= selected_date_str
        )
        items = q.order_by(Appointment.fecha_seguimiento.asc()).all()
        # El retraso se mide contra el día que el closer está mirando (no contra hoy): si revisa
        # un día pasado, ve el retraso que había ese día, coherente con la lista que se le muestra.
        try:
            reference_date = date.fromisoformat(selected_date_str[:10])
        except (TypeError, ValueError):
            reference_date = date.today()
        grouped = {'no_tomada': [], 'tomada': [], 'cerrada': []}
        for a in items:
            key = CloserFollowUpService._effective_tipo(a) or 'no_tomada'
            grouped[key].append(CloserFollowUpService._serialize(a, include_debt=(key == 'cerrada'), reference_date=reference_date))
        return grouped

    @staticmethod
    def send_due_reminders(selected_date_str=None):
        """Manda los avisos de seguimiento por WhatsApp (Whatchimp) que ya llegaron a su hora.

        Cada aviso lo pide el closer al programar el seguimiento: solo entran las citas con
        `followup_reminder_enabled` y una `followup_reminder_time` guardada. Sin las dos cosas no
        se manda nada — reemplaza al goteo automático de 2 por hora que avisaba de todo (ver
        bitácora del 11 y 14 de agosto: saturaba y hubo que apagarlo entero).

        Reglas:
          1. La hora guardada es local del closer (`User.timezone`), así que se compara contra su
             reloj: uno en otro huso recibe el aviso a SU hora, no a la del servidor.
          2. Se manda cuando esa hora ya pasó en el día de hoy. No hay ventana horaria impuesta:
             la hora la eligió el closer, el sistema no la discute.
          3. Una vez por día por cita (`followup_reminder_sent_at`). Un seguimiento vencido vuelve
             a avisar al día siguiente a la misma hora mientras siga sin resolverse, que es
             justamente lo que se le está recordando.

        Pensado para que el scheduler lo llame cada pocos minutos: llamarlo de más es inofensivo,
        el "una vez por día por cita" hace que las corridas extra no manden nada. Si el closer no
        tiene `two_chat_number` configurado (ver Gestión de Equipo), se cuenta como omitido en vez
        de fallar todo el lote."""
        if not reminders_enabled():
            return {
                "disabled": True,
                "sent": 0,
                "already_sent_today": 0,
                "skipped_no_phone": 0,
                "not_due_yet": 0,
                "failed": 0,
                "total_opted_in": 0
            }

        from app.services.whatchimp_service import WhatchimpService
        from app.services.user_time_service import zona_del_usuario

        selected_date_str = selected_date_str or date.today().isoformat()

        q = CloserFollowUpService._base_query(None).filter(
            Appointment.fecha_seguimiento.isnot(None),
            Appointment.fecha_seguimiento != '',
            Appointment.fecha_seguimiento <= selected_date_str,
            Appointment.followup_reminder_enabled.is_(True),
            Appointment.followup_reminder_time.isnot(None),
            Appointment.followup_reminder_time != ''
        )
        items = q.order_by(Appointment.fecha_seguimiento.asc()).all()

        by_closer = {}
        for a in items:
            if a.closer_id:
                by_closer.setdefault(a.closer_id, []).append(a)

        sent, skipped_no_phone, failed, already_sent, not_due_yet = 0, 0, 0, 0, 0
        for closer_appts in by_closer.values():
            closer = closer_appts[0].closer
            if not closer or not closer.is_active or not closer.two_chat_number:
                skipped_no_phone += len(closer_appts)
                continue

            # El reloj del closer, no el del servidor: tanto para saber si ya es la hora como
            # para el "una vez por día" (si no, el corte de día caía a medianoche UTC).
            ahora_local = datetime.now(zona_del_usuario(closer))
            hoy_local = ahora_local.date()

            for a in closer_appts:
                hora = parse_reminder_time(a.followup_reminder_time)
                if not hora:
                    continue

                sent_at = a.followup_reminder_sent_at
                if sent_at and sent_at.date() == hoy_local:
                    already_sent += 1
                    continue

                if ahora_local.strftime('%H:%M') < hora:
                    not_due_yet += 1
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
                    # Naive y en hora local del closer, para que `.date()` de arriba compare
                    # contra su día y no contra el del servidor.
                    a.followup_reminder_sent_at = ahora_local.replace(tzinfo=None)
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
            "not_due_yet": not_due_yet,
            "failed": failed,
            "total_opted_in": len(items)
        }

    @staticmethod
    def _cerrada_pool_items(closer_id):
        """"Llamadas cerradas" del pool: TODO cliente que ya compró algo (con venta completada en
        FinancialSale), con su deuda y programa — no solo los que alguna vez se etiquetaron
        explícitamente como `seguimiento_tipo='cerrada'` (que dependía de pasar por el flujo de
        cobro pendiente al declarar la venta, dejando afuera a la enorme mayoría de clientes ya
        cerrados). Antes de ese primer fix la pestaña quedaba casi siempre vacía — el usuario lo
        reportó: "no hay ningún registro para poder agregarle seguimiento".

        El dueño del item es quien hoy tiene la cita más reciente del cliente (`Appointment.closer_id`)
        — mismo criterio de propiedad que `_base_query` usa para el resto del módulo (propias +
        huérfanas de closers dados de baja) — NO quien hizo la venta originalmente
        (FinancialSale.email_vendedor). Antes se scopeaba por vendedor: si un cliente vendido por
        un closer terminaba con una cita más reciente en manos de otro (reasignación, una llamada
        de seguimiento que tomó alguien más), su cobro aparecía en la cola de AMBOS closers a la
        vez — reportado por el usuario como "tengo seguimientos de leads que le corresponden a
        otro closer, eso no debe pasar". Verificado contra la base local: 450 casos así antes de
        este fix, todos con el otro closer activo (no huérfano)."""
        from app.models import User, Client, FinancialSale

        if not closer_id:
            return []

        sales = FinancialSale.query.filter(
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

        inactive_closer_ids = {
            row[0] for row in db.session.query(User.id).filter(User.role == 'closer', User.is_active == False)
        }

        items = []
        for cid in client_ids:
            client = Client.query.get(cid)
            if not client:
                continue
            appt = Appointment.query.filter_by(client_id=cid).order_by(Appointment.start_time.desc()).first()
            if not appt:
                continue
            if appt.closer_id != closer_id and appt.closer_id not in inactive_closer_ids:
                continue
            days_since_call = (date.today() - appt.start_time.date()).days if appt.start_time else None

            # El recordatorio de cobro vive acá: la próxima cuota pendiente de este cliente (la
            # más próxima a vencer primero), para que el closer sepa exactamente qué y cuándo
            # cobrar sin tener que abrir el historial completo del cliente.
            next_cuota = InstallmentPlan.query.filter_by(client_id=cid, estado='pendiente') \
                .order_by(InstallmentPlan.fecha_vencimiento.asc()).first()
            deuda_val = CloserFollowUpService._client_debt(cid)
            enrollment_dt = CloserFollowUpService._client_enrollment_date(cid)
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
                'phone': client.phone or '',
                'origin': appt.origin or '',
                'examen': appt.examen or '',
                'seguimiento_tipo': 'cerrada',
                'seguimiento_sub': appt.seguimiento_sub or '',
                'seguimiento_intento': appt.seguimiento_intento or 1,
                'fecha_seguimiento': appt.fecha_seguimiento or None,
                'dias_retraso': CloserFollowUpService._dias_retraso(appt.fecha_seguimiento),
                'call_date': appt.start_time.isoformat() if appt.start_time else None,
                'days_since_call': days_since_call,
                'closer_notes': appt.closer_notes or '',
                # Solo relevante cuando el item llegó al pool por ser huérfano de un closer dado
                # de baja (mismo criterio que `_serialize` usa para el resto del módulo) — deja
                # claro que no es un lead propio.
                'owner_closer_name': appt.closer.username if (appt.closer and appt.closer.is_active is False) else None,
                'closer_id': appt.closer_id,
                'closer_name': appt.closer.username if appt.closer else None,
                'enrollment_date': enrollment_dt.isoformat() if enrollment_dt else None,
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
    def get_client_lead_stage(client_id):
        """Clasifica en qué etapa está un lead para que la búsqueda global del closer abra el
        modal correspondiente (en vez del resumen genérico del cliente): 'cerrada' (ya compró
        algo — seguimiento de cobranza/renovación/upsell), 'confirm' (tiene agenda(s) futura(s)
        sin confirmar), 'call' (la fecha de la cita ya pasó y el closer no reportó qué pasó),
        'seg' (llamada tomada/no tomada con seguimiento pendiente) o 'none' (sin nada accionable
        — cliente sin citas locales). Devuelve None si el client_id no existe."""
        from app.models import Client, InstallmentPlan

        client = Client.query.get(client_id)
        if not client:
            return None

        if CloserFollowUpService._client_has_sale(client):
            # Ancla una Appointment si el cliente compró pero nunca tuvo ninguna cita (ver
            # docstring de _ensure_appointment_for_client) — sin esto `appointment_id` salía None
            # y el frontend terminaba pegándole a POST /closer/deck/null.
            appt = CloserFollowUpService._ensure_appointment_for_client(client)
            enrollment_dt = CloserFollowUpService._client_enrollment_date(client_id)
            deuda_val = CloserFollowUpService._client_debt(client_id)
            next_cuota = InstallmentPlan.query.filter_by(client_id=client_id, estado='pendiente') \
                .order_by(InstallmentPlan.fecha_vencimiento.asc()).first()
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
                proxima_cuota = {'id': None, 'numero_cuota': None, 'monto': deuda_val, 'fecha_vencimiento': None, 'vencida': False, 'sin_plan': True}
            programa_code = CloserFollowUpService._client_program_code(client_id)
            return {
                'stage': 'cerrada',
                'client_id': client_id,
                'appointment_id': appt.id if appt else None,
                'lead_name': client.full_name or client.email or 'Sin Nombre',
                'instagram': client.instagram or '',
                'phone': client.phone or '',
                'origin': appt.origin if appt else '',
                'examen': appt.examen if appt else '',
                'closer_notes': appt.closer_notes if appt else '',
                'seguimiento_intento': (appt.seguimiento_intento if appt else 1) or 1,
                'call_date': appt.start_time.isoformat() if appt and appt.start_time else None,
                'enrollment_date': enrollment_dt.isoformat() if enrollment_dt else None,
                'deuda': deuda_val,
                'programa_code': programa_code,
                'programa_nombre': PROGRAM_CODE_NAMES.get(programa_code),
                'proxima_cuota': proxima_cuota
            }

        appts = Appointment.query.filter_by(client_id=client_id).order_by(Appointment.start_time.desc()).all()
        if not appts:
            return {'stage': 'none', 'client_id': client_id}

        now = datetime.utcnow()
        pending = [a for a in appts if not a.closer_processed and (a.closer_result or '').strip().lower() in ('', 'pendiente', '2da call')]
        confirm_candidates = sorted([a for a in pending if a.start_time and a.start_time > now], key=lambda a: a.start_time)
        call_candidates = [a for a in pending if not (a.start_time and a.start_time > now)]

        if confirm_candidates:
            return {
                'stage': 'confirm',
                'client_id': client_id,
                'appointments': [{
                    'id': a.id,
                    'start_time': a.start_time.isoformat() if a.start_time else None,
                    'result': a.result or '',
                    'lead_name': client.full_name or client.email or 'Sin Nombre'
                } for a in confirm_candidates]
            }

        if call_candidates:
            call_candidates.sort(key=lambda a: a.start_time or datetime.min, reverse=True)
            return {'stage': 'call', 'client_id': client_id, 'appointment_id': call_candidates[0].id}

        seg_candidates = [a for a in appts if not a.seguimiento_realizado and CloserFollowUpService._effective_tipo(a)]
        if seg_candidates:
            seg_candidates.sort(key=lambda a: a.fecha_seguimiento or '')
            chosen = seg_candidates[0]
            return {
                'stage': 'seg',
                'tipo': CloserFollowUpService._effective_tipo(chosen),
                'client_id': client_id,
                'appointment_id': chosen.id
            }

        # Nada pendiente por confirmar/reportar/seguir — el cliente sigue teniendo citas, así
        # que se abre la más reciente en modo reporte de llamada (permite revisar/corregir).
        return {'stage': 'call', 'client_id': client_id, 'appointment_id': appts[0].id}

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
                    # Rangos excluyentes (0-14 / 15-30 / 31+), no acumulativos — antes "30"
                    # incluía también lo que ya mostraba "14", así que cambiar de un filtro a
                    # otro nunca sacaba nada de la lista, solo agregaba.
                    if days_since == '14':
                        return d <= 14
                    if days_since == '30':
                        return 14 < d <= 30
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
                # Rangos excluyentes (0-14 / 15-30 / 31+), no acumulativos — antes "30" incluía
                # también lo que ya mostraba "14", así que cambiar de un filtro a otro nunca
                # sacaba nada de la lista, solo agregaba.
                if days_since == '14':
                    return d <= 14
                if days_since == '30':
                    return 14 < d <= 30
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
    def schedule_followup(appointment, tipo, sub, fecha_seguimiento, notes=None, intento=None,
                          reminder_enabled=None, reminder_time=None):
        """Crea/actualiza la categorización de un seguimiento sobre una cita existente.

        `reminder_enabled`/`reminder_time` solo se tocan si vienen: así los llamadores que no
        saben del aviso (o una edición parcial) no lo apagan sin querer."""
        appointment.seguimiento_tipo = tipo
        appointment.seguimiento_sub = sub
        appointment.seguimiento_intento = intento or 1
        appointment.fecha_seguimiento = fecha_seguimiento or None
        appointment.seguimiento_realizado = False
        if notes:
            appointment.closer_notes = notes
        CloserFollowUpService.apply_reminder_settings(appointment, reminder_enabled, reminder_time)

    @staticmethod
    def apply_reminder_settings(appointment, reminder_enabled=None, reminder_time=None):
        """Guarda el aviso de WhatsApp elegido por el closer, ignorando lo que no venga.

        Un aviso sin hora no se puede mandar (ver `send_due_reminders`), así que si queda
        activado sin hora se guarda como desactivado en vez de dejar un estado que promete un
        mensaje que nunca va a salir."""
        if reminder_time is not None:
            appointment.followup_reminder_time = parse_reminder_time(reminder_time)
        if reminder_enabled is not None:
            appointment.followup_reminder_enabled = bool(reminder_enabled)
        if appointment.followup_reminder_enabled and not appointment.followup_reminder_time:
            appointment.followup_reminder_enabled = False
        # Reprogramar reabre el aviso: si no, la marca de "ya avisé hoy" del seguimiento
        # anterior se comería el primer aviso del nuevo.
        if reminder_enabled is not None or reminder_time is not None:
            appointment.followup_reminder_sent_at = None
