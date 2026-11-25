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

// Un contacto de WhatsApp (el backend los guarda como `wa:<número>`).
export const esWhatsapp = (c) => Boolean(c?.igsid?.startsWith('wa:'));

// Minutos hasta que ya no se le puede escribir (`ventana.js`): Instagram 7 días desde su último mensaje,
// WhatsApp 24 h. null si ya se cerró o nunca escribió. Se avisa desde las últimas 24 h (WhatsApp: 3 h).
const CIERRE = 7 * 24 * HORA;
const CIERRE_WA = 24 * HORA;
export const AVISO_CIERRE = 24 * HORA;
export const avisoCierre = (c) => (esWhatsapp(c) ? 3 * HORA : AVISO_CIERRE);
export function cierreMin(c, ahora) {
    if (!c.ultimo_entrante_en) return null;
    const falta = (esWhatsapp(c) ? CIERRE_WA : CIERRE) - Math.floor((ahora - new Date(c.ultimo_entrante_en)) / 60000);
    return falta > 0 ? falta : null;
}
const porCerrarse = (c, ahora) => { const m = cierreMin(c, ahora); return m != null && m <= avisoCierre(c); };

// Sin ningún recorrido: escribió pero ninguna palabra clave arrancó un flujo.
export const flujoCortado = (c) => !c.ejecucion || CORTADOS.includes(c.ejecucion.estado);

const vencida = (t, ahora) => Boolean(t?.vence) && new Date(t.vence) < ahora;

export const COLAS = [
    // Por último mensaje: por espera, arriba quedaban las viejas que ya no van (Paula, 25/11/2026).
    { value: 'esperan', label: 'Esperan respuesta', cumple: (c, ahora) => esperaMin(c, ahora) != null },
    { value: 'esperan_hora', label: 'Esperan más de 1 h', cumple: (c, ahora) => esperaMin(c, ahora) >= HORA, porEspera: true },
    { value: 'sin_leer', label: 'Sin leer', cumple: (c) => c.sin_leer > 0 },
    { value: 'por_cerrarse', label: 'Se cierra la ventana', cumple: porCerrarse, porCierre: true, alerta: true },
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

// `asignado`: null (todos) · 'ninguno' · el id de un setter. `califica`: 'si' · 'no'. `fases` y `etiquetas`:
// listas (alcanza con una). `envioPor`: 'lead' (lo último lo escribió el lead), 'bot' o el id del setter.
export function cumpleFiltro(c, f, ahora) {
    // No lead / In-abrible que no volvió a escribir: fuera de la bandeja, salvo que se pida esa etapa en el filtro.
    if (c.cerrada && !f.conCerradas && !(f.fases || []).includes(c.fase)) return false;
    if (f.canal && (f.canal === 'wa') !== esWhatsapp(c)) return false;
    if (f.etiqueta && !(c.etiquetas || []).some((e) => claveEtiqueta(e) === f.etiqueta)) return false;
    if (f.etiquetas?.length && !(c.etiquetas || []).some((e) => f.etiquetas.includes(claveEtiqueta(e)))) return false;
    if (f.fases?.length && !f.fases.includes(c.fase)) return false;
    if (f.envioPor === 'lead') return c.ultimo_de === 'lead' && enRango(c.ultimo_en, f.envio, f.envioDesde, f.envioHasta, ahora)
        && cumpleFiltro(c, { ...f, envioPor: null, envio: null }, ahora);
    if (f.asignado === 'ninguno' && c.asignado) return false;
    if (f.asignado != null && f.asignado !== 'ninguno' && c.asignado?.id !== f.asignado) return false;
    if (f.etapa && c.etapa !== f.etapa) return false;
    if (f.califica && c.califica !== (f.califica === 'si')) return false;
    if (!enRango(c.inicio, f.inicio, f.inicioDesde, f.inicioHasta, ahora)) return false;
    if (f.envioPor != null && enviadoPor(c) !== f.envioPor) return false;
    return enRango(c.ultimo_envio?.en, f.envio, f.envioDesde, f.envioHasta, ahora);
}

// Todo lo ordenable de la bandeja (ADR-W184). `null` en el filtro: el orden de la cola.
const FASES_EN_ORDEN = ['apertura', 'conexion', 'dolor', 'consecuencia', 'compromiso', 'propuesta', 'link', 'confirmacion'];
const nivel = (c) => FASES_EN_ORDEN.indexOf(c.fase);
const vence = (c) => (c.tarea?.vence ? new Date(c.tarea.vence).getTime() : Infinity);
const ultimo = (c) => (c.ultimo_en ? new Date(c.ultimo_en).getTime() : 0);
export const ORDENES = [
    { value: 'espera', label: 'Tiempo de espera', detalle: 'más espera primero', corto: 'por espera', por: (a, b, ahora) => (esperaMin(b, ahora) ?? -1) - (esperaMin(a, ahora) ?? -1) },
    { value: 'cierre', label: 'Cierre de la ventana', detalle: 'la que se cierra antes', corto: 'por cierre de la ventana', por: (a, b, ahora) => (cierreMin(a, ahora) ?? Infinity) - (cierreMin(b, ahora) ?? Infinity) },
    { value: 'fase', label: 'Etapa del setting', detalle: 'la más avanzada primero', corto: 'por etapa', por: (a, b) => nivel(b) - nivel(a) },
    { value: 'fase_asc', label: 'Etapa del setting', detalle: 'la más nueva primero', corto: 'por etapa, de 1 a 8', por: (a, b) => nivel(a) - nivel(b) },
    { value: 'ultimo', label: 'Último mensaje', detalle: 'el más reciente primero', corto: 'por último mensaje', por: (a, b) => ultimo(b) - ultimo(a) },
    { value: 'sin_leer', label: 'Sin leer', detalle: 'primero las que tienen', corto: 'sin leer primero', por: (a, b) => (b.sin_leer || 0) - (a.sin_leer || 0) },
    { value: 'tarea', label: 'Tarea', detalle: 'la que vence antes', corto: 'por tarea', por: (a, b) => vence(a) - vence(b) },
];

/** El orden en uso: el elegido o, sin elegir, el de la cola. */
export function ordenDe(f) {
    if (f.orden) return ORDENES.find((o) => o.value === f.orden) || ORDENES[0];
    const def = COLAS.find((x) => x.value === f.cola) || COLAS[0];
    return ORDENES.find((o) => o.value === (def.porEspera ? 'espera' : def.porCierre ? 'cierre' : 'ultimo'));
}

export function filtrar(lista, { ahora, ...f }) {
    const def = COLAS.find((x) => x.value === f.cola) || COLAS[0];
    const salida = lista.filter((c) => def.cumple(c, ahora) && cumpleFiltro(c, f, ahora));
    const orden = ordenDe(f);
    return salida.sort((a, b) => orden.por(a, b, ahora));
}

// Sin usuario: Instagram no da el perfil de quien nunca escribió (solo le escribimos nosotros); al responder se completa.
/** El @usuario de Instagram cuando arriba se muestra el nombre; null si no hace falta repetirlo. */
export const usuarioDe = (c) => (!esWhatsapp(c) && c.nombre && c.username ? `@${c.username}` : null);

export function quien(c) {
    // El nombre primero (Mario, 25/11: «Nieves Pupo» se leía como @zpg_snow); el @usuario va debajo (`usuarioDe`).
    if (esWhatsapp(c)) return c.nombre || c.username || 'Sin nombre';
    if (c.nombre) return c.nombre;
    if (c.username) return `@${c.username}`;
    return c.nombre || (c.ultimo_entrante_en ? 'Sin usuario' : 'Todavía no respondió');
}
