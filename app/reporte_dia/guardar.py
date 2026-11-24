"""`PUT /api/reporte/dia`: guarda lo que la persona escribió, recalcula el estado y los números del rol.

Editar un día ya cerrado recalcula su estado y su fila del rol, pero no vuelve a mandar Discord.
"""
import json
import logging
from datetime import datetime

from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.reporte_dia.comun import TIPOS_VICTORIA, cierre_o_nuevo, datos, num, victoria_de
from app.reporte_dia.dia import calcular, modulo
from app.reporte_dia.estado import status_guardado

logger = logging.getLogger(__name__)

MAX_TEXTO = 4000


class EntradaInvalida(ValueError):
    pass


def _texto(v):
    if v is None:
        return ''
    if not isinstance(v, str):
        raise EntradaInvalida('Se esperaba texto.')
    return v.strip()[:MAX_TEXTO]


def _persona(p):
    if not isinstance(p, dict) or not (p.get('nombre') or '').strip():
        return None
    return {'id': str(p.get('id') or '')[:80], 'nombre': _texto(p.get('nombre'))[:200],
            'detalle': _texto(p.get('detalle'))[:200]}


def _victoria(nueva, anterior):
    if not isinstance(nueva, dict):
        raise EntradaInvalida('La victoria tiene que ser un objeto.')
    v = dict(anterior)
    if 'tipo' in nueva:
        if nueva['tipo'] not in TIPOS_VICTORIA:
            raise EntradaInvalida("Tipo de victoria inválido: 'persona' o 'sin_gente'.")
        v['tipo'] = nueva['tipo']
    if 'persona' in nueva:
        v['persona'] = _persona(nueva['persona'])
    for k in ('que', 'por', 'prueba_url', 'motivo'):
        if k in nueva:
            v[k] = _texto(nueva[k])
    if 'mas' in nueva:
        mas = nueva['mas'] if isinstance(nueva['mas'], list) else []
        v['mas'] = [{'persona': _persona(x.get('persona')), 'que': _texto(x.get('que'))}
                    for x in mas[:10] if isinstance(x, dict)]
    return v


def _bug_de_plataforma(autor, user, dia, texto):
    """La traba de la plataforma entra como reporte de bug, igual que desde el BugReportWidget."""
    from app.models import BugReport
    try:
        db.session.add(BugReport(
            user_id=autor.id, user_role=autor.role, report_type='bug', problem=texto,
            description=texto, route='/reporte',
            technical_context=json.dumps({'origen': 'reporte_dia', 'fecha': dia.isoformat(), 'usuario': user.id}),
        ))
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"[reporte] no se pudo crear el bug de plataforma de {user.id}: {e}")


def guardar(user, rol, dia, body, autor):
    """Aplica el body parcial al día y devuelve el `calc` (para armar la respuesta sin recalcular)."""
    m = modulo(rol)
    close = cierre_o_nuevo(user, dia, rol, m)
    d = datos(close)
    bug = None
    if 'victoria' in body:
        close.victory = _victoria(body['victoria'] or {}, victoria_de(close))
    if 'manana' in body:
        manana = body['manana'] if isinstance(body['manana'], dict) else {}
        if 'mejor' in manana:
            close.tomorrow = _texto(manana['mejor'])
        if 'traba' in manana:
            traba = _texto(manana['traba'])
            if traba and traba != (close.platform_issue or '').strip():
                bug = traba
            close.platform_issue = traba
        if 'flujo' in manana:
            close.workflow = _texto(manana['flujo'])
    if 'no_laborable' in body:
        close.is_non_working_day = bool(body['no_laborable'])
    if isinstance(body.get('mano'), dict):
        claves = {c for c, _, _ in m.MANO}
        for clave, v in body['mano'].items():
            if clave in claves:
                d['mano'][clave] = num(v)
                d['mano_meta'][clave] = {'por': autor.username, 'en': datetime.utcnow().isoformat() + 'Z'}
    if isinstance(body.get('correcciones'), dict):
        for clave, v in body['correcciones'].items():
            if clave not in m.CORREGIBLES:
                continue
            if num(v) is None:
                d['correcciones'].pop(clave, None)
            else:
                d['correcciones'][clave] = num(v)
    close.data = d
    flag_modified(close, 'data')
    close.updated_at = datetime.utcnow()

    calc = calcular(user, dia, rol, close, recalcular=True)
    close.status = status_guardado(close, calc['faltan'])
    m.persistir(user, dia, close, calc['vals'])
    db.session.commit()
    if bug:
        _bug_de_plataforma(autor, user, dia, bug)
    return calc
