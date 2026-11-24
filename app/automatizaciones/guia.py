"""La Guía del setting (ADR-W197): lo que el setter manda en cada fase, editable desde el Inbox.

Forma del contenido:
  {'quien': {'leads': [str], 'noleads': [str], 'excepcion': str},
   'etapas': {<fase>: {'nota': str, 'pasos': [paso]}}}     una entrada por fase de `fases.TODAS`
  paso: {'id', 't', 'atajo', 'uso': ''|'solo si'|'opcional'|'no se usa', 'cuando', 'nota', 'avanza',
         'porRespuesta', 'op': [{'x', 'si', 'audio', 'desde'}]}
  Cada etapa trae además `seguimientos` (ADR-W204): qué pasa si el lead no contesta, en orden de horas.
  seguimiento: {'id', 'h': horas desde el último mensaje del lead, 'quien': 'setter'|'auto',
                'x', 'boton', 'link', 'unaVez'}   (texto, botón y link solo en los automáticos)
  Un automático sale antes de las 24 h (la ventana de Instagram para un bot). Lo manda `cadencias.py`.

Hay una guía por embudo (`embudos.py`): la de Conversión son las versiones sin `embudo_id`. Sus etapas son
las fases del embudo, más No lead e In-abrible.

Las fases (cuáles hay, su orden y en qué cuenta del reporte caen) siguen fijas en `fases.py`: cambiarlas es
una propuesta. «Quién es lead» también: el setter no la cambia al publicar.

Qué opción responde más: el chat manda la clave `fase:paso:opción` con el mensaje (`IgMensaje.guia`). Un
mensaje respondió si el lead escribió después, antes del próximo mensaje de la guía en esa conversación.
"""
import re
from collections import defaultdict
from datetime import timedelta

from app import db
from app.automatizaciones import embudos, fases
from app.automatizaciones.guia_inicial import INICIAL
from app.automatizaciones.modelos import GuiaVersion, IgMensaje, ahora

USOS = ('', 'solo si', 'opcional', 'no se usa')
MAX_PASOS, MAX_OPCIONES, MAX_TEXTO = 40, 6, 4000
DIAS_USO = 14
_ID = re.compile(r'^[a-z0-9-]{1,40}$')
_FASE = re.compile(r'^[a-z0-9-]{1,20}$')
QUIENES = ('setter', 'auto')
MAX_SEGUIMIENTOS = 8
HORAS_MAXIMAS = 7 * 24
# Un automático tiene que salir dentro de la ventana de 24 h, con margen para la vuelta del reloj.
HORAS_AUTO = 23.5
LARGO_BOTON, LARGO_PLANTILLA = 20, 640


class GuiaInvalida(ValueError):  # noqa: N818  (como AccionInvalida)
    pass


def vigente(embudo=None):
    """(versión o None, contenido) del embudo (Conversión sin embudo). Sin publicaciones: la inicial en
    Conversión, vacía en los demás."""
    guardado = embudos.id_guardado(embudo)
    filtro = GuiaVersion.embudo_id.is_(None) if guardado is None else GuiaVersion.embudo_id == guardado
    v = GuiaVersion.query.filter(filtro).order_by(GuiaVersion.id.desc()).first()
    if v:
        return v, v.contenido
    return None, (INICIAL if guardado is None else {'quien': {}, 'etapas': {}})


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


def _seguimiento(s, nombre_fase, vistos):
    if not isinstance(s, dict):
        raise GuiaInvalida(f'{nombre_fase}: un seguimiento vino mal armado')
    sid = _texto(s.get('id'), 40).lower()
    if not _ID.match(sid) or sid in vistos:
        raise GuiaInvalida(f'{nombre_fase}: un seguimiento no tiene un id válido')
    vistos.add(sid)
    try:
        horas = round(float(s.get('h')), 2)
    except (TypeError, ValueError):
        raise GuiaInvalida(f'{nombre_fase}: poné a cuántas horas sale cada seguimiento')
    if not 0.25 <= horas <= HORAS_MAXIMAS:
        raise GuiaInvalida(f'{nombre_fase}: los seguimientos van entre 15 minutos y {HORAS_MAXIMAS // 24} días')
    quien = s.get('quien') if s.get('quien') in QUIENES else 'setter'
    if quien == 'setter':
        return {'id': sid, 'h': horas, 'quien': quien, 'nota': _texto(s.get('nota'), 300)}
    if horas > HORAS_AUTO:
        raise GuiaInvalida(f'{nombre_fase}: un seguimiento automático sale antes de las 24 h (Instagram no deja '
                           'que un bot escriba después). Pasalo a setter o bajá las horas.')
    boton, link = _texto(s.get('boton'), LARGO_BOTON), _texto(s.get('link'), 600)
    texto = _texto(s.get('x'), LARGO_PLANTILLA if boton else 1000)
    if not texto:
        raise GuiaInvalida(f'{nombre_fase}: el seguimiento automático de las {horas:g} h no tiene texto')
    if boton and not link:
        raise GuiaInvalida(f'{nombre_fase}: el botón «{boton}» necesita un link')
    return {'id': sid, 'h': horas, 'quien': quien, 'x': texto, 'boton': boton, 'link': link,
            'unaVez': bool(s.get('unaVez'))}


