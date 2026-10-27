// El filtro de la bandeja y los filtros guardados: los predefinidos y los que arma cada uno, que viven en
// este navegador (localStorage, sin tabla: decidido el 27/10/2026).

// `etiqueta`: la clave de `claveEtiqueta` («idDelGrupo:Nombre»). `inicio` y `envio`: hoy · ayer · rango
// (con `…Desde` y `…Hasta`, fechas yyyy-mm-dd). `envioPor`: 'bot' o el id del setter.
export const VACIO = {
    cola: 'todas', asignado: null, examen: null, etiqueta: null, etapa: null, califica: null,
    inicio: null, inicioDesde: '', inicioHasta: '', envioPor: null, envio: null, envioDesde: '', envioHasta: '',
};
// Las que cuentan como «un filtro puesto» (las fechas de un rango van con su filtro).
const CLAVES = ['cola', 'asignado', 'examen', 'etiqueta', 'etapa', 'califica', 'inicio', 'envioPor', 'envio'];
const CLAVE = 'inbox-filtros';

export const predefinidos = (yo) => [
    { id: 'todos', label: 'Todos', filtro: { ...VACIO } },
    { id: 'mios_recientes', label: 'Míos recientes', filtro: { ...VACIO, asignado: yo, inicio: 'hoy' } },
    { id: 'mios_esperan', label: 'Míos sin respuesta', filtro: { ...VACIO, cola: 'esperan', asignado: yo } },
    { id: 'mios', label: 'Todos los míos', filtro: { ...VACIO, asignado: yo } },
    { id: 'sin_asignar', label: 'Sin asignar', filtro: { ...VACIO, asignado: 'ninguno' } },
];

export const igual = (a, b) => Object.keys(VACIO).every((k) => a[k] === b[k]);

// Cuántos filtros hay puestos (la cola «Todas» no cuenta).
export const activos = (f) => CLAVES.filter((k) => (k === 'cola' ? f.cola !== 'todas' : f[k] != null)).length;

export function propios() {
    try {
        const v = JSON.parse(window.localStorage.getItem(CLAVE));
        // Los guardados antes de sumar un filtro nuevo lo toman vacío; el «hoy» viejo pasa a inicio de hoy.
        return Array.isArray(v) ? v.filter((x) => x && x.id && x.label && x.filtro).map((x) => {
            const { hoy, ...resto } = x.filtro;
            return { ...x, filtro: { ...VACIO, ...resto, ...(hoy ? { inicio: 'hoy' } : {}) } };
        }) : [];
    } catch {
        return [];
    }
}

export function guardarPropios(lista) {
    try {
        window.localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch { /* sin almacenamiento: el filtro dura lo que la pestaña */ }
}
