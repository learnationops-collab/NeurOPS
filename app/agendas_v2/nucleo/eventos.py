"""Eventos: link, publicación (con la versión del formulario incluida) y revisión antes de publicar.
Port de core/eventos.js. `publicado` es el mismo texto JSON que arma el frontend (JSON.stringify),
así que config_de tiene que dar byte a byte lo mismo.
"""

import json

from app.agendas_v2.nucleo.datos import buscar, horas_semana
from app.agendas_v2.nucleo.formulario import grupos_de_form, reglas_rotas
from app.agendas_v2.nucleo.normalizar import normal_evento, normal_form
from app.agendas_v2.nucleo.tiempo import fecha_corta
from app.agendas_v2.nucleo.util import fmt, js_json, js_str, js_truthy, num, obj

CAMPOS_EV = [
    'nombre',
    'slug',
    'funnel',
    'formulario',
    'duracion',
    'activo',
    'persona',
    'reservas',
    'antel',
    'paso',
    'zona',
    'desc',
    'redir',
    'indic',
]
CAMPOS_FORM = ['id', 'nombre', 'contacto', 'preguntas', 'reglas', 'resto', 'fin']


def _tomar(o, ks):
    # Una clave que falta es `undefined` en JS: no aparece en el JSON.
    return {k: o[k] for k in ks if k in o}


def config_de(e, form):
    """Lo que queda en vivo al publicar: la configuración completa del evento y una copia del formulario.
    Así, editar un formulario no cambia los links publicados hasta volver a publicar."""
    return js_json({'ev': _tomar(e, CAMPOS_EV), 'form': _tomar(form, CAMPOS_FORM) if form else None})


def sin_publicar(e, form):
    return config_de(e, form) != e.get('publicado')


def _leer(e):
    return json.loads(e['publicado'], parse_constant=lambda c: (_ for _ in ()).throw(ValueError(c)))


def version_publicada(e):
    """{'evento', 'form'} tal como se publicaron, o None."""
    if not e or not e.get('publicado'):
        return None
    try:
        p = _leer(e)
        if not isinstance(p, dict) or not js_truthy(p.get('ev')):
            return None
        form = p.get('form')
        return {
            'evento': normal_evento(e.get('id'), p['ev']),
            'form': normal_form(obj(form).get('id'), form) if js_truthy(form) else None,
        }
    except Exception:
        return None


def campos_publicados(e):
    """Campos del evento tal como se publicaron, para "Descartar". El formulario es compartido y no se toca."""
    v = version_publicada(e)
    return _tomar(v['evento'], CAMPOS_EV) if v else None


def form_cambio(e, form):
    """¿El formulario cambió desde la última publicación de este evento?"""
    if not e.get('publicado'):
        return False
    try:
        p = _leer(e)
        if p is None:
            return False  # en JS `null.form` tira y cae en el catch
        if not isinstance(p, dict) or 'form' not in p:
            return True  # JSON.stringify(undefined) nunca es igual a un texto
        return js_json(p['form']) != js_json(_tomar(form, CAMPOS_FORM) if form else None)
    except Exception:
        return False


def estado_evento(e, form):
    if not e.get('activo'):
        return {'k': 'pausado', 'n': 'Pausado', 'c': 'var(--idle)'}
    if not e.get('publicado'):
        return {'k': 'borrador', 'n': 'Borrador', 'c': 'var(--warning)'}
    if sin_publicar(e, form):
        return {'k': 'cambios', 'n': 'Cambios sin publicar', 'c': 'var(--warning)'}
    return {'k': 'vivo', 'n': 'En vivo', 'c': 'var(--success)'}


def link_evento(d, e):
    f = buscar(d, 'funnels', e.get('funnel'))
    return '/agenda/' + (f['slug'] + '/' if f else '') + e['slug']


