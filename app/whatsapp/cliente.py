"""Cliente mínimo de la WhatsApp Cloud API.

Variables de entorno: WA_ACCESS_TOKEN (token permanente), WA_PHONE_NUMBER_ID (el número que manda) y
WA_WABA_ID (la cuenta, para las plantillas).
"""
import logging
import os

import requests

from app.automatizaciones.transporte import ErrorDeEnvio

API = 'https://graph.facebook.com/v24.0'
PREFIJO = 'wa:'
logger = logging.getLogger(__name__)

# Códigos de Meta que significan «fuera de la ventana de 24 h»: hace falta una plantilla.
VENTANA_CERRADA = {131047, 131026}


def es_whatsapp(igsid):
    return bool(igsid) and igsid.startswith(PREFIJO)


def telefono_de(igsid):
    return igsid[len(PREFIJO):] if es_whatsapp(igsid) else None


def normalizar(telefono):
    """Solo dígitos, con código de país. None si no parece un número."""
    digitos = ''.join(c for c in str(telefono or '') if c.isdigit())
    if digitos.startswith('00'):
        digitos = digitos[2:]
    return digitos if 8 <= len(digitos) <= 15 else None


def variantes(telefono):
    """El número y su otra forma: un celular de Argentina se escribe 54… o 549… y uno de México 52… o 521…;
    WhatsApp responde desde la forma con 9 (o 1) aunque se le haya mandado a la otra."""
    t = telefono or ''
    salida = {t}
    for pais, extra, largo in (('54', '9', 12), ('52', '1', 12)):
        if t.startswith(pais + extra) and len(t) == largo + 1:
            salida.add(pais + t[len(pais) + 1:])
        elif t.startswith(pais) and len(t) == largo:
            salida.add(pais + extra + t[len(pais):])
    return salida


def configurado():
    return bool(os.environ.get('WA_ACCESS_TOKEN') and os.environ.get('WA_PHONE_NUMBER_ID'))


class ClienteWhatsapp:
    def __init__(self, token=None, phone_number_id=None, waba_id=None, sesion=None):
        self.token = token or os.environ.get('WA_ACCESS_TOKEN')
        self.phone_number_id = phone_number_id or os.environ.get('WA_PHONE_NUMBER_ID')
        self.waba_id = waba_id or os.environ.get('WA_WABA_ID')
        self.sesion = sesion or requests

    def texto(self, telefono, texto):
        return self.mandar(telefono, {'type': 'text', 'text': {'body': texto, 'preview_url': True}})

    def audio(self, telefono, url):
        return self.mandar(telefono, {'type': 'audio', 'audio': {'link': url}})

    def plantilla(self, telefono, nombre, idioma, parametros=None):
        plantilla = {'name': nombre, 'language': {'code': idioma}}
        if parametros:
            plantilla['components'] = [{'type': 'body', 'parameters': [
                {'type': 'text', 'text': str(p)} for p in parametros]}]
        return self.mandar(telefono, {'type': 'template', 'template': plantilla})

    def plantillas(self):
        """Las plantillas de la cuenta: [{name, status, category, language, components, rejected_reason}]."""
        datos = self._pedir('get', f'{self.waba_id}/message_templates',
                            params={'fields': 'name,status,category,language,components,rejected_reason', 'limit': 200})
        return datos.get('data') or []

    def crear_plantilla(self, nombre, idioma, categoria, componentes):
        return self._pedir('post', f'{self.waba_id}/message_templates', json={
            'name': nombre, 'language': idioma, 'category': categoria, 'components': componentes})

    def borrar_plantilla(self, nombre):
        return self._pedir('delete', f'{self.waba_id}/message_templates', params={'name': nombre})

    def mandar(self, telefono, cuerpo):
        datos = self._pedir('post', f'{self.phone_number_id}/messages',
                            json={'messaging_product': 'whatsapp', 'to': telefono, **cuerpo})
        return ((datos.get('messages') or [{}])[0]).get('id')

    def _pedir(self, metodo, ruta, **kwargs):
        if not self.token:
            raise ErrorDeEnvio('Falta WA_ACCESS_TOKEN')
        try:
            respuesta = getattr(self.sesion, metodo)(f'{API}/{ruta}', timeout=20,
                                                     headers={'Authorization': f'Bearer {self.token}'}, **kwargs)
            datos = respuesta.json() if respuesta.content else {}
        except (requests.RequestException, ValueError) as error:
            logger.error(f'[WHATSAPP] {metodo.upper()} {ruta}: {error}')
            raise ErrorDeEnvio(str(error))
        if respuesta.status_code >= 400 or 'error' in datos:
            error = datos.get('error') or {}
            detalle = (error.get('error_data') or {}).get('details')
            mensaje = ' · '.join(x for x in (error.get('message') or f'HTTP {respuesta.status_code}', detalle) if x)
            logger.error(f'[WHATSAPP] {metodo.upper()} {ruta}: {mensaje}')
            raise ErrorDeEnvio(mensaje, ventana_cerrada=error.get('code') in VENTANA_CERRADA)
        return datos
