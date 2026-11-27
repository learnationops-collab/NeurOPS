"""Turnos › «Lo que ve el lead»: por cada link con segmentación, los horarios que ve ahora un lead de cada
segmento (con la sesión que le toca, el mínimo diario y lo ocupado de verdad), y cambiar sus días.
La ventana es del evento del link: C/D toman la Sesión diagnóstica, pero con los días del link
(servicio.sesion_del_lead)."""

import json

from app import db
from app.agendas_v2 import servicio
from app.agendas_v2.modelos import SchedEvento
from app.agendas_v2.nucleo.datos import buscar
from app.agendas_v2.nucleo.disponibilidad import agenda_opt, dias_del_horizonte
from app.agendas_v2.nucleo.asignacion import asignacion
from app.agendas_v2.nucleo.eventos import version_publicada
from app.agendas_v2.nucleo.formulario import grupos_de_form
from app.agendas_v2.nucleo.normalizar import normal_evento
from app.agendas_v2.nucleo.util import js_json

# Días que se muestran desde hoy: los de la ventana y unos más, para ver qué sumaría estirarla.
DIAS_VISTA = 10
N_MAX = 30


def _sesion_del_grupo(d, evento, form, gid):
    """El evento de la sesión que toma un lead de ese segmento: el de su primera regla, si elige uno."""
    r = next((x for x in form.get('reglas') or [] if x.get('grupo') == gid and x.get('evento')), None)
    otro = buscar(d, 'eventos', r['evento']) if r else None
    if not otro or otro['id'] == evento['id']:
        return evento
    return {**evento, 'id': otro['id'], 'nombre': otro['nombre'], 'duracion': otro['duracion'],
            'margen': otro.get('margen') or 0, 'paso': otro['paso']}


def _slots(d, evento, form, gid, opciones, reservas=None):
    ev = {**evento, 'reservas': reservas} if reservas else evento
    sesion = _sesion_del_grupo(d, ev, form, gid)
    ctx = {**servicio._contexto(sesion, form, {}, ev), 'reglas': [], 'resto': gid}
    asig = asignacion(ctx, d, {**opciones, 'prueba': False})
    return sesion, sorted(({'t': s['t'], 'p': s['p']} for s in asig['slots']), key=lambda s: s['t'])


def links_con_segmentos(d):
    """Eventos publicados y activos de un funnel, con formulario que segmenta: [(evento publicado, form, e)]."""
    out = []
    for e in d['eventos']:
        if e.get('persona') or e.get('activo') is False or not e.get('funnel'):
            continue
        pub = version_publicada(e)
        form = pub and pub.get('form')
        if form and grupos_de_form(form):
            out.append((pub['evento'], form, e))
    return out


def vista(tz, ahora=None):
    """{links: [{id, nombre, funnel, ruta, setting, reservas, antel, dias: [{clave, dow, ventana}],
    segmentos: [{id, nombre, sesion, duracion, slots: [{t, p}]}]}], personas: {id: nombre}}.
    `slots` cubre DIAS_VISTA días; `ventana` dice cuáles ofrece hoy el link."""
    ahora = ahora or servicio.ahora_ms()
    tz = tz if servicio.zona_valida(tz) else None
    d0 = servicio.colecciones()
    d, elegibles = servicio.solo_elegibles(d0)
    opciones = servicio._ocupacion(ahora, elegibles)
    amplia = {'modo': 'dias', 'n': DIAS_VISTA - 1, 'tipo': 'corridos', 'desde': '', 'hasta': ''}
    links = []
    for evento, form, e in links_con_segmentos(d):
        funnel = buscar(d, 'funnels', evento.get('funnel')) or {}
        zona = tz or evento.get('zona', {}).get('tz')
        o = agenda_opt({'reservas': evento['reservas'], 'antel': evento['antel'], 'paso': evento['paso']}, evento['duracion'])
        ventana = {x['clave'] for x in dias_del_horizonte(o, zona, ahora)}
        o_amplia = agenda_opt({'reservas': amplia, 'antel': evento['antel'], 'paso': evento['paso']}, evento['duracion'])
        segmentos = []
        for gid in grupos_de_form(form):
            g = buscar(d, 'grupos', gid)
            if not g:
                continue
            sesion, en_ventana = _slots(d, evento, form, gid, opciones)
            _, todos = _slots(d, evento, form, gid, opciones, reservas=amplia)
            ve = {s['t'] for s in en_ventana}
            segmentos.append({
                'id': gid, 'nombre': g['nombre'], 'sesion': sesion['nombre'], 'duracion': sesion['duracion'],
                # Fuera de la ventana se muestran los de la vista amplia; dentro, los que ofrece de verdad.
                'slots': en_ventana + [s for s in todos if s['t'] not in ve],
                've': sorted(ve),
            })
        links.append({
            'id': e['id'], 'nombre': funnel.get('nombre') or evento['nombre'], 'evento': evento['nombre'],
            'ruta': f'/agendas-v2/agenda/{funnel.get("slug", "")}/{evento["slug"]}',
            'setting': bool(funnel.get('setting')),
            'reservas': evento['reservas'], 'antel': evento['antel'], 'tz': zona,
            'dias': [{'clave': x['clave'], 'dow': x['dow'], 'ventana': x['clave'] in ventana}
                     for x in dias_del_horizonte(o_amplia, zona, ahora)],
            'segmentos': segmentos,
        })
    personas = {p['id']: p['nombre'] for p in d0['personas']}
    return {'links': links, 'personas': personas}


def cambiar_dias(evento_id, n, tipo, usuario_id=None):
    """La ventana «N días» del link, en el borrador y en lo publicado a la vez: el link cambia ya.
    None si el evento no existe o no está publicado."""
    if not isinstance(n, int) or isinstance(n, bool) or not 1 <= n <= N_MAX or tipo not in ('habiles', 'corridos'):
        raise ValueError('Días inválidos')
    fila = db.session.get(SchedEvento, evento_id)
    e = normal_evento(evento_id, fila.datos) if fila else None
    if not e or not version_publicada(e):
        return None
    reservas = {'modo': 'dias', 'n': n, 'tipo': tipo, 'desde': '', 'hasta': ''}
    p = json.loads(e['publicado'])
    p['ev'] = {**p['ev'], 'reservas': reservas}
    fila.datos = {**(fila.datos or {}), 'reservas': reservas, 'publicado': js_json(p)}
    fila.actualizado_por_id = usuario_id
    servicio._subir_version()
    db.session.commit()
    return reservas
