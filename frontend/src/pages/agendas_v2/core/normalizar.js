// Normalizadores: todo documento que entra (del almacenamiento o de una edición) pasa por acá.
// Son la definición del esquema; las tablas sched_* del backend tienen que aceptar exactamente esto.

import {
    COLORES, CONTACTO, DURACIONES, ESTRATEGIAS, FIN_DEF, HORAS, ICONOS_ROL, INTEG_DEF, MS_U, PERM_KEYS, PERM_VIEJOS,
    TIPOS, TIPOS_CONTACTO, TZ_DEF, conOpciones, icoNombre, zonaValida,
} from './catalogos';
import { abrevDe, clonar, entero, esc, slugify, uid } from './util';

export const COLECCIONES = ['funnels', 'formularios', 'personas', 'grupos', 'eventos', 'roles'];

export function emailOk(m) {
    m = String(m || '').trim().toLowerCase().slice(0, 120);
    return /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(m) ? m : '';
}
export function urlOk(u) { u = String(u || '').trim().slice(0, 500); return /^https:\/\/[^\s<>"']+$/i.test(u) ? u : ''; }
export function fechaOk(f) { return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : ''; }
export function fotoOk(f) { return typeof f === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(f) && f.length < 150000 ? f : ''; }

// Descripción con formato: solo negrita, cursiva, subrayado, listas, saltos y links http(s). Todo lo demás queda como texto.
const TAGS_OK = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', UL: 'ul', OL: 'ol', LI: 'li', BR: 'br', P: 'p', DIV: 'div', A: 'a' };
export function limpiarHTML(x) {
    x = String(x || '').slice(0, 20000);
    if (!x.trim()) return '';
    if (typeof document === 'undefined') return esc(x.replace(/<[^>]+>/g, ''));
    const t = document.createElement('template');
    t.innerHTML = x;
    const walk = (n) => {
        let out = '';
        n.childNodes.forEach(c => {
            if (c.nodeType === 3) { out += esc(c.nodeValue); return; }
            if (c.nodeType !== 1 || /^(SCRIPT|STYLE|TEMPLATE|IFRAME|OBJECT)$/.test(c.tagName)) return;
            const tag = TAGS_OK[c.tagName], inner = walk(c);
            if (!tag) { out += inner; return; }
            if (tag === 'br') { out += '<br>'; return; }
            if (tag === 'a') {
                const h = c.getAttribute('href') || '';
                out += /^(https?:\/\/|mailto:)/i.test(h) ? '<a href="' + esc(h) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>' : inner;
                return;
            }
            out += '<' + tag + '>' + inner + '</' + tag + '>';
        });
        return out;
    };
    const r = walk(t.content);
    return r.replace(/<br>/g, '').replace(/<[^>]+>/g, '').trim() ? r : '';
}

export function normalPregunta(q) {
    q = q || {};
    const t = String(q.tipo || 'texto');
    return {
        id: String(q.id || uid('q')).slice(0, 40), tipo: t, titulo: String(q.titulo || '').slice(0, 300), ayuda: String(q.ayuda || '').slice(0, 300),
        placeholder: String(q.placeholder || '').slice(0, 80), obligatoria: q.obligatoria !== false, esNombre: q.esNombre === true,
        peso: entero(q.peso, 0, 5, conOpciones(t) ? 1 : 0),
        opciones: (Array.isArray(q.opciones) ? q.opciones : []).slice(0, 60).map(o => {
            o = typeof o === 'string' ? { texto: o } : (o || {});
            return { id: String(o.id || uid('o')).slice(0, 40), texto: String(o.texto || '').slice(0, 200), puntos: entero(o.puntos, 0, 10, null), descalifica: o.descalifica === true };
        }),
    };
}

export function normalReglas(reglas) {
    return (Array.isArray(reglas) ? reglas : []).slice(0, 20).map(r => {
        r = r || {};
        return {
            id: String(r.id || uid('r')).slice(0, 40), grupo: String(r.grupo || ''),
            cond: (Array.isArray(r.cond) ? r.cond : []).slice(0, 8).map(c => { c = c || {}; return { q: String(c.q || ''), ops: (Array.isArray(c.ops) ? c.ops : []).map(String).slice(0, 60) }; }),
        };
    });
}

export function normalForm(id, d) {
    d = d || {};
    const ct = { nombre: true, telefono: true, email: true, instagram: true };
    if (d.contacto && typeof d.contacto === 'object') Object.keys(ct).forEach(k => { ct[k] = d.contacto[k] !== false; });
    const ps = [];
    (Array.isArray(d.preguntas) ? d.preguntas : []).slice(0, 60).forEach(raw => {
        const q = normalPregunta(raw);
        const k = q.esNombre ? 'nombre' : TIPOS_CONTACTO[q.tipo] ? q.tipo : null;
        if (k) { if (!d.contacto) ct[k] = q.obligatoria; return; } // los datos de contacto no van como preguntas
        if (!TIPOS.some(t => t.k === q.tipo)) q.tipo = 'texto';
        q.esNombre = false;
        ps.push(q);
    });
    const fin = d.fin || {};
    return {
        id, nombre: String(d.nombre || 'Sin nombre').slice(0, 80), contacto: ct, preguntas: ps, reglas: normalReglas(d.reglas), resto: String(d.resto || ''),
        fin: { titulo: String(fin.titulo || FIN_DEF.titulo).slice(0, 120), texto: String(fin.texto == null ? FIN_DEF.texto : fin.texto).slice(0, 300) },
        orden: Number(d.orden) || 0,
    };
}

export function normalFunnel(id, d) {
    d = d || {};
    return {
        id, nombre: String(d.nombre || 'Sin nombre').slice(0, 80), slug: slugify(d.slug) || slugify(d.nombre) || id,
        color: COLORES.includes(d.color) ? d.color : 'azul', activo: d.activo !== false, orden: Number(d.orden) || 0,
        origenes: (Array.isArray(d.origenes) ? d.origenes : []).slice(0, 30)
            .map(o => { o = o || {}; return { id: String(o.id || ''), nombre: String(o.nombre || '').slice(0, 60), setter: String(o.setter || '') }; })
            .filter(o => o.id && (o.nombre || o.setter)),
    };
}

export function normalHorario(h) {
    const o = {};
    h = h && typeof h === 'object' ? h : {};
    for (let d = 0; d < 7; d++) {
        o[d] = (Array.isArray(h[d]) ? h[d] : []).slice(0, 6).map(r => [HORAS.includes(r && r[0]) ? r[0] : '09:00', HORAS.includes(r && r[1]) ? r[1] : '18:00']);
    }
    return o;
}

export function normalPersona(id, d) {
    d = d || {};
    return {
        id, nombre: String(d.nombre || 'Sin nombre').slice(0, 60), email: emailOk(d.email), rol: String(d.rol || 'closer').slice(0, 40), foto: fotoOk(d.foto),
        nivel: entero(d.nivel, 1, 3, 1), color: COLORES.includes(d.color) ? d.color : 'azul', tz: zonaValida(d.tz) ? d.tz : TZ_DEF,
        horario: normalHorario(d.horario), orden: Number(d.orden) || 0,
    };
}

export function normalGrupo(id, d) {
    d = d || {};
    return {
        id, nombre: String(d.nombre || 'Sin nombre').slice(0, 60), estrategia: ESTRATEGIAS[d.estrategia] ? d.estrategia : 'llenar',
        miembros: (Array.isArray(d.miembros) ? d.miembros : []).map(String).slice(0, 30), orden: Number(d.orden) || 0,
    };
}

export function normalEvento(id, d) {
    d = d || {};
    const rs = d.reservas || {}, an = d.antel || {}, pa = d.paso || {}, zn = d.zona || {};
    const dur = DURACIONES.includes(+d.duracion) ? +d.duracion : 45;
    return {
        id, nombre: String(d.nombre || 'Sin nombre').slice(0, 80), slug: slugify(d.slug) || slugify(d.nombre) || id, funnel: String(d.funnel || ''),
        formulario: String(d.formulario || ''), duracion: dur, activo: d.activo !== false,
        publicado: typeof d.publicado === 'string' ? d.publicado : '', orden: Number(d.orden) || 0, persona: String(d.persona || ''),
        reservas: {
            modo: ['dias', 'rango', 'siempre'].includes(rs.modo) ? rs.modo : 'dias', n: entero(rs.n, 1, 365, 30),
            tipo: rs.tipo === 'habiles' ? 'habiles' : 'corridos', desde: fechaOk(rs.desde), hasta: fechaOk(rs.hasta),
        },
        antel: { n: entero(an.n, 0, 999, 4), u: MS_U[an.u] ? an.u : 'h' },
        paso: { n: entero(pa.n, 1, 720, dur <= 30 ? 30 : 60), u: pa.u === 'h' ? 'h' : 'min', pers: pa.pers === true },
        zona: { modo: zn.modo === 'fija' ? 'fija' : 'auto', tz: zonaValida(zn.tz) ? zn.tz : TZ_DEF },
        desc: limpiarHTML(d.desc), redir: urlOk(d.redir),
        // Indicaciones para el lead: van en la invitación de Google Calendar (texto plano).
        indic: typeof d.indic === 'string' ? d.indic.slice(0, 2000) : '',
    };
}

export function normalRol(id, d) {
    d = d || {};
    const ac = [];
    (Array.isArray(d.accesos) ? d.accesos : []).forEach(a => {
        (PERM_VIEJOS[a] || [a]).forEach(k => { if (PERM_KEYS.includes(k) && !ac.includes(k)) ac.push(k); });
    });
    const nom = String(d.nombre || 'Sin nombre').slice(0, 60);
    const ab = String(d.abrev || '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, '').toUpperCase().slice(0, 4);
    return {
        id, nombre: nom, abrev: ab || abrevDe(nom), icono: ICONOS_ROL.some(x => x[0] === d.icono) ? d.icono : icoNombre(nom),
        color: COLORES.includes(d.color) ? d.color : '', atiende: d.atiende === true, accesos: ac, orden: Number(d.orden) || 0,
    };
}

export function normalPerfil(p) {
    p = p || {};
    return {
        nombre: String(p.nombre || '').slice(0, 60), apellido: String(p.apellido || '').slice(0, 60), funcion: String(p.funcion || '').slice(0, 60),
        foto: fotoOk(p.foto), persona: String(p.persona || ''),
    };
}

export function normalInteg(d) {
    d = d || {};
    const o = clonar(INTEG_DEF);
    Object.keys(o).forEach(k => {
        const x = d[k] || {};
        Object.keys(o[k]).forEach(c => {
            o[k][c] = typeof o[k][c] === 'boolean' ? (x[c] == null ? o[k][c] : x[c] === true) : String(x[c] || '').replace(/[^0-9]/g, '').slice(0, 20);
        });
    });
    return o;
}

export const NORM = { funnels: normalFunnel, formularios: normalForm, personas: normalPersona, grupos: normalGrupo, eventos: normalEvento, roles: normalRol };

// Las preguntas de contacto no se guardan: se arman al vuelo con los textos fijos de CONTACTO.
export function contactoPreguntas(f) {
    return CONTACTO.map(c => normalPregunta({
        id: 'c-' + c.k, tipo: c.tipo, titulo: c.titulo, ayuda: c.ayuda, placeholder: c.placeholder,
        obligatoria: f.contacto[c.k], esNombre: c.k === 'nombre', peso: 0,
    }));
}
export function preguntasFlujo(f) { return contactoPreguntas(f).concat(f.preguntas); }
