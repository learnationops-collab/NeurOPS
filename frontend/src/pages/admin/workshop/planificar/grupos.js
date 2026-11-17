// Tipo del taller y sus grupos de WhatsApp por conjunto de anuncios (ADR-W146): las cuentas del modal
// «Grupos», sin dibujo. El backend es `workshop_grupos_service`.

export const TIPOS = {
    frio: { texto: 'Frío', color: 'var(--info)', ayuda: 'Anuncios a quien no sigue la cuenta' },
    caliente: { texto: 'Caliente', color: 'var(--brand-secondary)', ayuda: 'Anuncios a quien ya sigue la cuenta' },
};

/** Valor del desplegable para un conjunto que Meta todavía no trajo: se pega su id. */
export const OTRO = '__otro__';

let serie = 0;
const clave = () => `g${++serie}`;

export const filaVacia = () => ({ clave: clave(), id: null, nombre: '', whatsapp_url: '', conjunto_id: '', manual: false });

/** Lo que devuelve la API, como formulario. Un conjunto guardado que Meta no lista queda en modo «pegar id». */
export const aFormulario = (datos) => {
    const conocidos = new Set((datos.conjuntos || []).map((c) => c.id));
    return {
        tipo: datos.tipo || '',
        general: datos.general || '',
        filas: (datos.grupos || []).map((g) => ({
            clave: clave(), id: g.id, nombre: g.nombre || '', whatsapp_url: g.whatsapp_url || '',
            conjunto_id: g.conjunto_id || '', manual: Boolean(g.conjunto_id) && !conocidos.has(g.conjunto_id),
        })),
    };
};

export const aCuerpo = (form) => ({
    tipo: form.tipo || null,
    general: form.general.trim() || null,
    grupos: form.filas.map((f) => ({
        ...(f.id ? { id: f.id } : {}),
        nombre: f.nombre.trim(), whatsapp_url: f.whatsapp_url.trim(), conjunto_id: f.conjunto_id.trim() || null,
    })),
});

/** «CG1 · Intereses» → 'CG1': el código con el que arranca el nombre del conjunto o del grupo. */
export const codigoDe = (nombre) => (/^\s*([A-Za-z]+\d+)\b/.exec(nombre || '') || [])[1] || '';

/** Nombre que se propone al elegir el conjunto: su código (o su nombre) y el día del taller, «CG1 21/11». */
export const nombreSugerido = (conjunto, fechaTaller) => {
    const [, mes, dia] = (fechaTaller || '').split('-');
    const base = codigoDe(conjunto?.nombre) || (conjunto?.nombre || '').trim().slice(0, 40);
    return [base, dia && mes ? `${dia}/${mes}` : ''].filter(Boolean).join(' ');
};

/** Las opciones del desplegable de una fila: sin conjunto, los que Meta trajo y no usa otra fila, y «pegar id». */
export const opcionesDeConjunto = (conjuntos, filas, fila) => {
    const usados = new Set(filas.filter((f) => f.clave !== fila.clave).map((f) => f.conjunto_id).filter(Boolean));
    return [
        { value: '', label: 'Sin conjunto' },
        ...conjuntos.filter((c) => !usados.has(c.id)).map((c) => ({
            value: c.id,
            label: [c.nombre || c.id, c.campana, c.activo ? null : 'pausado'].filter(Boolean).join(' · '),
        })),
        { value: OTRO, label: 'Otro: pegar el id' },
    ];
};

/** Los conjuntos con anuncios activos que todavía no tienen grupo en este taller. */
export const activosSinGrupo = (conjuntos, filas) => {
    const conGrupo = new Set(filas.map((f) => f.conjunto_id).filter(Boolean));
    return conjuntos.filter((c) => c.activo && !conGrupo.has(c.id));
};

/**
 * El link para probar a qué grupo manda la landing: la del conjunto (o la general) con `utm_term`.
 * El conjunto va por su id; un grupo sin conjunto, por el código de su nombre. Null si no hay con qué.
 */
export const enlaceDePrueba = (fila, conjuntos, landing) => {
    const term = fila.conjunto_id.trim() || codigoDe(fila.nombre).toLowerCase();
    const base = conjuntos.find((c) => c.id === fila.conjunto_id)?.landing || landing;
    if (!term || !base) return null;
    return `${base}${base.includes('?') ? '&' : '?'}utm_term=${encodeURIComponent(term)}`;
};

/** Lo primero que le falta al formulario para poder guardarse, o null. */
export const loQueFalta = (form) => {
    for (const f of form.filas) {
        if (!f.nombre.trim()) return 'A un grupo le falta el nombre';
        if (!f.whatsapp_url.trim()) return `Al grupo «${f.nombre.trim()}» le falta el enlace`;
    }
    return null;
};
