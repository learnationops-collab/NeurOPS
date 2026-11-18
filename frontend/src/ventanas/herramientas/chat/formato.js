// Formato del chat: horas, días, colores por persona y los servicios (W, A, L).
export const SISTEMAS = {
    work: { nombre: 'Work', letra: 'W' },
    academy: { nombre: 'Academy', letra: 'A' },
    leadership: { nombre: 'Leadership', letra: 'L' },
};

const COLORES = ['#5B7CFF', '#FF3FA4', '#2FBF8F', '#D9A441', '#E85C4A', '#9B6BFF', '#22B8D8', '#F472B6'];

/** El mismo color para la misma persona, en cualquier lado. */
export const colorDe = (nombre = '') => {
    let h = 0;
    for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return COLORES[h % COLORES.length];
};

export const hora = (iso) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

const clave = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** «Hoy», «Ayer» o la fecha. */
export const dia = (iso) => {
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date(Date.now() - 86400000);
    if (clave(d) === clave(hoy)) return 'Hoy';
    if (clave(d) === clave(ayer)) return 'Ayer';
    return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** Agrupa: separador de día y, dentro, los seguidos de la misma persona (menos de 5 min) van juntos. */
export const conSeparadores = (mensajes) => {
    const filas = [];
    let anterior = null;
    for (const m of mensajes) {
        const d = dia(m.fecha);
        if (!anterior || dia(anterior.fecha) !== d) filas.push({ tipo: 'dia', clave: `d-${m.id}`, texto: d });
        const seguido = anterior && !m.tarjeta && !anterior.tarjeta && !m.responde_a && anterior.autor.nombre === m.autor.nombre
            && dia(anterior.fecha) === d && new Date(m.fecha) - new Date(anterior.fecha) < 300000;
        filas.push({ tipo: 'mensaje', clave: `m-${m.id}`, m, seguido });
        anterior = m;
    }
    return filas;
};
