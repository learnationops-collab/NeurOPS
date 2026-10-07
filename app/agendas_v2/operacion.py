"""Agendas 2.0 escribe en la operacion: una reserva tomada desde el link publico es una agenda como
cualquier otra de NeurOPS. Mismo camino que la «Nueva agenda» manual del closer (app/api/closer.py):

  1. Cliente: se busca (email, telefono, instagram) o se crea, con BookingService.find_or_create_client.
     Guarda el ultimo formulario en `clients.formulario_payload`, tambien si no califico.
  2. Appointment: BookingService.create_appointment (notifica al closer y a admin, sincroniza el Lead),
     con la agenda completa en `appointments.agenda_payload`.
  3. FinancialAgenda: el espejo de siempre, BookingService.sync_appointment_to_financial_agenda (que
     ademas reconcilia duplicados), con el payload en `raw_data['agendas_v2']`.
  4. Evento en el Google Calendar del closer con Meet, invitando al lead. Va DESPUES de guardar: si
     Google falla, la agenda ya existe y se avisa a admin y al closer.
  5. Aviso al canal de ventas de Discord (webhook en DISCORD_AGENDAS_WEBHOOK). Si falta o falla, solo
     queda en el log: nunca frena la agenda.

Si el lead ya tiene una agenda futura abierta, no se crea otra: se REPROGRAMA esa (como hace la
ingesta de n8n), aunque cambie el closer.
"""

import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests
from flask import current_app
from sqlalchemy import func, or_
from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.models import Appointment, Client, Notification, User
from app.models.financial import FinancialAgenda
from app.agendas_v2.nucleo.catalogos import pais_de, pais_por_telefono

# Resultados de una Appointment que ya no ocupan el horario del closer. Incluye las dos grafias que
# hay en la base: las que pone el closer (Cancelada/Reprogramada) y las del sync de n8n (Cancelado/Reagendado).
RESULTADOS_NO_VIGENTES = ('Cancelada', 'Cancelado', 'Reprogramada', 'Reagendada', 'Reagendado')
# Una agenda que empezo hace menos de esto todavia cuenta como "futura abierta" para reprogramar.
MARGEN_REPROGRAMAR = timedelta(hours=2)


def filtro_vigente():
    """Appointment que sigue ocupando su horario: sin procesar y no cancelada ni reprogramada."""
    return (
        Appointment.closer_processed.is_(False),
        or_(Appointment.result.is_(None), Appointment.result.notin_(RESULTADOS_NO_VIGENTES)),
    )


def _o_none(x):
    x = (x or '').strip()
    return x or None


def _cliente(payload):
    from app.services.booking_service import BookingService

    lead = payload['lead']
    cliente = BookingService.find_or_create_client(
        nombre=_o_none(lead.get('nombre')) or 'Desconocido',
        email=_o_none(lead.get('email')),
        instagram=_o_none(lead.get('instagram')),
        phone=_o_none(lead.get('telefono')),
    )
    # El formulario más reciente manda: un cliente que vuelve a agendar actualiza su nombre y su
    # contacto con lo que acaba de escribir (pedido del 06/10/2026). Se lo encontró por email o
    # teléfono, así que un email distinto acá no lo tiene ningún otro cliente.
    nuevo = {
        'full_name': _o_none(lead.get('nombre')),
        'email': (_o_none(lead.get('email')) or '').strip().lower() or None,
        'phone': _o_none(lead.get('telefono')),
        'instagram': (_o_none(lead.get('instagram')) or '').strip().lstrip('@').lower() or None,
    }
    for campo, valor in nuevo.items():
        if valor and getattr(cliente, campo) != valor:
            setattr(cliente, campo, valor)
    # `enviado`: cuándo lo completó (las estadísticas del workshop cuentan aplicaciones por fecha).
    cliente.formulario_payload = {**payload, 'enviado': datetime.utcnow().isoformat()}
    flag_modified(cliente, 'formulario_payload')
    cliente.grupo = _grupo(payload) or cliente.grupo
    return cliente


def registrar_descalificado(payload):
    """Un lead que no califico: queda como cliente, con su formulario, sin agenda."""
    cliente = _cliente(payload)
    db.session.commit()
    return cliente


def agenda_de(cliente_id, inicio):
    """La agenda de Agendas 2.0 vigente de ese cliente a esa hora (el mismo lead que confirma dos veces)."""
    return Appointment.query.filter(
        Appointment.client_id == cliente_id,
        Appointment.start_time == inicio,
        Appointment.agenda_payload.isnot(None),
        *filtro_vigente(),
    ).first()


