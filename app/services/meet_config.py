"""Deja una reunión de Meet con las notas de Gemini, la transcripción y la grabación automáticas (ADR-W128).

La reunión la crea Calendar (el evento con Meet de la Momentum, que organiza team@: agendas_v2/organizador.py).
Solo su organizador puede pre-configurarla: team@ conectada con `meetings.space.settings`, en una
autorización aparte (google_aparte.MEET). Con la API de Meet v2: `spaces.get` con el código de la reunión
(spaces/abc-defg-hij) da su nombre real, y `spaces.patch` prende los tres artefactos. Se generan cuando entra
alguien con permiso para tomarlos (una cuenta del Workspace); la nota queda en el Drive de team@.
"""
import logging
import re

from googleapiclient.discovery import build

from app.services.google_aparte import MEET, SinConexion

logger = logging.getLogger(__name__)

CODIGO = re.compile(r'meet\.google\.com/([a-z]{3}-[a-z]{4}-[a-z]{3})')
ARTEFACTOS = {
    'recordingConfig': 'autoRecordingGeneration',
    'transcriptionConfig': 'autoTranscriptionGeneration',
    'smartNotesConfig': 'autoSmartNotesGeneration',
}


def codigo_de(meet_link):
    m = CODIGO.search(meet_link or '')
    return m.group(1) if m else None


def activar_artefactos(meet_link):
    """True si la reunión quedó con notas, transcripción y grabación automáticas. Nunca lanza: la reunión ya
    está creada y sirve igual sin esto."""
    codigo = codigo_de(meet_link)
    if not codigo:
        return False
    try:
        meet = build('meet', 'v2', credentials=MEET.credenciales(), cache_discovery=False)
        espacio = meet.spaces().get(name=f'spaces/{codigo}').execute()
        cuerpo = {'config': {'artifactConfig': {grupo: {campo: 'ON'} for grupo, campo in ARTEFACTOS.items()}}}
        mascara = ','.join(f'config.artifactConfig.{grupo}.{campo}' for grupo, campo in ARTEFACTOS.items())
        meet.spaces().patch(name=espacio['name'], updateMask=mascara, body=cuerpo).execute()
        return True
    except SinConexion as e:
        logger.warning(f'[MEET] {e} La reunión {codigo} queda sin notas automáticas.')
    except Exception as e:  # noqa: BLE001
        logger.error(f'[MEET] No se pudo configurar la reunión {codigo}: {e}')
    return False
