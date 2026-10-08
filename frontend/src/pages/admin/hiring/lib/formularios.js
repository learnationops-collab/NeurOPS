// Helpers puros del editor de formularios de Talent (ver components/forms/).
// Las preguntas tienen el mismo esquema que el PREGUNTAS del formulario público
// (institute-site, vacante-assistant/formulario) más `on` (si se muestra) y
// `base` (si es una de las originales, que el backend lee por su id).

export const TIPOS = [
    { k: 'radio', n: 'Una opción' },
    { k: 'check', n: 'Varias opciones' },
    { k: 'buscable', n: 'Lista con buscador' },
    { k: 'texto', n: 'Texto corto' },
    { k: 'parrafo', n: 'Párrafo' },
    { k: 'numero', n: 'Número' },
    { k: 'tel', n: 'Teléfono' },
    { k: 'link', n: 'Link' },
    { k: 'intro', n: 'Bienvenida' },
];

export const tipoDe = (k) => TIPOS.find((t) => t.k === k) || TIPOS[0];
export const conOpciones = (tipo) => tipo === 'radio' || tipo === 'check';

// Las que el panel necesita sí o sí: sin nombre el backend no guarda la postulación.
export const FIJAS = new Set(['nombre']);

export const URL_FORMULARIO = import.meta.env.VITE_TALENT_FORM_URL
    || 'https://institute.thelearnation.com/vacante-assistant/formulario/';

export const resumen = (preguntas = []) => {
    const sinIntro = preguntas.filter((q) => q.tipo !== 'intro');
    const activas = sinIntro.filter((q) => q.on !== false);
    return {
        activas: activas.length,
        total: sinIntro.length,
        excluyentes: activas.filter((q) => (q.o || []).some((o) => o.ko)).length,
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

/** Notas que explican lo que hace una pregunta más allá de su texto. */
export const notasDe = (q, tasaBrl) => {
    const n = [];
    if (q.pre === 'sueldo') n.push('Antes de esta pregunta aparece la pantalla «Cómo funciona la remuneración». Si responde mal, vuelve a esa pantalla.');
    if (q.si) {
        const valor = [q.si.es, q.si.igual, q.si.valor, q.si.eq, q.si.en, q.si.valores].find((v) => v != null);
        const texto = Array.isArray(valor) ? valor.join('» o «') : valor;
        n.push(texto
            ? `Condicional: aparece solo si en «${q.si.id}» responde «${texto}».`
            : `Condicional: aparece solo si «${q.si.id}» tiene respuesta.`);
    }
    if (q.ref === 'brl') n.push(`Si vive en Brasil, debajo muestra el equivalente en reales con el cambio de Configuración${tasaBrl ? ` (${String(tasaBrl).replace('.', ',')})` : ''}.`);
    if (q.puntua) n.push('Cada opción suma puntos; el techo de IA de la tabla sale de la opción más alta que marca.');
    if (q.mail) n.push('Valida que sea un correo.');
    if (q.tipo === 'tel') n.push('El código de país se completa solo según el país elegido.');
    if (q.tipo === 'buscable') n.push('La lista cambia según el país: provincias, estados o estados de Venezuela.');
    if (q.tipo === 'intro') n.push('Pantalla de bienvenida: hay que marcar las recomendaciones para empezar.');
    if (q.base && !FIJAS.has(q.id)) n.push('Pregunta original: el panel la lee por su id, así que su tipo no se cambia. Se puede apagar.');
    if (FIJAS.has(q.id)) n.push('Sin el nombre no se puede guardar la postulación: esta pregunta no se apaga.');
    return n;
};
