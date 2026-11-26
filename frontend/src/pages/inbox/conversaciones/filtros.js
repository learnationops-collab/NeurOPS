// El filtro de la bandeja y los filtros guardados: los predefinidos y los que arma cada uno, que viven en
// este navegador (localStorage, sin tabla: decidido el 27/10/2026).

// `etiqueta`: la clave de `claveEtiqueta` («idDelGrupo:Nombre»). `inicio` y `envio`: hoy · ayer (desde ayer) ·
// semana · rango (con `…Desde` y `…Hasta`, fechas yyyy-mm-dd). `envioPor`: 'lead', 'bot' o el id del setter. `fases`
// y `etiquetas`: listas (ADR-W184); `orden`: el de `ORDENES` (null: el de la cola). `origen`: anuncios · inbound ·
// bienvenida. Seguimientos hechos (ADR-W254), en las fases elegidas: `fuCant` null · 0 (ninguno) · 'alguno' · 1 · 2 ·
// 3 · '4+'; `fuCuando`, como `inicio` sin rango; `fuResp` 'si' · 'no' (el último). `toca`: lo pide la cadencia.
export const VACIO = {
    cola: 'todas', canal: null, asignado: null, etiqueta: null, etapa: null, califica: null, fases: [], etiquetas: [], orden: null,
    inicio: null, inicioDesde: '', inicioHasta: '', envioPor: null, envio: null, envioDesde: '', envioHasta: '',
    origen: null, fuCant: null, fuCuando: null, fuResp: null, toca: false,
};
// Las que cuentan como «un filtro puesto» (las fechas de un rango van con su filtro; el orden no filtra).
const CLAVES = ['cola', 'canal', 'asignado', 'etiqueta', 'etapa', 'califica', 'fases', 'etiquetas', 'inicio', 'envioPor', 'envio',
    'origen', 'fuCant', 'fuCuando', 'fuResp', 'toca'];
const DOLOR = ['dolor', 'consecuencia', 'compromiso'];
const CLAVE = 'inbox-filtros';

// Los rápidos (ADR-W254): un toque pone el filtro entero.
export const predefinidos = (yo) => [
    { id: 'todos', label: 'Todos', detalle: 'Sin filtros', filtro: { ...VACIO } },
    { id: 'mios_esperan', label: 'Míos sin respuesta', detalle: 'Esperan que les contestes', filtro: { ...VACIO, cola: 'esperan', asignado: yo } },
    { id: 'mios_hora', label: 'Esperan más de 1 h', detalle: 'Los más urgentes', filtro: { ...VACIO, cola: 'esperan_hora', asignado: yo } },
    { id: 'mios_cierre', label: 'Se cierra la ventana', detalle: 'Poco tiempo para escribirles', filtro: { ...VACIO, cola: 'por_cerrarse', asignado: yo } },
    { id: 'mios_toca', label: 'Toca seguimiento', detalle: 'Lo pide la cadencia de su fase', filtro: { ...VACIO, asignado: yo, toca: true } },
    { id: 'mios_recientes', label: 'Nuevos de hoy', detalle: 'Empezaron hoy', filtro: { ...VACIO, asignado: yo, inicio: 'hoy' } },
    { id: 'mios_dolor', label: 'Dolor sin seguimiento', detalle: 'Nunca les volviste a escribir', filtro: { ...VACIO, asignado: yo, fases: DOLOR, fuCant: 0 } },
    { id: 'mios_link', label: 'Link sin respuesta', detalle: 'Les mandaste el link y no contestaron', filtro: { ...VACIO, asignado: yo, fases: ['link'], envioPor: yo } },
    { id: 'mios', label: 'Todos los míos', detalle: 'Asignadas a vos', filtro: { ...VACIO, asignado: yo } },
    { id: 'sin_asignar', label: 'Sin asignar', detalle: 'Nadie las tiene', filtro: { ...VACIO, asignado: 'ninguno' } },
];

const mismo = (x, y) => (Array.isArray(x) || Array.isArray(y) ? JSON.stringify([...(x || [])].sort()) === JSON.stringify([...(y || [])].sort()) : x === y);
export const igual = (a, b) => Object.keys(VACIO).every((k) => mismo(a[k] ?? VACIO[k], b[k] ?? VACIO[k]));

