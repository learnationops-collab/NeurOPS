"""Envío directo a la API de WhatsApp de Meta (Cloud API), sin Whatchimp en el medio.

Las plantillas se mandan por NOMBRE e idioma: los IDs de Whatchimp (414407, 421566…) Meta no los
conoce. Cada número tiene sus propias plantillas aprobadas.

El token sale de la conexión (token de negocio del Embedded Signup) o, si no tiene, de
WHATSAPP_TOKEN (números del propio portfolio). Lanza excepción ante cualquier falla: el que llama
decide si cae a Whatchimp.
"""
import logging
import os

import requests

from app.models.whatsapp import WhatsappConexion
from app.services.whatchimp_service import WhatchimpService

logger = logging.getLogger(__name__)

TIMEOUT = 15


def _graph():
    return f"https://graph.facebook.com/{os.environ.get('WHATSAPP_GRAPH_VERSION', 'v23.0')}"


def conexion_activa(phone_number_id=None, user_id=None):
    """La conexión conectada por phone_number_id o por closer; None si no hay."""
    q = WhatsappConexion.query.filter_by(estado='conectado')
    if phone_number_id:
        q = q.filter_by(phone_number_id=str(phone_number_id))
    elif user_id:
        q = q.filter_by(user_id=user_id)
    else:
        return None
    return q.order_by(WhatsappConexion.id.desc()).first()


def _token(conexion):
    token = (conexion.token if conexion else None) or os.environ.get('WHATSAPP_TOKEN')
    if not token:
        raise Exception('Sin token de WhatsApp (ni de la conexión ni WHATSAPP_TOKEN)')
    return token


def _parametros(variables):
    """Variables posicionales ({{1}}, {{2}}…) o con nombre ({{nombre}}) según venga lista o dict.
    Meta rechaza variables vacías o con saltos de línea: se reemplazan por '-' y espacios."""
    def limpio(v):
        texto = ' '.join(str(v).split()) if v not in (None, '') else ''
        return texto or '-'

    if isinstance(variables, dict):
        return [{'type': 'text', 'parameter_name': k, 'text': limpio(v)} for k, v in variables.items()]
    return [{'type': 'text', 'text': limpio(v)} for v in (variables or [])]


def enviar_plantilla(conexion, destino, plantilla, idioma='es', variables=None):
    """Manda una plantilla aprobada desde el número de `conexion` a `destino`. Devuelve el wamid."""
    if not conexion:
        raise Exception('No hay número conectado para enviar')
    numero = WhatchimpService.normalize_phone(destino)
    if not numero:
        raise Exception('No hay número de destino')

    plantilla_payload = {'name': plantilla, 'language': {'code': idioma}}
    parametros = _parametros(variables)
    if parametros:
        plantilla_payload['components'] = [{'type': 'body', 'parameters': parametros}]

    respuesta = requests.post(
        f'{_graph()}/{conexion.phone_number_id}/messages',
        headers={'Authorization': f'Bearer {_token(conexion)}'},
        json={'messaging_product': 'whatsapp', 'to': numero, 'type': 'template', 'template': plantilla_payload},
        timeout=TIMEOUT,
    )
    datos = respuesta.json() if respuesta.content else {}
    if not respuesta.ok:
        error = (datos.get('error') or {}) if isinstance(datos, dict) else {}
        raise Exception(f"Meta rechazó el mensaje ({error.get('code')}): {error.get('message') or respuesta.text[:200]}")
    wamid = ((datos.get('messages') or [{}])[0]).get('id')
    logger.info('[WA CLOUD] %s → %s (%s) wamid=%s', conexion.phone_number_id, numero, plantilla, wamid)
    return wamid


def listar_plantillas(conexion):
    """Las plantillas de la cuenta de WhatsApp de la conexión, con su estado en Meta."""
    respuesta = requests.get(
        f'{_graph()}/{conexion.waba_id}/message_templates',
        headers={'Authorization': f'Bearer {_token(conexion)}'},
        params={'fields': 'name,language,status,category', 'limit': 200},
        timeout=TIMEOUT,
    )
    respuesta.raise_for_status()
    return respuesta.json().get('data', [])
