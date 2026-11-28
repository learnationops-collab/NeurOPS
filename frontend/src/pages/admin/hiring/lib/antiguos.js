import { soloDigitos, href } from './escalas';
import { NIVEL_INGLES, cierreNum } from './closers';

// «Antiguos» de Closers (ADR-W277): los de búsquedas anteriores, con un filtro para armar la lista
// de a quién volver a escribirle, y su CSV.

export const ESTADOS_ANTIGUOS = [
    { id: 'preseleccionada', label: 'Seleccionados', c: 'var(--success)' },
    { id: 'en_reserva', label: 'Reserva', c: 'var(--info)' },
    { id: 'decidir', label: 'A decidir', c: 'var(--warning)' },
    { id: 'testeo', label: 'En prueba', c: 'var(--warning)' },
    { id: 'baja', label: 'Baja', c: 'var(--error)' },
    { id: 'descartado', label: 'Descartados', c: 'var(--idle)' },
    { id: 'sin_calificar', label: 'Sin calificar', c: 'var(--text-muted-40)' },
];

export const QUITAR = [
    { id: 'repostulados', label: 'Se volvieron a postular', nota: 'Tienen una postulación más nueva' },
    { id: 'incompletos', label: 'No terminaron el formulario' },
    { id: 'sinWhatsapp', label: 'Sin WhatsApp' },
];

// Lo que tienen que tener sí o sí (todas las marcadas a la vez): para rescatar, de los descartados o
// sin calificar, a los que valen un mensaje.
const EXPERIENCIA = ['Tengo formación + experiencia', 'Tengo experiencia'];
export const TENER = [
    { id: 'cierre', label: 'Midieron su % de cierre' },
    { id: 'experiencia', label: 'Experiencia como closer' },
    { id: 'video', label: 'Video de presentación' },
    { id: 'llamada', label: 'Llamada grabada' },
    { id: 'ingles', label: 'Inglés intermedio o más' },
];
const tiene = {
    cierre: (p) => cierreNum(p.cierre) != null,
    experiencia: (p) => EXPERIENCIA.includes(p.conocimiento),
    video: (p) => !!href(p.video),
    llamada: (p) => !!href(p.llamada),
    ingles: (p) => (NIVEL_INGLES[p.ingles] ?? 0) >= 2,
};
export const cumple = (p, id) => tiene[id](p);

export const CIERRES = [0, 20, 30, 50];

export const FILTRO_DEFAULT = { estados: [], quitar: [], tener: [], cierreMin: 0 };
const CLAVE = 'neurops-talent-filtro-antiguos-v1';

export const leerFiltro = () => {
    try {
        const f = JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
        if (!f) return FILTRO_DEFAULT;
        const r = { ...FILTRO_DEFAULT, ...f };
        // «Sin video» pasó de «Sacar» a «Que tengan».
        return { ...r, quitar: r.quitar.filter((id) => QUITAR.some((o) => o.id === id)), tener: r.tener.filter((id) => tiene[id]) };
    } catch { return FILTRO_DEFAULT; }
};
export const guardarFiltro = (f) => {
    try { window.localStorage.setItem(CLAVE, JSON.stringify(f)); } catch { /* sin almacenamiento: dura la sesión */ }
};

export const cuantosActivos = (f) => f.estados.length + f.quitar.length + f.tener.length + (f.cierreMin ? 1 : 0);

// La misma persona se reconoce por su email o por su WhatsApp (los últimos 8 dígitos, así no importa
// si lo escribió con o sin código de país). Al archivar se vacía `dedupe_key`, por eso no sirve.
const clavesDe = (p) => {
    const ks = [];
    const mail = (p.email || '').trim().toLowerCase();
    if (mail.includes('@')) ks.push(`m:${mail}`);
    const d = soloDigitos(p.whatsapp);
    if (d.length >= 7) ks.push(`w:${d.slice(-8)}`);
    return ks;
};

/** Ids de las archivadas que tienen otra postulación más nueva (activa o archivada). */
export const repostulados = (archivadas, activas) => {
    const ultima = new Map();
    [...archivadas, ...activas].forEach((p) => {
        const t = Date.parse(p.created_at) || 0;
        clavesDe(p).forEach((k) => { if (t > (ultima.get(k) || 0)) ultima.set(k, t); });
    });
    const ids = new Set();
    archivadas.forEach((p) => {
        const t = Date.parse(p.created_at) || 0;
        if (clavesDe(p).some((k) => ultima.get(k) > t)) ids.add(p.id);
    });
    return ids;
};

const quita = {
    repostulados: (p, ctx) => ctx.repostulados.has(p.id),
    incompletos: (p) => !p.completo,
    sinWhatsapp: (p) => soloDigitos(p.whatsapp).length < 7,
};

/** Pasa el filtro salvo, opcionalmente, una de sus partes (para contar cuánto suma cada opción). */
export const pasa = (p, f, ctx, salvo) => {
    if (salvo !== 'estados' && f.estados.length && !f.estados.includes(p.veredicto)) return false;
    if (salvo !== 'cierre' && f.cierreMin && !((cierreNum(p.cierre) ?? -1) >= f.cierreMin)) return false;
    if (!f.tener.every((id) => id === salvo || tiene[id](p))) return false;
    return f.quitar.every((id) => id === salvo || !quita[id]?.(p, ctx));
};

export const cuantosQuita = (lista, id, ctx) => lista.filter((p) => quita[id](p, ctx)).length;

// --- Volver a invitar ---

export const LINK_POSTULACION = 'https://institute.thelearnation.com/vacante/';
export const MENSAJE_REINVITAR = `Hola, como estás? Te escribe Dari Gonzalez del equipo de Mario Buhler de Learnation

Hace no mucho te postulaste como closer de ventas con nosotros, y ahora tenemos una vacante disponible para trabajar con +6 leads cualificados por día

Si te interesa postularte, aquí te dejo el link nuevo de postulación así participas del proceso!

Si quedás, nos estaremos contactando pronto!

${LINK_POSTULACION}`;

/** El chat de WhatsApp con el mensaje de reinvitación ya escrito; null sin número. */
export const waReinvitar = (whatsapp) => {
    const d = soloDigitos(whatsapp);
    return d.length >= 7 ? `https://wa.me/${d}?text=${encodeURIComponent(MENSAJE_REINVITAR)}` : null;
};

// --- CSV ---

const celda = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const descargarCsv = (lista, etiquetaEstado) => {
    const cab = ['Nombre', 'Estado', 'Cierre %', 'WhatsApp', 'Link WhatsApp', 'Email', 'País', 'Conocimiento', 'Inglés', 'Video', 'Llamada', 'Postuló', 'Formulario'];
    const filas = lista.map((p) => {
        return [
            p.nombre,
            etiquetaEstado(p.veredicto),
            cierreNum(p.cierre) ?? (p.cierre === 'nada' ? 'No mide' : ''),
            p.whatsapp || '',
            waReinvitar(p.whatsapp) || '',
            p.email || '',
            p.pais || '',
            p.conocimiento || '',
            p.ingles || '',
            href(p.video) || '',
            href(p.llamada) || '',
            (p.created_at || '').slice(0, 10),
            p.completo ? 'Completo' : 'A medias',
        ];
    });
    const texto = [cab, ...filas].map((r) => r.map(celda).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `closers-antiguos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
