"""Helpers compartidos de las rutas de agendas financieras (sin rutas)."""
from flask import request
from app.models import FinancialAgenda, Client
from datetime import datetime
from sqlalchemy import or_, and_, func
from app.services.agenda_contacto_service import ig_limpio, mail_limpio


def parse_date_robustly(val):
    if not val:
        return datetime.utcnow()
    val_str = str(val).strip()
    try:
        from dateutil import parser
        if '-' in val_str and val_str.find('-') == 4:
            return parser.parse(val_str, dayfirst=False)
        if '/' in val_str:
            parts = val_str.split('/')
            if len(parts) > 0 and len(parts[0]) <= 2:
                return parser.parse(val_str, dayfirst=True)
        return parser.parse(val_str)
    except:
        return datetime.utcnow()

# Estados en los que la agenda sigue ABIERTA: la llamada todavia no ocurrio y el lead
# sigue esperando. Todo lo demas (Show Up, No Show, Lead Perdido, conversando, cierres)
# describe una cita que ya paso, y volver a agendar despues de eso es una segunda cita,
# no una reprogramacion de la primera.
ESTADOS_AGENDA_ABIERTA = {
    '', 'pendiente', 'confirmado', 'por_confirmar', 'por confirmar',
    'reagendada', 'reagendado', 'reprogramada', 'reprogramado',
}

_SEPARADORES_TELEFONO = (' ', '-', '(', ')', '+', '.')


def _whatsapp_solo_digitos():
    """Expresion SQL con el whatsapp sin separadores, para comparar numeros y no textos."""
    from app.services.agenda_contacto_service import whatsapp_solo_digitos
    return whatsapp_solo_digitos(_SEPARADORES_TELEFONO)


def _cola_telefono(valor, largo=9):
    """Ultimos `largo` digitos de un telefono, o None si no llega a tener esos digitos.

    Se compara la cola y no el numero entero porque el prefijo de pais aparece de forma
    intermitente segun como lo escriba el lead ('+51 996 526 031', '996526031'), y con
    el numero completo esas dos formas del MISMO telefono no se reconocen.
    """
    digitos = ''.join(c for c in str(valor or '') if c.isdigit())
    return digitos[-largo:] if len(digitos) >= largo else None


def _split_multi(raw_value):
    # Los filtros del tablero envian una o varias opciones separadas por coma
    if not raw_value:
        return []
    return [part.strip() for part in raw_value.split(',') if part.strip()]

def _build_agenda_queries():
    # Construye la consulta filtrada por fechas y la consulta con el resto de filtros
    # de la request actual. Devuelve (date_query, query, closer_results) donde
    # closer_results son los estados post call pedidos (se filtran en memoria porque
    # se calculan a partir de la cita asociada).
    start_date_str = request.args.get('start_date', default='', type=str).strip()
    end_date_str = request.args.get('end_date', default='', type=str).strip()
    date_filter_by = request.args.get('date_filter_by', default='meet', type=str).strip().lower()
    search = request.args.get('search', default='', type=str).strip()

    estados = _split_multi(request.args.get('estado', default='', type=str))
    closers = _split_multi(request.args.get('closer', default='', type=str))
    fuentes = _split_multi(request.args.get('fuente', default='', type=str))
    closer_results = _split_multi(request.args.get('closer_result', default='', type=str))

    # Consulta base filtrada únicamente por fechas. Las marcadas como repetidas del mismo
    # lead quedan fuera de todo el libro: se descartaron justamente para no verlas dos
    # veces. Siguen existiendo y se listan (y se deshacen) desde el panel de duplicados,
    # ver app/api/public/financial_agendas_dedup.py.
    date_query = FinancialAgenda.query.filter(FinancialAgenda.duplicada_de_id.is_(None))

    if date_filter_by == 'created':
        if start_date_str:
            date_query = date_query.filter(FinancialAgenda.registro >= start_date_str)
        if end_date_str:
            date_query = date_query.filter(FinancialAgenda.registro <= f"{end_date_str}T23:59:59")
    else:
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
                end_date = None
                if end_date_str:
                    try:
                        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
                    except ValueError:
                        pass

                # Filtro para fecha de cita (date)
                date_conds = [FinancialAgenda.date >= start_date]
                if end_date:
                    date_conds.append(FinancialAgenda.date <= end_date)

                # Filtro para fecha de seguimiento (fecha_seguimiento)
                followup_conds = [FinancialAgenda.fecha_seguimiento >= start_date_str]
                if end_date_str:
                    followup_conds.append(FinancialAgenda.fecha_seguimiento <= f"{end_date_str}T23:59:59")
                else:
                    followup_conds.append(FinancialAgenda.fecha_seguimiento <= f"{start_date_str}T23:59:59")

                date_query = date_query.filter(or_(
                    and_(*date_conds),
                    and_(*followup_conds)
                ))
            except ValueError:
                pass

    # La consulta principal aplica además los filtros específicos de estado, closer, fuente y búsqueda
    query = date_query

    if search:
        search_pattern = f"%{search}%"
        from app.services import agenda_contacto_service
        query = query.filter(or_(
            agenda_contacto_service.busqueda(search_pattern),  # el lead: su persona, o la copia si no tiene
            FinancialAgenda.nombre.ilike(search_pattern),
            FinancialAgenda.closer.ilike(search_pattern)
        ))

    if estados:
        query = query.filter(FinancialAgenda.estado.in_(estados))
    if closers:
        query = query.filter(FinancialAgenda.closer.in_(closers))
    if fuentes:
        query = query.filter(FinancialAgenda.nombre.in_(fuentes))
    # El filtro por Call Confirmer (`encargado_triage`) se retiró el 10/10/2026 junto con la
    # columna del tablero: los closers confirman sus propias agendas. Si llega, se ignora.

    if date_filter_by == 'created':
        query = query.order_by(FinancialAgenda.registro.desc())
    else:
        query = query.order_by(FinancialAgenda.date.desc())

    return date_query, query, closer_results


