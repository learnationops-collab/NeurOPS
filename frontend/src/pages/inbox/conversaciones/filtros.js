// El filtro de la bandeja y los filtros guardados: los predefinidos y los que arma cada uno, que viven en
// este navegador (localStorage, sin tabla: decidido el 27/10/2026).

// `etiqueta`: la clave de `claveEtiqueta` («idDelGrupo:Nombre»). `inicio` y `envio`: hoy · ayer · rango
// (con `…Desde` y `…Hasta`, fechas yyyy-mm-dd). `envioPor`: 'bot' o el id del setter.
export const VACIO = {
    cola: 'todas', asignado: null, etiqueta: null, etapa: null, califica: null,
    inicio: null, inicioDesde: '', inicioHasta: '', envioPor: null, envio: null, envioDesde: '', envioHasta: '',
};
// Las que cuentan como «un filtro puesto» (las fechas de un rango van con su filtro).
const CLAVES = ['cola', 'asignado', 'etiqueta', 'etapa', 'califica', 'inicio', 'envioPor', 'envio'];
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
            const { hoy, examen, ...resto } = x.filtro; // eslint-disable-line no-unused-vars
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

const dia = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '…');
const cuando = (f, k) => (f[k] === 'rango' ? `del ${dia(f[`${k}Desde`])} al ${dia(f[`${k}Hasta`])}` : f[k]);

// Lo que hay puesto, en palabras: una parte por filtro, con lo que hay que poner para sacarla.
// `nombre(id)`: cómo se llama el setter; `etiqueta(clave)`: el texto de la etiqueta.
export function resumen(f, { colas, etapas, nombre, etiqueta }) {
    const partes = [];
    if (f.cola !== 'todas') partes.push({ texto: colas.find((c) => c.value === f.cola)?.label || f.cola, quitar: { cola: 'todas' } });
    if (f.asignado === 'ninguno') partes.push({ texto: 'Sin asignar', quitar: { asignado: null } });
    else if (f.asignado != null) partes.push({ texto: `Asignadas a ${nombre(f.asignado)}`, quitar: { asignado: null } });
    if (f.etapa) partes.push({ texto: `En etapa ${etapas.find((e) => e.value === f.etapa)?.label || f.etapa}`, quitar: { etapa: null } });
    if (f.califica) partes.push({ texto: f.califica === 'si' ? 'Califican' : 'No califican', quitar: { califica: null } });
    if (f.etiqueta) partes.push({ texto: `Con la etiqueta ${etiqueta(f.etiqueta)}`, quitar: { etiqueta: null } });
    if (f.inicio) partes.push({ texto: `Empezaron ${cuando(f, 'inicio')}`, quitar: { inicio: null, inicioDesde: '', inicioHasta: '' } });
    if (f.envioPor != null || f.envio) {
        const quien = f.envioPor == null ? '' : ` de ${f.envioPor === 'bot' ? 'el bot' : nombre(f.envioPor)}`;
        partes.push({
            texto: `Último mensaje${quien}${f.envio ? ` ${cuando(f, 'envio')}` : ''}`,
            quitar: { envioPor: null, envio: null, envioDesde: '', envioHasta: '' },
        });
    }
    return partes;
}
