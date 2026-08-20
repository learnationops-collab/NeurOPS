"""Las agendas de cada setter y la bandeja de las que no tienen dueño.

Vive aparte de `app/api/setter.py` (que ya pasa las 1800 lineas) y se cuelga del
mismo blueprint.

Por que existe la bandeja: el enrutamiento de Calendly manda 'setting' cuando el
lead entro por el link de un setter, pero los tres setters comparten el mismo
evento, asi que el nombre solo viaja en el formulario. Si el formulario no llego,
o llego con 'No identificado', la agenda queda con fuente 'setting'/'Desconocido'
y no hay forma automatica de saber de quien es. En vez de dejarla huerfana, se le
muestra al equipo de setting para que la reclame.

Ojo con el criterio de "mis agendas": es la FUENTE de la agenda, no
`Appointment.setter_id`. Cualificar un lead de ManyChat crea un Appointment
placeholder (`origin='ManyChat / Instagram'`, `result='Cualificado'`, sin agenda
real detras) y con el criterio viejo esos aparecian mezclados con las citas de
verdad en la pestaña del setter.
"""
import logging

from flask import request, jsonify
from flask_login import current_user
from sqlalchemy import or_, func

from app import db
from app.models import ROLE_SETTER, Client, Appointment
from app.models.financial import FinancialAgenda
from app.decorators import role_required
from app.services.fuente_service import normalizar, es_sin_dueno
from app.api.setter import bp

logger = logging.getLogger(__name__)

# Estados previos a la llamada: la agenda todavia esta en juego.
ESTADOS_PENDIENTES = {'pendiente', 'contactado', 'contactada', 'confirmado',
                      'confirmada', 'sin respuesta', 'agendado', 'agendada', ''}


def _variantes_de_fuente(coincide):
    """Valores de `nombre` tal cual estan en la base que cumplen `coincide`.

    La fuente la escriben n8n, el formulario y ediciones a mano, asi que conviven
    variantes de mayusculas y acentos ('Ivan' / 'Iván'). Se resuelve con un solo
    DISTINCT y la comparacion normalizada en Python, en vez de intentar
    normalizar dentro de SQL.
    """
    valores = db.session.query(FinancialAgenda.nombre).distinct().all()
    return [v[0] for v in valores if v[0] is not None and coincide(v[0])]


def _mis_variantes():
    objetivo = normalizar(current_user.username)
    return _variantes_de_fuente(lambda n: normalizar(n) == objetivo)


def _cliente_de(agenda):
    """Client que corresponde a una agenda, por instagram o mail."""
    condiciones = []
    ig = (agenda.instagram or '').strip().lstrip('@').lower()
    if ig and ig not in ('n/a', ''):
        condiciones.append(func.lower(func.replace(Client.instagram, '@', '')) == ig)
    mail = (agenda.mail or '').strip().lower()
    if mail and '@' in mail:
        condiciones.append(func.lower(Client.email) == mail)
    if not condiciones:
        return None
    return Client.query.filter(or_(*condiciones)).first()


def _cita_de(agenda, client=None):
    from datetime import timedelta
    client = client or _cliente_de(agenda)
    if not client or not agenda.date:
        return None
    return Appointment.query.filter(
        Appointment.client_id == client.id,
        Appointment.start_time >= agenda.date - timedelta(hours=12),
        Appointment.start_time <= agenda.date + timedelta(hours=12)
    ).first()


def _serializar(agenda, con_cita=True):
    client = _cliente_de(agenda)
    appt = _cita_de(agenda, client) if con_cita else None
    raw = agenda.raw_data or {}
    return {
        "id": agenda.id,
        # El modal de detalle trabaja sobre la cita; sin ella solo se puede leer.
        "appointment_id": appt.id if appt else None,
        "client_id": client.id if client else None,
        "lead_name": agenda.lead or (client.full_name if client else "Sin nombre"),
        "closer_name": agenda.closer or "Sin asignar",
        "start_time": agenda.date.isoformat() if agenda.date else None,
        "created_at": agenda.created_at.isoformat() if agenda.created_at else None,
        "phone": agenda.whatsapp if agenda.whatsapp not in (None, 'N/A') else "",
        "instagram": agenda.instagram if agenda.instagram not in (None, 'N/A') else "",
        "mail": agenda.mail if agenda.mail not in (None, 'N/A') else "",
        "origin": agenda.nombre,
        "fuente": agenda.nombre,
        "fuente_origen": raw.get('fuente_origen'),
        "fuente_form": raw.get('fuente_form'),
        "result": agenda.estado,
        "closer_result": appt.closer_result if appt else None,
        "tiene_formulario": bool(client and client.form_data),
    }


