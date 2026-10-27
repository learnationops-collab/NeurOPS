"""La lectura de la ficha del lead."""
import logging

from flask import jsonify, request
from flask_login import current_user

from app import db
from app.api.ficha import bp, sin_permiso
from app.services import ficha_lead_service
from app.services.leads_del_setter import puede_abrir

logger = logging.getLogger(__name__)


def _entero(nombre):
    valor = request.args.get(nombre)
    try:
        return int(valor) if valor else None
    except (TypeError, ValueError):
        return None


@bp.route('/lead', methods=['GET'])
def lead():
    """`GET /api/ficha/lead?appointment_id=<id>`, `?client_id=<id>` o `?person_uuid=<uuid>`.

    Al menos uno. El estado operativo cuelga de `Appointment` y el cobro de `Client`, y segun de
    donde se abra la ficha se tiene una clave o la otra. `person_uuid` (docs/plan_personas.md,
    Etapa 2a) es la persona: se abre la ficha de su cliente.
    """
    appointment_id, client_id = _entero('appointment_id'), _entero('client_id')
    person_uuid = (request.args.get('person_uuid') or '').strip()
    if not appointment_id and not client_id and person_uuid:
        from app.services import person_service
        cliente = person_service.cliente_de(person_service.por_uuid(person_uuid), crear=False)
        client_id = cliente.id if cliente else None
        if not client_id:
            return jsonify({'message': 'Lead no encontrado'}), 404
    if not appointment_id and not client_id:
        return jsonify({'message': 'Falta appointment_id, client_id o person_uuid'}), 400

    # Un setter abre solo sus leads (los de su Revisar, ver `leads_del_setter`); el resto de los
    # roles, cualquiera. Se mira antes de armar la ficha, que puede anclarle una agenda al cliente.
    datos = (ficha_lead_service.ficha(appointment_id=appointment_id, client_id=client_id,
                                      usuario=current_user)
             if puede_abrir(current_user, appointment_id=appointment_id, client_id=client_id) else None)
    if not datos:
        # 404 y no 403 tambien cuando el recurso existe pero queda fuera de alcance: un 403
        # confirmaria su existencia (mismo criterio que GET /api/comercial/clientes/<id>).
        return jsonify({'message': 'Lead no encontrado'}), 404
    _marcar_notas_leidas(datos)
    return jsonify(datos), 200


def _marcar_notas_leidas(datos):
    """Abrir la ficha es leer sus notas: se apaga el punto de «sin leer» del mazo. Nunca frena la lectura."""
    from app.services import avisos_service

    try:
        avisos_service.marcar_leidos(current_user, (datos.get('identidad') or {}).get('person_uuid'))
    except Exception as e:
        db.session.rollback()
        logger.error(f'[avisos] no se pudieron marcar como leídas las notas: {e}')


@bp.route('/bitacora', methods=['GET'])
def bitacora():
    """`GET /api/ficha/bitacora?appointment_id=<id>` o `?client_id=<id>`: la bitácora del lead por tramos.

    Ruta propia, como Fulfillment: le pide el expediente a la Academia y abrir la ficha no tiene que
    esperarla. La ve quien puede abrir la ficha.
    """
    from app.services import bitacora_lead_service

    appointment_id, client_id = _entero('appointment_id'), _entero('client_id')
    if not appointment_id and not client_id:
        return jsonify({'message': 'Falta appointment_id o client_id'}), 400
    # Sin `resolver_lead` con client_id: ancla una agenda si no hay, y esto es solo lectura.
    from app import db
    from app.models import Appointment, Client
    appt = db.session.get(Appointment, appointment_id) if appointment_id else None
    client = appt.client if appt else (db.session.get(Client, client_id) if client_id else None)
    if not client or not puede_abrir(current_user, appointment_id=appointment_id, client_id=client_id):
        return jsonify({'message': 'Lead no encontrado'}), 404
    quien = {'email': current_user.email, 'rol': current_user.role}
    return jsonify(bitacora_lead_service.bitacora(client, quien=quien)), 200


@bp.route('/comentarios-academia', methods=['GET'])
def comentarios_academia():
    """`GET /api/ficha/comentarios-academia?appointment_id=<id>` o `?client_id=<id>`: lo que anotó el equipo de la
    Academia sobre el alumno (pestaña Fulfillment). Mismo permiso que la bitácora."""
    from app import db
    from app.models import Appointment, Client
    from app.services import bitacora_lead_service

    appointment_id, client_id = _entero('appointment_id'), _entero('client_id')
    if not appointment_id and not client_id:
        return jsonify({'message': 'Falta appointment_id o client_id'}), 400
    appt = db.session.get(Appointment, appointment_id) if appointment_id else None
    client = appt.client if appt else (db.session.get(Client, client_id) if client_id else None)
    if not client or not puede_abrir(current_user, appointment_id=appointment_id, client_id=client_id):
        return jsonify({'message': 'Lead no encontrado'}), 404
    quien = {'email': current_user.email, 'rol': current_user.role}
    return jsonify(bitacora_lead_service.comentarios(client, quien=quien)), 200


