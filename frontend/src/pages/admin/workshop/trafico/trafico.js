/**
 * Las cuentas y definiciones de la pestaña «Tráfico landings» de Workshop (16/10/2026): el período,
 * los formatos y las columnas y facetas de las dos listas (el ranking por landing / fuente / campaña y
 * el detalle de visitas). Los números los arma el backend (`app/api/workshop_trafico.py`).
 */

const pad = (n) => String(n).padStart(2, '0');
/** Día de calendario LOCAL: el backend corta el rango a las 00:00 de La Paz, y `toISOString` daría el de UTC. */
export const diaLocal = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
const masDias = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);

/** Los mismos períodos que Marketing (el selector del Administrador de anuncios de Meta). */
export const PERIODOS = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'ayer', label: 'Ayer' },
    { key: 'ultimos_7', label: 'Últimos 7 días' },
    { key: 'ultimos_30', label: 'Últimos 30 días' },
    { key: 'ultimos_90', label: 'Últimos 90 días' },
    { key: 'este_mes', label: 'Este mes' },
    { key: 'mes_pasado', label: 'Mes pasado' },
    { key: 'personalizado', label: 'Personalizado', quedaAbierto: true },
];
export const PERIODO_POR_DEFECTO = 'ultimos_30';

/** { desde, hasta } de un período, en días locales. `null` para «Personalizado» o uno que no existe. */
export const rangoDePeriodo = (key, hoy = new Date()) => {
    const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    switch (key) {
        case 'hoy': return { desde: diaLocal(h), hasta: diaLocal(h) };
        case 'ayer': return { desde: diaLocal(masDias(h, -1)), hasta: diaLocal(masDias(h, -1)) };
        case 'ultimos_7': return { desde: diaLocal(masDias(h, -6)), hasta: diaLocal(h) };
        case 'ultimos_30': return { desde: diaLocal(masDias(h, -29)), hasta: diaLocal(h) };
        case 'ultimos_90': return { desde: diaLocal(masDias(h, -89)), hasta: diaLocal(h) };
        case 'este_mes': return { desde: diaLocal(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: diaLocal(h) };
        case 'mes_pasado': return {
            desde: diaLocal(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
            hasta: diaLocal(new Date(h.getFullYear(), h.getMonth(), 0)),
        };
        default: return null;
    }
};

/** Tope del detalle de visitas que se pide: la lista las dibuja de a páginas al scrollear. */
export const LIMITE_DETALLE = 5000;

export const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
export const pct = (n) => (n == null ? '—' : `${Number(n).toFixed(1).replace(/\.0$/, '')}%`);
export const diaCorto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Un instante del backend (ISO con Z) en el reloj de quien mira: `16/10 14:05`. */
export const fechaHora = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** El referrer sin protocolo ni barra final: `institute.thelearnation.com/live-class-t5`. */
export const referrerCorto = (url) => (url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : null);

export const EVENTO = { visita: 'Visita', clic_whatsapp: 'Clic al grupo' };

// Lo vacío como texto, para poder filtrarlo en el panel de facetas (un null no es una opción).
export const o = (v, vacio) => (v == null || String(v).trim() === '' ? vacio : String(v).trim());
