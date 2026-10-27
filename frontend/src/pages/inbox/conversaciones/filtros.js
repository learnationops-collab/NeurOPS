// El filtro de la bandeja (cola, asignado, examen, «hoy») y los filtros guardados: los predefinidos y
// los que arma cada uno, que viven en este navegador (localStorage, sin tabla: decidido el 27/10/2026).

// `etiqueta`: la clave de `claveEtiqueta` («idDelGrupo:Nombre»).
export const VACIO = { cola: 'todas', asignado: null, examen: null, etiqueta: null, hoy: false };
const CLAVE = 'inbox-filtros';

export const predefinidos = (yo) => [
    { id: 'mios_esperan', label: 'Míos esperando', filtro: { ...VACIO, cola: 'esperan', asignado: yo } },
    { id: 'mios_hoy', label: 'Míos de hoy', filtro: { ...VACIO, asignado: yo, hoy: true } },
    { id: 'esperan', label: 'Esperan respuesta', filtro: { ...VACIO, cola: 'esperan' } },
    { id: 'cortados', label: 'Flujos cortados', filtro: { ...VACIO, cola: 'cortadas' } },
    { id: 'sin_asignar', label: 'Sin asignar', filtro: { ...VACIO, asignado: 'ninguno' } },
];

export const igual = (a, b) => Object.keys(VACIO).every((k) => a[k] === b[k]);

// Cuántos filtros hay puestos (la cola «Todas» no cuenta).
export const activos = (f) => Object.keys(VACIO).filter((k) => (k === 'cola' ? f.cola !== 'todas' : Boolean(f[k]))).length;

export function propios() {
    try {
        const v = JSON.parse(window.localStorage.getItem(CLAVE));
        // Los guardados antes de sumar un filtro nuevo (la etiqueta) lo toman vacío.
        return Array.isArray(v) ? v.filter((x) => x && x.id && x.label && x.filtro).map((x) => ({ ...x, filtro: { ...VACIO, ...x.filtro } })) : [];
    } catch {
        return [];
    }
}

export function guardarPropios(lista) {
    try {
        window.localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch { /* sin almacenamiento: el filtro dura lo que la pestaña */ }
}
