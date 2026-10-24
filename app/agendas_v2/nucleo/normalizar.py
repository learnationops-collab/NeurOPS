"""Normalizadores: todo documento que entra (de la base o de una edición) pasa por acá.
Port de core/normalizar.js. Son la definición del esquema: las claves y su orden son las mismas
que en el frontend, así el JSON de una publicación sale idéntico en los dos lados.
"""

import re

from app.agendas_v2.nucleo.catalogos import (
    COLORES,
    CONTACTO,
    DURACION_MAX,
    DURACION_MIN,
    MARGEN_MAX,
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
    'normal_gracias',
    'normal_funnel',
    'normal_grupo',
    'normal_horario',
    'normal_integ',
    'normal_perfil',
    'normal_persona',
    'normal_pregunta',
    'normal_reglas',
    'normal_rol',
    'normal_segmento',
    'normal_video',
    'preguntas_flujo',
    'url_ok',
]

COLECCIONES = ['funnels', 'formularios', 'personas', 'grupos', 'eventos', 'roles', 'gracias']

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
                # Versión corta para el aviso de Discord («Sí», «No»): vacía, se usa el texto.
                'corto': cortar(txt(o.get('corto')), 40),
                'puntos': entero(o.get('puntos'), 0, 10, None),
                'descalifica': o.get('descalifica') is True,
            }
        )
    return {
        'id': cortar(txt(q.get('id')) or uid('q'), 40),
        'tipo': t,
        'titulo': cortar(txt(q.get('titulo')), 300),
        'corto': cortar(txt(q.get('corto')), 40),
        'ayuda': cortar(txt(q.get('ayuda')), 300),
        'placeholder': cortar(txt(q.get('placeholder')), 80),
        'obligatoria': q.get('obligatoria') is not False,
        'esNombre': q.get('esNombre') is True,
        'peso': entero(q.get('peso'), 0, 5, 1 if con_opciones(t) else 0),
        'opciones': opciones,
        # Si cuenta para el segmento A/B/C/D: '' no, 'cuenta' sí, 'clave' sí y sin respuesta no hay segmento.
        'segmento': q.get('segmento') if q.get('segmento') in ('cuenta', 'clave') and con_opciones(t) else '',
    }


def normal_segmento(s):
    """Cortes del segmento en % del puntaje (A ≥ a, B ≥ b, C ≥ c), la incertidumbre de los puntos (sigma,
    en %) y la versión de los puntos. Inactivo, el formulario no segmenta."""
    s = obj(s)
    a = entero(s.get('a'), 0, 100, 69)
    b = min(a, entero(s.get('b'), 0, 100, 54))
    return {
        'activo': s.get('activo') is True,
        'a': a,
        'b': b,
        'c': min(b, entero(s.get('c'), 0, 100, 31)),
        'sigma': entero(s.get('sigma'), 1, 50, 12),
        'version': cortar(txt(s.get('version')), 20),
    }


def normal_reglas(reglas):
    out = []
    for r in lista(reglas)[:20]:
        r = obj(r)
        cond = []
        for c in lista(r.get('cond'))[:8]:
            c = obj(c)
            cond.append({'q': txt(c.get('q')), 'ops': [js_str(x) for x in lista(c.get('ops'))][:60]})
        # url: la regla no manda a una estrategia sino a otra página (el lead no agenda).
        url = url_ok(r.get('url'))
        out.append({'id': cortar(txt(r.get('id')) or uid('r'), 40), 'grupo': '' if url else txt(r.get('grupo')),
                    'url': url, 'cond': cond})
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
        'segmento': normal_segmento(d.get('segmento')),
        # url: la página a la que va el que no califica (la landing de descalificados); vacía, ve el título y el texto.
        'fin': {'titulo': cortar(txt(fin.get('titulo'), FIN_DEF['titulo']), 120), 'texto': cortar(texto_fin, 300),
                'url': url_ok(fin.get('url'))},
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
    slug = slugify(d.get('slug')) or slugify(d.get('nombre')) or id
    anteriores = []
    for x in lista(d.get('slugs_anteriores'))[:20]:
        x = slugify(x)
        if x and x != slug and x not in anteriores:
            anteriores.append(x)
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 80),
        'slug': slug,
        # Los slugs que tuvo antes: los links ya compartidos con esos slugs siguen andando.
        'slugs_anteriores': anteriores,
        'color': d.get('color') if d.get('color') in COLORES else 'azul',
        'activo': d.get('activo') is not False,
        'orden': _orden(d.get('orden')),
        'origenes': origenes,
        'tipo': tipo_funnel(d),
        # Funnel de setting: cada setter activo de NeurOPS tiene su link (?o=<su código>) y la agenda
        # queda a su nombre. No lleva orígenes a mano.
        'setting': tipo_funnel(d) == 'setting',
        # Los setters que trabajan este funnel (ids de usuario). Vacío: todos los setters activos.
        'setters': sorted({int(x) for x in (d.get('setters') or [])[:200] if isinstance(x, int) or (isinstance(x, str) and x.isdigit())}),
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
        'sesiones': normal_sesiones(d.get('sesiones')),
        'orden': _orden(d.get('orden')),
    }


