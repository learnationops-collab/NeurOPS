import os
import logging
import requests

logger = logging.getLogger(__name__)


class WhatchimpService:
    """Envía recordatorios de seguimiento a los closers por WhatsApp vía Whatchimp (plantilla
    ya aprobada, id 421566). El número de negocio (phone_number_id) y la plantilla son fijos
    para este template — solo cambian las variables por mensaje."""

    BASE_URL = "https://app.whatchimp.com/api/v1/whatsapp/send/template"
    PHONE_NUMBER_ID = "1250095971516745"
    TEMPLATE_ID = "421566"

    TIPO_SEGUIMIENTO_LABELS = {
        'no_tomada': 'Llamada sin tomar',
        'tomada': 'Llamada tomada',
        'cerrada': 'Llamada cerrada',
    }

    @staticmethod
    def normalize_phone(phone):
        """Deja solo dígitos — formato que Whatchimp espera y que arma un link directo al chat
        de WhatsApp (sin '+', sin espacios ni guiones)."""
        if not phone:
            return ""
        return "".join(filter(str.isdigit, str(phone)))

    @staticmethod
    def send_followup_reminder(closer_name, tipo_key, lead_name, lead_phone, closer_phone):
        """Envía UN recordatorio de seguimiento pendiente al WhatsApp del closer. Lanza excepción
        si falta la API key, el closer no tiene número configurado, o Whatchimp responde error —
        el caller decide cómo tratar cada fallo individual sin frenar al resto del lote."""
        api_key = os.environ.get('WHATCHIMP_API_KEY')
        if not api_key:
            raise Exception("WHATCHIMP_API_KEY no está configurada en las variables de entorno")

        closer_phone_norm = WhatchimpService.normalize_phone(closer_phone)
        if not closer_phone_norm:
            raise Exception("El closer no tiene número de WhatsApp configurado")

        payload = {
            "apiToken": api_key,
            "phone_number_id": WhatchimpService.PHONE_NUMBER_ID,
            "template_id": WhatchimpService.TEMPLATE_ID,
            "templateVariable-closer-1": closer_name or "Closer",
            "templateVariable-followUpType-2": WhatchimpService.TIPO_SEGUIMIENTO_LABELS.get(tipo_key, tipo_key or ""),
            "templateVariable-name-3": lead_name or "Sin Nombre",
            "templateVariable-telefono-4": WhatchimpService.normalize_phone(lead_phone),
            "phone_number": closer_phone_norm,
        }

        response = requests.post(WhatchimpService.BASE_URL, data=payload, timeout=15)
        response.raise_for_status()
        try:
            return response.json()
        except ValueError:
            return {"status": "ok", "raw": response.text}
