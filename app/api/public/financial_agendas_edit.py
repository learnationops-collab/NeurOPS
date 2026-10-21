"""Edicion, borrado y reparaciones de agendas financieras."""
from flask import request, jsonify, current_app
from flask_login import current_user
from app.models import db, FinancialAgenda, Client
from datetime import datetime
from sqlalchemy import or_, func
from app.services.agenda_contacto_service import ig_limpio, mail_limpio
from app.services.agenda_time_service import parse_a_utc, zona_origen
from . import bp


@bp.route('/public/financial-agendas/<int:agenda_id>', methods=['PUT', 'OPTIONS'])
def update_financial_agenda(agenda_id):
    # Actualiza una agenda financiera
    if request.method == 'OPTIONS':
        return '', 204
        
    data = request.json or {}
    agenda = FinancialAgenda.query.get(agenda_id)
    if not agenda:
        return jsonify({"error": "Agenda no encontrada"}), 404
        
    try:
        if 'nombre' in data:
            agenda.nombre = data['nombre']
        # El lead, su instagram, whatsapp y mail corrigen a su persona (lo que se muestra sale de ella).
        from app.services import agenda_contacto_service
        if 'lead' in data:
            agenda_contacto_service.corregir(agenda, 'lead', data['lead'], current_user)
        if 'closer' in data:
            from app.services.booking_service import BookingService
            agenda.closer = BookingService.normalize_closer_name(data['closer'])
        if 'fecha_meet' in data:
            agenda.fecha_meet = data['fecha_meet']
        if 'instagram' in data:
            agenda_contacto_service.corregir(agenda, 'instagram', data['instagram'], current_user)
        if 'whatsapp' in data:
            agenda_contacto_service.corregir(agenda, 'whatsapp', data['whatsapp'], current_user)
        if 'mail' in data:
            agenda_contacto_service.corregir(agenda, 'mail', data['mail'], current_user)
            # Propagar la corrección al Cliente ya existente cuando el mail real llega DESPUÉS
            # de que el Cliente ya se hubiera creado con un placeholder (p.ej. agendó por
            # Calendly antes de que n8n mandara su mail real, o el mail vino vacío la primera
            # vez y alguien lo corrige acá a mano). Sin esto, `agenda.mail` queda correcto pero
            # `Client.email` se queda con el placeholder para siempre -- el mismo problema que
            # ya se había resuelto para el flujo de sincronización normal en
            # `BookingService.find_or_create_client`, pero que faltaba acá en la edición manual
            # (bug real reportado por el usuario, 10/sep/2026, caso "Mia Sky": corrigió el mail
            # que llega de n8n en el Registro de Agendas pero el Cliente seguía "Sin email real").
            nuevo_mail = (data['mail'] or '').strip().lower()
            if nuevo_mail and '@' in nuevo_mail:
                contacto = agenda.contacto()
                ig_clean = ig_limpio(contacto['instagram'])
                whatsapp_clean = (contacto['whatsapp'] or '').strip()
                client_filters = []
                if ig_clean:
                    client_filters.append(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean)
                if whatsapp_clean and len(whatsapp_clean) >= 8:
                    client_filters.append(Client.phone.like(f"%{whatsapp_clean[-8:]}%"))
                from app.services.booking_service import BookingService
                # El cliente de la persona de la agenda; el cruce por texto, de respaldo.
                client = (BookingService.cliente_de_agenda(agenda)
                          or (Client.query.filter(or_(*client_filters)).first() if client_filters else None))
                if client:
                    email_actual = (client.email or '').lower()
                    es_placeholder = (not email_actual or 'no-email-' in email_actual or 'no_email_' in email_actual
                                       or '@neurops.com' in email_actual or '@neurops.temp' in email_actual)
                    if es_placeholder:
                        client.email = nuevo_mail
        status_changed = False
        if 'estado' in data and data['estado'] != agenda.estado:
            status_changed = True
            agenda.estado = data['estado']
            
        # El Tablero de Agendas ya no muestra ni edita el Call Confirmer (10/10/2026), pero la
        # pantalla del rol triage (/triage/deck, TriageWorkflowPage) sigue mandando su usuario al
        # confirmar o reagendar, y el prefill de su reporte diario (/public/triage-report/prefill)
        # cuenta sus agendas por este campo: si dejara de guardarse, ese reporte quedaria en cero.
        if 'encargado_triage' in data:
            agenda.encargado_triage = data['encargado_triage']
        if 'fecha_seguimiento' in data:
            agenda.fecha_seguimiento = data['fecha_seguimiento']
        if 'seguimiento_realizado' in data:
            agenda.seguimiento_realizado = bool(data['seguimiento_realizado'])
        if 'date' in data:
            # Misma convencion que la ingesta: la columna guarda UTC naive. El editor del panel
            # manda ISO con 'Z' (ver FinancialAgendasPage.handleEditSubmit); si por lo que sea
            # llega un string sin zona, se asume AGENDAS_SOURCE_TZ igual que en el webhook.
            nueva_fecha, _ = parse_a_utc(data['date'])
            if nueva_fecha:
                agenda.date = nueva_fecha
        if 'created_at' in data and data['created_at']:
            nuevo_created_at, _ = parse_a_utc(data['created_at'])
            if nuevo_created_at:
                agenda.created_at = nuevo_created_at
                # `registro` es el texto que se muestra/ordena en el panel de agendas y siempre
                # fue hora local de la fuente, no UTC: se deja como estaba para no mover los
                # listados que ordenan por ese campo.
                import pytz
                agenda.registro = pytz.UTC.localize(nuevo_created_at).astimezone(
                    zona_origen()).replace(tzinfo=None).isoformat()
            
        if status_changed:
            from app.models import Notification
            contacto = agenda.contacto()
            notif = Notification(
                subject=f"Estado de Agenda Actualizado: {contacto['lead'] or agenda.nombre or 'Desconocido'}",
                content=f"La agenda con @{contacto['instagram'] or 'sin_ig'} ha cambiado de estado a '{agenda.estado}'.",
                target_users=["all"],
                associated_id=agenda.id,
                associated_type="agenda"
            )
            db.session.add(notif)
            
            # Sincronización in-line de razones para Setter (Confirmer)
            if agenda.estado in ('Cancelada', 'Reagendada'):
                from app.models import Appointment
                from app.services.closer_service import CloserService
                from flask_login import current_user
                
                contacto = agenda.contacto()
                ig_clean = ig_limpio(contacto['instagram'])
                mail_clean = mail_limpio(contacto['mail'])

                client_filters = []
                if ig_clean:
                    client_filters.append(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean)
                if mail_clean:
                    client_filters.append(func.lower(Client.email) == mail_clean)
                    
                from app.services.booking_service import BookingService
                client = BookingService.cliente_de_agenda(agenda)
                if client is None and client_filters:
                    client = Client.query.filter(or_(*client_filters)).first()

                if client and agenda.date:
                    start_of_day = datetime.combine(agenda.date.date(), datetime.min.time())
                    end_of_day = datetime.combine(agenda.date.date(), datetime.max.time())

                    appt = Appointment.query.filter(
                        Appointment.client_id == client.id,
                        Appointment.start_time >= start_of_day,
                        Appointment.start_time <= end_of_day
                    ).first()
                    
                    if appt:
                        mapped_st = 'Cancelado' if agenda.estado == 'Cancelada' else 'Reagendado'
                        process_payload = {
                            'status': mapped_st,
                            'reschedule_date': data.get('reschedule_date'),
                            'note': data.get('note'),
                            'role': 'setter'
                        }
                        user_id = current_user.id if (current_user and current_user.is_authenticated) else appt.setter_id
                        CloserService.process_agenda(closer_id=user_id, appt_id=appt.id, data=process_payload, is_admin=True)

        # Si se edita closer_result (desde la vista de admin/closer)
        if 'closer_result' in data:
            from app.models import Appointment
            from app.services.booking_service import BookingService
            from app.services.closer_service import CloserService
            from flask_login import current_user
            
            contacto = agenda.contacto()
            ig_clean = ig_limpio(contacto['instagram'])
            mail_clean = mail_limpio(contacto['mail'])

            client_filters = []
            if ig_clean:
                client_filters.append(func.lower(func.replace(Client.instagram, '@', '')) == ig_clean)
            if mail_clean:
                client_filters.append(func.lower(Client.email) == mail_clean)
                
            client = BookingService.cliente_de_agenda(agenda)
            if client is None and client_filters:
                client = Client.query.filter(or_(*client_filters)).first()

            if client and agenda.date:
                start_of_day = datetime.combine(agenda.date.date(), datetime.min.time())
                end_of_day = datetime.combine(agenda.date.date(), datetime.max.time())
                
                appt = Appointment.query.filter(
                    Appointment.client_id == client.id,
                    Appointment.start_time >= start_of_day,
                    Appointment.start_time <= end_of_day
                ).first()
                
                if appt:
                    new_closer_res = data['closer_result']
                    # Mapear de vuelta al formato interno de closer_result
                    if new_closer_res == 'Show Up':
                        new_closer_res = 'Show up'
                    elif new_closer_res == '2TH Call':
                        new_closer_res = '2da call'
                    elif new_closer_res == 'Cancelada':
                        new_closer_res = 'Cancelado'
                    elif new_closer_res == 'Reagendada':
                        new_closer_res = 'Reagendado'
                        
                    if new_closer_res in ('Cancelado', 'Reagendado', '2da call'):
                        process_payload = {
                            'status': new_closer_res,
                            'reschedule_date': data.get('reschedule_date'),
                            'note': data.get('note'),
                            'role': 'closer'
                        }
                        user_id = current_user.id if (current_user and current_user.is_authenticated) else appt.closer_id
                        CloserService.process_agenda(closer_id=user_id, appt_id=appt.id, data=process_payload, is_admin=True)
                    else:
                        appt.closer_result = new_closer_res
                        if new_closer_res in ('Show up', 'No Show'):
                            appt.closer_processed = True
                        db.session.add(appt)
                        BookingService.sync_appointment_to_financial_agenda(appt)

        db.session.commit()

        # Sincronizar la agenda editada
        try:
            from app.services.booking_service import BookingService
            BookingService.sync_financial_agenda_to_appointment(agenda)
        except Exception as sync_err:
            # Si este sync falla, la agenda queda con la fecha nueva y el Appointment con la
            # vieja -- justo el tipo de desfase que se esta corrigiendo. Antes se silenciaba.
            current_app.logger.error(
                f"[SYNC ERROR] Agenda {agenda.id} editada pero no sincronizada a Appointment: {sync_err}")

        return jsonify({"message": "Agenda actualizada correctamente", "agenda": agenda.to_dict()}), 200
    except ValueError as e:
        # El dato corregido es inválido (422) o ya es de otra persona (409): no se guarda nada.
        from app.services.persona_de_venta import DatoDeOtraPersona
        db.session.rollback()
        return jsonify({"error": str(e)}), 409 if isinstance(e, DatoDeOtraPersona) else 422
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-agendas/<int:agenda_id>', methods=['DELETE'])
def delete_financial_agenda(agenda_id):
    # Elimina un registro de agenda financiera
    agenda = FinancialAgenda.query.get(agenda_id)
    if not agenda:
        return jsonify({"error": "Agenda no encontrada"}), 404
        
    try:
        # Buscar y eliminar cita asociada si existe
        try:
            from app.models import Appointment, Client
            # Buscar el cliente asociado
            contacto = agenda.contacto()
            ig_norm = contacto['instagram'].strip().lstrip('@').lower() if contacto['instagram'] else None
            email_norm = contacto['mail'].strip().lower() if contacto['mail'] else None
            from app.services.booking_service import BookingService
            client = BookingService.cliente_de_agenda(agenda)
            if client is None and (ig_norm or email_norm):
                client_filters = []
                if ig_norm: client_filters.append(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig_norm)
                if email_norm: client_filters.append(db.func.lower(Client.email) == email_norm)
                client = Client.query.filter(or_(*client_filters)).first()
            if client:
                start_of_day = datetime.combine(agenda.date.date(), datetime.min.time())
                end_of_day = datetime.combine(agenda.date.date(), datetime.max.time())
                appt = Appointment.query.filter(
                    Appointment.client_id == client.id,
                    Appointment.start_time >= start_of_day,
                    Appointment.start_time <= end_of_day
                ).first()
                if appt:
                    db.session.delete(appt)
        except Exception as appt_err:
            print(f"[DELETE SYNC ERROR] {appt_err}")

        db.session.delete(agenda)
        db.session.commit()
        return jsonify({"message": "Agenda eliminada correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-agendas/sync-appointments', methods=['POST'])
def sync_all_financial_agendas():
    """Sincroniza masivamente las agendas financieras con Appointments, con filtro temporal por defecto."""
    try:
        from app.services.booking_service import BookingService
        from datetime import date, timedelta
        
        sync_all = request.args.get('all', 'false').lower() == 'true'
        days = request.args.get('days', 14, type=int)
        
        # Las marcadas como repetidas quedan fuera: su cita se cancelo al descartarlas y
        # sincronizarlas se la devolveria a la bandeja del closer. `sync_financial_agenda_
        # to_appointment` ya las corta por su cuenta; esto ademas evita recorrerlas.
        query = FinancialAgenda.query.filter(FinancialAgenda.duplicada_de_id.is_(None))
        if not sync_all:
            limit_date = date.today() - timedelta(days=days)
            query = query.filter(FinancialAgenda.date >= limit_date)
            
        agendas = query.all()
        synced_count = 0
        for agenda in agendas:
            appt = BookingService.sync_financial_agenda_to_appointment(agenda)
            if appt:
                synced_count += 1
                
        return jsonify({
            "status": "success",
            "message": f"Sincronización completada. {synced_count} agendas procesadas.",
            "total_processed": len(agendas),
            "synced": synced_count,
            "filtered_by_days": None if sync_all else days
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
