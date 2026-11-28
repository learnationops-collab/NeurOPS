"""Los WhatsApp internos al equipo (aviso de agenda nueva y recordatorio de seguimiento) por la Cloud API propia,
con plantillas de utilidad (ADR-W289). Whatchimp queda de respaldo en `whatchimp_service`."""
from app.automatizaciones.transporte import ErrorDeEnvio
from app.whatsapp.cliente import ClienteWhatsapp, configurado, normalizar

AGENDA = 'aviso_agenda'
# La vieja la aprobó Meta como marketing; la nueva (texto de sistema) va como utilidad. Se usa la vieja hasta que
# la nueva esté aprobada.
SEGUIMIENTO = ('aviso_seguimiento', 'recordatorio_seguimiento')
IDIOMA = 'es'


def _limpio(valor):
    # Meta rechaza parámetros vacíos, con saltos de línea o tabulaciones.
    texto = ' '.join(str(valor if valor not in (None, '') else '-').split())
    return texto or '-'


def _mandar(numero, plantilla, valores):
    if not configurado():
        raise ErrorDeEnvio('La API propia de WhatsApp no está configurada')
    telefono = normalizar(numero)
    if not telefono:
        raise ErrorDeEnvio('No hay número de WhatsApp')
    return ClienteWhatsapp().plantilla(telefono, plantilla, IDIOMA, [_limpio(v) for v in valores])


def aviso_agenda(numero, closer, lead, telefono, instagram, dia, hora, grupo, fuente):
    return _mandar(numero, AGENDA, [closer, lead, telefono, instagram, dia, hora, grupo, fuente])


def recordatorio_seguimiento(numero, closer, tipo, lead, telefono):
    nueva, vieja = SEGUIMIENTO
    try:
        return _mandar(numero, nueva, [closer, tipo, lead, telefono])
    except ErrorDeEnvio:
        return _mandar(numero, vieja, [closer, tipo, lead, telefono])