@bp.route('/<int:appt_id>/fulfillment', methods=['GET'])
def fulfillment(appt_id):
    """Como le va al alumno dentro de la Academia (Learnation).

    Ruta propia y no parte de `GET /ficha/lead` porque es una llamada a OTRO sistema, con su
    timeout y su limite de peticiones por minuto: si viajara en la lectura de la ficha, abrir
    cualquier lead —incluso uno que nunca compro— dependeria de que la Academia este arriba.

    El permiso es `cobrar` y no uno propio: la audiencia es exactamente la misma (la direccion y
    el closer), y un permiso nuevo sin una politica distinta detras es una clave mas que mantener
    en los cuatro lugares donde se comprueba.
    """
    from app.services import ficha_fulfillment_service

    appt, client = ficha_lead_service.resolver_lead(appointment_id=appt_id)
    if not appt:
        return jsonify({'message': 'Lead no encontrado'}), 404
    if not ficha_lead_service.permisos_de(current_user, appt)['cobrar']:
        return sin_permiso('cobrar')

    ventas = ficha_lead_service._ventas_del_cliente(client)
    datos = ficha_fulfillment_service.fulfillment(client, ventas)
    # Lo que la pestana ya pago en peticiones queda como la foto de la Academia de este cliente,
    # que es lo que leen las tablas Clientes y Ventas (ver `academy_snapshot_service`). No cambia
    # la respuesta y nunca la rompe.
    from app.services import academy_snapshot_service
    academy_snapshot_service.guardar_desde_fulfillment(client, datos)
    return jsonify(datos), 200


@bp.route('/<int:appt_id>/triage/horarios', methods=['GET'])
def horarios_para_closing(appt_id):
    """Los horarios libres del closer (`?closer_id=`) para la llamada de closing que agenda el triage."""
    from app.agendas_v2 import a_triage

    appt, _ = ficha_lead_service.resolver_lead(appointment_id=appt_id)
    if not appt:
        return jsonify({'message': 'Lead no encontrado'}), 404
    if not ficha_lead_service.permisos_de(current_user, appt)['triar']:
        return sin_permiso('triar')
    return jsonify({'horarios': a_triage.horarios_closer(request.args.get('closer_id', type=int))}), 200


@bp.route('/<int:appt_id>/estado-venta', methods=['GET'])
def estado_venta(appt_id):
    """Como viene pagando este cliente el programa que se le esta vendiendo (`?programa=RR`).

    Es lo que el wizard de venta del mazo pedia a `/closer/sales/client-state`: cuanto pago, cuanto
    le falta, cuantas ventas tiene en ese programa y que tipos de pago siguen la secuencia
    (`allowed_types`, para AVISAR, no para bloquear). No viaja en `GET /ficha/lead` porque depende
    del programa que el closer elige en medio de la venta, y el de la ficha es el que ya tiene.

    Esa ruta es `/closer/*` y la direccion comercial recibe 403 ahi; por eso esta puerta, con el
    permiso de declarar la venta. Tampoco crea un cliente al consultar, como hace aquella cuando no
    le llega un id: aca la agenda ya tiene el suyo.
    """
    from app.services.sales_consistency_service import SalesConsistencyService

    appt, client = ficha_lead_service.resolver_lead(appointment_id=appt_id)
    if not appt:
        return jsonify({'message': 'Lead no encontrado'}), 404
    if not ficha_lead_service.permisos_de(current_user, appt)['reportar']:
        return sin_permiso('reportar')

    programa = (request.args.get('programa') or '').strip().upper()
    if programa not in SalesConsistencyService.PROGRAM_DEFAULT_TOTALS:
        return jsonify({'message': f'Programa desconocido: «{programa}».'}), 400
    client_id = client.id if client else None
    estado = SalesConsistencyService.get_client_payment_state(client_id, programa)
    estado['allowed_types'] = SalesConsistencyService.get_allowed_types(client_id, programa)
    estado['client_id'] = client_id
    return jsonify(estado), 200


@bp.route('/vocabulario', methods=['GET'])
def vocabulario():
    """Los vocabularios sueltos, sin un lead.

    Los necesita cualquier pantalla que ofrezca las mismas listas fuera de la ficha (un filtro de
    dolores, el selector de closer) sin tener que pedir una ficha entera para sacarlas.
    """
    from app.services import ficha_vocabulario as voc
    return jsonify(voc.vocabulario()), 200
