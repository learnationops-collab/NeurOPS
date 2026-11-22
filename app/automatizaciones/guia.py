"""La Guía del setting (ADR-W197): lo que el setter manda en cada fase, editable desde el Inbox.

Forma del contenido:
  {'quien': {'leads': [str], 'noleads': [str], 'excepcion': str},
   'etapas': {<fase>: {'nota': str, 'pasos': [paso]}}}     una entrada por fase de `fases.TODAS`
  paso: {'id', 't', 'atajo', 'uso': ''|'solo si'|'opcional'|'no se usa', 'cuando', 'nota', 'avanza',
         'porRespuesta', 'op': [{'x', 'si', 'audio', 'desde'}]}

Las fases (cuáles hay, su orden y en qué cuenta del reporte caen) siguen fijas en `fases.py`: cambiarlas es
una propuesta. «Quién es lead» también: el setter no la cambia al publicar.

Qué opción responde más: el chat manda la clave `fase:paso:opción` con el mensaje (`IgMensaje.guia`). Un
mensaje respondió si el lead escribió después, antes del próximo mensaje de la guía en esa conversación.
"""
import re
from collections import defaultdict
from datetime import timedelta

from app import db
from app.automatizaciones import fases
from app.automatizaciones.guia_inicial import INICIAL
from app.automatizaciones.modelos import GuiaVersion, IgMensaje, ahora

USOS = ('', 'solo si', 'opcional', 'no se usa')
MAX_PASOS, MAX_OPCIONES, MAX_TEXTO = 40, 6, 4000
DIAS_USO = 14
_ID = re.compile(r'^[a-z0-9-]{1,40}$')


class GuiaInvalida(ValueError):  # noqa: N818  (como AccionInvalida)
    pass


def vigente():
    """(versión o None, contenido). Sin publicaciones, la inicial."""
    v = GuiaVersion.query.order_by(GuiaVersion.id.desc()).first()
    return v, (v.contenido if v else INICIAL)


def _texto(v, largo=MAX_TEXTO):
    return str(v or '').strip()[:largo]


def _paso(p, vistos):
    if not isinstance(p, dict):
        raise GuiaInvalida('Un paso vino mal armado')
    pid = _texto(p.get('id'), 40).lower()
    if not _ID.match(pid) or pid in vistos:
        raise GuiaInvalida(f'El paso «{_texto(p.get("t"), 60)}» no tiene un id válido')
    vistos.add(pid)
    atajo = re.sub(r'[^a-z0-9-]', '', _texto(p.get('atajo'), 40).lower().lstrip('/'))
    if not atajo:
        raise GuiaInvalida(f'El paso «{_texto(p.get("t"), 60)}» necesita un atajo')
    ops = p.get('op') if isinstance(p.get('op'), list) else []
    if not ops or len(ops) > MAX_OPCIONES:
        raise GuiaInvalida(f'El paso «{_texto(p.get("t"), 60)}» necesita entre 1 y {MAX_OPCIONES} opciones')
    uso = p.get('uso') if p.get('uso') in USOS else ''
    return {'id': pid, 't': _texto(p.get('t'), 80) or 'Paso', 'atajo': atajo, 'uso': uso,
            'cuando': _texto(p.get('cuando'), 160) if uso == 'solo si' else '', 'nota': _texto(p.get('nota'), 400),
            'avanza': bool(p.get('avanza')), 'porRespuesta': bool(p.get('porRespuesta')),
            'op': [{k: _texto(o.get(k), MAX_TEXTO if k == 'x' else 80) for k in ('x', 'si', 'audio', 'desde')
                    if isinstance(o, dict) and _texto(o.get(k))} for o in ops]}


def validar(contenido):
    """El contenido limpio, o GuiaInvalida con el motivo para mostrar."""
    if not isinstance(contenido, dict) or not isinstance(contenido.get('etapas'), dict):
        raise GuiaInvalida('La guía vino mal armada')
    q = contenido.get('quien') or {}
    lista = lambda v: [_texto(x, 200) for x in (v if isinstance(v, list) else []) if _texto(x)]  # noqa: E731
    salida = {'quien': {'leads': lista(q.get('leads')), 'noleads': lista(q.get('noleads')),
                        'excepcion': _texto(q.get('excepcion'), 600)}, 'etapas': {}}
    for fase in fases.TODAS:
        e = contenido['etapas'].get(fase) or {}
        pasos = e.get('pasos') if isinstance(e.get('pasos'), list) else []
        if len(pasos) > MAX_PASOS:
            raise GuiaInvalida(f'{fases.NOMBRES[fase]}: hasta {MAX_PASOS} pasos')
        vistos = set()
        salida['etapas'][fase] = {'nota': _texto(e.get('nota'), 600), 'pasos': [_paso(p, vistos) for p in pasos]}
        if any(not o.get('x') and not o.get('audio') for p in salida['etapas'][fase]['pasos'] for o in p['op']):
            raise GuiaInvalida(f'{fases.NOMBRES[fase]}: hay una opción sin texto')
    return salida


def publicar(contenido, autor_id, puede_quien, nota=None):
    """Guarda una versión nueva. Sin `puede_quien` (el setter), «Quién es lead» queda como estaba."""
    limpio = validar(contenido)
    _, actual = vigente()
    if not puede_quien and limpio['quien'] != validar(actual)['quien']:
        raise PermissionError('«Quién es lead» lo cambia la dirección comercial: usá «Proponer un cambio»')
    v = GuiaVersion(contenido=limpio, autor_id=autor_id, nota=_texto(nota, 300) or None)
    db.session.add(v)
    db.session.commit()
    return v


def clave_valida(clave):
    """`fase:paso:opción` si tiene esa forma (lo que manda el chat), si no None."""
    partes = str(clave or '').split(':')
    if len(partes) == 3 and partes[0] in fases.TODAS and _ID.match(partes[1]) and partes[2].isdigit():
        return ':'.join(partes)
    return None


def uso(dias=DIAS_USO):
    """{clave: {'enviados', 'respondidos'}} de los últimos `dias`."""
    desde = ahora() - timedelta(days=dias)
    marcados = IgMensaje.query.filter(IgMensaje.guia.isnot(None), IgMensaje.enviado_en >= desde).all()
    if not marcados:
        return {}
    por_contacto = defaultdict(list)
    for m in (IgMensaje.query.filter(IgMensaje.contacto_id.in_(list({m.contacto_id for m in marcados})),
                                     IgMensaje.enviado_en >= desde).order_by(IgMensaje.enviado_en, IgMensaje.id)):
        por_contacto[m.contacto_id].append(m)
    salida = defaultdict(lambda: {'enviados': 0, 'respondidos': 0})
    for mensajes in por_contacto.values():
        for i, m in enumerate(mensajes):
            if not m.guia:
                continue
            salida[m.guia]['enviados'] += 1
            for siguiente in mensajes[i + 1:]:
                if siguiente.direccion == IgMensaje.ENTRANTE:
                    salida[m.guia]['respondidos'] += 1
                    break
                if siguiente.guia:
                    break
    return dict(salida)
