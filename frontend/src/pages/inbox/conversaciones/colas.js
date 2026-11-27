// Las colas de la bandeja y cómo se ordena cada una. Una conversación «espera» cuando lo último lo
// escribió el lead: la espera corre desde ese mensaje.
import { horasDeVentana } from './ventana';

const HORA = 60;
// Cada cuánto se vuelven a pedir la lista y el chat abierto (ms).
export const REFRESCO = 20000;
// Un recorrido que se cortó sin terminar: el setter lo puede retomar.
const CORTADOS = ['error', 'ventana_vencida'];

// «No requiere respuesta» (ADR-W235): marcada después de lo último del lead, ya no espera hasta que vuelva a escribir.
export const resuelta = (c) => Boolean(c.resuelta_en && c.ultimo_en && new Date(c.resuelta_en) >= new Date(c.ultimo_en));

export function esperaMin(c, ahora) {
    if (c.ultimo_de !== 'lead' || !c.ultimo_en || resuelta(c)) return null;
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

// Minutos hasta que Work ya no le puede escribir (`ventana.js`): 7 días con HUMAN_AGENT aprobado, si no 24 h.
// null si ya se cerró o nunca escribió. Se avisa desde las últimas 24 h (ventana de 24 h: 3 h).
export const avisoCierre = (c) => (horasDeVentana(esWhatsapp(c)) > 24 ? 24 * HORA : 3 * HORA);
export function cierreMin(c, ahora) {
    if (!c.ultimo_entrante_en) return null;
    const falta = horasDeVentana(esWhatsapp(c)) * HORA - Math.floor((ahora - new Date(c.ultimo_entrante_en)) / 60000);
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

// hoy · ayer (desde ayer: ayer y hoy) · semana (los últimos 7 días) · rango (desde y hasta, días enteros en la
// hora de quien mira).
export function enRango(iso, rango, desde, hasta, ahora) {
    if (!rango) return true;
    if (!iso) return false;
    const t = new Date(iso).getTime();
    const hoy = cero(ahora);
    if (rango === 'hoy') return t >= hoy;
    if (rango === 'ayer') return t >= hoy - DIA;
    if (rango === 'semana') return t >= hoy - 6 * DIA;
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

// Los seguimientos que ya le hizo el equipo en esas fases (todas si no hay ninguna): {n, en, resp}, con la fecha
// y la respuesta del último (ADR-W254). La lista los trae por fase en `seguimientos_hechos`.
export function seguimientosDe(c, fases) {
    const porFase = c.seguimientos_hechos || {};
    const elegidas = fases?.length ? fases : Object.keys(porFase);
    let salida = { n: 0, en: null, resp: null };
    elegidas.forEach((f) => {
        const x = porFase[f];
        if (!x) return;
        const masNuevo = !salida.en || x.en > salida.en;
        salida = { n: salida.n + x.n, en: masNuevo ? x.en : salida.en, resp: masNuevo ? x.resp : salida.resp };
    });
    return salida;
}

const cumpleCantidad = (n, cant) => (cant == null ? true : cant === 'alguno' ? n >= 1 : cant === '4+' ? n >= 4 : n === cant);

// Hace cuántos días calendario fue (Mario, 27/11/2026: «hoy, ayer, antes de ayer, hace 2 días»). `corto`: «hoy»,
// «ayer», «3 d».
export function haceDias(iso, ahora = new Date(), corto = false) {
    if (!iso) return null;
    const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const n = Math.round((dia(ahora) - dia(new Date(iso))) / 86400000);
    if (n <= 0) return 'hoy';
    if (n === 1) return 'ayer';
    if (corto) return `${n} d`;
    return n === 2 ? 'antes de ayer' : `hace ${n} días`;
}

// Le escribiste y no contestó, y todavía puede agendar (Mario, 27/11/2026): sin los que ya agendaron (Confirmación) ni
// las salidas (No lead, In-abrible). Es la base de «Les escribiste», la marca de la fila y las Stats de seguimientos.
export const esperaSeguimiento = (c) => Boolean(c.racha) && !c.cerrada && c.fase !== 'confirmacion' && c.fase !== 'nolead' && c.fase !== 'inabrible';

// Les escribió el equipo y no contestaron (`racha`), con cuántos seguimientos desde su última respuesta.
const cumpleSinResp = (c, v) => v == null || (esperaSeguimiento(c) && (v === 'todos' || (v === '3+' ? c.racha.n >= 3 : c.racha.n === v)));

function cumpleSeguimientos(c, f, ahora) {
    if (f.toca && !c.toca) return false;
    if (!cumpleSinResp(c, f.sinResp)) return false;
    if (f.fuCant == null && !f.fuCuando && !f.fuResp) return true;
    const s = seguimientosDe(c, f.fases);
    if (!cumpleCantidad(s.n, f.fuCant)) return false;
    if (f.fuCuando && !enRango(s.en, f.fuCuando, '', '', ahora)) return false;
    return !f.fuResp || (s.n > 0 && s.resp === (f.fuResp === 'si'));
}

// `asignado`: null (todos) · 'ninguno' · el id de un setter. `califica`: 'si' · 'no'. `fases` y `etiquetas`:
// listas (alcanza con una). `envioPor`: 'lead' (lo último lo escribió el lead), 'bot' o el id del setter.
export function cumpleFiltro(c, f, ahora) {
    // No lead / In-abrible que no volvió a escribir: fuera de la bandeja, salvo que se pida esa etapa en el filtro.
    if (c.cerrada && !f.conCerradas && !(f.fases || []).includes(c.fase)) return false;
    if (f.canal && (f.canal === 'wa') !== esWhatsapp(c)) return false;
    // El broadcast de WhatsApp al que respondió (ADR-W259): la etiqueta del taller o «Broadcast».
    if (f.broadcast && c.broadcast !== f.broadcast) return false;
    if (f.etiqueta && !(c.etiquetas || []).some((e) => claveEtiqueta(e) === f.etiqueta)) return false;
    if (f.etiquetas?.length && !(c.etiquetas || []).some((e) => f.etiquetas.includes(claveEtiqueta(e)))) return false;
    if (f.fases?.length && !f.fases.includes(c.fase)) return false;
    if (f.origen && c.canal !== f.origen) return false;
    if (!cumpleSeguimientos(c, f, ahora)) return false;
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
    { value: 'sin_resp', label: 'Sin respuesta', detalle: 'tu último mensaje más viejo primero', corto: 'por días sin respuesta',
        por: (a, b) => (a.racha ? Date.parse(a.racha.ultimo) : Infinity) - (b.racha ? Date.parse(b.racha.ultimo) : Infinity) },
    { value: 'seguimientos', label: 'Seguimientos', detalle: 'los que tienen menos primero', corto: 'por seguimientos',
        por: (a, b) => (a.racha ? a.racha.n : Infinity) - (b.racha ? b.racha.n : Infinity) },
];

/** El orden en uso: el elegido o, sin elegir, el de la cola. */
export function ordenDe(f) {
    if (f.orden) return ORDENES.find((o) => o.value === f.orden) || ORDENES[0];
    const def = COLAS.find((x) => x.value === f.cola) || COLAS[0];
    return ORDENES.find((o) => o.value === (def.porEspera ? 'espera' : def.porCierre ? 'cierre' : 'ultimo'));
}

// Cuántas cumplen el filtro, sin ordenarlas (las cuentas de cada opción del Filtro).
export function contar(lista, { ahora, ...f }) {
    const def = COLAS.find((x) => x.value === f.cola) || COLAS[0];
    return lista.reduce((n, c) => n + (def.cumple(c, ahora) && cumpleFiltro(c, f, ahora) ? 1 : 0), 0);
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
    // Si agendó, el de Work le gana al del perfil (ADR-W238: «👻» en WhatsApp).
    if (c.nombre_real) return c.nombre_real;
    if (esWhatsapp(c)) return c.nombre || c.username || 'Sin nombre';
    if (c.nombre) return c.nombre;
    if (c.username) return `@${c.username}`;
    return c.nombre || (c.ultimo_entrante_en ? 'Sin usuario' : 'Todavía no respondió');
}

// Lo que manda Instagram, en palabras (`unsupported_type`: historia, reel o algo que la API no entrega).
export const ADJUNTOS = {
    image: '📷 Imagen', video: '🎬 Video', audio: '🎤 Audio', file: '📄 Archivo', share: '🔗 Compartió una publicación',
    story_mention: '📣 Te mencionó en una historia', ig_reel: '🎬 Compartió un reel',
    unsupported_type: '⚠️ Algo que Instagram no deja ver acá (historia, reel…): miralo en la app',
};

// La vista previa de la fila: el texto o, si no tiene (un audio mandado desde la app), qué adjunto es.
export function vistaPrevia(c) {
    return c.ultimo_texto || (c.ultimo_adjunto && (ADJUNTOS[c.ultimo_adjunto] || `📎 ${c.ultimo_adjunto}`)) || '…';
}
