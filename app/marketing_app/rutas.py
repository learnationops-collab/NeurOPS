"""Las rutas de Learnation Marketing en Work (ADR-W280). Todas piden la sesión de Work y la lista de
`acceso.py`; las que escriben, además, el CSRF de siempre (lo manda el puente de la página).

GET  /api/marketing-app/pagina          la página del artifact con su puente (va en el iframe de /ops/dashboard)
GET|PUT|PATCH|DELETE /api/marketing-app/db/doc   un documento (`?path=` o `{path, data}`)
GET  /api/marketing-app/db/col          una colección (`?path=&rev=`: si no cambió, `{unchanged: true}`)
POST|GET /api/marketing-app/assets      subir / listar archivos;  DELETE /api/marketing-app/assets/<id>
GET  /_blob/<id>                        un archivo subido, en la misma dirección que en el artifact
POST /api/marketing-app/claude          una vuelta de Learnito
POST /api/marketing-app/mcp             una herramienta de un conector (Meta, Drive, Work)
"""
import logging
import os
import secrets

from flask import Blueprint, Response, jsonify, request
from flask_login import current_user

from app import db
from app.marketing_app import almacen, claude_puente, conectores
from app.marketing_app.acceso import requiere_acceso
from app.marketing_app.meta_graph import ErrorDeTool
from app.models import MarketingAppAsset

logger = logging.getLogger(__name__)

bp = Blueprint('marketing_app', __name__, url_prefix='/api/marketing-app')
blobs = Blueprint('marketing_app_blobs', __name__)

AQUI = os.path.dirname(__file__)
MAX_ARCHIVO = 20 * 1024 * 1024
TIPOS = ('image/', 'video/', 'application/pdf', 'font/', 'text/csv', 'text/markdown', 'text/plain',
         'application/json', 'text/css', 'application/javascript', 'text/javascript')
_PAGINA = None


def _error(code, message, status=400, retryable=False):
    return jsonify({'code': code, 'message': message, 'retryable': retryable}), status


def _pagina():
    global _PAGINA
    if _PAGINA is None:
        with open(os.path.join(AQUI, 'pagina.html'), encoding='utf-8') as f:
            html = f.read()
        with open(os.path.join(AQUI, 'puente.js'), encoding='utf-8') as f:
            puente = f.read()
        marca = '<body>'
        i = html.index(marca) + len(marca)
        _PAGINA = html[:i] + '<script>' + puente.replace('</script', '<\\/script') + '</script>' + html[i:]
    return _PAGINA


@bp.route('/pagina', methods=['GET'])
@requiere_acceso
def pagina():
    return Response(_pagina(), mimetype='text/plain', headers={'Cache-Control': 'no-store'})


# --- Documentos -----------------------------------------------------------------------------------

@bp.route('/db/doc', methods=['GET', 'PUT', 'PATCH', 'DELETE'])
@requiere_acceso
def documento():
    try:
        if request.method in ('GET', 'DELETE'):
            ruta = request.args.get('path', '')
            if request.method == 'GET':
                return jsonify(almacen.leer(ruta))
            almacen.borrar(ruta)
            return jsonify({'ok': True})
        cuerpo = request.get_json(silent=True) or {}
        ruta, data = cuerpo.get('path', ''), cuerpo.get('data')
        if request.method == 'PUT':
            version = almacen.guardar(ruta, data, current_user.id)
        else:
            version = almacen.actualizar(ruta, data, current_user.id)
        return jsonify({'ok': True, 'version': version})
    except almacen.ErrorDeAlmacen as e:
        db.session.rollback()
        return _error(e.code, e.message)


@bp.route('/db/col', methods=['GET'])
@requiere_acceso
def coleccion():
    try:
        ruta = request.args.get('path', '')
        rev = request.args.get('rev')
        if rev:
            actual = almacen.revision('/'.join(almacen._partes(ruta, par=False)))
            if actual == rev:
                return jsonify({'rev': actual, 'unchanged': True})
        return jsonify(almacen.listar(ruta))
    except almacen.ErrorDeAlmacen as e:
        return _error(e.code, e.message)


