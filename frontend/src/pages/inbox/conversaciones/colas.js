// Las colas de la bandeja y cómo se ordena cada una. Una conversación «espera» cuando lo último lo
// escribió el lead: la espera corre desde ese mensaje.

const HORA = 60;
// Cada cuánto se vuelven a pedir la lista y el chat abierto (ms).
export const REFRESCO = 20000;
// Un recorrido que se cortó sin terminar: el setter lo puede retomar.
const CORTADOS = ['error', 'ventana_vencida'];

export function esperaMin(c, ahora) {
    if (c.ultimo_de !== 'lead' || !c.ultimo_en) return null;
    return Math.max(0, Math.floor((ahora - new Date(c.ultimo_en)) / 60000));
}

export function textoEspera(min) {
    if (min == null) return '';
    if (min < HORA) return `${min} min`;
    if (min < 24 * HORA) return `${Math.floor(min / HORA)} h ${min % HORA ? `${min % HORA} min` : ''}`.trim();
    return `${Math.floor(min / (24 * HORA))} d`;
}

// Ámbar desde la media hora, rojo desde las 3 h: a esa altura el lead ya se enfrió.
export function colorEspera(min) {
    if (min == null) return undefined;
    if (min >= 3 * HORA) return 'var(--error)';
    if (min >= 30) return 'var(--warning)';
    return 'var(--text-muted)';
}

// Sin ningún recorrido: escribió pero ninguna palabra clave arrancó un flujo.
export const flujoCortado = (c) => !c.ejecucion || CORTADOS.includes(c.ejecucion.estado);

export const COLAS = [
    { value: 'esperan', label: 'Esperan respuesta', cumple: (c, ahora) => esperaMin(c, ahora) != null, porEspera: true },
    { value: 'esperan_hora', label: 'Esperan más de 1 h', cumple: (c, ahora) => esperaMin(c, ahora) >= HORA, porEspera: true },
    { value: 'cortadas', label: 'Flujo cortado', cumple: flujoCortado, alerta: true },
    { value: 'bot_pausado', label: 'Bot pausado', cumple: (c) => c.bot_pausado },
    { value: 'califican', label: 'Califican', cumple: (c) => c.califica === true },
    { value: 'no_califican', label: 'No califican', cumple: (c) => c.califica === false },
    { value: 'todas', label: 'Todas', cumple: () => true },
];

// «ENARM 2027», «enarm» y «Enarm.» son el mismo examen para filtrar.
export function examenDe(c) {
    const primera = String(c.examen || '').trim().split(/[\s.,;]+/)[0];
    return primera ? primera.toUpperCase().slice(0, 12) : null;
}

export function examenes(lista) {
    const cuenta = new Map();
    lista.forEach((c) => {
        const e = examenDe(c);
        if (e) cuenta.set(e, (cuenta.get(e) || 0) + 1);
    });
    return [...cuenta].sort((a, b) => b[1] - a[1]);
}

// Los setters a los que están asignadas las conversaciones de la lista, con cuántas tiene cada uno.
export function asignados(lista) {
    const cuenta = new Map();
    lista.forEach((c) => {
        if (!c.asignado) return;
        const previo = cuenta.get(c.asignado.id) || { ...c.asignado, n: 0 };
        cuenta.set(c.asignado.id, { ...previo, n: previo.n + 1 });
    });
    return [...cuenta.values()].sort((a, b) => b.n - a.n);
}

export const claveEtiqueta = (e) => `${e.group_id || ''}:${e.name}`;

// Las etiquetas puestas en la lista, con cuántas conversaciones tiene cada una.
export function etiquetasDe(lista) {
    const cuenta = new Map();
    lista.forEach((c) => (c.etiquetas || []).forEach((e) => {
        const k = claveEtiqueta(e);
        cuenta.set(k, { ...e, n: (cuenta.get(k)?.n || 0) + 1 });
    }));
    return [...cuenta.values()].sort((a, b) => b.n - a.n);
}

const mismoDia = (iso, ahora) => Boolean(iso) && new Date(iso).toDateString() === ahora.toDateString();

// `asignado`: null (todos) · 'ninguno' · el id de un setter. `hoy`: el último mensaje es de hoy.
export function cumpleFiltro(c, { examen, asignado, etiqueta, hoy }, ahora) {
    if (examen && examenDe(c) !== examen) return false;
    if (etiqueta && !(c.etiquetas || []).some((e) => claveEtiqueta(e) === etiqueta)) return false;
    if (asignado === 'ninguno' && c.asignado) return false;
    if (asignado != null && asignado !== 'ninguno' && c.asignado?.id !== asignado) return false;
    return !hoy || mismoDia(c.ultimo_en, ahora);
}

// Las colas de espera van de la que más espera a la que menos; las demás, por el último mensaje.
export function filtrar(lista, { cola, examen, asignado = null, etiqueta = null, hoy = false, ahora }) {
    const def = COLAS.find((x) => x.value === cola) || COLAS[0];
    const salida = lista.filter((c) => def.cumple(c, ahora) && cumpleFiltro(c, { examen, asignado, etiqueta, hoy }, ahora));
    if (def.porEspera) salida.sort((a, b) => esperaMin(b, ahora) - esperaMin(a, ahora));
    return salida;
}

export function quien(c) {
    return c.username ? `@${c.username}` : c.nombre || 'Sin usuario';
}
