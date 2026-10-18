"""«Mis agendas»: la bandeja de palabras clave del setter (ver `palabra_clave_service`).

Vive aparte de `setter.py` (que ya pasa las 1600 lineas) y se cuelga del mismo blueprint.

Reemplaza a la lista de agendas del mazo (`/setter/deck/agendas`) y a su asignacion
(`/setter/deck/assign-unattributed-ad`): aquella trabajaba sobre las filas del Tablero de Agendas
por el nombre de la fuente y con la fecha del chip, y esta sobre las agendas del setter con la
misma regla que sus numeros, de cualquier fecha desde que hay anuncios que atribuir.
"""
from flask import jsonify, request
from flask_login import current_user

from app.api.setter import bp
from app.decorators import role_required
from app.models import ROLE_SETTER
from app.services import palabra_clave_service as servicio
from app.services import ventas_palabra_clave_service as ventas_servicio


@bp.route('/palabras-clave', methods=['GET'])
@role_required(ROLE_SETTER)
def bandeja_de_palabras_clave():
    """Las agendas sin anuncio, los anuncios para el buscador y el resumen (hoy, racha).

    `?solo=resumen` devuelve solo el resumen: es lo que pide el dock para su marca cuando el setter
    entra por otra seccion, y no hace falta mandarle la lista entera.
    """
    if request.args.get('solo') == 'resumen':
        return jsonify({'resumen': servicio.resumen(current_user)}), 200
    return jsonify(servicio.bandeja(current_user)), 200


@bp.route('/palabras-clave', methods=['POST'])
@role_required(ROLE_SETTER)
def asignar_palabra_clave():
    """Body: {"appointment_id": int, "ad_id": int, "instagram": "usuario" (opcional)}.

    En vez de `ad_id` puede venir `palabra_clave` (texto): una que no esta en la lista, o una que
    llego por ManyChat sin anuncio. Se busca sin tildes ni mayusculas y, si no hay, se crea su
    anuncio (15/10/2026).

    Devuelve la asignacion y el resumen recalculado: con `pendientes` en 0 la pantalla festeja.
    """
    datos = request.get_json(silent=True) or {}
    palabra = datos.get('palabra_clave')
    if palabra is not None and not isinstance(palabra, str):
        return jsonify({'error': 'La palabra clave tiene que ser texto.'}), 400
    try:
        appointment_id = int(datos.get('appointment_id'))
        ad_id = int(datos['ad_id']) if datos.get('ad_id') is not None else None
    except (TypeError, ValueError):
        return jsonify({'error': 'Falta la agenda o el anuncio.'}), 400
    if ad_id is None and not (palabra or '').strip():
        return jsonify({'error': 'Falta la agenda o el anuncio.'}), 400
    instagram = datos.get('instagram')
    if instagram is not None and not isinstance(instagram, str):
        return jsonify({'error': 'El Instagram tiene que ser texto.'}), 400
    try:
        hecho = servicio.asignar(current_user, appointment_id, ad_id, instagram, palabra=palabra)
    except servicio.ErrorDePalabraClave as error:
        return jsonify({'error': str(error)}), error.estado
    return jsonify({**hecho, 'resumen': servicio.resumen(current_user)}), 200


@bp.route('/palabras-clave/ventas', methods=['GET'])
@role_required(ROLE_SETTER)
def ventas_sin_palabra_clave():
    """Las ventas de la fuente del setter, por cliente: pendientes (algún pago sin palabra clave) y
    completadas. Ver `ventas_palabra_clave_service` (17/10/2026)."""
    return jsonify(ventas_servicio.ventas(current_user)), 200


@bp.route('/palabras-clave/ventas', methods=['POST'])
@role_required(ROLE_SETTER)
def asignar_palabra_clave_a_ventas():
    """Body: {"grupo": "c<client_id>" | "v<venta_id>", "ad_id": int | "palabra_clave": str,
    "instagram": "usuario" (opcional)}. Pone el anuncio en todos los pagos de ese cliente."""
    datos = request.get_json(silent=True) or {}
    grupo, palabra, instagram = datos.get('grupo'), datos.get('palabra_clave'), datos.get('instagram')
    if not isinstance(grupo, str) or grupo[:1] not in ('c', 'v') or not grupo[1:].isdigit():
        return jsonify({'error': 'Falta el cliente.'}), 400
    if palabra is not None and not isinstance(palabra, str):
        return jsonify({'error': 'La palabra clave tiene que ser texto.'}), 400
    if instagram is not None and not isinstance(instagram, str):
        return jsonify({'error': 'El Instagram tiene que ser texto.'}), 400
    try:
        ad_id = int(datos['ad_id']) if datos.get('ad_id') is not None else None
    except (TypeError, ValueError):
        return jsonify({'error': 'Ese anuncio no existe: elegilo de la lista.'}), 400
    if ad_id is None and not (palabra or '').strip():
        return jsonify({'error': 'Elegí el anuncio de la lista o escribí la palabra clave.'}), 400
    try:
        hecho = ventas_servicio.asignar(current_user, grupo, ad_id, palabra, instagram)
    except servicio.ErrorDePalabraClave as error:
        return jsonify({'error': str(error)}), error.estado
    return jsonify(hecho), 200
