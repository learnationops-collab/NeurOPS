// Eventos: link, publicación (con la versión del formulario incluida) y revisión antes de publicar.

import { buscar, horasSemana } from './datos';
import { gruposDeForm, reglasRotas } from './formulario';
import { normalEvento, normalForm } from './normalizar';
import { fechaCorta } from './tiempo';
import { fmt } from './util';

const CAMPOS_EV = ['nombre', 'slug', 'funnel', 'formulario', 'duracion', 'activo', 'persona', 'reservas', 'antel', 'paso', 'zona', 'desc', 'redir', 'indic'];
const CAMPOS_FORM = ['id', 'nombre', 'contacto', 'preguntas', 'reglas', 'resto', 'fin'];
const tomar = (o, ks) => ks.reduce((a, k) => { a[k] = o[k]; return a; }, {});

// Lo que queda en vivo al publicar: la configuración completa del evento y una copia del formulario.
// Así, editar un formulario no cambia los links publicados hasta volver a publicar.
export function configDe(e, form) {
    return JSON.stringify({ ev: tomar(e, CAMPOS_EV), form: form ? tomar(form, CAMPOS_FORM) : null });
}
export function sinPublicar(e, form) { return configDe(e, form) !== e.publicado; }

export function versionPublicada(e) {
    if (!e || !e.publicado) return null;
    try {
        const p = JSON.parse(e.publicado);
        if (!p || !p.ev) return null;
        return { evento: normalEvento(e.id, p.ev), form: p.form ? normalForm(p.form.id, p.form) : null };
    } catch { return null; }
}
// Campos del evento tal como se publicaron, para "Descartar". El formulario es compartido y no se toca.
export function camposPublicados(e) {
    const v = versionPublicada(e);
    return v ? tomar(v.evento, CAMPOS_EV) : null;
}
// ¿El formulario cambió desde la última publicación de este evento?
export function formCambio(e, form) {
    if (!e.publicado) return false;
    try { const p = JSON.parse(e.publicado); return JSON.stringify(p.form) !== JSON.stringify(form ? tomar(form, CAMPOS_FORM) : null); } catch { return false; }
}

export function estadoEvento(e, form) {
    if (!e.activo) return { k: 'pausado', n: 'Pausado', c: 'var(--idle)' };
    if (!e.publicado) return { k: 'borrador', n: 'Borrador', c: 'var(--warning)' };
    if (sinPublicar(e, form)) return { k: 'cambios', n: 'Cambios sin publicar', c: 'var(--warning)' };
    return { k: 'vivo', n: 'En vivo', c: 'var(--success)' };
}

export function linkEvento(d, e) { const f = buscar(d, 'funnels', e.funnel); return '/agenda/' + (f ? f.slug + '/' : '') + e.slug; }

export function resumenAgenda(e) {
    const r = e.reservas, a = e.antel, pm = e.paso.n * (e.paso.u === 'h' ? 60 : 1);
    const hasta = r.modo === 'siempre' ? 'Sin límite' : r.modo === 'rango' ? (r.desde && r.hasta ? fechaCorta(r.desde) + ' a ' + fechaCorta(r.hasta) : 'Rango sin fechas') : r.n + (r.tipo === 'habiles' ? ' días hábiles' : ' días');
    return hasta + ' · ' + a.n + ' ' + ({ min: 'min', h: 'h', d: 'd' })[a.u] + ' antes · cada ' + (pm % 60 === 0 && pm >= 60 ? pm / 60 + ' h' : pm + ' min');
}

