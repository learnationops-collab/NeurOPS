"""El almacén de documentos de Learnation Marketing, con la semántica de la capacidad `db` del artifact.

- Una ruta de documento tiene un número par de segmentos: `coleccion/doc` (o `a/b/c/d`).
- `set` reemplaza el documento entero; `update` lo fusiona (los objetos anidados se fusionan; listas y demás
  reemplazan el campo) y falla con `invalid_argument` si el documento no existe; `delete` es idempotente.
- La «revisión» de una colección (`rev`) cambia con cualquier alta, cambio o baja: el puente de la página la
  usa para saber si hay algo nuevo sin bajar todo de nuevo (sus `onSnapshot`).
"""
import re
from datetime import datetime

from sqlalchemy import func

from app import db
from app.models import MarketingAppDoc

SEGMENTO = re.compile(r'^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$')


class ErrorDeAlmacen(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def _partes(ruta, par):
    partes = [p for p in str(ruta or '').split('/')]
    if not partes or not all(SEGMENTO.match(p) for p in partes) or (len(partes) % 2 == 0) != par:
        raise ErrorDeAlmacen('invalid_argument', f'Ruta inválida: {ruta}')
    return partes


def _doc_de(ruta):
    partes = _partes(ruta, par=True)
    return '/'.join(partes[:-1]), partes[-1]


def _fila(coleccion, doc_id):
    return MarketingAppDoc.query.filter_by(collection=coleccion, doc_id=doc_id).first()


def leer(ruta):
    coleccion, doc_id = _doc_de(ruta)
    f = _fila(coleccion, doc_id)
    return {'id': doc_id, 'exists': f is not None, 'data': f.data if f else None, 'version': f.version if f else 0}


def revision(coleccion):
    cuantos, ultimo, suma = db.session.query(
        func.count(MarketingAppDoc.id), func.max(MarketingAppDoc.updated_at), func.sum(MarketingAppDoc.version),
    ).filter(MarketingAppDoc.collection == coleccion).one()
    return f'{cuantos}:{suma or 0}:{ultimo.isoformat() if ultimo else ""}'


def listar(ruta):
    coleccion = '/'.join(_partes(ruta, par=False))
    filas = MarketingAppDoc.query.filter_by(collection=coleccion).order_by(MarketingAppDoc.doc_id).all()
    return {'rev': revision(coleccion), 'docs': [{'id': f.doc_id, 'data': f.data, 'version': f.version} for f in filas]}


def _fusionar(base, cambios):
    out = dict(base or {})
    for k, v in cambios.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _fusionar(out[k], v)
        else:
            out[k] = v
    return out


def _validar(data):
    if not isinstance(data, dict):
        raise ErrorDeAlmacen('invalid_argument', 'El documento tiene que ser un objeto.')


def guardar(ruta, data, user_id=None):
    _validar(data)
    coleccion, doc_id = _doc_de(ruta)
    f = _fila(coleccion, doc_id)
    if f is None:
        f = MarketingAppDoc(collection=coleccion, doc_id=doc_id, data=data, version=1)
        db.session.add(f)
    else:
        f.data = data
        f.version = (f.version or 0) + 1
    f.updated_at = datetime.utcnow()
    f.updated_by = user_id
    db.session.commit()
    return f.version


def actualizar(ruta, cambios, user_id=None):
    _validar(cambios)
    coleccion, doc_id = _doc_de(ruta)
    f = _fila(coleccion, doc_id)
    if f is None:
        raise ErrorDeAlmacen('invalid_argument', 'El documento no existe.')
    f.data = _fusionar(f.data, cambios)
    f.version = (f.version or 0) + 1
    f.updated_at = datetime.utcnow()
    f.updated_by = user_id
    db.session.commit()
    return f.version


def borrar(ruta):
    coleccion, doc_id = _doc_de(ruta)
    f = _fila(coleccion, doc_id)
    if f is not None:
        db.session.delete(f)
        db.session.commit()
