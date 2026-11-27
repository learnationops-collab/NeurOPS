import { soloDigitos, href } from './escalas';
import { cierreNum } from './closers';

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
    { id: 'sinVideo', label: 'Sin video de presentación' },
];

export const CIERRES = [0, 20, 30, 50];

export const FILTRO_DEFAULT = { estados: [], quitar: [], cierreMin: 0 };
const CLAVE = 'neurops-talent-filtro-antiguos-v1';

export const leerFiltro = () => {
    try {
        const f = JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
        return f ? { ...FILTRO_DEFAULT, ...f } : FILTRO_DEFAULT;
    } catch { return FILTRO_DEFAULT; }
};
export const guardarFiltro = (f) => {
    try { window.localStorage.setItem(CLAVE, JSON.stringify(f)); } catch { /* sin almacenamiento: dura la sesión */ }
};

export const cuantosActivos = (f) => f.estados.length + f.quitar.length + (f.cierreMin ? 1 : 0);

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
    sinVideo: (p) => !href(p.video),
};

/** Pasa el filtro salvo, opcionalmente, una de sus partes (para contar cuánto suma cada opción). */
export const pasa = (p, f, ctx, salvo) => {
    if (salvo !== 'estados' && f.estados.length && !f.estados.includes(p.veredicto)) return false;
    if (salvo !== 'cierre' && f.cierreMin && !((cierreNum(p.cierre) ?? -1) >= f.cierreMin)) return false;
    return f.quitar.every((id) => id === salvo || !quita[id]?.(p, ctx));
};

export const cuantosQuita = (lista, id, ctx) => lista.filter((p) => quita[id](p, ctx)).length;

// --- CSV ---

const celda = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const descargarCsv = (lista, etiquetaEstado) => {
    const cab = ['Nombre', 'Estado', 'Cierre %', 'WhatsApp', 'Link WhatsApp', 'Email', 'País', 'Video', 'Postuló', 'Formulario'];
    const filas = lista.map((p) => {
        const d = soloDigitos(p.whatsapp);
        return [
            p.nombre,
            etiquetaEstado(p.veredicto),
            cierreNum(p.cierre) ?? (p.cierre === 'nada' ? 'No mide' : ''),
            p.whatsapp || '',
            d.length >= 7 ? `https://wa.me/${d}` : '',
            p.email || '',
            p.pais || '',
            href(p.video) || '',
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
