"""Videos de las páginas de gracias: archivos en el volumen de Railway, no en la base.

La carpeta sale de AGENDAS_VIDEOS_DIR (el punto de montaje del volumen, p. ej. /data/videos). Sin esa
variable no se puede subir nada y los links de Loom/YouTube siguen funcionando.

## Subida por partes

Un video pesa cientos de MB y gunicorn corta a los 120 s, así que no se sube de una vez:
  1. `crear(nombre, tamano, tipo)` reserva un id y deja `<id>.part` vacío y `<id>.json` con los datos.
  2. `recibir(id, desde, datos)` agrega una parte de hasta PARTE_MAX bytes. `desde` tiene que ser lo
     que ya está guardado: si no coincide (una parte repetida o perdida) se rechaza con lo recibido,
     y el navegador sigue desde ahí. Así también se retoma una subida cortada.
  3. Con la última parte, `<id>.part` pasa a `<id>.<ext>` y el video queda listo.

## Servirlo

`parte_para_servir` devuelve como mucho SERVIR_MAX bytes por pedido. El servidor tiene un worker
sincrónico: mandar el video entero lo dejaría tomado mientras el lead mira. El navegador pide los
rangos de a uno y sigue pidiendo solo.
"""

import json
import os
import re
import secrets

TIPOS = {'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov'}
TAMANO_MAX = 500 * 1024 * 1024
PARTE_MAX = 8 * 1024 * 1024
SERVIR_MAX = 1024 * 1024
RE_ID = re.compile(r'v[a-z0-9]{20}')


class VideoError(Exception):
    """code: 'sin_volumen' | 'invalido' | 'no_existe' | 'desfasado' (con `recibido`)."""

    def __init__(self, code, message, recibido=None):
        super().__init__(message)
        self.code = code
        self.recibido = recibido


def directorio():
    """La carpeta de los videos, creada si hace falta, o None si no hay volumen configurado."""
    d = (os.environ.get('AGENDAS_VIDEOS_DIR') or '').strip()
    if not d:
        return None
    os.makedirs(d, exist_ok=True)
    return d


def _dir():
    d = directorio()
    if not d:
        raise VideoError('sin_volumen', 'Falta configurar el volumen de videos (AGENDAS_VIDEOS_DIR).')
    return d


def _ruta(video_id, ext):
    if not RE_ID.fullmatch(video_id or ''):
        raise VideoError('no_existe', 'Ese video no existe.')
    return os.path.join(_dir(), video_id + '.' + ext)


def _guardar_meta(meta):
    with open(_ruta(meta['id'], 'json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f)


def meta(video_id):
    """{id, nombre, tipo, tamano, recibido, listo}. VideoError('no_existe') si no está."""
    try:
        with open(_ruta(video_id, 'json'), encoding='utf-8') as f:
            m = json.load(f)
    except FileNotFoundError:
        raise VideoError('no_existe', 'Ese video no existe.') from None
    if m.get('listo'):
        m['recibido'] = m['tamano']
    else:
        try:
            m['recibido'] = os.path.getsize(_ruta(video_id, 'part'))
        except FileNotFoundError:
            m['recibido'] = 0
    return m


def crear(nombre, tamano, tipo):
    d = _dir()  # antes de validar: sin volumen no tiene sentido seguir
    if tipo not in TIPOS:
        raise VideoError('invalido', 'Subí un video MP4, WebM o MOV.')
    if not isinstance(tamano, int) or isinstance(tamano, bool) or not 0 < tamano <= TAMANO_MAX:
        raise VideoError('invalido', 'El video puede pesar hasta 500 MB.')
    video_id = 'v' + ''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789') for _ in range(20))
    m = {'id': video_id, 'nombre': str(nombre or '')[:120], 'tipo': tipo, 'tamano': tamano, 'listo': False}
    open(os.path.join(d, video_id + '.part'), 'wb').close()
    _guardar_meta(m)
    return {**m, 'recibido': 0}


def recibir(video_id, desde, datos):
    """Agrega `datos` en la posición `desde`. Devuelve la meta al día."""
    m = meta(video_id)
    if m['listo']:
        return m
    if desde != m['recibido']:
        raise VideoError('desfasado', 'La subida se desfasó.', recibido=m['recibido'])
    if not datos or len(datos) > PARTE_MAX or desde + len(datos) > m['tamano']:
        raise VideoError('invalido', 'Parte inválida.')
    with open(_ruta(video_id, 'part'), 'ab') as f:
        f.write(datos)
    recibido = desde + len(datos)
    if recibido == m['tamano']:
        os.replace(_ruta(video_id, 'part'), _ruta(video_id, TIPOS[m['tipo']]))
        m['listo'] = True
        _guardar_meta({k: v for k, v in m.items() if k != 'recibido'})
    return {**m, 'recibido': recibido}


def borrar(video_id):
    for ext in ('part', 'json', *TIPOS.values()):
        try:
            os.remove(_ruta(video_id, ext))
        except FileNotFoundError:
            pass


def _rango(cabecera, total):
    """(inicio, fin inclusive) del header Range `bytes=a-b`, o None si no hay o no se entiende."""
    m = re.fullmatch(r'bytes=(\d*)-(\d*)', (cabecera or '').strip())
    if not m or (not m.group(1) and not m.group(2)):
        return None
    if m.group(1):
        inicio = int(m.group(1))
        fin = int(m.group(2)) if m.group(2) else total - 1
    else:  # sufijo: los últimos N bytes
        inicio, fin = max(0, total - int(m.group(2))), total - 1
    if inicio >= total or fin < inicio:
        raise VideoError('invalido', 'Rango fuera del archivo.')
    return inicio, min(fin, total - 1)


def parte_para_servir(video_id, cabecera_rango):
    """(bytes, inicio, fin, total, tipo) de un video listo, como mucho SERVIR_MAX bytes desde el inicio
    pedido (0 si no pidió rango)."""
    m = meta(video_id)
    if not m['listo']:
        raise VideoError('no_existe', 'Ese video no existe.')
    total = m['tamano']
    rango = _rango(cabecera_rango, total)
    inicio, fin = rango if rango else (0, total - 1)
    fin = min(fin, inicio + SERVIR_MAX - 1)
    with open(_ruta(video_id, TIPOS[m['tipo']]), 'rb') as f:
        f.seek(inicio)
        datos = f.read(fin - inicio + 1)
    return datos, inicio, fin, total, m['tipo']
