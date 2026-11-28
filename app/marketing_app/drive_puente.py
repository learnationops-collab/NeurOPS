"""El conector «Google Drive» de Learnation Marketing, atendido por Work (ADR-W280).

Usa la cuenta conectada en la autorización `drive_marketing` (app/services/google_aparte.py) y contesta con la
forma del conector de claude.ai: archivos con `id`, `title`, `mimeType`, `parentId`, `capabilities`,
`fileExtension`, `viewUrl`…; `search_files` con `{files, nextPageToken}`. Las consultas vienen con la sintaxis
del conector (`title`, `parentId = '…'`) y se traducen a la de la API de Drive (`name`, `'…' in parents`).
"""
import re

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.marketing_app.meta_graph import ErrorDeTool
from app.services.google_aparte import DRIVE_MARKETING, SinConexion

CAMPOS = ('id,name,mimeType,parents,createdTime,modifiedTime,trashed,webViewLink,fileExtension,size,driveId,'
          'starred,readOnly,capabilities(canAddChildren,canEdit,canMoveItemWithinDrive,canTrash)')
TODOS = {'supportsAllDrives': True}


def _servicio():
    try:
        creds = DRIVE_MARKETING.credenciales()
    except SinConexion as e:
        from flask import request
        try:
            link = DRIVE_MARKETING.link_para_conectar(request.host_url)
        except Exception:  # noqa: BLE001  (sin pedido no hay link; el mensaje igual sirve)
            link = ''
        raise ErrorDeTool(f'{e} Conectalo con la cuenta de Google que tiene las carpetas'
                          + (f': {link}' if link else ' (Operaciones › Integraciones).')) from e
    return build('drive', 'v3', credentials=creds, cache_discovery=False)


def _archivo(f):
    out = {
        'id': f.get('id'), 'title': f.get('name'), 'mimeType': f.get('mimeType'),
        'parentId': (f.get('parents') or [None])[0], 'createdTime': f.get('createdTime'),
        'modifiedTime': f.get('modifiedTime'), 'trashed': bool(f.get('trashed')), 'starred': bool(f.get('starred')),
        'readOnly': bool(f.get('readOnly')), 'viewUrl': f.get('webViewLink'),
        'resourceUri': f'googledrive://file/{f.get("id")}', 'capabilities': f.get('capabilities') or {},
    }
    for k, d in (('fileExtension', 'fileExtension'), ('size', 'fileSize'), ('driveId', 'sharedDriveId')):
        if f.get(k) is not None:
            out[d] = f[k]
    return out


def _ejecutar(pedido):
    try:
        return pedido.execute()
    except HttpError as e:
        status = getattr(e.resp, 'status', 0)
        raise ErrorDeTool(f'Drive respondió {status}: {e.reason or e}'[:600],
                          code='server_unavailable' if status >= 500 else 'tool_error',
                          retryable=status >= 500 or status == 429) from e


_CAMPO = re.compile(r"\bparentId\s*(=|!=)\s*'((?:[^'\\]|\\.)*)'")


def traducir(q):
    """De la sintaxis del conector a la de Drive v3."""
    q = str(q or '').strip()
    q = _CAMPO.sub(lambda m: (f"'{m.group(2)}' in parents" if m.group(1) == '=' else f"not '{m.group(2)}' in parents"), q)
    q = re.sub(r"\btitle(\s*(?:!=|=|contains)\s*')", r'name\1', q)
    q = re.sub(r"\bowner\s*=\s*'([^']*)'", r"'\1' in owners", q)
    q = re.sub(r"\bcreator\s*=\s*'([^']*)'", r"'\1' in owners", q)
    if not re.search(r'\btrashed\b', q):
        q = f'({q}) and trashed = false' if q else 'trashed = false'
    return q


def buscar(inp):
    pedido = _servicio().files().list(
        q=traducir(inp.get('query')), pageSize=min(int(inp.get('pageSize') or 50), 1000),
        pageToken=inp.get('pageToken') or None, fields=f'nextPageToken,files({CAMPOS})',
        includeItemsFromAllDrives=True, corpora='allDrives', orderBy=inp.get('orderBy') or None, **TODOS)
    r = _ejecutar(pedido)
    out = {'files': [_archivo(f) for f in r.get('files', [])]}
    if r.get('nextPageToken'):
        out['nextPageToken'] = r['nextPageToken']
    return out


def metadatos(inp):
    if not inp.get('fileId'):
        raise ErrorDeTool('Falta fileId.', code='invalid_argument')
    return _archivo(_ejecutar(_servicio().files().get(fileId=inp['fileId'], fields=CAMPOS, **TODOS)))


def crear(inp):
    if not inp.get('title'):
        raise ErrorDeTool('Falta title.', code='invalid_argument')
    cuerpo = {'name': inp['title'], 'mimeType': inp.get('contentMimeType') or inp.get('mimeType')}
    if inp.get('parentId'):
        cuerpo['parents'] = [inp['parentId']]
    if inp.get('textContent') or inp.get('base64Content'):
        raise ErrorDeTool('Subir contenido a Drive no está en la página.', code='invalid_argument')
    return _archivo(_ejecutar(_servicio().files().create(body={k: v for k, v in cuerpo.items() if v},
                                                          fields=CAMPOS, **TODOS)))


def copiar(inp):
    if not inp.get('fileId'):
        raise ErrorDeTool('Falta fileId.', code='invalid_argument')
    cuerpo = {}
    if inp.get('title'):
        cuerpo['name'] = inp['title']
    if inp.get('parentId'):
        cuerpo['parents'] = [inp['parentId']]
    return _archivo(_ejecutar(_servicio().files().copy(fileId=inp['fileId'], body=cuerpo, fields=CAMPOS, **TODOS)))


def actualizar(inp):
    fid = inp.get('fileId')
    if not fid:
        raise ErrorDeTool('Falta fileId.', code='invalid_argument')
    svc = _servicio()
    cuerpo = {}
    if inp.get('title'):
        cuerpo['name'] = inp['title']
    for k in ('description', 'starred', 'folderColorRgb'):
        if k in inp:
            cuerpo[k] = inp[k]
    extra = {}
    if inp.get('parentId'):
        actual = _ejecutar(svc.files().get(fileId=fid, fields='parents', **TODOS))
        extra = {'addParents': inp['parentId'], 'removeParents': ','.join(actual.get('parents') or []) or None}
    return _archivo(_ejecutar(svc.files().update(fileId=fid, body=cuerpo, fields=CAMPOS, **extra, **TODOS)))
