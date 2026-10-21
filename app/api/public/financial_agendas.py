"""Ingreso de agendas financieras (webhook) y verificacion de hora."""
from flask import request, jsonify
from app.models import db, FinancialAgenda
from app.services import agenda_contacto_service
from datetime import datetime, timedelta
from sqlalchemy import or_, func
from app.services.agenda_time_service import zona_origen, limites_dia_origen, resolver_hora_agenda, como_se_ve
from . import bp
# Re-export: otros modulos importan estos helpers desde aca.
from .financial_agendas_helpers import (  # noqa: F401
    parse_date_robustly, ESTADOS_AGENDA_ABIERTA, _SEPARADORES_TELEFONO, _whatsapp_solo_digitos,
    _cola_telefono, _split_multi, _build_agenda_queries, _resolve_closer_results)


@bp.route('/public/financial-agendas/verificar-hora', methods=['POST'])
def verificar_hora_agenda():
    """Prueba en seco: contesta "como interpretaria el sistema esta hora" SIN guardar nada.

    Para que existe: hasta ahora, la unica forma de saber si n8n manda bien la hora era crear
    una agenda de verdad y despues ir a mirarla. Este endpoint acepta el MISMO payload que el
    webhook real y usa la MISMA funcion (`resolver_hora_agenda`), asi que lo que contesta es
    literalmente lo que va a pasar al guardar -- si usara otro camino no probaria nada.

    Se puede pegar desde n8n (duplicando el nodo HTTP Request y cambiandole la URL) o con curl.
    No toca la base y no devuelve datos de nadie: solo la interpretacion de lo que le mandaste.
    """
    item = request.get_json() or {}
    if isinstance(item, list):
        item = item[0] if item else {}

    utc, diag = resolver_hora_agenda(item)
    zonas = ['UTC', str(zona_origen()), 'America/Sao_Paulo', 'America/Bogota', 'America/Buenos_Aires']
    zona_pedida = item.get('tz_verificacion')
    if zona_pedida and zona_pedida not in zonas:
        zonas.append(str(zona_pedida))

    veredicto = {
        'ok': 'La hora llego completa (con zona horaria). No hay nada que corregir en n8n.',
        'zona_asumida': 'La hora llego SIN zona horaria y el sistema tuvo que suponerla. '
                        'Si n8n formatea en una zona distinta a la asumida, la agenda queda corrida.',
        'campo_incorrecto': 'n8n no mando el campo de la hora de la cita; se uso el de registro. '
                            'La agenda va a quedar con la hora equivocada.',
        'ilegible': 'El valor que mando n8n no se puede interpretar como fecha.',
        'ausente': 'n8n no mando ninguna hora.',
    }.get(diag['nivel'], '')

    return jsonify({
        'guardaria_utc': diag['utc'],
        'guardaria_un_respaldo': diag['es_respaldo'],
        'se_veria_asi': como_se_ve(utc, zonas),
        'campo_usado': diag['campo'],
        'valor_recibido': diag['valor_recibido'],
        'traia_zona_horaria': diag['traia_zona'],
        'zona_asumida': diag['zona_asumida'],
        'nivel': diag['nivel'],
        'veredicto': veredicto,
        'detalle': diag['detalle'],
        'nota': 'Prueba en seco: no se guardo nada. Compara "se_veria_asi" contra la hora que '
                'muestra Calendly para esa reunion.'
    }), 200


