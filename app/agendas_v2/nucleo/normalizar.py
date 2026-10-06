"""Normalizadores: todo documento que entra (de la base o de una edición) pasa por acá.
Port de core/normalizar.js. Son la definición del esquema: las claves y su orden son las mismas
que en el frontend, así el JSON de una publicación sale idéntico en los dos lados.
"""

import re

from app.agendas_v2.nucleo.catalogos import (
    COLORES,
    CONTACTO,
    DURACIONES,
    ESTRATEGIAS,
    FIN_DEF,
    HORAS,
    ICONOS_ROL,
    INTEG_DEF,
    MS_U,
    PERM_KEYS,
    PERM_VIEJOS,
    TIPOS,
    TIPOS_CONTACTO,
    TZ_DEF,
    con_opciones,
    ico_nombre,
    zona_valida,
)
from app.agendas_v2.nucleo.html_limpio import limpiar_html
from app.agendas_v2.nucleo.util import (
    WS,
    abrev_de,
    clonar,
    cortar,
    entero,
    js_number,
    js_str,
    js_trim,
    js_truthy,
    largo16,
    lista,
    num,
    obj,
    slugify,
    txt,
    uid,
)

__all__ = [
    'COLECCIONES',
    'NORM',
    'contacto_preguntas',
    'email_ok',
    'fecha_ok',
    'foto_ok',
    'limpiar_html',
    'normal_evento',
    'normal_form',
    'normal_funnel',
    'normal_grupo',
    'normal_horario',
    'normal_integ',
    'normal_perfil',
    'normal_persona',
    'normal_pregunta',
    'normal_reglas',
    'normal_rol',
    'preguntas_flujo',
    'url_ok',
]

COLECCIONES = ['funnels', 'formularios', 'personas', 'grupos', 'eventos', 'roles']

_RE_EMAIL = re.compile('[^' + WS + '@<>"\']+@[^' + WS + '@<>"\']+\\.[a-z]{2,}')
_RE_URL = re.compile('https://[^' + WS + '<>"\']+', re.I)


def email_ok(m):
    m = cortar(js_trim(txt(m)).lower(), 120)
    return m if _RE_EMAIL.fullmatch(m) else ''


def url_ok(u):
    u = cortar(js_trim(txt(u)), 500)
    return u if _RE_URL.fullmatch(u) else ''


def fecha_ok(f):
    return f if isinstance(f, str) and re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', f) else ''


def foto_ok(f):
    return (
        f if isinstance(f, str) and re.match(r'data:image/(jpeg|png|webp);base64,', f) and largo16(f) < 150000 else ''
    )


def _orden(v):
    """`Number(d.orden) || 0`."""
    n = js_number(v)
    return num(n) if js_truthy(n) else 0


def _en(clave, mapa):
    """`MAPA[clave]` sin tomar las propiedades heredadas de un objeto de JS."""
    return isinstance(clave, str) and clave in mapa


def normal_pregunta(q):
    q = obj(q)
    t = txt(q.get('tipo'), 'texto')
    opciones = []
    for o in lista(q.get('opciones'))[:60]:
        o = {'texto': o} if isinstance(o, str) else obj(o)
        opciones.append(
            {
                'id': cortar(txt(o.get('id')) or uid('o'), 40),
                'texto': cortar(txt(o.get('texto')), 200),
                'puntos': entero(o.get('puntos'), 0, 10, None),
                'descalifica': o.get('descalifica') is True,
            }
        )
    return {
        'id': cortar(txt(q.get('id')) or uid('q'), 40),
        'tipo': t,
        'titulo': cortar(txt(q.get('titulo')), 300),
        'ayuda': cortar(txt(q.get('ayuda')), 300),
        'placeholder': cortar(txt(q.get('placeholder')), 80),
        'obligatoria': q.get('obligatoria') is not False,
        'esNombre': q.get('esNombre') is True,
        'peso': entero(q.get('peso'), 0, 5, 1 if con_opciones(t) else 0),
        'opciones': opciones,
    }


def normal_reglas(reglas):
    out = []
    for r in lista(reglas)[:20]:
        r = obj(r)
        cond = []
        for c in lista(r.get('cond'))[:8]:
            c = obj(c)
            cond.append({'q': txt(c.get('q')), 'ops': [js_str(x) for x in lista(c.get('ops'))][:60]})
        out.append({'id': cortar(txt(r.get('id')) or uid('r'), 40), 'grupo': txt(r.get('grupo')), 'cond': cond})
    return out