def cliente_por_email(email):
    email = (email or '').strip().lower()
    if not email:
        return None
    return Client.query.filter(func.lower(Client.email) == email).first()


def _fuente(payload, setter):
    """Lo que va en Appointment.origin / FinancialAgenda.nombre («Fuente»), según el tipo del funnel:
    - setting: el setter del link ('setting', «sin dueño», si el link no es de un setter activo);
    - vsl: 'vsl'; workshop: 'workshop', o 'workshop_landing' si el origen es la grabación (?o=grabacion,
      replay o landing). Son los valores que ya leen el panel del workshop, el mazo y la ficha;
    - otro: el origen del link (?o=) o el funnel."""
    from app.services.fuente_service import FUENTE_SETTING, FUENTE_VSL, FUENTE_WORKSHOP_LANDING,         FUENTE_WORKSHOP_VIVO, es_workshop_landing

    if setter:
        return setter.username
    tipo = payload.get('funnel_tipo')
    if tipo == 'setting':
        return FUENTE_SETTING
    if tipo == 'vsl':
        return FUENTE_VSL
    if tipo == 'workshop':
        return FUENTE_WORKSHOP_LANDING if es_workshop_landing(f"workshop {payload.get('origen') or ''}")             else FUENTE_WORKSHOP_VIVO
    return payload.get('origen') or payload.get('funnel_slug') or 'agendas 2.0'


def _espejo_de(appt, inicio_anterior):
    """La FinancialAgenda de esa cita ANTES de moverla (mismo cruce que el espejo, +/-36 h)."""
    from app.services.booking_service import BookingService

    filtros = BookingService.filtros_de_agenda_del_cliente(appt.client)
    if not filtros or not inicio_anterior:
        return None
    return FinancialAgenda.query.filter(
        FinancialAgenda.duplicada_de_id.is_(None),
        or_(*filtros),
        FinancialAgenda.date >= inicio_anterior - timedelta(hours=36),
        FinancialAgenda.date <= inicio_anterior + timedelta(hours=36),
    ).first()


def _grupo(payload):
    """La prioridad de Thalamus del lead va al campo `grupo` (el «grupo 1/2/3» de Calendly) del cliente y
    de la agenda: es lo que el closer ve en su mazo y en la ficha."""
    return (payload.get('prioridad_nombre') or '')[:50] or None


def _payload_en_espejo(fa, payload):
    if not fa:
        return
    fa.raw_data = {**(fa.raw_data or {}), 'agendas_v2': payload}
    flag_modified(fa, 'raw_data')
    fa.grupo = _grupo(payload) or fa.grupo


def proxima_de(cliente_id, ahora):
    """La próxima agenda vigente del cliente (cualquier sistema), o None. Una agenda que el closer
    canceló directo en Google Calendar no cuenta, aunque en NeurOPS siga abierta (no se la toca)."""
    from app.services.google_service import GoogleService

    candidatas = (
        Appointment.query.filter(
            Appointment.client_id == cliente_id,
            Appointment.start_time >= ahora - MARGEN_REPROGRAMAR,
            *filtro_vigente(),
        )
        .order_by(Appointment.start_time)
        .all()
    )
    for appt in candidatas:
        if appt.google_event_id and GoogleService.evento_cancelado(appt.closer_id, appt.google_event_id):
            continue
        return appt
    return None