def normal_sesiones(v):
    """Lo que el closer ajustó de cada evento: {evento_id: {duracion?, margen?}} en minutos. Lo que no
    ajustó no aparece y toma la propuesta del evento."""
    out = {}
    for k, x in list(obj(v).items())[:100]:
        x = obj(x)
        s = {}
        if x.get('duracion') not in ('', None):
            s['duracion'] = entero(x.get('duracion'), DURACION_MIN, DURACION_MAX, 45)
        if x.get('margen') not in ('', None):
            s['margen'] = entero(x.get('margen'), 0, MARGEN_MAX, 0)
        if s:
            out[js_str(k)] = s
    return out


def normal_grupo(id, d):
    d = obj(d)
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 60),
        'estrategia': d.get('estrategia') if _en(d.get('estrategia'), ESTRATEGIAS) else 'llenar',
        'miembros': [js_str(x) for x in lista(d.get('miembros'))][:30],
        'pesos': _pesos(d.get('pesos')),
        'orden': _orden(d.get('orden')),
    }


def _pesos(v):
    """Distribuida: el porcentaje de cada closer {persona_id: 0..100}. Sin dato, todos parejo."""
    return {js_str(k): entero(x, 0, 100, 0) for k, x in list(obj(v).items())[:30]}


def normal_evento(id, d):
    d = obj(d)
    rs, an, pa, zn = obj(d.get('reservas')), obj(d.get('antel')), obj(d.get('paso')), obj(d.get('zona'))
    dur = entero(d.get('duracion'), DURACION_MIN, DURACION_MAX, 45)
    slug = slugify(d.get('slug')) or slugify(d.get('nombre')) or id
    anteriores = []
    for x in lista(d.get('slugs_anteriores'))[:20]:
        x = slugify(x)
        if x and x != slug and x not in anteriores:
            anteriores.append(x)
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 80),
        'slug': slug,
        # Los slugs que tuvo antes: los links ya compartidos con esos slugs siguen andando.
        'slugs_anteriores': anteriores,
        'funnel': txt(d.get('funnel')),
        'formulario': txt(d.get('formulario')),
        'duracion': dur,
        # Margen después de cada sesión: bloquea la agenda del closer pero el lead no lo ve.
        'margen': entero(d.get('margen'), 0, MARGEN_MAX, 0),
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
        # Página de gracias (colección `gracias`) a la que va el lead al confirmar. No entra en la copia
        # publicada: se toma del evento en vivo.
        'gracias': txt(d.get('gracias')),
    }


_RE_ARCHIVO_VIDEO = re.compile('v[a-z0-9]{20}')


def normal_video(v):
    """Un video de la página de gracias: un archivo subido al volumen (`archivo`, su id) o un link
    (Loom, YouTube, Vimeo o Drive). Si están los dos, manda el archivo."""
    v = obj(v)
    a = txt(v.get('archivo'))
    return {
        'archivo': a if _RE_ARCHIVO_VIDEO.fullmatch(a) else '',
        'nombre': cortar(txt(v.get('nombre')), 120),
        'url': url_ok(v.get('url')),
    }


def normal_gracias(id, d):
    """Página de gracias después de agendar: el video que completa la reserva, el del plan y los
    casos de éxito de la Academia. `segundos`: cuánto video antes de mostrar «Ver mi plan»."""
    d = obj(d)
    return {
        'id': id,
        'nombre': cortar(txt(d.get('nombre'), 'Sin nombre'), 80),
        'video': normal_video(d.get('video')),
        'plan': normal_video(d.get('plan')),
        'segundos': entero(d.get('segundos'), 0, 60, 5),
        'casos': d.get('casos') is not False,
        'orden': _orden(d.get('orden')),
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
    'gracias': normal_gracias,
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
