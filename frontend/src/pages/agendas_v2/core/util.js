// Utilidades sin dependencias, compartidas por el núcleo y las pantallas.

export function uid(p) { return (p || '') + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7); }
export function clonar(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
export function letra(j) { return String.fromCharCode(65 + (j % 26)); }
export function pad(n) { return (n < 10 ? '0' : '') + n; }
export function mayus(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
export function enLista(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]; }
export function entero(v, min, max, def) {
    if (v === '' || v === null || v === undefined) return def;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
export function fmt(n, d = 0) { const k = Math.pow(10, d); return String(Math.round(n * k) / k).replace('.', ','); }
export function slugify(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
export function iniciales(n) { const p = String(n || '').trim().split(/\s+/); return ((p[0] || '?').charAt(0) + (p[1] || '').charAt(0)).toUpperCase(); }
export function abrevDe(n) {
    const w = String(n || '').trim().split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w.slice(0, 3).map(x => x[0]).join('') : (w[0] || '?').slice(0, 3)).toUpperCase();
}
export function hashTxt(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h); }
export function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function porIds(arr, ids, clave) {
    return ids.map(id => arr.find(x => (clave ? x[clave] : x) === id)).filter(x => x != null);
}