def registrar_agenda(payload, closer, setter, inicio, ahora=None, decision=None):
    """Crea (o reprograma) la agenda en la operacion. `inicio`: datetime UTC sin zona.
    `decision`: lo que eligió el lead que ya tenía una agenda próxima: 'reprogramar' la mueve;
    cualquier otra cosa ('adicional') crea otra y le avisa al closer, que decide si cancela la
    anterior. Nunca se borra ni se mueve una agenda sin que el lead lo haya pedido.
    Devuelve (appointment, evento_a_borrar): evento_a_borrar es (user_id, google_event_id) del evento
    viejo de una agenda reprogramada, o None. Hace commit."""
    from app.services.booking_service import BookingService

    ahora = ahora or datetime.utcnow()
    cliente = _cliente(payload)
    db.session.flush()

    previa = proxima_de(cliente.id, ahora)

    if previa and decision == 'reprogramar':
        anterior = previa.start_time
        espejo = _espejo_de(previa, anterior)
        evento_viejo = (previa.closer_id, previa.google_event_id) if previa.google_event_id else None
        previa.start_time = inicio
        previa.closer_id = closer.id
        previa.setter_id = setter.id if setter else previa.setter_id
        previa.is_rescheduled = True
        previa.google_event_id = None
        previa.agenda_payload = {**payload, 'reprogramada_desde': anterior.isoformat() + 'Z' if anterior else None}
        if espejo:
            espejo.date = inicio
            espejo.fecha_meet = inicio.isoformat()
            espejo.closer = closer.username
            _payload_en_espejo(espejo, previa.agenda_payload)
        db.session.add(
            Notification(
                subject='Agenda reprogramada',
                content=(
                    f'{cliente.full_name or "Un lead"} reprogramó su agenda desde el link de agendas: '
                    f'pasa al {inicio.strftime("%d/%m/%Y %H:%M")} UTC.'
                ),
                target_users=['role:admin', int(closer.id)],
                associated_id=previa.id,
                associated_type='appointment',
            )
        )
        db.session.commit()
        if not espejo:
            _payload_en_espejo(BookingService.sync_appointment_to_financial_agenda(previa), previa.agenda_payload)
            db.session.commit()
        current_app.logger.info(f'[AGENDAS 2.0] Agenda #{previa.id} reprogramada de {anterior} a {inicio}')
        return previa, evento_viejo

    if previa:
        payload = {**payload, 'sesion_adicional_de': {'agenda_id': previa.id, 'inicio': previa.start_time.isoformat() + 'Z'}}
    appt = BookingService.create_appointment(
        client_id=cliente.id,
        closer_id=closer.id,
        start_time_utc=inicio,
        origin=_fuente(payload, setter),
        setter_id=setter.id if setter else None,
    )
    if not appt:
        # create_appointment solo falla si el closer ya tiene una cita a esa MISMA hora.
        db.session.rollback()
        return None, None
    appt.agenda_payload = payload
    if previa:
        db.session.flush()
        db.session.add(
            Notification(
                subject='Sesión adicional: revisá la agenda anterior',
                content=(
                    f'{cliente.full_name or "Un lead"} ya tenía una agenda el '
                    f'{previa.start_time.strftime("%d/%m/%Y %H:%M")} UTC y pidió una sesión adicional el '
                    f'{inicio.strftime("%d/%m/%Y %H:%M")} UTC. Decidí si cancelás la anterior.'
                ),
                target_users=['role:admin', *sorted({int(closer.id), int(previa.closer_id)} - {None})],
                associated_id=appt.id,
                associated_type='appointment',
            )
        )
    db.session.commit()
    _payload_en_espejo(BookingService.sync_appointment_to_financial_agenda(appt, cita_nueva=True), payload)
    db.session.commit()
    return appt, None


INDICACIONES_POR_DEFECTO = (
    'Entrá a la videollamada con el link de Google Meet de esta invitación a la hora indicada, '
    'desde un lugar tranquilo y con buena conexión.'
)


def _descripcion(payload):
    """La descripción del evento, que también ve el lead en su invitación: solo las indicaciones para
    la sesión que configura la dirección en el evento (Thalamus › Events › Indicaciones). Los datos y
    las respuestas del lead NO van acá: el closer los ve en NeurOPS."""
    return (payload.get('indicaciones') or '').strip() or INDICACIONES_POR_DEFECTO


