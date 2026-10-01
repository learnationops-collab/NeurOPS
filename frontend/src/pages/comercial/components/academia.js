/**
 * La Academia (academy.thelearnation.com) en Revisar: columnas, facetas y atajos de Clientes y
 * Ventas, para encontrar a los alumnos que están cumpliendo con sus actividades.
 *
 * Cada fila trae `academia`, armado por el backend desde la FOTO guardada de su cliente (ver
 * `academy_snapshot_service.py`): el estado ya derivado con su tono —el frontend no elige colores—,
 * las métricas y cuándo se leyeron. Una venta que no se cruza con ningún cliente trae `null`: no hay
 * alumno que buscar.
 *
 * Nada de esto consulta la Academia en vivo (no tiene un endpoint masivo y su límite de consultas se
 * comparte con todo el equipo). Por eso cada dato va con su frescura: "hace 3 h" dice cuánto se
 * puede confiar en él.
 *
 * Es un módulo sin JSX por lo mismo que `tablasDef.js`: las facetas y columnas se importan en los
 * tests sin montar React.
 */

const num = (v) => Number(v).toLocaleString('en-US');

/** "hace 5 min", "hace 3 h", "hace 2 días"… o null si no hay fecha. */
export const haceCuanto = (iso, ahora = Date.now()) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(t)) return null;
    const minutos = Math.max(0, Math.round((ahora - t) / 60000));
    if (minutos < 1) return 'recién';
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.round(horas / 24);
    if (dias < 45) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
    const meses = Math.round(dias / 30);
    return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
};

/** Días desde una fecha ISO, o null. */
export const diasDesde = (iso, ahora = Date.now()) => {
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(t) ? null : (ahora - t) / 86400000;
};

// Un dato de la Academia más viejo que esto se pinta como viejo: con el cron andando, cada cliente
// se renueva varias veces por día, así que tres días sin renovar es que algo no está andando.
export const DIAS_DATO_VIEJO = 3;

const marca = (iso) => {
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(t) ? null : t;
};

export const actividadDe = (f) => f.academia?.estado?.label ?? null;
export const esActivoEnAcademia = (f) => f.academia?.estado?.key === 'activo';

/** Tramos para filtrar sin escribir un número: cuánto estudió y cuánto entregó. */
export const tramoHoras = (f) => {
    const h = f.academia?.horas;
    if (h === null || h === undefined) return null;
    if (h < 1) return 'Menos de 1 h';
    if (h < 10) return '1 a 9 h';
    if (h < 50) return '10 a 49 h';
    return '50 h o más';
};

export const tramoEjecuciones = (f) => {
    const n = f.academia?.ejecuciones;
    if (n === null || n === undefined) return null;
    if (n === 0) return 'Ninguna';
    if (n < 10) return '1 a 9';
    if (n < 50) return '10 a 49';
    return '50 o más';
};

/**
 * Lo que dice cada "i". Las definiciones son las del backend (`academy_snapshot_service.py`): si se
 * cambia un umbral allá, el texto de acá tiene que cambiar con él.
 */
export const AYUDA_ACADEMIA = {
    actividad: 'Activo: le vimos actividad en los últimos 7 días (tenía racha, o subió alguno de sus '
        + 'contadores: horas, lecciones, ejecuciones, pomodoros o sesiones). Inactivo: tiene cuenta pero '
        + 'no vimos nada en esa semana. Sin acceso: ninguno de sus correos tiene cuenta en la Academia. '
        + 'Sin correo: solo tenemos el correo que inventa NeurOPS, así que no hay con qué buscarlo. '
        + 'Sin datos: todavía no se lo consultó (o la Academia dio error). '
        + 'La Academia no informa la fecha de su última actividad: se deduce comparando los datos de '
        + 'una lectura con los de la anterior, así que es tan precisa como la sincronización.',
    horas: 'Horas de estudio acumuladas que registra la Academia.',
    progreso: 'Avance del programa según la Academia, en porcentaje.',
    lecciones: 'Lecciones completadas sobre el total de su programa.',
    ejecuciones: 'Ejecuciones (los ejercicios prácticos) que entregó en la Academia, acumuladas.',
    racha: 'Días seguidos que viene estudiando, según la Academia.',
    frescura: 'Cuándo se leyeron estos datos de la Academia. Se renuevan cada vez que alguien abre la '
        + 'pestaña Fulfillment de la ficha y con la sincronización automática, que va de a poco '
        + 'porque la Academia admite 60 consultas por minuto para todo el equipo.',
};

/** Las columnas de la Academia. `academia: true` es lo que hace que ordenar por una muestre sus columnas.
 *
 * `min` es el ancho en px por debajo del cual la columna no se angosta: su rótulo con la «i» de
 * ayuda (y el chip más largo, en la de Academia). Sin él, a ~1000px de tabla los rótulos quedaban
 * en «H…» o se montaban sobre la columna de al lado. Cliente y closer no llevan mínimo: se reparten
 * lo que sobra y cortan con «…». De cuándo es cada dato va debajo del chip de Academia y no en una
 * columna propia: con ella las nueve columnas no entraban a ese ancho. */