// Cuántos filtros hay puestos (la cola «Todas» no cuenta).
export const activos = (f) => CLAVES.filter((k) => (k === 'cola' ? f.cola !== 'todas'
    : Array.isArray(f[k]) ? f[k].length > 0 : f[k] != null && f[k] !== false)).length;

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
export const RANGOS = [['hoy', 'Hoy'], ['ayer', 'Desde ayer'], ['semana', 'Esta semana']];
const cuando = (f, k) => (f[k] === 'rango' ? `del ${dia(f[`${k}Desde`])} al ${dia(f[`${k}Hasta`])}`
    : (RANGOS.find(([v]) => v === f[k])?.[1] || f[k]).toLowerCase());
const ORIGENES = { anuncios: 'Anuncios', inbound: 'Inbound', bienvenida: 'Bienvenida' };
const cantidad = (v) => (v === 0 ? 'Sin seguimientos' : v === 'alguno' ? 'Con seguimientos'
    : v === '4+' ? '4 o más seguimientos' : `${v} ${v === 1 ? 'seguimiento' : 'seguimientos'}`);

// Lo que hay puesto, en palabras: una parte por filtro, con lo que hay que poner para sacarla y su sección del
// panel (`sec`, para mostrarlo debajo del nombre de la sección).
// `nombre(id)`: cómo se llama el setter; `etiqueta(clave)`: el texto de la etiqueta; `fase(id)`: su nombre.
export function resumen(f, { colas, etapas, nombre, etiqueta, fase = (x) => x }) {
    const partes = [];
    const poner = (sec, texto, quitar) => partes.push({ sec, texto, quitar });
    if (f.cola !== 'todas') poner('estado', colas.find((c) => c.value === f.cola)?.label || f.cola, { cola: 'todas' });
    if (f.etapa) poner('etapa', `En etapa ${etapas.find((e) => e.value === f.etapa)?.label || f.etapa}`, { etapa: null });
    if (f.fases?.length) poner('etapa', `En ${f.fases.map(fase).join(', ')}`, { fases: [] });
    if (f.fuCant != null) poner('seguimientos', cantidad(f.fuCant) + (f.fases?.length ? ' en esa etapa' : ''), { fuCant: null, fuCuando: null });
    if (f.fuCuando) poner('seguimientos', `Último seguimiento ${cuando(f, 'fuCuando')}`, { fuCuando: null });
    if (f.fuResp) poner('seguimientos', f.fuResp === 'si' ? 'Contestó el último seguimiento' : 'No contestó el último seguimiento', { fuResp: null });
    if (f.toca) poner('seguimientos', 'Toca seguimiento', { toca: false });
    if (f.asignado === 'ninguno') poner('personas', 'Sin asignar', { asignado: null });
    else if (f.asignado != null) poner('personas', `Asignadas a ${nombre(f.asignado)}`, { asignado: null });
    if (f.envioPor != null) {
        const quien = f.envioPor === 'bot' ? 'el bot' : f.envioPor === 'lead' ? 'el lead' : nombre(f.envioPor);
        poner('personas', `Último mensaje de ${quien}`, { envioPor: null });
    }
    if (f.origen) poner('personas', `Origen: ${ORIGENES[f.origen] || f.origen}`, { origen: null });
    if (f.canal) poner('personas', f.canal === 'wa' ? 'Por WhatsApp' : 'Por Instagram', { canal: null });
    if (f.califica) poner('personas', f.califica === 'si' ? 'Califican' : 'No califican', { califica: null });
    if (f.inicio) poner('fechas', `Empezaron ${cuando(f, 'inicio')}`, { inicio: null, inicioDesde: '', inicioHasta: '' });
    if (f.envio) poner('fechas', `Último mensaje ${cuando(f, 'envio')}`, { envio: null, envioDesde: '', envioHasta: '' });
    if (f.etiqueta) poner('etiquetas', `Con la etiqueta ${etiqueta(f.etiqueta)}`, { etiqueta: null });
    if (f.etiquetas?.length) poner('etiquetas', `Con ${f.etiquetas.map(etiqueta).join(', ')}`, { etiquetas: [] });
    return partes;
}