def seguimientos(lista, nombre_fase):
    """Los seguimientos de una etapa, limpios y ordenados por horas."""
    lista = lista if isinstance(lista, list) else []
    if len(lista) > MAX_SEGUIMIENTOS:
        raise GuiaInvalida(f'{nombre_fase}: hasta {MAX_SEGUIMIENTOS} seguimientos')
    vistos = set()
    return sorted((_seguimiento(s, nombre_fase, vistos) for s in lista), key=lambda s: s['h'])


def automaticos(contenido):
    """{fase: [seguimientos automáticos]}: lo que el setter no puede cambiar al publicar."""
    return {f: [s for s in e.get('seguimientos') or [] if s.get('quien') == 'auto']
            for f, e in (contenido.get('etapas') or {}).items()}


def validar(contenido, embudo=None):
    """El contenido limpio, o GuiaInvalida con el motivo para mostrar."""
    if not isinstance(contenido, dict) or not isinstance(contenido.get('etapas'), dict):
        raise GuiaInvalida('La guía vino mal armada')
    q = contenido.get('quien') or {}
    lista = lambda v: [_texto(x, 200) for x in (v if isinstance(v, list) else []) if _texto(x)]  # noqa: E731
    salida = {'quien': {'leads': lista(q.get('leads')), 'noleads': lista(q.get('noleads')),
                        'excepcion': _texto(q.get('excepcion'), 600)}, 'etapas': {}}
    nombres = {f['id']: f['nombre'] for f in embudos.fases_de(embudo)}
    for fase in embudos.ids_de(embudo):
        nombre = nombres.get(fase) or fases.NOMBRES.get(fase, fase)
        e = contenido['etapas'].get(fase) or {}
        pasos = e.get('pasos') if isinstance(e.get('pasos'), list) else []
        if len(pasos) > MAX_PASOS:
            raise GuiaInvalida(f'{nombre}: hasta {MAX_PASOS} pasos')
        vistos = set()
        salida['etapas'][fase] = {
            'nota': _texto(e.get('nota'), 600), 'pasos': [_paso(p, vistos) for p in pasos],
            'seguimientos': [] if fase in fases.SALIDAS else seguimientos(e.get('seguimientos'), nombre)}
        if any(not o.get('x') and not o.get('audio') for p in salida['etapas'][fase]['pasos'] for o in p['op']):
            raise GuiaInvalida(f'{nombre}: hay una opción sin texto')
    return salida


def publicar(contenido, autor_id, puede_quien, nota=None, embudo=None):
    """Guarda una versión nueva. Sin `puede_quien` (el setter), «Quién es lead» y los seguimientos
    automáticos quedan como estaban."""
    limpio = validar(contenido, embudo)
    _, actual = vigente(embudo)
    anterior = validar(actual, embudo)
    if not puede_quien and limpio['quien'] != anterior['quien']:
        raise PermissionError('«Quién es lead» lo cambia la dirección comercial: usá «Proponer un cambio»')
    if not puede_quien and automaticos(limpio) != automaticos(anterior):
        raise PermissionError('Los seguimientos automáticos los cambia la dirección comercial: usá «Proponer un cambio»')
    v = GuiaVersion(contenido=limpio, autor_id=autor_id, nota=_texto(nota, 300) or None,
                    embudo_id=embudos.id_guardado(embudo))
    db.session.add(v)
    db.session.commit()
    return v


def clave_valida(clave):
    """`fase:paso:opción` si tiene esa forma (lo que manda el chat), si no None."""
    partes = str(clave or '').split(':')
    if len(partes) == 3 and _FASE.match(partes[0]) and _ID.match(partes[1]) and partes[2].isdigit():
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