# --- Archivos -------------------------------------------------------------------------------------

def _asset(a):
    return {'id': a.id, 'url': f'/_blob/{a.id}', 'sizeBytes': a.size, 'contentType': a.content_type,
            'filename': a.filename, 'createdAt': a.created_at.isoformat() + 'Z'}


@bp.route('/assets', methods=['GET', 'POST'])
@requiere_acceso
def archivos():
    if request.method == 'GET':
        todos = MarketingAppAsset.query.with_entities(
            MarketingAppAsset.id, MarketingAppAsset.size, MarketingAppAsset.content_type,
            MarketingAppAsset.filename, MarketingAppAsset.created_at).order_by(MarketingAppAsset.created_at).all()
        return jsonify({'assets': [_asset(a) for a in todos], 'usage': {'bytes': sum(a.size for a in todos),
                                                                          'files': len(todos)}})
    f = request.files.get('file')
    if f is None:
        return _error('bad_request', 'Falta el archivo.')
    datos = f.read()
    tipo = (f.mimetype or 'application/octet-stream').lower()
    if not datos:
        return _error('bad_request', 'El archivo está vacío.')
    if len(datos) > MAX_ARCHIVO:
        return _error('too_large', 'El archivo pasa de 20 MB.', 413)
    if not tipo.startswith(TIPOS):
        return _error('unsupported_type', f'Tipo de archivo no admitido: {tipo}.', 415)
    a = MarketingAppAsset(id=secrets.token_hex(16), content_type=tipo, filename=(f.filename or '')[:255] or None,
                          size=len(datos), data=datos, created_by=current_user.id)
    db.session.add(a)
    db.session.commit()
    return jsonify(_asset(a))


@bp.route('/assets/<asset_id>', methods=['DELETE'])
@requiere_acceso
def borrar_archivo(asset_id):
    a = db.session.get(MarketingAppAsset, asset_id)
    if a is not None:
        db.session.delete(a)
        db.session.commit()
    return jsonify({'ok': True})


@blobs.route('/_blob/<asset_id>', methods=['GET'])
@requiere_acceso
def blob(asset_id):
    a = db.session.get(MarketingAppAsset, asset_id)
    if a is None:
        return _error('not_found', 'No existe.', 404)
    # Un SVG subido se sirve como imagen descargable, nunca como documento que corra scripts.
    headers = {'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
               'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"}
    return Response(a.data, mimetype=a.content_type, headers=headers)


# --- Learnito y conectores ------------------------------------------------------------------------

@bp.route('/claude', methods=['POST'])
@requiere_acceso
def claude():
    try:
        return jsonify(claude_puente.preguntar(current_user.id, request.get_json(silent=True) or {}))
    except claude_puente.ErrorDeLearnito as e:
        return _error(e.code, e.message, e.status if 400 <= e.status < 600 else 502, e.code == 'rate_limited')


@bp.route('/mcp', methods=['POST'])
@requiere_acceso
def mcp():
    cuerpo = request.get_json(silent=True) or {}
    servidor, herramienta = cuerpo.get('server'), cuerpo.get('tool')
    try:
        return jsonify({'payload': conectores.llamar(servidor, herramienta, cuerpo.get('input') or {})})
    except ErrorDeTool as e:
        db.session.rollback()
        logger.info(f'[MARKETING_APP] {servidor}/{herramienta}: {e.code} {e.message}')
        return _error(e.code, e.message, 502 if e.code in ('upstream_error', 'server_unavailable') else 400,
                      e.retryable)
    except ValueError as e:
        db.session.rollback()
        return _error('invalid_argument', str(e))
    except Exception as e:  # noqa: BLE001  (la página muestra el mensaje; el detalle queda en el log)
        db.session.rollback()
        logger.error(f'[MARKETING_APP] {servidor}/{herramienta} falló: {e}', exc_info=True)
        return _error('upstream_error', f'Work no pudo completar «{herramienta}»: {e}'[:600], 502)
