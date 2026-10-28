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

const vencida = (t, ahora) => Boolean(t?.vence) && new Date(t.vence) < ahora;

export const COLAS = [
    { value: 'esperan', label: 'Esperan respuesta', cumple: (c, ahora) => esperaMin(c, ahora) != null, porEspera: true },
    { value: 'esperan_hora', label: 'Esperan más de 1 h', cumple: (c, ahora) => esperaMin(c, ahora) >= HORA, porEspera: true },
    { value: 'sin_leer', label: 'Sin leer', cumple: (c) => c.sin_leer > 0 },
    { value: 'cortadas', label: 'Flujo cortado', cumple: flujoCortado, alerta: true },
    { value: 'bot_pausado', label: 'Bot pausado', cumple: (c) => c.etapas?.auto === 'pausada' },
    { value: 'tarea_vencida', label: 'Con tarea vencida', cumple: (c, ahora) => vencida(c.tarea, ahora), alerta: true },
    { value: 'todas', label: 'Todas', cumple: () => true },
];

export const ETAPAS = [
    { value: 'con_bot', label: 'Con el bot', tramo: 'auto', color: 'var(--info)' },
    { value: 'conversando', label: 'En conversación', tramo: 'manual', color: '#7D63E6' },
    { value: 'link', label: 'Link enviado', tramo: 'agenda', color: 'var(--warning)' },
    { value: 'agendo', label: 'Agendó', tramo: 'agenda', color: 'var(--success)' },
];

const DIA = 86400000;
const cero = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

// hoy · ayer · rango (desde y hasta, días enteros en la hora de quien mira).
export function enRango(iso, rango, desde, hasta, ahora) {
    if (!rango) return true;
    if (!iso) return false;
    const t = new Date(iso).getTime();
    const hoy = cero(ahora);
    if (rango === 'hoy') return t >= hoy;
    if (rango === 'ayer') return t >= hoy - DIA && t < hoy;
    const d = desde ? new Date(`${desde}T00:00`).getTime() : -Infinity;
    const h = hasta ? new Date(`${hasta}T00:00`).getTime() + DIA : Infinity;
    return t >= d && t < h;
}

// «ENARM 2027», «enarm» y «Enarm.» son el mismo examen.
export function examenDe(c) {
    const primera = String(c.examen || '').trim().split(/[\s.,;]+/)[0];
    return primera ? primera.toUpperCase().slice(0, 12) : null;
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

// El último mensaje enviado: 'bot' o el setter asignado (Meta no dice quién del equipo lo mandó).
const enviadoPor = (c) => (c.ultimo_envio?.de === 'bot' ? 'bot' : c.ultimo_envio ? c.asignado?.id ?? null : null);

// `asignado`: null (todos) · 'ninguno' · el id de un setter. `califica`: 'si' · 'no'.
export function cumpleFiltro(c, f, ahora) {
    if (f.etiqueta && !(c.etiquetas || []).some((e) => claveEtiqueta(e) === f.etiqueta)) return false;
    if (f.asignado === 'ninguno' && c.asignado) return false;
    if (f.asignado != null && f.asignado !== 'ninguno' && c.asignado?.id !== f.asignado) return false;
    if (f.etapa && c.etapa !== f.etapa) return false;
    if (f.califica && c.califica !== (f.califica === 'si')) return false;
    if (!enRango(c.inicio, f.inicio, f.inicioDesde, f.inicioHasta, ahora)) return false;
    if (f.envioPor != null && enviadoPor(c) !== f.envioPor) return false;
    return enRango(c.ultimo_envio?.en, f.envio, f.envioDesde, f.envioHasta, ahora);
}

// Las colas de espera van de la que más espera a la que menos; las demás, por el último mensaje.
export function filtrar(lista, { ahora, ...f }) {
    const def = COLAS.find((x) => x.value === f.cola) || COLAS[0];
    const salida = lista.filter((c) => def.cumple(c, ahora) && cumpleFiltro(c, f, ahora));
    if (def.porEspera) salida.sort((a, b) => esperaMin(b, ahora) - esperaMin(a, ahora));
    return salida;
}

export function quien(c) {
    return c.username ? `@${c.username}` : c.nombre || 'Sin usuario';
}