def _resolve_closer_results(agendas):
    # Resuelve en lote el estado post call de cada agenda (cliente + cita del mismo dia)
    from app.models import Appointment
    from app.models.financial import map_closer_result_to_display

    resultados = {}
    if not agendas:
        return resultados

    from app.services import agenda_contacto_service
    agenda_contacto_service.precargar(agendas)
    agendas_por_ig = {}
    agendas_por_mail = {}
    for a in agendas:
        contacto = a.contacto()
        ig_clean = ig_limpio(contacto['instagram'])
        mail_clean = mail_limpio(contacto['mail'])
        if ig_clean:
            agendas_por_ig.setdefault(ig_clean, []).append(a)
        if mail_clean:
            agendas_por_mail.setdefault(mail_clean, []).append(a)

    # Primero el cliente de la persona de cada agenda (docs/plan_personas.md); el texto, de respaldo
    # para las agendas sin persona o cuya persona todavía no tiene cliente.
    from app.services.booking_service import BookingService
    por_persona = BookingService.clientes_por_persona(agendas)
    cliente_por_agenda = {a.id: por_persona[a.person_uuid] for a in agendas if a.person_uuid in por_persona}

    client_filters = []
    if agendas_por_ig:
        client_filters.append(func.lower(func.replace(Client.instagram, '@', '')).in_(list(agendas_por_ig.keys())))
    if agendas_por_mail:
        client_filters.append(func.lower(Client.email).in_(list(agendas_por_mail.keys())))

    for c in (Client.query.filter(or_(*client_filters)).all() if client_filters else []):
        c_ig = c.instagram.strip().replace('@', '').lower() if c.instagram else None
        c_mail = c.email.strip().lower() if c.email else None
        for a in agendas_por_ig.get(c_ig, []) + agendas_por_mail.get(c_mail, []):
            cliente_por_agenda.setdefault(a.id, c.id)

    client_ids = set(cliente_por_agenda.values())
    if not client_ids:
        return resultados

    citas_por_cliente = {}
    for appt in Appointment.query.filter(Appointment.client_id.in_(list(client_ids))).all():
        citas_por_cliente.setdefault(appt.client_id, []).append(appt)

    for a in agendas:
        client_id = cliente_por_agenda.get(a.id)
        if not client_id or not a.date:
            continue
        for appt in citas_por_cliente.get(client_id, []):
            if appt.start_time and appt.start_time.date() == a.date.date():
                mapped = map_closer_result_to_display(appt.closer_result)
                if mapped:
                    resultados[a.id] = mapped
                break

    return resultados