// Checklist del evento: [ok (1|0), título, detalle].
export function revision(d, e) {
    const f = buscar(d, 'funnels', e.funnel), fo = buscar(d, 'formularios', e.formulario), out = [];
    out.push(f ? (f.activo ? [1, 'Funnel ' + f.nombre, 'Recibe agendas'] : [0, 'Funnel ' + f.nombre + ' pausado', 'Activalo en Configuración']) : [0, 'Falta el funnel', 'Elegilo arriba']);
    out.push(fo ? [1, 'Formulario ' + fo.nombre, (fo.preguntas.length + 4) + ' preguntas'] : [0, 'Falta el formulario', 'Elegilo arriba']);
    if (e.persona) {
        const pf = buscar(d, 'personas', e.persona);
        out.push(!pf ? [0, 'Falta la persona', 'Elegila arriba'] : horasSemana(pf) ? [1, 'Link directo a ' + pf.nombre, fmt(horasSemana(pf), 1) + ' h/sem'] : [0, pf.nombre + ' no tiene horario', 'Cargalo en Team']);
    } else {
        const gids = gruposDeForm(fo);
        const vacios = gids.filter(id => {
            const g = buscar(d, 'grupos', id);
            return !g || !g.miembros.some(pid => { const p = buscar(d, 'personas', pid); return p && horasSemana(p) > 0; });
        });
        const rotas = reglasRotas(fo);
        out.push(!fo ? [0, 'Sin ruteo', 'Elegí un formulario']
            : !gids.length ? [0, 'El formulario no tiene ruteo', 'Configuralo en Forms']
                : rotas.length ? [0, rotas.length === 1 ? 'Una regla apunta a una pregunta borrada' : rotas.length + ' reglas apuntan a preguntas borradas', 'Revisá el ruteo en Forms']
                    : vacios.length ? [0, 'Hay prioridades sin closers con horario', 'Si no hay lugar, pasa a la siguiente prioridad']
                        : [1, 'Ruteo completo', gids.length + (gids.length === 1 ? ' prioridad' : ' prioridades')]);
    }
    const rr = e.reservas;
    out.push(rr.modo === 'rango' && (!rr.desde || !rr.hasta || rr.hasta < rr.desde) ? [0, 'Fechas inválidas', 'Revisá el rango de reservas'] : [1, 'Agenda', resumenAgenda(e)]);
    const dup = d.eventos.some(x => x.id !== e.id && linkEvento(d, x) === linkEvento(d, e));
    out.push(dup ? [0, 'El link ya existe', 'Cambiá el link'] : [1, 'Link único', linkEvento(d, e)]);
    out.push(!e.publicado ? [0, 'Nunca publicado', 'Probalo y publicá']
        : formCambio(e, fo) ? [0, 'El formulario cambió', 'Publicá para que el link use la versión nueva']
            : sinPublicar(e, fo) ? [0, 'Cambios sin publicar', 'El link sigue con la versión anterior']
                : [1, 'Publicado', 'Lo que ves es lo que está en vivo']);
    return out;
}
// Slug libre para un link nuevo: agrega -2, -3… si ya existe en el mismo funnel.
export function slugLibre(d, e, slug) {
    let s = slug, n = 2;
    const usado = (x) => d.eventos.some(o => o.id !== e.id && o.funnel === e.funnel && o.slug === x);
    while (usado(s)) s = slug + '-' + n++;
    return s;
}

// Los pasos de un agendamiento (un evento dentro de su funnel), en el orden en que se arma:
// formulario → equipo → evento → publicado. [{k, ok, n, det}] con `n` corto para la tarjeta del funnel.
export function pasosAgendamiento(d, e) {
    const fo = buscar(d, 'formularios', e.formulario);
    const [, , ruteo, agenda, link] = revision(d, e);
    const est = estadoEvento(e, fo);
    return [
        fo ? { k: 'formulario', ok: true, n: 'Formulario', det: fo.nombre } : { k: 'formulario', ok: false, n: 'Sin formulario', det: 'Elegí o creá el formulario' },
        { k: 'equipo', ok: !!ruteo[0], n: ruteo[0] ? 'Equipo' : 'Sin equipo', det: ruteo[1] + ' · ' + ruteo[2] },
        { k: 'evento', ok: !!(agenda[0] && link[0]), n: agenda[0] && link[0] ? e.duracion + ' min' : 'Revisar evento', det: agenda[0] ? (link[0] ? agenda[2] : link[1]) : agenda[1] },
        { k: 'publicado', ok: est.k === 'vivo', n: est.k === 'vivo' ? 'En vivo' : est.n, det: est.k === 'vivo' ? 'Recibe agendas' : 'El link todavía no recibe agendas con lo último' },
    ];
}

// Lo que le falta a un funnel para recibir agendas: {listo, faltas: [texto], porEvento: {id: pasos}}.
// Listo = activo y con al menos un agendamiento con todos sus pasos en orden.
export function estadoFunnel(d, f) {
    const eventos = d.eventos.filter(e => e.funnel === f.id);
    const porEvento = Object.fromEntries(eventos.map(e => [e.id, pasosAgendamiento(d, e)]));
    const faltas = [];
    if (!f.activo) faltas.push('Funnel pausado');
    if (!eventos.length) faltas.push('Sin agendamientos');
    const pendientes = new Set();
    Object.values(porEvento).forEach(ps => ps.forEach(p => { if (!p.ok) pendientes.add(p.k); }));
    const NOMBRE = { formulario: 'formulario', equipo: 'equipo', evento: 'evento', publicado: 'publicar' };
    if (pendientes.size) faltas.push('Falta: ' + ['formulario', 'equipo', 'evento', 'publicado'].filter(k => pendientes.has(k)).map(k => NOMBRE[k]).join(', '));
    const listo = f.activo && Object.values(porEvento).some(ps => ps.every(p => p.ok));
    return { listo, faltas, porEvento };
}
