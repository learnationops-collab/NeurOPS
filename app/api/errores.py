"""Un error inesperado de un endpoint: se registra completo y al cliente le llega un mensaje genérico, sin el
texto de la excepción, que podía traer SQL, rutas o datos (auditoría de seguridad, 27/10/2026). Los errores de
validación (400, 409, 422) siguen devolviendo su mensaje: está escrito para quien lo lee."""
import logging

from flask import jsonify, request

logger = logging.getLogger(__name__)


def error_interno(e, mensaje='Error interno', clave='error'):
    logger.error(f'[500] {request.method} {request.path}: {e}', exc_info=e)
    return jsonify({clave: f'{mensaje}. Quedó registrado para revisarlo.'}), 500