export const COLS_ACADEMIA = [
    { key: 'academia', header: 'Academia', width: '1.2fr', min: 112, academia: true,
        ayuda: `${AYUDA_ACADEMIA.actividad} Debajo del estado va de cuándo es el dato: ${AYUDA_ACADEMIA.frescura}`,
        orden: (f) => marca(f.academia?.ultima_actividad), ordenLabel: 'Última actividad en la Academia' },
    { key: 'ac_horas', header: 'Horas', width: '0.65fr', min: 68, academia: true, ayuda: AYUDA_ACADEMIA.horas,
        orden: (f) => f.academia?.horas, ordenLabel: 'Horas de estudio' },
    { key: 'ac_progreso', header: 'Progreso', width: '0.85fr', min: 94, academia: true,
        ayuda: AYUDA_ACADEMIA.progreso, orden: (f) => f.academia?.progreso, ordenLabel: 'Progreso en la Academia' },
    { key: 'ac_lecciones', header: 'Lecciones', width: '0.9fr', min: 96, academia: true,
        ayuda: AYUDA_ACADEMIA.lecciones, orden: (f) => f.academia?.lecciones, ordenLabel: 'Lecciones completadas' },
    { key: 'ac_ejecuciones', header: 'Ejecuciones', width: '1.05fr', min: 112, academia: true,
        ayuda: AYUDA_ACADEMIA.ejecuciones, orden: (f) => f.academia?.ejecuciones, ordenLabel: 'Ejecuciones entregadas' },
    { key: 'ac_racha', header: 'Racha', width: '0.65fr', min: 68, academia: true, ayuda: AYUDA_ACADEMIA.racha,
        orden: (f) => f.academia?.racha, ordenLabel: 'Racha de estudio' },
];

export const FACETAS_ACADEMIA = [
    { key: 'academia', label: 'Actividad en la Academia', de: actividadDe },
    { key: 'academia_horas', label: 'Horas de estudio', de: tramoHoras },
    { key: 'academia_ejecuciones', label: 'Ejecuciones', de: tramoEjecuciones },
];

export const CHIP_ACADEMIA = {
    key: 'academia_activos', label: 'Activos en la Academia', filtro: esActivoEnAcademia, academia: true,
};

export const AGRUPABLE_ACADEMIA = { key: 'academia', label: 'Actividad en la Academia', de: actividadDe };

/** Cómo se escribe cada métrica en su celda. */
export const formatoAcademia = {
    horas: (v) => (v === null || v === undefined ? '—' : `${num(v)} h`),
    progreso: (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 10) / 10}%`),
    lecciones: (hechas, total) => {
        if (hechas === null || hechas === undefined) return '—';
        return total ? `${num(hechas)}/${num(total)}` : num(hechas);
    },
    ejecuciones: (v) => (v === null || v === undefined ? '—' : num(v)),
    racha: (v) => (v === null || v === undefined ? '—' : `${num(v)} ${v === 1 ? 'día' : 'días'}`),
};

/**
 * Cuántos alumnos hay en estas filas y cómo están, contando cada CLIENTE una vez: en Ventas un
 * cliente con tres cobros son tres filas y un solo alumno.
 *
 * `masViejo` es el dato más viejo de todos (la lectura buena, o el último intento si nunca hubo
 * una): es lo que dice cuánto se puede confiar en la tabla entera.
 */
export const resumenAcademia = (filas) => {
    const porCliente = new Map();
    (filas || []).forEach(f => {
        if (f.academia && f.client_id !== null && f.client_id !== undefined && !porCliente.has(f.client_id)) {
            porCliente.set(f.client_id, f.academia);
        }
    });
    let activos = 0;
    let conCuenta = 0;
    let sinDatos = 0;
    let masViejo = null;
    porCliente.forEach(a => {
        const estado = a.estado?.key;
        if (estado === 'activo') activos += 1;
        if (estado === 'activo' || estado === 'inactivo') conCuenta += 1;
        if (estado === 'sin_datos') sinDatos += 1;
        const cuando = a.sincronizado || a.intentado;
        if (cuando && (!masViejo || Date.parse(cuando) < Date.parse(masViejo))) masViejo = cuando;
    });
    return { clientes: porCliente.size, activos, conCuenta, sinDatos, conDatos: porCliente.size - sinDatos,
        masViejo };
};

/**
 * El número de la Academia en la tira de totales de Clientes y Ventas: cuántos alumnos de lo
 * filtrado están activos, sobre cuántos tienen cuenta. Sale de las mismas filas que el resto de la
 * tira, así que cierra con lo que se ve.
 *
 * `null` (no se muestra) si nadie de esas filas tiene cuenta: «0 activos de 0» no dice nada y
 * ocupaba un lugar de la tira.
 */
export const itemTotalAcademia = (filas) => {
    const r = resumenAcademia(filas);
    if (!r.conCuenta) return null;
    return {
        key: 'academia', label: r.activos === 1 ? 'activo' : 'activos', valor: num(r.activos),
        color: 'var(--success)', hint: `de ${num(r.conCuenta)} en la Academia`,
        ayuda: 'Alumnos de esta lista con actividad en la Academia en los últimos 7 días, sobre los '
            + 'que tienen cuenta.',
    };
};
