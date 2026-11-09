"""El correo saliente de la plataforma por la API de Gmail (ADR-W123): reemplaza al Gmail de n8n.

Una cuenta de Google (team@) conectada solo con permiso de enviar (`gmail.send`), en una autorización aparte
(app/services/google_aparte.py, clave 'correo'). Sin contraseñas ni verificación en dos pasos. La Academia
manda sus mails por POST /api/external/academy/correo con el mensaje MIME entero.
"""
import base64

from googleapiclient.discovery import build

from app.services.google_aparte import CORREO, SinConexion

SinCorreo = SinConexion
MAXIMO_BYTES = 20 * 1024 * 1024  # Gmail acepta hasta 25 MB por mensaje

estado = CORREO.estado
link_para_conectar = CORREO.link_para_conectar


def enviar_mime(mime):
    """Manda el mensaje MIME (bytes) tal cual. Gmail pone como remitente la cuenta conectada si el From es
    otro. Devuelve el id del mensaje en Gmail. Levanta SinCorreo o el error de Google."""
    if not mime or len(mime) > MAXIMO_BYTES:
        raise ValueError('El mensaje está vacío o pesa más de 20 MB.')
    servicio = build('gmail', 'v1', credentials=CORREO.credenciales(), cache_discovery=False)
    raw = base64.urlsafe_b64encode(mime).decode('ascii')
    r = servicio.users().messages().send(userId='me', body={'raw': raw}).execute()
    return r.get('id')