def normal_form(id, d):
    d = obj(d)
    ct = {'nombre': True, 'telefono': True, 'email': True, 'instagram': True}
    contacto = d.get('contacto')
    if js_truthy(contacto) and isinstance(contacto, (dict, list)):
        for k in ct:
            ct[k] = (contacto.get(k) if isinstance(contacto, dict) else None) is not False
    ps = []
    for raw in lista(d.get('preguntas'))[:60]:
        q = normal_pregunta(raw)
        k = 'nombre' if q['esNombre'] else q['tipo'] if _en(q['tipo'], TIPOS_CONTACTO) else None
        if k:  # los datos de contacto no van como preguntas
            if not js_truthy(contacto):
                ct[k] = q['obligatoria']
            continue
        if not any(t['k'] == q['tipo'] for t in TIPOS):
            q['tipo'] = 'texto'
        q['esNombre'] = False
        ps.append(q)
    fin = obj(d.get('fin'))
    texto_fin = FIN_DEF['texto'] if fin.get('texto') is None else js_str(fin.get('texto'))
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 80),
        'contacto': ct,
        'preguntas': ps,
        'reglas': normal_reglas(d.get('reglas')),
        'resto': txt(d.get('resto')),
        'fin': {'titulo': cortar(txt(fin.get('titulo'), FIN_DEF['titulo']), 120), 'texto': cortar(texto_fin, 300)},
        'orden': _orden(d.get('orden')),
    }


def normal_funnel(id, d):
    d = obj(d)
    origenes = []
    for o in lista(d.get('origenes'))[:30]:
        o = obj(o)
        x = {'id': txt(o.get('id')), 'nombre': cortar(txt(o.get('nombre')), 60), 'setter': txt(o.get('setter'))}
        if x['id'] and (x['nombre'] or x['setter']):
            origenes.append(x)
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 80),
        'slug': slugify(d.get('slug')) or slugify(d.get('nombre')) or id,
        'color': d.get('color') if d.get('color') in COLORES else 'azul',
        'activo': d.get('activo') is not False,
        'orden': _orden(d.get('orden')),
        'origenes': origenes,
        'tipo': tipo_funnel(d),
        # Funnel de setting: cada setter activo de NeurOPS tiene su link (?o=<su usuario>) y la agenda
        # queda a su nombre. No lleva orígenes a mano.
        'setting': tipo_funnel(d) == 'setting',
    }


# Para qué cuenta cada funnel en las estadísticas (la «Fuente» de la agenda, ver operacion._fuente):
# setting → el setter del link; vsl → 'vsl'; workshop → 'workshop' (o 'workshop_landing' si el origen es
# la grabación); otro → el origen o el funnel. Los funnels viejos traían solo `setting: true`.
TIPOS_FUNNEL = ('setting', 'vsl', 'workshop', 'otro')


def tipo_funnel(d):
    t = d.get('tipo')
    return t if t in TIPOS_FUNNEL else ('setting' if d.get('setting') is True else 'otro')


def _pos(r, i):
    """`r && r[i]` para una franja que puede venir rota."""
    return r[i] if isinstance(r, (list, tuple, str)) and len(r) > i else None


def franjas(h, dia):
    """Franjas de un día del horario. Acepta claves 0..6 o '0'..'6' (el JSON las vuelve texto)."""
    if not isinstance(h, dict):
        return []
    v = h.get(dia, h.get(str(dia)))
    return v if isinstance(v, list) else []


def normal_horario(h):
    o = {}
    for d in range(7):
        o[d] = [
            [_pos(r, 0) if _pos(r, 0) in HORAS else '09:00', _pos(r, 1) if _pos(r, 1) in HORAS else '18:00']
            for r in franjas(h, d)[:6]
        ]
    return o


def normal_persona(id, d):
    d = obj(d)
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 60),
        'email': email_ok(d.get('email')),
        'rol': cortar(txt(d.get('rol'), 'closer'), 40),
        'foto': foto_ok(d.get('foto')),
        'nivel': entero(d.get('nivel'), 1, 3, 1),
        'color': d.get('color') if d.get('color') in COLORES else 'azul',
        'tz': d.get('tz') if zona_valida(d.get('tz')) else TZ_DEF,
        'horario': normal_horario(d.get('horario')),
        'orden': _orden(d.get('orden')),
    }


def normal_grupo(id, d):
    d = obj(d)
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 60),
        'estrategia': d.get('estrategia') if _en(d.get('estrategia'), ESTRATEGIAS) else 'llenar',
        'miembros': [js_str(x) for x in lista(d.get('miembros'))][:30],
        'orden': _orden(d.get('orden')),
    }