def crear_evento(appt, nombre_evento, evento_a_borrar=None):
    """Evento en el Calendar del closer con Meet e invitacion al lead. Nunca rompe la agenda: si
    Google falla, se avisa a admin y al closer para crearlo a mano."""
    from app.services.google_service import GoogleService

    if evento_a_borrar:
        try:
            GoogleService.delete_event(*evento_a_borrar)
        except Exception as e:  # noqa: BLE001  (el evento viejo no puede frenar la agenda nueva)
            current_app.logger.warning(f'[AGENDAS 2.0] No se pudo borrar el evento viejo {evento_a_borrar}: {e}')

    payload = dict(appt.agenda_payload or {})
    lead = payload.get('lead') or {}
    closer = db.session.get(User, appt.closer_id)
    fin = appt.start_time + timedelta(minutes=int(payload.get('duracion_min') or 60))
    titulo = f'{nombre_evento}: {lead.get("nombre") or "Lead"} y {closer.username if closer else "Learnation"}'
    email = _o_none(lead.get('email'))
    try:
        evento_id, meet = GoogleService.crear_evento_con_meet(
            appt.closer_id, appt.start_time, fin, titulo, _descripcion(payload), invitado_email=email
        )
    except Exception as e:  # noqa: BLE001  (Google puede fallar de mil formas; la agenda ya esta guardada)
        current_app.logger.error(f'[AGENDAS 2.0] Sin evento de Calendar para la agenda #{appt.id}: {e}')
        db.session.add(
            Notification(
                subject='Agenda sin evento de Google Calendar',
                content=(
                    f'La agenda de {lead.get("nombre") or "un lead"} '
                    f'del {appt.start_time.strftime("%d/%m/%Y %H:%M")} UTC '
                    f'se guardó, pero no se pudo crear el evento en el Calendar del closer ({e}). '
                    'Creálo a mano con link de Meet e invitá al lead.'
                ),
                target_users=['role:admin', int(appt.closer_id)],
                associated_id=appt.id,
                associated_type='appointment',
            )
        )
        db.session.commit()
        return False
    appt.google_event_id = evento_id
    appt.agenda_payload = {**payload, 'meet': meet}
    db.session.commit()
    return True


ZONA_EQUIPO = 'America/La_Paz'
COLOR_NUEVA, COLOR_REPROGRAMADA = 0x2ECC71, 0xF1C40F


def _corto(texto, n):
    texto = str(texto or '').strip()
    return texto if len(texto) <= n else texto[: n - 1] + '…'


def zona_del_lead(lead):
    """(zona, país) del lead para mostrarle la hora al equipo. Manda el país del WhatsApp: la zona del
    navegador puede caer en la del equipo (Bolivia) aunque el número sea de otro país. Si la zona que
    eligió el lead es de ese mismo país (Brasil, México, EE. UU. tienen varias), se respeta."""
    tz = lead.get('tz')
    pais = pais_por_telefono(lead.get('telefono')) or pais_de(lead.get('pais'))
    zonas = [z[0] for z in pais['z']]
    try:
        return ZoneInfo(tz if tz in zonas else zonas[0]), pais
    except Exception:  # noqa: BLE001
        return ZoneInfo(ZONA_EQUIPO), pais_de('BO')


def aviso_discord(appt):
    """El mensaje para Discord de una agenda de Agendas 2.0 (embed con lead, closer, horario y formulario)."""
    payload = appt.agenda_payload or {}
    lead = payload.get('lead') or {}
    closer = db.session.get(User, appt.closer_id)
    setter = db.session.get(User, appt.setter_id) if appt.setter_id else None
    zona, pais = zona_del_lead(lead)
    local = appt.start_time.replace(tzinfo=ZoneInfo('UTC')).astimezone(zona)
    reprogramada = bool(payload.get('reprogramada_desde'))
    origen = (setter.username if setter else payload.get('origen')) or '-'
    nota = str(payload['nota']) if payload.get('nota') is not None else '-'
    campos = [
        {'name': 'Lead', 'value': _corto(lead.get('nombre') or '-', 256), 'inline': True},
        {'name': 'Closer', 'value': closer.username if closer else '-', 'inline': True},
        {'name': 'Horario del lead', 'value': f"{local.strftime('%d/%m/%Y %H:%M')} {BANDERAS.get(pais['c'], '🌍')} {pais['n']}", 'inline': True},
        {'name': 'Setter / origen', 'value': origen, 'inline': True},
        {'name': 'Prioridad', 'value': payload.get('prioridad_nombre') or '-', 'inline': True},
        {'name': 'Nota', 'value': nota, 'inline': True},
    ]
    ig = lead.get('instagram')
    contacto = ' · '.join(x for x in (lead.get('telefono'), lead.get('email'), ('@' + ig) if ig else None) if x)
    if contacto:
        campos.append({'name': 'Contacto', 'value': _corto(contacto, 1024), 'inline': False})
    respuestas = [r for r in payload.get('respuestas') or [] if r.get('respuesta')]
    if respuestas:
        texto = '\n'.join(f'**{_corto(r["pregunta"], 120)}**: {_corto(r["respuesta"], 200)}' for r in respuestas)
        campos.append({'name': 'Formulario', 'value': _corto(texto, 1024), 'inline': False})
    if payload.get('meet'):
        campos.append({'name': 'Meet', 'value': payload['meet'], 'inline': False})
    titulo = (
        ('🔁 Agenda reprogramada' if reprogramada else '📅 Nueva agenda')
        + ': '
        + (payload.get('evento_nombre') or 'Llamada')
    )
    return {
        # @everyone, como el aviso de n8n: el canal de ventas se entera al instante.
        'content': '@everyone',
        'allowed_mentions': {'parse': ['everyone']},
        'embeds': [
            {
                'title': _corto(titulo, 256),
                'color': COLOR_REPROGRAMADA if reprogramada else COLOR_NUEVA,
                'fields': campos,
                'footer': {'text': f'Agendas 2.0 · agenda #{appt.id}'},
                'timestamp': datetime.utcnow().isoformat() + 'Z',
            }
        ]
    }


