// El filtro de la bandeja y los filtros guardados: los predefinidos y los que arma cada uno, que viven en
// este navegador (localStorage, sin tabla: decidido el 27/10/2026).

// `etiqueta`: la clave de `claveEtiqueta` («idDelGrupo:Nombre»). `inicio` y `envio`: hoy · ayer · rango
// (con `…Desde` y `…Hasta`, fechas yyyy-mm-dd). `envioPor`: 'lead', 'bot' o el id del setter. `fases` y
// `etiquetas`: listas (ADR-W184); `orden`: el de `ORDENES` (null: el de la cola). Se guarda con el filtro.
export const VACIO = {
    cola: 'todas', asignado: null, etiqueta: null, etapa: null, califica: null, fases: [], etiquetas: [], orden: null,
    inicio: null, inicioDesde: '', inicioHasta: '', envioPor: null, envio: null, envioDesde: '', envioHasta: '',
};
// Las que cuentan como «un filtro puesto» (las fechas de un rango van con su filtro; el orden no filtra).
const CLAVES = ['cola', 'asignado', 'etiqueta', 'etapa', 'califica', 'fases', 'etiquetas', 'inicio', 'envioPor', 'envio'];
const CLAVE = 'inbox-filtros';

export const predefinidos = (yo) => [
    { id: 'todos', label: 'Todos', filtro: { ...VACIO } },
    { id: 'mios_recientes', label: 'Míos recientes', filtro: { ...VACIO, asignado: yo, inicio: 'hoy' } },
    { id: 'mios_esperan', label: 'Míos sin respuesta', filtro: { ...VACIO, cola: 'esperan', asignado: yo } },
    { id: 'mios', label: 'Todos los míos', filtro: { ...VACIO, asignado: yo } },
    { id: 'sin_asignar', label: 'Sin asignar', filtro: { ...VACIO, asignado: 'ninguno' } },
];

const mismo = (x, y) => (Array.isArray(x) || Array.isArray(y) ? JSON.stringify([...(x || [])].sort()) === JSON.stringify([...(y || [])].sort()) : x === y);
export const igual = (a, b) => Object.keys(VACIO).every((k) => mismo(a[k] ?? VACIO[k], b[k] ?? VACIO[k]));

// Cuántos filtros hay puestos (la cola «Todas» no cuenta).
export const activos = (f) => CLAVES.filter((k) => (k === 'cola' ? f.cola !== 'todas'
    : Array.isArray(f[k]) ? f[k].length > 0 : f[k] != null)).length;

export function propios() {
    try {
        const v = JSON.parse(window.localStorage.getItem(CLAVE));
        // Los guardados antes de sumar un filtro nuevo lo toman vacío; el «hoy» viejo pasa a inicio de hoy.
        return Array.isArray(v) ? v.filter((x) => x && x.id && x.label && x.filtro).map((x) => {
            const { hoy, examen, ...resto } = x.filtro; // eslint-disable-line no-unused-vars
            // La etiqueta suelta de antes pasa a la lista de etiquetas.
            const etiquetas = resto.etiquetas || (resto.etiqueta ? [resto.etiqueta] : []);
            return { ...x, filtro: { ...VACIO, ...resto, etiqueta: null, etiquetas, ...(hoy ? { inicio: 'hoy' } : {}) } };
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

const dia = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '…');
const cuando = (f, k) => (f[k] === 'rango' ? `del ${dia(f[`${k}Desde`])} al ${dia(f[`${k}Hasta`])}` : f[k]);

// Lo que hay puesto, en palabras: una parte por filtro, con lo que hay que poner para sacarla.
// `nombre(id)`: cómo se llama el setter; `etiqueta(clave)`: el texto de la etiqueta; `fase(id)`: su nombre.
export function resumen(f, { colas, etapas, nombre, etiqueta, fase = (x) => x }) {
    const partes = [];
    if (f.cola !== 'todas') partes.push({ texto: colas.find((c) => c.value === f.cola)?.label || f.cola, quitar: { cola: 'todas' } });
    if (f.asignado === 'ninguno') partes.push({ texto: 'Sin asignar', quitar: { asignado: null } });
    else if (f.asignado != null) partes.push({ texto: `Asignadas a ${nombre(f.asignado)}`, quitar: { asignado: null } });
    if (f.etapa) partes.push({ texto: `En etapa ${etapas.find((e) => e.value === f.etapa)?.label || f.etapa}`, quitar: { etapa: null } });
    if (f.califica) partes.push({ texto: f.califica === 'si' ? 'Califican' : 'No califican', quitar: { califica: null } });
    if (f.etiqueta) partes.push({ texto: `Con la etiqueta ${etiqueta(f.etiqueta)}`, quitar: { etiqueta: null } });
    if (f.fases?.length) partes.push({ texto: `En ${f.fases.map(fase).join(', ')}`, quitar: { fases: [] } });
    if (f.etiquetas?.length) partes.push({ texto: `Con ${f.etiquetas.map(etiqueta).join(', ')}`, quitar: { etiquetas: [] } });
    if (f.inicio) partes.push({ texto: `Empezaron ${cuando(f, 'inicio')}`, quitar: { inicio: null, inicioDesde: '', inicioHasta: '' } });
    if (f.envioPor != null || f.envio) {
        const quien = f.envioPor == null ? '' : ` de ${f.envioPor === 'bot' ? 'el bot' : f.envioPor === 'lead' ? 'el lead' : nombre(f.envioPor)}`;
        partes.push({
            texto: `Último mensaje${quien}${f.envio ? ` ${cuando(f, 'envio')}` : ''}`,
            quitar: { envioPor: null, envio: null, envioDesde: '', envioHasta: '' },
        });
    }
    return partes;
}