def normal_evento(id, d):
    d = obj(d)
    rs, an, pa, zn = obj(d.get('reservas')), obj(d.get('antel')), obj(d.get('paso')), obj(d.get('zona'))
    dur_n = js_number(d.get('duracion'))
    dur = int(dur_n) if dur_n in DURACIONES else 45
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 80),
        'slug': slugify(d.get('slug')) or slugify(d.get('nombre')) or id,
        'funnel': txt(d.get('funnel')),
        'formulario': txt(d.get('formulario')),
        'duracion': dur,
        'activo': d.get('activo') is not False,
        'publicado': d.get('publicado') if isinstance(d.get('publicado'), str) else '',
        'orden': _orden(d.get('orden')),
        'persona': txt(d.get('persona')),
        'reservas': {
            'modo': rs.get('modo') if rs.get('modo') in ('dias', 'rango', 'siempre') else 'dias',
            'n': entero(rs.get('n'), 1, 365, 30),
            'tipo': 'habiles' if rs.get('tipo') == 'habiles' else 'corridos',
            'desde': fecha_ok(rs.get('desde')),
            'hasta': fecha_ok(rs.get('hasta')),
        },
        'antel': {'n': entero(an.get('n'), 0, 999, 4), 'u': an.get('u') if _en(an.get('u'), MS_U) else 'h'},
        'paso': {
            'n': entero(pa.get('n'), 1, 720, 30 if dur <= 30 else 60),
            'u': 'h' if pa.get('u') == 'h' else 'min',
            'pers': pa.get('pers') is True,
        },
        'zona': {
            'modo': 'fija' if zn.get('modo') == 'fija' else 'auto',
            'tz': zn.get('tz') if zona_valida(zn.get('tz')) else TZ_DEF,
        },
        'desc': limpiar_html(d.get('desc')),
        'redir': url_ok(d.get('redir')),
        # Indicaciones para el lead: van en la invitación de Google Calendar (texto plano).
        'indic': cortar(d['indic'], 2000) if isinstance(d.get('indic'), str) else '',
    }


def normal_rol(id, d):
    d = obj(d)
    ac = []
    for a in lista(d.get('accesos')):
        for k in PERM_VIEJOS[a] if _en(a, PERM_VIEJOS) else [a]:
            if k in PERM_KEYS and k not in ac:
                ac.append(k)
    nom = cortar(txt(d.get('nombre'), 'Sin nombre'), 60)
    ab = re.sub('[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]', '', txt(d.get('abrev'))).upper()[:4]
    return {
        'id': id,
        'nombre': nom,
        'abrev': ab or abrev_de(nom),
        'icono': d.get('icono') if any(x[0] == d.get('icono') for x in ICONOS_ROL) else ico_nombre(nom),
        'color': d.get('color') if d.get('color') in COLORES else '',
        'atiende': d.get('atiende') is True,
        'accesos': ac,
        'orden': _orden(d.get('orden')),
    }


def normal_perfil(p):
    p = obj(p)
    return {
        'nombre': cortar(txt(p.get('nombre')), 60),
        'apellido': cortar(txt(p.get('apellido')), 60),
        'funcion': cortar(txt(p.get('funcion')), 60),
        'foto': foto_ok(p.get('foto')),
        'persona': txt(p.get('persona')),
    }


def normal_integ(d):
    d = obj(d)
    o = clonar(INTEG_DEF)
    for k, campos in o.items():
        x = obj(d.get(k))
        for c, defecto in campos.items():
            if isinstance(defecto, bool):
                campos[c] = defecto if x.get(c) is None else x.get(c) is True
            else:
                campos[c] = re.sub('[^0-9]', '', txt(x.get(c)))[:20]
    return o


NORM = {
    'funnels': normal_funnel,
    'formularios': normal_form,
    'personas': normal_persona,
    'grupos': normal_grupo,
    'eventos': normal_evento,
    'roles': normal_rol,
}


def contacto_preguntas(f):
    """Las preguntas de contacto no se guardan: se arman al vuelo con los textos fijos de CONTACTO."""
    return [
        normal_pregunta(
            {
                'id': 'c-' + c['k'],
                'tipo': c['tipo'],
                'titulo': c['titulo'],
                'ayuda': c.get('ayuda'),
                'placeholder': c.get('placeholder'),
                'obligatoria': f['contacto'][c['k']],
                'esNombre': c['k'] == 'nombre',
                'peso': 0,
            }
        )
        for c in CONTACTO
    ]


def preguntas_flujo(f):
    return contacto_preguntas(f) + f['preguntas']
