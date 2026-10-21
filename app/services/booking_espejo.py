"""Espejo entre la cita (`Appointment`) y la fila del Tablero de Agendas (`FinancialAgenda`).
Mixin de `BookingService` (app/services/booking_service.py)."""
from app.models import Appointment, User, Notification, db
from app.services import agenda_contacto_service
from datetime import datetime, timedelta
import pytz


class BookingEspejoMixin:
    @staticmethod
    def sync_financial_agenda_to_appointment(agenda):
        """Sincroniza un registro de agenda financiera con la tabla de citas."""
        from app.services.booking_service import BookingService
        if not agenda:
            return None
        if getattr(agenda, 'duplicada_de_id', None) is not None:
            # Una agenda marcada como repetida no tiene que tener cita: al descartarla se
            # cancelo la suya justamente para que el closer no viera dos llamadas con la
            # misma persona. Sin este corte, el resync masivo de /sync-appointments le
            # recalcula el `result` desde el `estado` de la fila oculta y le devuelve la
            # llamada duplicada a la bandeja -- o peor, se la vuelve a crear.
            return None

        # 1. El cliente de la persona de la agenda; si no tiene, se busca o crea con sus datos
        # (los de la persona o, sin persona, la copia de la fila).
        contacto = agenda.contacto()
        client = BookingService.cliente_de_agenda(agenda) or BookingService.find_or_create_client(
            nombre=contacto['lead'],
            email=contacto['mail'],
            instagram=contacto['instagram'],
            phone=contacto['whatsapp'],
            grupo=getattr(agenda, 'grupo', None)
        )
        
        # 2. Resolver Closer
        closer_user = BookingService.resolve_user_by_name(agenda.closer, default_role='closer')
        if not closer_user:
            # No se pudo resolver el texto de agenda.closer contra ningun User ni CloserAlias
            # (tipicamente porque se renombro al closer y quedo un nombre viejo suelto en
            # agendas anteriores). Appointment.closer_id es NOT NULL, asi que sigue haciendo
            # falta un fallback - pero antes este fallback era silencioso: la agenda quedaba
            # asignada al primer closer/admin de la tabla sin que nadie se enterara. Ahora se
            # avisa a los admins via Notification para que la reasignen a mano.
            closer_user = User.query.filter_by(role='closer').first() or User.query.filter_by(role='admin').first()
            print(f"[SYNC WARNING] Agenda {agenda.id}: closer='{agenda.closer}' no resuelve a "
                  f"ningun usuario. Fallback temporal a '{closer_user.username if closer_user else None}'.")
            if closer_user:
                try:
                    db.session.add(Notification(
                        subject="Agenda con closer sin resolver",
                        content=(
                            f"La agenda de '{contacto['lead'] or agenda.nombre or 'Desconocido'}' tiene "
                            f"closer='{agenda.closer}', que no coincide con ningun usuario activo "
                            f"(¿se renombro y falta un alias con el nombre viejo?). Se asigno "
                            f"temporalmente a {closer_user.username} - revisar y reasignar."
                        ),
                        target_users=["role:admin"],
                        associated_id=agenda.id,
                        associated_type="agenda"
                    ))
                except Exception:
                    pass

        if not closer_user:
            print("[SYNC ERROR] No se encontró Closer ni Admin en la base de datos.")
            return None
            
        # 3. Resolver Setter
        setter_user = BookingService.resolve_user_by_name(agenda.nombre, default_role='setter')
        setter_id = setter_user.id if setter_user else None
        
        # 4. Buscar cita del mismo día (rango de +/- 12 horas para tolerar desfases UTC/local)
        start_search = agenda.date - timedelta(hours=12)
        end_search = agenda.date + timedelta(hours=12)
        
        appt = Appointment.query.filter(
            Appointment.client_id == client.id,
            Appointment.start_time >= start_search,
            Appointment.start_time <= end_search
        ).first()
        
        # 5. Mapear estado
        estado_clean = str(agenda.estado).strip().lower() if agenda.estado else ""

        # Conservar valores existentes
        existing_result = appt.result if appt else None
        existing_closer_result = appt.closer_result if appt else 'Pendiente'

        result = existing_result
        closer_result = existing_closer_result

        # Una vez que el Closer avanzó el pipeline de confirmación DENTRO de NeurOPS
        # (por_confirmar → conversando → confirmado, ver modalStep 'confirm' en
        # CloserWorkflowPage.jsx), ese estado es autoritativo — no debe pisarse con un valor
        # potencialmente desactualizado de la hoja de cálculo (la hoja la mantiene el Call
        # Confirmer por separado y no siempre refleja en tiempo real lo que el closer ya hizo).
        # Mismo criterio que ya usaba _format_appointment_for_deck (app/api/closer.py) para
        # decidir qué mostrar, pero acá faltaba aplicarlo también al GUARDAR: un cliente
        # reportó que sus agendas marcadas "Confirmado" desaparecían solas de esa columna —
        # el resync masivo de /public/financial-agendas/sync-appointments (o cualquier edición
        # del sheet que dispare el webhook por-item) las revertía a 'Pendiente'/'Agendado' sin
        # que el closer hiciera nada. Cancelado/Reagendado sí se siguen aplicando siempre: son
        # señales reales de un evento externo, no un default desactualizado.
        CLOSER_CONFIRM_STAGES = ('por_confirmar', 'conversando', 'confirmado')
        existing_result_lower = (existing_result or '').strip().lower()
        closer_owns_confirm_stage = existing_result_lower in CLOSER_CONFIRM_STAGES

        # Si es un estado del Call Confirmer (antes de la llamada)
        if estado_clean in ('pendiente', '', 'agendado', 'agendada', 'confirmado', 'confirmada', 'sin respuesta', 'contactado', 'contactada'):
            if not closer_owns_confirm_stage:
                if estado_clean in ('pendiente', ''):
                    result = 'Pendiente'
                elif estado_clean in ('agendado', 'agendada'):
                    result = 'Agendado'
                elif estado_clean in ('confirmado', 'confirmada'):
                    result = 'Confirmado'
                elif estado_clean == 'sin respuesta':
                    result = 'Sin respuesta'
                elif estado_clean in ('contactado', 'contactada'):
                    result = 'Contactado'
        elif estado_clean in ('cancelado', 'cancelada', 'reagendado', 'reagendada'):
            if estado_clean in ('cancelado', 'cancelada'):
                result = 'Cancelado'
            elif estado_clean in ('reagendado', 'reagendada'):
                result = 'Reagendado'
        
        # Si es un estado del Closer (después de la llamada). 'Archivada sin reporte' no lo escribe
        # nadie en el tablero: vuelve del espejo de una agenda que archivó el barrido de los 30 días
        # (ver `sync_appointment_to_financial_agenda`), y se lee como lo que es.
        elif estado_clean in ('show up', 'show_up', 'no show', 'no_show', 'cerrada', 'cerrado', '2th call', '2da call', 'lead perdido', 'perdido', 'no lead', 'archivada sin reporte', 'venta', 'cerrado/pif', 'cerrado/split'):
            if estado_clean in ('no show', 'no_show'):
                closer_result = 'No Show'
            elif estado_clean in ('show up', 'show_up'):
                closer_result = 'Show up'
            elif estado_clean in ('cerrada', 'cerrado', 'venta', 'cerrado/pif', 'cerrado/split'):
                closer_result = 'Cerrada'
            elif estado_clean in ('2th call', '2da call'):
                closer_result = '2da call'
            elif estado_clean in ('lead perdido', 'perdido'):
                closer_result = 'Lead Perdido'
            elif estado_clean == 'no lead':
                closer_result = 'No Lead'
            elif estado_clean == 'archivada sin reporte':
                from app.services.closer_agendas_service import ARCHIVADA_SIN_REPORTE
                closer_result = ARCHIVADA_SIN_REPORTE
            
            # Si se procesa con un estado de Closer pero el result del confirmer estaba vacío,
            # lo dejamos como Confirmado por defecto.
            if not result:
                result = 'Confirmado'

        # Determinar si está procesado por el Closer o Setter
        is_already_closer_processed = appt.closer_processed if appt else False
        is_closer_state = estado_clean in ('show up', 'show_up', 'no show', 'no_show', 'cerrada', 'cerrado', '2th call', '2da call', 'lead perdido', 'perdido', 'no lead', 'archivada sin reporte', 'cancelado', 'cancelada', 'reagendado', 'reagendada', 'venta', 'cerrado/pif', 'cerrado/split')
        
        if is_already_closer_processed and not is_closer_state:
            # Si ya fue procesado por el closer y el webhook no envía un estado de closer,
            # mantenemos el estado de closer procesado para no degradarla a pendiente.
            closer_processed = True
            closer_result = existing_closer_result
            setter_processed = True
        else:
            if is_closer_state:
                closer_processed = True
                setter_processed = True
            else:
                closer_processed = False
                setter_processed = False
            
        if not appt:
            appt = Appointment(
                closer_id=closer_user.id,
                setter_id=setter_id,
                client_id=client.id,
                start_time=agenda.date,
                origin=agenda.nombre or 'n8n',
                result=result,
                closer_result=closer_result,
                closer_processed=closer_processed,
                setter_processed=setter_processed
            )
            db.session.add(appt)
        else:
            appt.closer_id = closer_user.id
            appt.setter_id = setter_id
            appt.start_time = agenda.date
            appt.origin = agenda.nombre or appt.origin
            appt.result = result
            appt.closer_result = closer_result
            appt.closer_processed = closer_processed
            appt.setter_processed = setter_processed
            
        try:
            db.session.commit()
            return appt
        except Exception as e:
            db.session.rollback()
            print(f"[SYNC ERROR] No se pudo guardar el Appointment: {e}")
            return None

    @staticmethod
    def filtros_de_agenda_del_cliente(client):
        """Las señales con las que una fila del Tablero de Agendas (`FinancialAgenda`) se reconoce
        como de este cliente, para un `or_`: su persona (Etapa 2c: la agenda no guarda el contacto).
        Lista vacia si no tiene persona.

        Vivia adentro de `sync_appointment_to_financial_agenda`; sale a su propia funcion para que
        quien necesite la fila de UNA cita (la correccion de una agenda desde la ficha) la busque
        con el mismo cruce, sin pasar por el respaldo de «la agenda mas reciente del lead».
        """
        from app.models.financial import FinancialAgenda

        if not client or not client.person_uuid:
            return []
        return [FinancialAgenda.person_uuid == client.person_uuid]

    @staticmethod
    def sync_appointment_to_financial_agenda(appt, cita_nueva=False):
        """Sincroniza un Appointment de vuelta a la tabla de FinancialAgenda (BD de agendas financieras).

        `cita_nueva`: la cita se acaba de reservar (Agendas 2.0), asi que si no tiene fila a su hora
        se le crea una. Sin esto, un lead que ya habia agendado otra vez caia en el respaldo de
        "la agenda mas reciente del lead" y la reserva nueva pisaba la fila de la vieja (estado,
        closer) en vez de tener la suya: una agenda menos en el tablero y en el workshop."""
        from app.services.booking_service import BookingService
        from app.models.financial import FinancialAgenda
        from app.models import User
        from sqlalchemy import or_
        
        if not appt or not appt.client:
            return None
            
        client = appt.client
        # Buscar agenda financiera existente (rango de +/- 36 horas para tolerar desfases UTC/local).
        # Una cita recien reservada solo es "la misma" que una fila a su misma hora: a menos de 36 h
        # puede haber otra agenda del mismo lead (una sesion adicional) que no hay que mover.
        margen = timedelta(minutes=5) if cita_nueva else timedelta(hours=36)
        start_search = appt.start_time - margen
        end_search = appt.start_time + margen

        filters = BookingService.filtros_de_agenda_del_cliente(client)

        agenda = None
        # `misma_cita` distingue "esta agenda ES esta cita" (cayo en la ventana de +/-36h)
        # de "es otra agenda cualquiera del mismo lead" (el respaldo de abajo, que agarra
        # la mas reciente sin mirar fechas). Solo en el primer caso se puede reescribir la
        # fecha de la agenda: con el respaldo, procesar una cita vieja le movia la fecha
        # hacia atras a la agenda mas nueva del lead y la sacaba del taller que la gano.
        misma_cita = False
        if filters:
            # Nunca una agenda marcada como repetida: escribirle el resultado del closer ahi
            # dejaria a la que SI se conservo en 'Pendiente' para siempre, y de paso le
            # cambiaria el estado a la descartada, que es justo lo que mira el panel de
            # duplicados para sugerir cual conservar si alguien la restaura.
            vigente = FinancialAgenda.duplicada_de_id.is_(None)
            agenda = FinancialAgenda.query.filter(
                vigente,
                or_(*filters),
                FinancialAgenda.date >= start_search,
                FinancialAgenda.date <= end_search
            ).first()
            misma_cita = agenda is not None

            if not agenda and not cita_nueva:
                agenda = (FinancialAgenda.query
                          .filter(vigente, or_(*filters))
                          .order_by(FinancialAgenda.date.desc()).first())

        if not agenda and appt.start_time:
            # Ultimo recurso antes de crear: ¿ya hay una agenda para una llamada a ESTA
            # misma hora, a nombre de esta persona? Cuando ninguna de las tres señales
            # coincide (el Client quedo con una identidad distinta de la que trae la
            # agenda) esto es lo unico que evita una segunda fila para la misma reunion.
            from app.services.client_dedup_service import _names_compatible
            margen = timedelta(minutes=5)
            for fila in FinancialAgenda.query.filter(
                    FinancialAgenda.duplicada_de_id.is_(None),
                    FinancialAgenda.date >= appt.start_time - margen,
                    FinancialAgenda.date <= appt.start_time + margen).all():
                lead_fila = fila.contacto()['lead']
                if _names_compatible(client.full_name, lead_fila):
                    agenda, misma_cita = fila, True
                    print(f"[SYNC] La cita {appt.id} ya tenia agenda #{fila.id} a la misma "
                          f"hora ({lead_fila}); se reusa en vez de crear otra.")
                    break

        # Mapear estado: prioritario el resultado del closer si ya fue procesado por él
        mapped_state = 'Pendiente'
        if appt.closer_result and appt.closer_result != 'Pendiente':
            mapped_state = appt.closer_result
        elif appt.result and appt.result != 'Pendiente':
            mapped_state = appt.result

        # Normalizar strings para evitar inconsistencias en reportes y sheets
        mapped_state_lower = mapped_state.lower()
        if mapped_state_lower in ('show up', 'show_up'):
            mapped_state = 'Show Up'
        elif mapped_state_lower in ('no show', 'no_show'):
            mapped_state = 'No Show'
        elif mapped_state_lower in ('cancelado', 'cancelada'):
            mapped_state = 'Cancelada'
        elif mapped_state_lower in ('reagendado', 'reagendada'):
            mapped_state = 'Reagendada'
        elif mapped_state_lower in ('2th call', '2da call'):
            mapped_state = '2TH Call'
        elif mapped_state_lower in ('lead perdido', 'perdido'):
            mapped_state = 'Lead Perdido'
        elif mapped_state_lower == 'no lead':
            mapped_state = 'No Lead'
        elif mapped_state_lower == 'archivada sin reporte':
            from app.services.closer_agendas_service import ARCHIVADA_SIN_REPORTE
            mapped_state = ARCHIVADA_SIN_REPORTE
                
        # Buscar nombres de closer y setter
        closer_name = 'Sin asignar'
        if appt.closer_id:
            c_user = User.query.get(appt.closer_id)
            if c_user:
                closer_name = c_user.username
                
        setter_name = None
        if appt.setter_id:
            s_user = User.query.get(appt.setter_id)
            if s_user:
                setter_name = s_user.username

        # `FinancialAgenda.nombre` es la columna "Fuente" del tablero de agendas, no un campo
        # exclusivo del setter: para las agendas que entran por n8n vale 'workshop',
        # 'workshop landing', etc. Antes esto se escribia siempre con el nombre del setter, y
        # como el embudo del workshop no tiene setter quedaba en 'Sin asignar' — borrando la
        # fuente real cada vez que el closer o el confirmer tocaban la cita (y sacando esas
        # agendas del conteo del workshop). Ahora solo se pisa cuando hay un setter de verdad;
        # si no, se conserva lo que ya tenia la agenda y, en ultimo caso, se usa appt.origin,
        # que es donde sync_financial_agenda_to_appointment guarda la fuente original.
        fuente_actual = (agenda.nombre or '').strip() if agenda else ''
        if setter_name:
            fuente = setter_name
        elif fuente_actual and fuente_actual.lower() != 'sin asignar':
            fuente = fuente_actual
        else:
            fuente = (appt.origin or '').strip() or fuente_actual or 'Sin asignar'

        if not agenda:
            # Fecha de alta de la agenda espejo: la de la CITA, no la de ahora.
            #
            # Esta funcion corre cuando un closer o un confirmer toca una cita que
            # todavia no tenia fila en `financial_agendas`, y eso puede pasar semanas
            # despues. Con `utcnow()` la agenda quedaba "registrada hoy" y el embudo
            # del workshop -- que atribuye cada agenda al taller cuya ventana contiene
            # su fecha de alta -- se la sumaba al taller que estuviera abierto: el del
            # 26/09/2026 mostraba una agenda exitosa que en realidad era una cita del
            # 2 de septiembre. Ademas `registro` es hora LOCAL de America/La_Paz en
            # todo el resto del sistema (ver app/api/public/financial_agendas.py) y
            # aca se guardaba UTC, o sea corrida 4 horas (26/09/2026).
            alta_utc = appt.created_at or appt.start_time or datetime.utcnow()
            registro_local = pytz.UTC.localize(alta_utc).astimezone(
                pytz.timezone('America/La_Paz')).replace(tzinfo=None).isoformat()
            agenda = FinancialAgenda(
                person_uuid=client.person_uuid,
                nombre=fuente,
                closer=closer_name,
                fecha_meet=appt.start_time.isoformat(),
                date=appt.start_time,
                created_at=alta_utc,
                registro=registro_local,
                estado=mapped_state,
                raw_data={"created_by_sync": True, "fuente": fuente}
            )
            if not agenda.person_uuid:
                # Cliente sin persona (Etapa 2c): se resuelve con sus datos; la agenda no guarda el contacto.
                agenda_contacto_service.dar_persona(agenda, client.full_name, client.email, client.instagram, client.phone)
            db.session.add(agenda)
            recien_creada = True
        else:
            recien_creada = False
            # Actualizar datos de existente
            agenda.nombre = fuente
            agenda.closer = closer_name
            agenda.estado = mapped_state
            if misma_cita:
                agenda.date = appt.start_time
                agenda.fecha_meet = appt.start_time.isoformat()
            
        try:
            db.session.flush()
            if recien_creada:
                # Ultima red: si aun asi quedo una hermana a la misma hora, se resuelve
                # sola en vez de dejar dos llamadas con la misma persona en el libro.
                from app.services import agenda_dedup_service
                try:
                    agenda_dedup_service.reconciliar(agenda)
                except Exception as e:
                    print(f"[AGENDA UNICA] fallo la reconciliacion del espejo: {e}")
            return agenda
        except Exception as e:
            print(f"[SYNC ERROR] No se pudo guardar la FinancialAgenda: {e}")
            return None
