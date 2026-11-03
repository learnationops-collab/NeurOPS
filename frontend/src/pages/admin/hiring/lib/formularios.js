// Helpers puros del editor de formularios de Talent (ver components/forms/).
// Las preguntas tienen el mismo esquema que el PREGUNTAS del formulario público
// (institute-site, vacante-assistant/formulario) más `on` (si se muestra) y
// `base` (si es una de las originales, que el backend lee por su id; se puede
// borrar, menos el nombre, y el score la toma como apagada).

export const TIPOS = [
    { k: 'radio', n: 'Una opción' },
    { k: 'check', n: 'Varias opciones' },
    { k: 'buscable', n: 'Lista con buscador' },
    { k: 'texto', n: 'Texto corto' },
    { k: 'email', n: 'Correo electrónico' },
    { k: 'parrafo', n: 'Párrafo' },
    { k: 'numero', n: 'Número' },
    { k: 'dinero', n: 'Dinero' },
    { k: 'tel', n: 'Teléfono' },
    { k: 'link', n: 'Link' },
    { k: 'intro', n: 'Bienvenida' },
];

export const tipoDe = (k) => TIPOS.find((t) => t.k === k) || TIPOS[0];

// «Correo electrónico» y «Dinero» se guardan como texto con `mail` y número con
// `dinero`: el formulario público y el backend ya saben dibujarlos y validarlos.
const GUARDADO_COMO = { email: ['texto', { mail: true }], dinero: ['numero', { dinero: true }] };

/** El tipo que ve quien edita (`email`, `dinero` o el guardado). */
export const tipoVisible = (q) => {
    if (q.tipo === 'texto' && q.mail) return 'email';
    if (q.tipo === 'numero' && (q.dinero || q.ref === 'brl')) return 'dinero';
    return q.tipo;
};
export const conOpciones = (tipo) => tipo === 'radio' || tipo === 'check';

// Las que el panel necesita sí o sí: sin nombre el backend no guarda la postulación.
export const FIJAS = new Set(['nombre']);

export const URL_FORMULARIO = import.meta.env.VITE_TALENT_FORM_URL
    || 'https://institute.thelearnation.com/vacante-assistant/formulario/';

// Cada formulario vive en su link: /vacante/<slug>/ (el .htaccess de institute-site
// sirve ahí la página de la vacante, que carga el formulario de ese slug).
export const URL_VACANTES = import.meta.env.VITE_TALENT_VACANTES_URL
    || 'https://institute.thelearnation.com/vacante/';

export const linkDe = (slug) => (slug ? `${URL_VACANTES}${slug}/` : '');

/** Lo que se tipea en el link, en el formato que acepta el backend. */
export const limpiarSlug = (texto) => texto.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').slice(0, 60);

/** Si alguna respuesta la corta: una opción `ko`, una `necesaria` sin marcar o un número fuera de `ko_min`/`ko_max`. */
export const tieneExcluyente = (q) => (q.o || []).some((o) => o.ko || o.necesaria) || q.ko_min != null || q.ko_max != null;

export const resumen = (preguntas = []) => {
    const sinIntro = preguntas.filter((q) => q.tipo !== 'intro');
    const activas = sinIntro.filter((q) => q.on !== false);
    return {
        activas: activas.length,
        total: sinIntro.length,
        excluyentes: activas.filter(tieneExcluyente).length,
    };
};

const azar = () => Math.random().toString(36).slice(2, 8);

/** Un id nuevo que no choque con ninguno del formulario. */
export const idNuevo = (preguntas, prefijo = 'extra') => {
    const usados = new Set(preguntas.map((q) => q.id));
    let id = `${prefijo}_${azar()}`;
    while (usados.has(id)) id = `${prefijo}_${azar()}`;
    return id;
};

export const preguntaNueva = (preguntas) => ({
    id: idNuevo(preguntas),
    bloque: 'Extra',
    tipo: 'radio',
    t: '',
    h: '',
    req: true,
    on: true,
    base: false,
    o: [{ t: 'Opción A' }, { t: 'Opción B' }],
});

export const duplicar = (preguntas, q) => ({
    ...JSON.parse(JSON.stringify(q)),
    id: idNuevo(preguntas),
    base: false,
    t: q.t ? `${q.t} (copia)` : '',
});

/** Mueve la pregunta `id` un lugar (`delta` −1 o +1). */
export const mover = (preguntas, id, delta) => {
    const i = preguntas.findIndex((q) => q.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= preguntas.length) return preguntas;
    const copia = [...preguntas];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    return copia;
};

// Claves que solo tienen sentido en ciertos tipos: al cambiar de tipo se sacan.
const SOLO_EN = {
    mail: ['email'], dinero: ['dinero'], ref: ['dinero'], unidad: ['numero', 'dinero'], min: ['numero', 'dinero'], max: ['numero', 'dinero'],
    ko_min: ['numero', 'dinero'], ko_max: ['numero', 'dinero'], tramos: ['numero', 'dinero'],
    largo: ['parrafo'], puntua: ['radio', 'check'], reqs: ['intro'],
};

/** Cambia el tipo visible de `q`. Si cambia el tipo guardado, una original pasa a ser nueva (otro id, `base: false`):
 * el backend guarda su respuesta en `respuestas_extra` y la original cuenta como
 * borrada (se recupera desde el final). Las condicionales que la nombraban la siguen.
 * Devuelve la lista y el id con que quedó. */