BANDERAS = {
    'AR': '🇦🇷', 'BO': '🇧🇴', 'BR': '🇧🇷', 'CL': '🇨🇱', 'CO': '🇨🇴', 'CR': '🇨🇷', 'CU': '🇨🇺', 'DO': '🇩🇴',
    'EC': '🇪🇨', 'ES': '🇪🇸', 'GT': '🇬🇹', 'HN': '🇭🇳', 'MX': '🇲🇽', 'NI': '🇳🇮', 'PA': '🇵🇦', 'PE': '🇵🇪',
    'PY': '🇵🇾', 'SV': '🇸🇻', 'US': '🇺🇸', 'UY': '🇺🇾', 'VE': '🇻🇪',
}
DIAS = ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')


def aviso_whatsapp(appt):
    """Los 8 datos de la plantilla del aviso al closer (la misma del flujo de n8n): día y hora en la zona
    del lead, con su bandera, como los mandaba n8n."""
    payload = appt.agenda_payload or {}
    lead = payload.get('lead') or {}
    closer = db.session.get(User, appt.closer_id)
    setter = db.session.get(User, appt.setter_id) if appt.setter_id else None
    zona, pais = zona_del_lead(lead)
    local = appt.start_time.replace(tzinfo=ZoneInfo('UTC')).astimezone(zona)
    hora = local.strftime('%I:%M').lstrip('0') + (' am' if local.hour < 12 else ' pm')
    reprogramada = ' (reprogramada)' if payload.get('reprogramada_desde') else ''
    return {
        'closer': closer.username if closer else '',
        'lead': (lead.get('nombre') or 'Lead') + reprogramada,
        'telefono': lead.get('telefono'),
        'instagram': ('@' + lead['instagram']) if lead.get('instagram') else None,
        'dia': f'{DIAS[local.weekday()]} {local.day}',
        'hora': f'{hora} {BANDERAS.get(pais['c'], "🌍")}',
        'grupo': payload.get('prioridad_nombre'),
        'fuente': (setter.username if setter else payload.get('origen') or payload.get('funnel_slug')),
    }


def avisar_whatsapp(appt):
    """Avisa la agenda al WhatsApp del closer (Whatchimp). Devuelve True si salió. Nunca lanza."""
    from app.services.whatchimp_service import AvisoDeAgenda

    closer = db.session.get(User, appt.closer_id)
    if not closer or not closer.two_chat_number:
        current_app.logger.warning(f'[AGENDAS 2.0] El closer de la agenda #{appt.id} no tiene WhatsApp: no se le avisa.')
        return False
    try:
        AvisoDeAgenda.enviar(closer.two_chat_number, **aviso_whatsapp(appt))
        return True
    except Exception as e:  # noqa: BLE001  (WhatsApp nunca puede frenar una agenda)
        current_app.logger.error(f'[AGENDAS 2.0] No se pudo avisar por WhatsApp la agenda #{appt.id}: {e}')
        return False


def avisar_discord(appt):
    """Manda el aviso al canal de ventas. Devuelve True si salio. Nunca lanza."""
    url = os.environ.get('DISCORD_AGENDAS_WEBHOOK')
    if not url:
        current_app.logger.warning('[AGENDAS 2.0] Sin DISCORD_AGENDAS_WEBHOOK: no se avisa a Discord.')
        return False
    try:
        r = requests.post(url, json=aviso_discord(appt), timeout=10)
        if r.status_code >= 300:
            current_app.logger.error(f'[AGENDAS 2.0] Discord respondio {r.status_code} para la agenda #{appt.id}')
            return False
        return True
    except Exception as e:  # noqa: BLE001  (Discord nunca puede frenar una agenda)
        current_app.logger.error(f'[AGENDAS 2.0] No se pudo avisar a Discord la agenda #{appt.id}: {e}')
        return False