def resumen_agenda(e):
    r, a = e['reservas'], e['antel']
    pm = e['paso']['n'] * (60 if e['paso']['u'] == 'h' else 1)
    if r['modo'] == 'siempre':
        hasta = 'Sin límite'
    elif r['modo'] == 'rango':
        hasta = (
            fecha_corta(r['desde']) + ' a ' + fecha_corta(r['hasta'])
            if r['desde'] and r['hasta']
            else 'Rango sin fechas'
        )
    else:
        hasta = js_str(r['n']) + (' días hábiles' if r['tipo'] == 'habiles' else ' días')
    cada = js_str(num(pm / 60)) + ' h' if pm % 60 == 0 and pm >= 60 else js_str(pm) + ' min'
    return (
        hasta
        + ' · '
        + js_str(a['n'])
        + ' '
        + {'min': 'min', 'h': 'h', 'd': 'd'}.get(a['u'], 'undefined')
        + ' antes · cada '
        + cada
    )


def _ruteo(d, fo):
    gids = grupos_de_form(fo)

    def vacio(gid):
        g = buscar(d, 'grupos', gid)
        return not g or not any((p := buscar(d, 'personas', pid)) and horas_semana(p) > 0 for pid in g['miembros'])

    vacios = [g for g in gids if vacio(g)]
    rotas = reglas_rotas(fo)
    if not fo:
        return [0, 'Sin ruteo', 'Elegí un formulario']
    if not gids:
        return [0, 'El formulario no tiene ruteo', 'Configuralo en Forms']
    if rotas:
        t = (
            'Una regla apunta a una pregunta borrada'
            if len(rotas) == 1
            else str(len(rotas)) + ' reglas apuntan a preguntas borradas'
        )
        return [0, t, 'Revisá el ruteo en Forms']
    if vacios:
        return [0, 'Hay prioridades sin closers con horario', 'Si no hay lugar, pasa a la siguiente prioridad']
    return [1, 'Ruteo completo', str(len(gids)) + (' prioridad' if len(gids) == 1 else ' prioridades')]


def revision(d, e):
    """Checklist del evento: [ok (1|0), título, detalle]."""
    f, fo = buscar(d, 'funnels', e.get('funnel')), buscar(d, 'formularios', e.get('formulario'))
    out = []
    if f:
        out.append(
            [1, 'Funnel ' + f['nombre'], 'Recibe agendas']
            if f.get('activo')
            else [0, 'Funnel ' + f['nombre'] + ' pausado', 'Activalo en Configuración']
        )
    else:
        out.append([0, 'Falta el funnel', 'Elegilo arriba'])
    out.append(
        [1, 'Formulario ' + fo['nombre'], str(len(fo['preguntas']) + 4) + ' preguntas']
        if fo
        else [0, 'Falta el formulario', 'Elegilo arriba']
    )
    if e.get('persona'):
        pf = buscar(d, 'personas', e['persona'])
        if not pf:
            out.append([0, 'Falta la persona', 'Elegila arriba'])
        elif horas_semana(pf):
            out.append([1, 'Link directo a ' + pf['nombre'], fmt(horas_semana(pf), 1) + ' h/sem'])
        else:
            out.append([0, pf['nombre'] + ' no tiene horario', 'Cargalo en Team'])
    else:
        out.append(_ruteo(d, fo))
    rr = e['reservas']
    malas = rr['modo'] == 'rango' and (not rr['desde'] or not rr['hasta'] or rr['hasta'] < rr['desde'])
    out.append([0, 'Fechas inválidas', 'Revisá el rango de reservas'] if malas else [1, 'Agenda', resumen_agenda(e)])
    dup = any(x['id'] != e['id'] and link_evento(d, x) == link_evento(d, e) for x in d['eventos'])
    out.append([0, 'El link ya existe', 'Cambiá el link'] if dup else [1, 'Link único', link_evento(d, e)])
    if not e.get('publicado'):
        out.append([0, 'Nunca publicado', 'Probalo y publicá'])
    elif form_cambio(e, fo):
        out.append([0, 'El formulario cambió', 'Publicá para que el link use la versión nueva'])
    elif sin_publicar(e, fo):
        out.append([0, 'Cambios sin publicar', 'El link sigue con la versión anterior'])
    else:
        out.append([1, 'Publicado', 'Lo que ves es lo que está en vivo'])
    return out


def slug_libre(d, e, slug):
    """Slug libre para un link nuevo: agrega -2, -3… si ya existe en el mismo funnel."""

    def usado(x):
        return any(o['id'] != e['id'] and o.get('funnel') == e.get('funnel') and o['slug'] == x for o in d['eventos'])

    s, n = slug, 2
    while usado(s):
        s = slug + '-' + str(n)
        n += 1
    return s
