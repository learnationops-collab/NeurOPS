// Formato de los números del reporte y nombres de los días.
export const NDIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// 'YYYY-MM-DD' → Date local (sin corrimiento de zona).
export const aFecha = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const nomDia = (s) => { const f = aFecha(s); return `${NDIA[f.getDay()]} ${f.getDate()}`; };
export const fechaLarga = (s) => {
    const t = aFecha(s).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
};

// Partes de un número formateado: { txt, suf } (suf va en <small>). min = minutos → «5h 40».
export function partes(v, f = 'n') {
    if (f === 'usd') return { txt: 'US$ ' + Math.round(v).toLocaleString('es-AR') };
    if (f === '%') return { txt: String(Math.round(v)), suf: '%' };
    if (f === 'min') return { txt: String(Math.floor(v / 60)), suf: 'h', post: ' ' + String(Math.round(v % 60)).padStart(2, '0') };
    return { txt: Math.round(v).toLocaleString('es-AR') };
}
export const plano = (v, f = 'n') => {
    if (v == null) return '—';
    const p = partes(v, f);
    return p.txt + (p.suf || '') + (p.post || '');
};

// Iniciales para el avatar de una persona.
export const iniciales = (n) => {
    const p = String(n || '').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p[1] || '').charAt(0)).toUpperCase();
};

export const PALETA = ['var(--rp-acento)', '#2fd3ff', 'var(--rp-ok)', 'var(--rp-warn)', '#f472b6', '#a3e635'];

// Estado del día (API) → clase de la tira y del chip.
export const CLASE_ESTADO = { en_curso: 'pend', completo: 'ok', incompleto: 'venc', no_laborable: 'libre' };
export const TEXTO_ESTADO = { en_curso: 'En curso', completo: 'Completo', incompleto: 'Incompleto', no_laborable: 'No laborable' };
export const COLOR_ESTADO = { en_curso: 'var(--rp-warn)', completo: 'var(--rp-ok)', incompleto: 'var(--rp-mal)', no_laborable: 'var(--ln-text-muted)' };
