"""Los archivos de los comprobantes, en el volumen de Railway (no en la base).

La carpeta es COMPROBANTES_DIR o, si no está, `comprobantes/` al lado de AGENDAS_VIDEOS_DIR (el mismo
volumen). Cada archivo se guarda con su sha256 como nombre: el mismo archivo subido dos veces es uno solo,
y el hash sirve para detectar un comprobante reusado en otro pago.
"""
import hashlib
import os
import re
from datetime import datetime

TIPOS = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'application/pdf': 'pdf', 'text/csv': 'csv', 'text/plain': 'txt',
}
EXTENSIONES = {'jpeg': 'image/jpeg', **{ext: tipo for tipo, ext in TIPOS.items()}}
TAMANO_MAX = 15 * 1024 * 1024
RE_HASH = re.compile(r'[0-9a-f]{64}')


class ComprobanteError(Exception):
    """code: 'sin_volumen' | 'invalido' | 'no_existe'."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def directorio():
    d = (os.environ.get('COMPROBANTES_DIR') or '').strip()
    if not d:
        videos = (os.environ.get('AGENDAS_VIDEOS_DIR') or '').strip().rstrip('/\\')
        if not videos:
            raise ComprobanteError('sin_volumen', 'Falta configurar el volumen de comprobantes (COMPROBANTES_DIR).')
        d = os.path.join(os.path.dirname(videos), 'comprobantes')
    os.makedirs(d, exist_ok=True)
    return d


def tipo_de(nombre, tipo):
    """El tipo MIME admitido del archivo, por lo que dice el navegador o, si no, por la extensión."""
    tipo = (tipo or '').split(';')[0].strip().lower()
    if tipo in TIPOS:
        return tipo
    ext = (nombre or '').rsplit('.', 1)[-1].lower() if '.' in (nombre or '') else ''
    if ext in EXTENSIONES:
        return EXTENSIONES[ext]
    raise ComprobanteError('invalido', 'El comprobante tiene que ser una imagen, un PDF o un CSV.')


def guardar(datos, nombre, tipo, usuario):
    """Guarda el archivo y devuelve su entrada para `transaction_evidence` (sin la lectura todavía)."""
    if not datos:
        raise ComprobanteError('invalido', 'El archivo está vacío.')
    if len(datos) > TAMANO_MAX:
        raise ComprobanteError('invalido', 'El comprobante no puede pasar de 15 MB.')
    tipo = tipo_de(nombre, tipo)
    sha = hashlib.sha256(datos).hexdigest()
    ruta = os.path.join(directorio(), f'{sha}.{TIPOS[tipo]}')
    if not os.path.exists(ruta):
        with open(ruta, 'wb') as f:
            f.write(datos)
    return {
        'id': sha, 'nombre': (nombre or f'comprobante.{TIPOS[tipo]}')[:200], 'tipo': tipo,
        'tamano': len(datos), 'subido': datetime.utcnow().isoformat(timespec='seconds'),
        'subido_por': getattr(usuario, 'email', None),
    }


def ruta_de(entrada):
    """La ruta en el volumen de una entrada de `transaction_evidence`."""
    sha, tipo = entrada.get('id') or '', entrada.get('tipo')
    if not RE_HASH.fullmatch(sha) or tipo not in TIPOS:
        raise ComprobanteError('no_existe', 'Ese comprobante no existe.')
    ruta = os.path.join(directorio(), f'{sha}.{TIPOS[tipo]}')
    if not os.path.exists(ruta):
        raise ComprobanteError('no_existe', 'El archivo del comprobante no está en el volumen.')
    return ruta


def leer(entrada):
    with open(ruta_de(entrada), 'rb') as f:
        return f.read()
