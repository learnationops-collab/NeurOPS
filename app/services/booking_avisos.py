"""Avisos de una agenda: el webhook (Discord / 2Chat) y el registro de eventos del lead.
Mixin de `BookingService` (app/services/booking_service.py)."""
from app.models import Appointment, db
from datetime import datetime, time
import pytz


class BookingAvisosMixin:
    @staticmethod
    def trigger_agenda_webhook(appointment, event=None):
        # Trigger the webhook

        
        try:
            from app.models import Integration
            # 1. Find 'Agenda' Integration
            webhook = Integration.query.filter(Integration.name.ilike('Agenda%')).first()
            if not webhook:
                # Try by key if name fails
                webhook = Integration.query.filter_by(key='agenda_webhook').first()
            
            if not webhook: return
            
            url = webhook.url_prod if webhook.active_env == 'prod' else webhook.url_dev
            if not url: return

            import requests
            
            # 2. Prepare Data
            client = appointment.client
            closer = appointment.closer
            
            # Count appointments for this client to get "numero_agenda"
            count = Appointment.query.filter_by(client_id=client.id).count()
            
            # Format Date/Time (Adjust to Closer's TZ if possible, else UTC)
            tz_name = closer.timezone or 'America/La_Paz'
            user_tz = pytz.timezone(tz_name)
            local_dt = appointment.start_time.replace(tzinfo=pytz.UTC).astimezone(user_tz)
            
            date_str = local_dt.strftime('%d/%m/%Y')
            time_str = local_dt.strftime('%H:%M')
            
            # Source for Discord Display (User request: Setter Name or "Sin Setter")
            display_source = appointment.setter.username if appointment.setter else "Sin Setter"
            
            payload = {
                "nombre_completo": client.full_name or "Sin Nombre",
                "primer_nombre": client.full_name.split(' ')[0] if client.full_name else "",
                "numero_telefono": client.phone or "",
                "fuente": display_source,
                "fecha_agenda": date_str,
                "hora_agenda": time_str,
                "closer": closer.username,
                "zona_geografica": tz_name,
                "tipo_evento": "agendada",
                "numero_agenda": count
            }
            
            # 3. Send
            if 'discord.com/api/webhooks' in url:
                try:
                    from app.services.image_service import ImageService
                    import json
                    
                    # Calculate todays count
                    today_start = datetime.combine(datetime.utcnow().date(), time.min)
                    today_end = datetime.combine(datetime.utcnow().date(), time.max)
                    todays_count = Appointment.query.filter(
                        Appointment.created_at >= today_start,
                        Appointment.created_at <= today_end
                    ).count()
                    
                    # Prepare Image Data
                    img_data = {
                        "client_name": payload.get('nombre_completo', 'N/A'),
                        "closer_name": payload.get('closer', 'N/A'),
                        "date_str": payload.get('fecha_agenda', ''),
                        "time_str": payload.get('hora_agenda', ''),
                        "source": payload.get('fuente', 'N/A'),
                        "client_phone": client.phone or 'N/A',
                        "client_ig": getattr(client, 'instagram_username', 'N/A'),
                        "count": todays_count
                    }
                    
                    # Generate Image
                    img_buffer = ImageService.generate_client_card(img_data)
                    
                    # Discord Multipart Payload
                    files = {
                        'file': ('agenda_card.png', img_buffer, 'image/png')
                    }
                    
                    # JSON payload
                    json_payload = {
                        "content": f"@everyone **📅 NUEVA AGENDA**\nCantidad de agendas de hoy: **{todays_count}**",
                        "embeds": [{
                            "color": 3801080, # Sky blue (matches accent)
                            "image": {
                                "url": "attachment://agenda_card.png"
                            },
                        }]
                    }
                    
                    res = requests.post(url, files=files, data={"payload_json": json.dumps(json_payload)}, timeout=10)
                    print(f"[Discord] Status: {res.status_code} | Response: {res.text}")
                    res.raise_for_status()
                    
                except Exception as img_err:
                    print(f"[Discord Image Error] {img_err}. Fallback to text.")
                    res = requests.post(url, json=payload, timeout=5)
                    print(f"[Discord Fallback] Status: {res.status_code} | Response: {res.text}")
            else:
                requests.post(url, json=payload, timeout=5)
            print(f"[Agenda Webhook] Sent to {url}")
            
            # 4. WhatsApp Automation via 2Chat (Forcing Jean Carlo's Number)
            try:
                from app.services.two_chat_service import TwoChatService
                
                # Forced Sender (Jean Carlo)
                JEAN_CARLO_NUMBER = "+525620873819"
                
                # Refined Professional Message
                wa_message = (
                    f"¡Hola {payload['primer_nombre']}! 👋\n\n"
                    f"Te confirmo que hemos recibido tu agendamiento para tu sesión de consultoría "
                    f"con **{payload['closer']}**.\n\n"
                    f"📅 **Fecha:** {payload['fecha_agenda']}\n"
                    f"⏰ **Hora:** {payload['hora_agenda']}\n\n"
                    f"¡Nos vemos pronto! 🚀"
                )
                
                TwoChatService.send_message(
                    to_number=client.phone,
                    text=wa_message,
                    from_number=JEAN_CARLO_NUMBER
                )
                print(f"[2Chat Auto] Message sent from {JEAN_CARLO_NUMBER} to {client.phone}")
            except Exception as wa_err:
                print(f"[2Chat Auto Error] {wa_err}")
                
        except Exception as e:
            print(f"[Agenda Webhook Error] {e}")

    @staticmethod
    def log_lead_event(appt_id, user_id, action_type, description):
        from app.models import LeadEventLog, User, get_impersonation_state
        from flask import has_request_context

        # Validar trazabilidad si se realiza bajo suplantación de identidad. El estado puede
        # venir de la cookie de sesión (flujo clásico) o del JWT propio de una pestaña aislada
        # (clic derecho -> "Simular en pestaña nueva") - ver get_impersonation_state().
        is_impersonating, original_user_id, _ = get_impersonation_state() if has_request_context() else (False, None, None)
        if is_impersonating:
            original_user = db.session.get(User, original_user_id)
            target_user = db.session.get(User, user_id)
            
            orig_name = original_user.username if original_user else f"Usuario {original_user_id}"
            target_name = target_user.username if target_user else f"Usuario {user_id}"
            
            suffix = f" (Acción ejecutada por {orig_name} actuando en nombre de {target_name})"
            description = f"{description}{suffix}"
            
        appt = db.session.get(Appointment, appt_id) if appt_id else None
        log = LeadEventLog(
            appointment_id=appt_id,
            user_id=user_id,
            action_type=action_type,
            description=description,
            # La estructura del log (docs/plan_notas_avisos_settings.md): de qué persona y con qué agenda.
            person_uuid=(appt.person_uuid or (appt.client.person_uuid if appt.client else None)) if appt else None,
            origen='appointment' if appt_id else None,
            origen_id=appt_id,
        )
        db.session.add(log)
        try:
            db.session.commit()
            return log
        except Exception as err:
            db.session.rollback()
            print(f"[LeadEventLog Error] {err}")
            return None