@bp.route('/public/financial-agendas', methods=['POST'])
def receive_financial_agendas():
    # Recibe datos de agendas desde Excel/Apps Script/n8n
    from flask import current_app
    
    data = request.get_json() or {}
    items = data if isinstance(data, list) else [data]
    
    saved = 0
    agendas_created = []
    for item in items:
        # Loggear el item para auditoría y diagnóstico
        current_app.logger.info(f"[n8n AGENDA WEBHOOK] Recibido item: {item}")

        if 'fuente' in item:
            setter = item.get('fuente')
            lead_val = item.get('nombre') or item.get('cliente') or item.get('lead') or 'Desconocido'
        elif 'setter' in item or 'setter_name' in item or 'vendedor' in item:
            setter = item.get('setter') or item.get('setter_name') or item.get('vendedor')
            lead_val = item.get('lead') or item.get('cliente') or item.get('nombre') or 'Desconocido'
        elif 'lead' in item and 'nombre' in item:
            setter = item.get('lead')
            lead_val = item.get('nombre')
        else:
            setter = item.get('nombre') or item.get('setter') or 'Sin asignar'
            lead_val = item.get('lead') or item.get('cliente') or 'Desconocido'

        if not setter:
            setter = 'Sin asignar'

        # La columna `date` es UTC naive (la lee asi todo el sistema: las ventanas de dia de
        # user_time_service, el isoformat() de la API y el parseUtcIso() del frontend). Antes
        # aca se guardaba hora local de La Paz, y eso corria cada agenda de Calendly 4 horas
        # hacia atras -- ver app/services/agenda_time_service.py.
        agenda_date, diag_hora = resolver_hora_agenda(item)
        dt_str = diag_hora['valor_recibido']
        if diag_hora['nivel'] != 'ok':
            # Un aviso por nivel, con el string crudo, para poder pedirle a n8n el cambio exacto.
            current_app.logger.warning(
                f"[AGENDA HORA:{diag_hora['nivel'].upper()}] lead '{lead_val}': "
                f"{diag_hora['detalle']} (campo='{diag_hora['campo']}', "
                f"valor='{diag_hora['valor_recibido']}')")

        import pytz
        la_paz_tz = pytz.timezone('America/La_Paz')

        # Normalizar el campo de registro a formato local de America/La_Paz
        registro_traido = item.get('registro') or item.get('fecha')
        registro_val = registro_traido or datetime.now(la_paz_tz).isoformat()
        try:
            from dateutil import parser
            parsed_reg = parser.parse(str(registro_val).strip())
            if parsed_reg.tzinfo is not None:
                registro_val = parsed_reg.astimezone(la_paz_tz).replace(tzinfo=None).isoformat()
        except:
            pass

        # Buscar duplicados en el mismo dia para el mismo lead
        existing = None
        ig_val = item.get('instagram') or item.get('ig')
        ig_norm = None
        if ig_val and isinstance(ig_val, str) and ig_val.lower() not in ('n/a', ''):
            ig_norm = ig_val.strip().lstrip('@').lower()
        
        mail_val = (item.get('mail') or item.get('email') or '').strip().lower()
        phone_val = (item.get('whatsapp') or item.get('phone') or item.get('telefono') or '').strip()
        
        copia = []
        if ig_norm and ig_norm != 'n/a':
            copia.append(agenda_contacto_service.IG_NORMALIZADO == ig_norm)
        if mail_val and mail_val != 'n/a' and '@' in mail_val:
            copia.append(agenda_contacto_service.MAIL_NORMALIZADO == mail_val)
        cola_telefono = _cola_telefono(phone_val)
        if cola_telefono:
            # Se comparan solo los digitos y solo los ultimos: el mismo numero llega
            # escrito '+51 996 526 031' una vez y '+51996526031' la otra, y con el LIKE
            # sobre el texto crudo esas dos no matcheaban -- el lead se duplicaba aunque
            # fuera la misma persona el mismo dia (26/09/2026).
            copia.append(_whatsapp_solo_digitos().like(f"%{cola_telefono}"))
        # Las agendas de su persona; la copia solo cuenta en las que no tienen (Etapa 2b).
        from app.services import person_service
        persona = person_service.buscar(email=mail_val, instagram=ig_norm, phone=phone_val) if copia else None
        client_filters = [c for c in (FinancialAgenda.person_uuid == persona.uuid if persona else None,
                                      agenda_contacto_service.sin_persona(*copia)) if c is not None]

        if client_filters and agenda_date:
            # Una agenda ya marcada como repetida no puede recibir datos nuevos: la agenda
            # legitima que acaba de llegar quedaria escondida dentro de una fila que el
            # libro no muestra.
            vigente = FinancialAgenda.duplicada_de_id.is_(None)

            # "El mismo dia" es el dia local de la fuente, no el dia UTC: con las fechas ya
            # normalizadas a UTC, una cita de las 21:00 cae en el dia UTC siguiente y el
            # deduplicador dejaria de reconocer la agenda que acaba de reprogramarse.
            start_day, end_day = limites_dia_origen(agenda_date)
            existing = FinancialAgenda.query.filter(
                vigente,
                or_(*client_filters),
                FinancialAgenda.date >= start_day,
                FinancialAgenda.date <= end_day
            ).first()

            if not existing:
                # Reprogramacion a OTRO dia. La regla de arriba solo reconoce el duplicado
                # si la reunion cae el mismo dia, asi que mover la cita del jueves al
                # viernes entraba como agenda nueva y el lead quedaba dos veces en el libro
                # (y con dos llamadas en la bandeja de su closer).
                #
                # Solo se toma como reprogramacion si la agenda anterior sigue ABIERTA y su
                # llamada todavia no paso: una que ya se resolvio (Show Up, No Show, Lead
                # Perdido) es una llamada que de verdad ocurrio, y quien vuelve a agendar
                # despues de eso esta sacando una segunda cita, no moviendo la primera.
                existing = FinancialAgenda.query.filter(
                    vigente,
                    or_(*client_filters),
                    FinancialAgenda.date >= datetime.utcnow() - timedelta(hours=2),
                    func.lower(func.coalesce(FinancialAgenda.estado, '')).in_(ESTADOS_AGENDA_ABIERTA)
                ).order_by(FinancialAgenda.date).first()
                if existing:
                    current_app.logger.info(
                        f"[AGENDA REPROGRAMADA] '{lead_val}': la agenda #{existing.id} del "
                        f"{existing.date} se mueve a {agenda_date} en vez de crear una fila nueva")
                    item = dict(item)
                    item['reprogramada_desde'] = existing.date.isoformat() if existing.date else None

        # Extraer encargado de triage de forma robusta. El Call Confirmer ya no se ve en el
        # tablero (10/10/2026), pero n8n puede seguir mandandolo y se guarda igual: es el dato
        # que cuenta el reporte diario del rol triage (ver el PUT de mas abajo).
        encargado_triage_val = None
        for k in ['encargado_triage', 'encargado', 'triage', 'call_confirmer', 'confirmer', 'encargadotriage', 'callconfirmer']:
            val = next((item[key] for key in item if key.lower() == k), None)
            if val:
                encargado_triage_val = str(val).strip()
                break

        from app.services.booking_service import BookingService
        raw_closer = item.get('closer') or item.get('vendedor')
        grupo_val = (item.get('grupo') or '').strip() or None

        # Todos los formularios de Calendly apuntan al mismo evento, asi que este
        # webhook llega siempre con la misma fuente sin importar que setter trajo
        # al lead. Si esa persona ya completo el formulario de un setter, esa es
        # la fuente que vale. Ver app/services/fuente_formulario_service.py.
        from app.services.fuente_formulario_service import fuente_para_agenda_entrante
        setter, fuente_del_form = fuente_para_agenda_entrante(
            str(setter).strip(),
            nombre=str(lead_val).strip(),
            telefono=phone_val,
            instagram=ig_val,
            mail=mail_val
        )
        if fuente_del_form:
            # Se guarda tambien la fuente original del webhook: sirve para auditar
            # que se piso y con que, sin perder el dato que mando n8n.
            item = dict(item)
            item['fuente_webhook'] = item.get('fuente')
            item['fuente_origen'] = 'formulario_calendly'
            item['fuente'] = setter
            current_app.logger.info(
                f"[FUENTE FORM] Agenda de {lead_val}: fuente tomada del formulario -> {setter}")

        if existing:
            # Actualizar datos de agenda existente
            existing.nombre = str(setter).strip()
            existing.lead = str(lead_val).strip()
            if raw_closer:
                existing.closer = BookingService.normalize_closer_name(raw_closer)
            existing.fecha_meet = dt_str or existing.fecha_meet
            existing.date = agenda_date
            # Solo se pisa `registro` si el payload TRAE la fecha de alta. El respaldo
            # "ahora" de arriba tiene sentido para una fila nueva, pero sobre una agenda
            # que ya existe reescribe su fecha de alta con la del reenvio: una agenda de
            # hace semanas pasaba a figurar como registrada hoy, y como el embudo del
            # workshop mira `created_at` (viejo) O `registro` (nuevo), la misma fila caia
            # en la ventana de dos talleres a la vez (26/09/2026).
            if registro_traido:
                existing.registro = registro_val
            existing.estado = item.get('estado') or existing.estado
            existing.grupo = grupo_val or existing.grupo
            existing.encargado_triage = encargado_triage_val or existing.encargado_triage
            # Mail/whatsapp/instagram no se actualizaban acá: si el primer webhook del día
            # llegaba sin email (o con 'N/A') y uno posterior del mismo lead (ej. Calendly
            # reprogramado) sí lo traía, la agenda existente se quedaba con el dato viejo para
            # siempre — y ese es el valor que sync_financial_agenda_to_appointment usa después
            # para el Client. Solo se pisa cuando el valor nuevo es mejor que 'N/A'/vacío.
            if mail_val and mail_val != 'n/a' and '@' in mail_val:
                existing.mail = item.get('mail') or item.get('email')
            if phone_val and phone_val != 'n/a':
                existing.whatsapp = item.get('whatsapp') or item.get('phone') or item.get('telefono')
            if ig_norm and ig_norm != 'n/a':
                existing.instagram = item.get('instagram') or item.get('ig')
            existing.raw_data = {**item, '_hora_diagnostico': diag_hora}
            # La persona, con lo que mandó n8n (Etapa 2c): no se lee la copia de la agenda.
            agenda_contacto_service.dar_persona(existing, lead_val, item.get('mail') or item.get('email'),
                                                item.get('instagram') or item.get('ig'),
                                                item.get('whatsapp') or item.get('phone') or item.get('telefono'))
            agendas_created.append(existing)
        else:
            if not (item.get('mail') or item.get('email')):
                # Sin esto, una agenda sin email de n8n queda con el string literal 'N/A' en
                # silencio (ver mail=... más abajo) y nadie se entera hasta que un closer, meses
                # después, encuentra un cliente sin correo. Deja rastro explícito en los logs de
                # Railway para poder confirmar del lado de n8n/Calendly si el mail nunca llegó.
                current_app.logger.warning(
                    f"[AGENDA SIN EMAIL] n8n mandó la agenda de '{lead_val}' sin 'mail' ni 'email' en el payload. "
                    f"Keys recibidas: {list(item.keys())}"
                )
            # Crear nueva agenda si no existe duplicado
            agenda = FinancialAgenda(
                nombre=str(setter).strip(),
                lead=str(lead_val).strip(),
                closer=BookingService.normalize_closer_name(raw_closer or 'Sin asignar'),
                fecha_meet=dt_str or str(agenda_date),
                date=agenda_date,
                registro=registro_val,
                instagram=item.get('instagram') or item.get('ig') or 'N/A',
                whatsapp=item.get('whatsapp') or item.get('phone') or item.get('telefono') or 'N/A',
                mail=item.get('mail') or item.get('email') or 'N/A',
                estado=item.get('estado') or 'Pendiente',
                grupo=grupo_val,
                encargado_triage=encargado_triage_val,
                raw_data={**item, '_hora_diagnostico': diag_hora}
            )
            agenda_contacto_service.dar_persona(agenda, lead_val, item.get('mail') or item.get('email'),
                                                item.get('instagram') or item.get('ig'),
                                                item.get('whatsapp') or item.get('phone') or item.get('telefono'))
            db.session.add(agenda)
            agendas_created.append(agenda)
            saved += 1

    # Red de seguridad de la regla "un lead no puede tener dos agendas el mismo dia a la
    # misma hora". La deduplicacion de mas arriba decide ANTES de crear y se le escapa
    # cuando la identidad no coincide (mail 'N/A', instagram escrito distinto, telefono con
    # otro formato) o cuando n8n manda dos requests en paralelo y ninguno ve la fila del
    # otro. Esta pasada corre con las filas ya escritas, que es cuando el choque se ve.
    db.session.flush()
    from app.services import agenda_dedup_service
    for agenda in agendas_created:
        try:
            agenda_dedup_service.reconciliar(agenda)
        except Exception:
            current_app.logger.exception(
                "[AGENDA UNICA] fallo la reconciliacion de la agenda #%s", agenda.id)

    db.session.commit()

    # Sincronización en tiempo real con Appointments
    try:
        from app.services.booking_service import BookingService
        for agenda in agendas_created:
            BookingService.sync_financial_agenda_to_appointment(agenda)
    except Exception as sync_err:
        current_app.logger.error(f"[SYNC ERROR] No se pudo sincronizar cita: {sync_err}")

    return jsonify({"message": f"{saved} agenda records saved", "saved": saved}), 201

@bp.route('/public/financial-agendas/sync', methods=['POST'])
def sync_financial_agendas_from_sheets():
    # Deshabilitado en favor de n8n
    return jsonify({"message": "La sincronización de agendas desde Google Sheets ha sido deshabilitada en favor de n8n."}), 200