@bp.route('/agendas', methods=['GET'])
@role_required(ROLE_SETTER)
def get_setter_agendas():
    """Las agendas cuya FUENTE es este setter.

    Filtra por `FinancialAgenda.nombre`, no por `Appointment.setter_id`: ese
    campo tambien lo llenan las cualificaciones de ManyChat, que crean una cita
    placeholder sin agenda real y ensuciaban esta lista.

    ?status=pending|completed|all
    """
    estado_filtro = request.args.get('status', 'all')

    variantes = _mis_variantes()
    if not variantes:
        return jsonify([]), 200

    agendas = FinancialAgenda.query.filter(
        FinancialAgenda.nombre.in_(variantes)
    ).order_by(FinancialAgenda.date.desc()).limit(500).all()

    if estado_filtro == 'pending':
        agendas = [a for a in agendas if (a.estado or '').strip().lower() in ESTADOS_PENDIENTES]
    elif estado_filtro == 'completed':
        agendas = [a for a in agendas if (a.estado or '').strip().lower() not in ESTADOS_PENDIENTES]

    return jsonify([_serializar(a) for a in agendas]), 200


@bp.route('/agendas/sin-asignar', methods=['GET'])
@role_required(ROLE_SETTER)
def get_agendas_sin_asignar():
    """Agendas que entraron por setting pero sin saber de que setter son.

    Solo se ofrecen las posteriores al ingreso del setter: nadie puede reclamar
    una agenda de antes de haber entrado al equipo. Las que ya descarto ("no es
    mia") tampoco vuelven a aparecerle.
    """
    variantes = _variantes_de_fuente(es_sin_dueno)
    condiciones = [FinancialAgenda.nombre == None]  # noqa: E711
    if variantes:
        condiciones.append(FinancialAgenda.nombre.in_(variantes))

    desde = current_user.created_at
    query = FinancialAgenda.query.filter(or_(*condiciones))
    if desde:
        query = query.filter(FinancialAgenda.created_at >= desde)

    agendas = query.order_by(FinancialAgenda.date.desc()).limit(200).all()

    pendientes = []
    for a in agendas:
        raw = a.raw_data or {}
        if current_user.id in (raw.get('descartada_por') or []):
            continue
        pendientes.append(_serializar(a))

    return jsonify(pendientes), 200


@bp.route('/agendas/<int:agenda_id>/reclamar', methods=['POST'])
@role_required(ROLE_SETTER)
def reclamar_agenda(agenda_id):
    """El setter dice si una agenda sin dueño es suya.

    Body: {"accion": "mia"} o {"accion": "no_mia"}.

    Al reclamarla se escribe la fuente, se le atribuye la cita y se deja el
    `fuente_form` en el cliente, para que las respuestas del formulario queden
    vinculadas al mismo setter que la agenda.
    """
    accion = (request.get_json() or {}).get('accion')
    if accion not in ('mia', 'no_mia'):
        return jsonify({"error": "La acción debe ser 'mia' o 'no_mia'"}), 400

    agenda = FinancialAgenda.query.get(agenda_id)
    if not agenda:
        return jsonify({"error": "Agenda no encontrada"}), 404

    # Se revalida en el servidor: la lista pudo quedar vieja en pantalla y no se
    # puede permitir que un setter le saque una agenda ya atribuida a otro.
    if not es_sin_dueno(agenda.nombre):
        return jsonify({"error": f"Esta agenda ya tiene fuente ({agenda.nombre})"}), 409
    if current_user.created_at and agenda.created_at and agenda.created_at < current_user.created_at:
        return jsonify({"error": "Esta agenda es anterior a tu ingreso"}), 403

    raw = dict(agenda.raw_data or {})

    if accion == 'no_mia':
        descartada_por = list(raw.get('descartada_por') or [])
        if current_user.id not in descartada_por:
            descartada_por.append(current_user.id)
        raw['descartada_por'] = descartada_por
        agenda.raw_data = raw
        db.session.add(agenda)
        db.session.commit()
        return jsonify({"message": "Agenda descartada", "accion": accion}), 200

    raw['fuente_webhook'] = raw.get('fuente_webhook', agenda.nombre)
    raw['fuente_origen'] = 'reclamada_por_setter'
    raw['fuente_form'] = current_user.username
    agenda.nombre = current_user.username
    agenda.raw_data = raw
    db.session.add(agenda)

    client = _cliente_de(agenda)
    appt = _cita_de(agenda, client)
    if appt:
        appt.origin = agenda.nombre
        appt.setter_id = current_user.id
        db.session.add(appt)

    # Vincular tambien las respuestas del formulario del lead con este setter
    if client:
        from sqlalchemy.orm.attributes import flag_modified
        form_data = dict(client.form_data or {})
        form_data['fuente_form'] = current_user.username
        form_data['fuente_asignada_por'] = 'setter'
        client.form_data = form_data
        flag_modified(client, 'form_data')
        db.session.add(client)

    db.session.commit()
    return jsonify({
        "message": f"Agenda asignada a {current_user.username}",
        "accion": accion,
        "fuente": agenda.nombre,
        "cita_actualizada": bool(appt),
        "formulario_vinculado": bool(client),
    }), 200