export const cambiarTipo = (preguntas, q, visible) => {
    const [tipo, marcas] = GUARDADO_COMO[visible] || [visible, {}];
    const nueva = { ...q, tipo };
    Object.entries(SOLO_EN).forEach(([k, tipos]) => { if (!tipos.includes(visible)) delete nueva[k]; });
    Object.assign(nueva, marcas);
    if (visible === 'dinero' && !nueva.unidad) nueva.unidad = 'USD por mes';
    // «Necesaria» solo vale en varias opciones.
    if (tipo !== 'check' && (nueva.o || []).some((o) => o.necesaria)) {
        nueva.o = nueva.o.map(({ necesaria, ...o }) => o);
    }
    if (conOpciones(tipo) && !(nueva.o || []).length) nueva.o = [{ t: 'Opción A' }, { t: 'Opción B' }];
    // Mismo tipo guardado (texto ↔ correo, número ↔ dinero): la respuesta sigue en su lugar.
    if (!q.base || q.tipo === tipo) return { lista: preguntas.map((x) => (x.id === q.id ? nueva : x)), id: q.id };
    nueva.id = idNuevo(preguntas, q.id.slice(0, 30));
    nueva.base = false;
    const lista = preguntas.map((x) => {
        if (x.id === q.id) return nueva;
        return x.si && x.si.id === q.id ? { ...x, si: { ...x.si, id: nueva.id } } : x;
    });
    return { lista, id: nueva.id };
};

/** Suelta la pregunta `id` en el lugar de `destinoId` (arrastrar): queda antes
 * si sube y después si baja, y pasa al bloque de la pregunta donde cayó. */
export const soltar = (preguntas, id, destinoId) => {
    const i = preguntas.findIndex((q) => q.id === id);
    const j = preguntas.findIndex((q) => q.id === destinoId);
    if (i < 0 || j < 0 || i === j) return preguntas;
    const copia = [...preguntas];
    const [q] = copia.splice(i, 1);
    copia.splice(j, 0, { ...q, bloque: preguntas[j].bloque });
    return copia;
};

/** Borra `id`. Las que dependían de ella (su `si` la nombraba) quedan apagadas y sin
 * condición: sin la pregunta de la que dependen no aparecerían nunca. */
export const borrar = (preguntas, id) => preguntas
    .filter((q) => q.id !== id)
    .map((q) => {
        if (!q.si || q.si.id !== id) return q;
        const { si, ...resto } = q;
        return { ...resto, on: false };
    });

/** Las preguntas que dependen de `id` (su condición `si` la nombra): sin ella no aparecerían. */
export const dependientes = (preguntas, id) => preguntas.filter((q) => q.si && q.si.id === id);

/** Notas que explican lo que hace una pregunta más allá de su texto. */
export const notasDe = (q) => {
    const n = [];
    if (q.pre === 'sueldo') n.push('Antes de esta pregunta aparece la pantalla «Cómo funciona la remuneración». Si responde mal, vuelve a esa pantalla.');
    if (q.si) {
        const valor = [q.si.es, q.si.igual, q.si.valor, q.si.eq, q.si.en, q.si.valores].find((v) => v != null);
        const texto = Array.isArray(valor) ? valor.join('» o «') : valor;
        n.push(texto
            ? `Condicional: aparece solo si en «${q.si.id}» responde «${texto}».`
            : `Condicional: aparece solo si «${q.si.id}» tiene respuesta.`);
    }
    if (q.mail) n.push('Valida que sea un correo.');
    if (q.tipo === 'tel') n.push('Pide el código de país con un selector que arranca en el país detectado (o el que eligió, si se pregunta). Sin la pregunta de país, el país sale de ese código.');
    if (q.tipo === 'buscable') n.push('La lista cambia según el país: provincias, estados o estados de Venezuela.');
    if (q.tipo === 'intro') n.push('Pantalla de bienvenida: hay que marcar las recomendaciones para empezar.');
    if (FIJAS.has(q.id)) n.push('Sin el nombre no se puede guardar la postulación: esta pregunta no se apaga ni se elimina.');
    return n;
};

// Puntaje de cada pregunta: la misma regla que app/services/hiring_puntaje.py.
export const PTS_MAX = 3;
export const ptsDe = (o) => (o && typeof o === 'object' ? Math.max(0, Math.min(PTS_MAX, Number(o.pts) || 0)) : 0);
const TIPOS_TEXTO = ['parrafo', 'texto'];

/** Importancia (0 no cuenta). Sin guardar: ×1 las de opciones y números, 0 las de texto. */
export const pesoDe = (q) => (q.peso != null ? q.peso : ['radio', 'check', 'numero'].includes(q.tipo) ? 1 : 0);

/** Lo máximo que suma la pregunta (0 = no puntúa). */
export const maximoDe = (q) => {
    const ops = (q.o || []).map(ptsDe);
    if (q.tipo === 'radio') return Math.max(0, ...ops);
    if (q.tipo === 'check') return Math.min(PTS_MAX, ops.reduce((a, b) => a + b, 0));
    if (q.tipo === 'numero') return Math.max(0, ...(q.tramos || []).map(ptsDe));
    if (TIPOS_TEXTO.includes(q.tipo) || q.tipo === 'link') return PTS_MAX;
    return 0;
};

export const puntuaQ = (q) => q.on !== false && q.tipo !== 'intro' && pesoDe(q) > 0 && maximoDe(q) > 0;
