from app.models import Availability, Appointment, User, Client, SurveyAnswer, Notification, db
from sqlalchemy import or_
from datetime import datetime, timedelta, date, time
import pytz

from app.services.booking_avisos import BookingAvisosMixin
from app.services.booking_identidad import BookingIdentidadMixin
from app.services.booking_espejo import BookingEspejoMixin


class BookingService(BookingAvisosMixin, BookingIdentidadMixin, BookingEspejoMixin):
    @staticmethod
    def get_available_slots_utc(start_date, end_date, preferred_closer_id=None):
        from app.models import WeeklyAvailability
        
        # Get all active appointments (not cancelled/rescheduled, not already resolved by the closer) in range to avoid double booking
        appointments = Appointment.query.filter(
            Appointment.start_time >= datetime.combine(start_date, time.min),
            Appointment.start_time <= datetime.combine(end_date, time.max) + timedelta(days=1),
            Appointment.closer_processed == False,
            or_(Appointment.result == None, Appointment.result == '', Appointment.result.notin_(['Cancelada', 'Reprogramada']))
        ).all()
        
        booked_slots = set()
        for appt in appointments:
            booked_slots.add((appt.closer_id, appt.start_time))
            
        unique_slots = {}
        
        # Iterate through each day in the range
        current_date = start_date
        while current_date <= end_date:
            # 1. Check for specific overrides in Availability table for this day
            day_avs = Availability.query.filter_by(date=current_date)
            if preferred_closer_id:
                day_avs = day_avs.filter_by(closer_id=preferred_closer_id)
            
            day_avs = day_avs.all()
            
            if day_avs:
                # Use specific offsets if they exist
                for av in day_avs:
                    BookingService._process_slot(av.closer, current_date, av.start_time, booked_slots, unique_slots, preferred_closer_id)
            else:
                # 2. Fallback to WeeklyAvailability
                day_of_week = current_date.weekday() # 0 = Monday, etc.
                weekly_query = WeeklyAvailability.query.filter_by(day_of_week=day_of_week, is_active=True)
                if preferred_closer_id:
                    weekly_query = weekly_query.filter_by(closer_id=preferred_closer_id)
                
                weekly_slots = weekly_query.all()
                for ws in weekly_slots:
                    BookingService._process_slot(ws.closer, current_date, ws.start_time, booked_slots, unique_slots, preferred_closer_id)
            
            current_date += timedelta(days=1)
        
        available_slots = list(unique_slots.values())
        available_slots.sort(key=lambda x: x['ts'])
        return available_slots

    @staticmethod
    def _process_slot(closer, date_val, time_val, booked_slots, unique_slots, preferred_closer_id):
        if not closer: return
        
        try: closer_tz = pytz.timezone(closer.timezone or 'America/La_Paz')
        except: closer_tz = pytz.timezone('America/La_Paz')
            
        local_dt = closer_tz.localize(datetime.combine(date_val, time_val))
        utc_dt = local_dt.astimezone(pytz.UTC).replace(tzinfo=None)
        
        # Avoid past slots (with 5 min buffer)
        if utc_dt < datetime.utcnow() - timedelta(minutes=5): return
        
        if (closer.id, utc_dt) not in booked_slots:
            ts_key = utc_dt
            if ts_key not in unique_slots:
                unique_slots[ts_key] = {
                    'utc_iso': utc_dt.isoformat() + 'Z', 
                    'closer_id': closer.id, 
                    'ts': utc_dt.replace(tzinfo=pytz.UTC).timestamp(),
                    'date': date_val.isoformat(),
                    'start': time_val.strftime('%H:%M')
                }
            elif preferred_closer_id and closer.id == preferred_closer_id:
                 unique_slots[ts_key]['closer_id'] = closer.id

    @staticmethod
    def cliente_de_agenda(agenda):
        """El cliente de la agenda por su persona (docs/plan_personas.md), o None si todavía no la
        tiene. Quien llama sigue con su búsqueda por mail/instagram de respaldo."""
        if agenda is None or not getattr(agenda, 'person_uuid', None):
            return None
        return Client.query.filter_by(person_uuid=agenda.person_uuid).order_by(Client.id).first()

    @staticmethod
    def clientes_por_persona(agendas):
        """{person_uuid: client_id} de esas agendas, en una consulta (el más antiguo si hay varios)."""
        uuids = {a.person_uuid for a in agendas if getattr(a, 'person_uuid', None)}
        if not uuids:
            return {}
        salida = {}
        for c in Client.query.filter(Client.person_uuid.in_(uuids)).order_by(Client.id).with_entities(Client.id, Client.person_uuid):
            salida.setdefault(c.person_uuid, c.id)
        return salida

    @staticmethod
    def _email_de_otro(email, client_id):
        """¿Ese email ya es de otro cliente? (`clients.email` es único: pisarlo rompería el guardado)."""
        return Client.query.filter(db.func.lower(Client.email) == email, Client.id != client_id).first() is not None

    @staticmethod
    def create_or_update_client(data, client_id=None):
        email = data.get('email')
        name = data.get('name')
        phone = data.get('phone')
        instagram = data.get('instagram')

        email_clean = str(email).strip().lower() if email and '@' in str(email) else None
        ig_clean = str(instagram).strip().replace('@', '').lower() if instagram and str(instagram).lower() not in ('n/a', 'none', '') else None
        phone_clean = str(phone).strip() if phone and str(phone).lower() not in ('n/a', 'none', '') else None
        
        client = None
        if client_id:
            client = Client.query.get(client_id)

        if not client:
            # Quién es lo decide su persona (docs/plan_personas.md): la busca por todos sus mails,
            # instagrams y teléfonos, y le crea el cliente comercial si todavía no tiene. Los duplicados
            # ya no se fusionan acá: los junta scripts/fusionar_personas.py.
            from app.services import person_service
            person = person_service.resolver(name, email_clean, ig_clean, phone_clean, fuente='agenda')
            client = person_service.cliente_de(person)
        if client:
            if name: client.full_name = name
            if email_clean and (not client.email or 'no-email-' in client.email) and \
                    not BookingService._email_de_otro(email_clean, client.id):
                client.email = email_clean
            if phone_clean: client.phone = phone_clean
            if ig_clean: client.instagram = ig_clean
        
        db.session.commit()
        return client

    @staticmethod
    def create_appointment(client_id, closer_id, start_time_utc, origin='direct', setter_id=None, ignorar_ids=()):
        # Validar existencia de cliente
        client = Client.query.get(client_id)

        if not client:
            print(f"[BookingService Error] Cliente con ID {client_id} no encontrado.")
            return None

        # Verificar conflicto de horario para el mismo closer (una cita ya resuelta por el closer,
        # p.ej. Show up/No Show/No Lead/Lead Perdido, o archivada sin reporte por el sistema, no
        # debe seguir bloqueando ese horario: todas quedan con closer_processed=True).
        # ignorar_ids: las que quien llama ya sabe que no siguen (Agendas 2.0: ya no están en su Google Calendar).
        conflict = Appointment.query.filter_by(closer_id=closer_id, start_time=start_time_utc).filter(
            Appointment.closer_processed == False,
            or_(Appointment.result == None, Appointment.result == '', Appointment.result.notin_(['Cancelada', 'Reprogramada']))
        )
        if ignorar_ids:
            conflict = conflict.filter(Appointment.id.notin_(list(ignorar_ids)))
        conflict = conflict.first()
        if conflict: return None
            
        appt = Appointment(
            closer_id=closer_id,
            setter_id=setter_id,
            client_id=client.id,
            start_time=start_time_utc,
            origin=origin,
            last_stage='Nueva'
        )
        db.session.add(appt)
        
        # Notificación para Closer y Admins
        try:
            client_name = client.full_name or client.email or "Cliente"
            
            noti = Notification(
                subject="Nueva Agenda",
                content=f"Nueva sesión con {client_name} para el {start_time_utc.strftime('%d/%m/%Y %H:%M')} UTC.",
                target_users=["role:admin", int(closer_id)],
                related_users=[int(closer_id), client.id],
                associated_id=appt.id,
                associated_type='appointment'
            )
            db.session.add(noti)
            
            
        except Exception as e:
            print(f"Error creando notificación de cita: {e}")

        db.session.commit()
        return appt

    @staticmethod
    def eliminar_agenda(appt):
        """Borra una agenda y lo que cuelga de ella. Devuelve (ok, error).

        Vive acá porque la borran dos superficies con permisos distintos —el mazo del closer
        (`DELETE /closer/deck/<id>`) y el libro de la dirección comercial
        (`DELETE /comercial/agendas/<id>`)— y las dos tienen que hacer exactamente lo mismo: si
        una se olvidara de desvincular las respuestas de la encuesta, el borrado fallaría por la
        foreign key en una pantalla y no en la otra.

        Las respuestas de la encuesta se DESVINCULAN, no se borran: son del cliente y valen
        aunque la cita desaparezca. El evento de Google Calendar se borra en el mejor esfuerzo:
        que la agenda del closer quede con un hueco de más no puede impedir borrar la fila.

        El plan de cuotas tampoco se va con la agenda, y es lo más delicado: `InstallmentPlan`
        cuelga de la cita con `cascade='all, delete-orphan'`, así que borrar la cita borraba el
        cronograma del cliente entero, cuotas ya cobradas incluidas —el plan es del CLIENTE, la
        cita es solo donde quedó colgado—. Se pasa a la cita más reciente que le quede al cliente.
        Si esta era la única, el borrado se frena: no hay dónde dejar el plan y perderlo no es un
        efecto aceptable de limpiar una agenda. El registro de eventos de la cita sí se va con
        ella: cuenta lo que pasó en ESA llamada."""
        from app.models import InstallmentPlan

        try:
            cuotas = InstallmentPlan.query.filter_by(appointment_id=appt.id).all()
            if cuotas:
                otra = BookingService.otra_agenda_del_cliente(appt)
                if not otra:
                    return False, ('Es la única agenda de este cliente y de ella cuelga su plan de '
                                   'cuotas: si se borra, se pierde el plan. Agendá otra llamada '
                                   'antes de borrar esta.')
                for cuota in cuotas:
                    cuota.appointment_id = otra.id

            SurveyAnswer.query.filter_by(appointment_id=appt.id).update({'appointment_id': None})

            if appt.google_event_id:
                try:
                    from app.services.google_service import GoogleService
                    GoogleService.delete_event(appt.closer_id, appt.google_event_id)
                except Exception as gcal_err:
                    print(f"[GCal Delete Error] {gcal_err}")

            db.session.delete(appt)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def otra_agenda_del_cliente(appt):
        """La cita más reciente del mismo cliente que no sea `appt`, o None. Es a donde pasa lo
        que colgaba de una cita que se borra (ver `eliminar_agenda`)."""
        if not appt.client_id:
            return None
        return (Appointment.query
                .filter(Appointment.client_id == appt.client_id, Appointment.id != appt.id)
                .order_by(Appointment.start_time.desc().nullslast(), Appointment.id.desc())
                .first())

    @staticmethod
    def save_survey_answers(client_id, answers_data, appointment_id=None):
        for item in answers_data:
            q_id = item['question_id']
            ans_text = item['answer']
            existing = SurveyAnswer.query.filter_by(client_id=client_id, question_id=q_id).first()
            if existing:
                existing.answer = ans_text
                if appointment_id: existing.appointment_id = appointment_id
            else:
                new_ans = SurveyAnswer(client_id=client_id, question_id=q_id, answer=ans_text, appointment_id=appointment_id)
                db.session.add(new_ans)
        db.session.commit()
