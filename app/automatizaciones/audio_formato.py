"""El audio que sube el equipo, en un formato que Instagram y WhatsApp reproduzcan (25/11/2026).

Las notas de voz de WhatsApp son ogg/opus y lo grabado en el navegador es webm: Instagram no los reproduce.
En vez de rechazarlos, se pasan a mp3 con ffmpeg. Lo que ya sirve (mp3, m4a, aac, wav) queda como vino.
"""
import logging
import os
import subprocess

logger = logging.getLogger(__name__)

SIRVEN = ('audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/wav', 'audio/x-wav')
# El navegador a veces no sabe el tipo (un .opus llega como octet-stream): manda la extensión.
POR_EXTENSION = {'.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
                 '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.webm': 'audio/webm'}
SEGUNDOS_MAX = 60


class AudioInvalido(ValueError):
    pass


def tipo_de(mimetype, nombre_archivo):
    """El tipo del archivo, o None si no es un audio."""
    tipo = (mimetype or '').split(';')[0].strip().lower()
    if tipo.startswith('audio/') or tipo == 'video/webm':
        return tipo
    return POR_EXTENSION.get(os.path.splitext(nombre_archivo or '')[1].lower())


def reproducible(datos, tipo):
    """(datos, tipo) listos para mandar: si Instagram no lo reproduce, convertido a mp3."""
    if tipo in SIRVEN:
        return datos, 'audio/mp4' if tipo == 'audio/m4a' else tipo
    try:
        salida = subprocess.run(
            ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-ac', '1',
             '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', 'pipe:1'],
            input=datos, capture_output=True, timeout=SEGUNDOS_MAX, check=False)
    except FileNotFoundError:
        logger.error('[AUDIO] ffmpeg no está instalado')
        raise AudioInvalido('No se pudo convertir el audio: subilo en mp3 o m4a')
    except subprocess.TimeoutExpired:
        raise AudioInvalido('El audio tardó demasiado en convertirse')
    if salida.returncode != 0 or not salida.stdout:
        logger.error(f'[AUDIO] ffmpeg falló ({tipo}): {salida.stderr.decode(errors="ignore")[:300]}')
        raise AudioInvalido('No se pudo leer el audio: probá subirlo en mp3 o m4a')
    return salida.stdout, 'audio/mpeg'
