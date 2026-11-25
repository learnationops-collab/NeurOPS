// Qué se puede ver de una agenda en las vistas de Confirmar (ADR-W201): las propiedades de la agenda y
// cada pregunta del formulario que respondieron los leads del tablero (`f:<pregunta>`).
import { parseUtcIso, splitLocalDateTime } from '../../../utils/datetime';
import { ETAPAS_CONFIRMACION, etapaDeConfirmacion } from './etapas';

export const PROPIEDADES_AGENDA = [
    { clave: 'hora', titulo: 'Hora', ancho: '150px' },
    { clave: 'telefono', titulo: 'Teléfono', ancho: '160px' },
    { clave: 'closer', titulo: 'Closer', ancho: '130px', soloTriage: true },
    { clave: 'etapa', titulo: 'Etapa', ancho: '150px' },
    { clave: 'tipo', titulo: 'Tipo de llamada', ancho: '130px' },
    { clave: 'segmento', titulo: 'Segmento', ancho: '110px' },
    { clave: 'avisos', titulo: 'Avisos', ancho: '210px' },
    { clave: 'origen', titulo: 'Origen', ancho: '160px' },
    { clave: 'examen', titulo: 'Examen', ancho: '140px' },
    { clave: 'inversion', titulo: 'Inversión', ancho: '170px' },
    { clave: 'decision', titulo: 'Decisión', ancho: '150px' },
    { clave: 'ingresos', titulo: 'Ingresos', ancho: '160px' },
    { clave: 'notas_setter', titulo: 'Nota del setter', ancho: '280px' },
];

const ES_FORMULARIO = 'f:';
export const esDeFormulario = (clave) => clave.startsWith(ES_FORMULARIO);

const respuestas = (a) => (a.form_data && typeof a.form_data === 'object' && !Array.isArray(a.form_data) ? a.form_data : {});
const texto = (v) => (v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? '' : String(v).trim());

// Las preguntas del formulario que tiene al menos una agenda del tablero, en el orden en que aparecen.
export function propiedadesDeFormulario(agendas) {
    const vistas = new Map();
    (agendas || []).forEach(a => Object.entries(respuestas(a)).forEach(([k, v]) => {
        if (!vistas.has(k) && texto(v)) vistas.set(k, { clave: ES_FORMULARIO + k, titulo: k, ancho: '200px', formulario: true });
    }));
    return [...vistas.values()];
}

export function catalogoDePropiedades(agendas, esTriage) {
    return [...PROPIEDADES_AGENDA.filter(p => esTriage || !p.soloTriage), ...propiedadesDeFormulario(agendas)];
}

export const respuestaDe = (a, clave) => texto(respuestas(a)[clave.slice(ES_FORMULARIO.length)]);

// Inversión y decisión, de la pregunta del formulario que habla de eso (como la tarjeta del tablero).
export const inversionDe = (a) => {
    const fd = respuestas(a);
    const k = fd.inversion ? 'inversion' : Object.keys(fd).find(x => /invert|inversi|presupuesto/i.test(x));
    return k ? texto(fd[k]) : '';
};
export const decisionDe = (a) => {
    const fd = respuestas(a);
    const k = Object.keys(fd).find(x => /decisi|decid|acompa|qui[eé]n\s+(paga|financ|apoya)|apoyo/i.test(x));
    return k ? texto(fd[k]) : '';
};

export const ingresosDe = (a) => {
    const fd = respuestas(a);
    const k = Object.keys(fd).find(x => /ingres|gan[aá]s|sueldo|salario|factur/i.test(x));
    return k ? texto(fd[k]) : '';
};

// Triage o closing: lo dice el rol de quien toma la llamada; sin rol (datos viejos), la del triage que mira
// es de triage. Momentum y 2ª llamada se aclaran.
export function tipoDe(a, { userId, esTriage } = {}) {
    const triage = a.closer_role ? a.closer_role === 'triage' : !!(esTriage && userId && a.closer_id === userId);
    if (triage) return { clave: 'triage', titulo: 'Triage' };
    const extra = a.tipo_llamada === 'segunda' ? ' · 2ª' : a.tipo_llamada === 'momentum' ? ' · Momentum' : '';
    return { clave: 'closing', titulo: 'Closing' + extra };
}

// La inversión del formulario en pocas palabras, para la tarjeta: «Entre $200 y $500 USD.» →
// «$200–500 USD», «Más de 1000 USD» → «+$1.000 USD» y cualquier forma de «no puedo» → «Sin
// inversión» (pedido del 23/10/2026). El texto completo queda en el `title`.
const milesAr = (n) => Number(n).toLocaleString('es-AR');
export const inversionCorta = (txt) => {
    const t = String(txt || '').trim().replace(/\.$/, '');
    if (/\b(no\s+(puedo|estoy|tengo|cuento|dispongo)|ninguna|nada|sin\s+(inversi|presupuesto|dinero))/i.test(t)) return { texto: 'Sin inversión', sin: true };
    const nums = (t.match(/\d[\d.,]*/g) || []).map(x => Number(x.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))).filter(n => n > 0);
    const usd = /usd|d[oó]lar/i.test(t) ? ' USD' : '';
    if (nums.length >= 2) return { texto: `$${milesAr(nums[0])}–${milesAr(nums[1])}${usd}` };
    if (nums.length === 1) {
        const signo = /m[aá]s\s+de|desde|\+/i.test(t) ? '+' : /menos\s+de|hasta/i.test(t) ? '<' : '';
        return { texto: `${signo}$${milesAr(nums[0])}${usd}` };
    }
    return { texto: t.length > 22 ? `${t.slice(0, 21)}…` : t };
};

// Si decide solo o necesita a alguien más, sacado del formulario: la pregunta que habla de
// decidir, de acompañamiento o de quién paga. Sin una pregunta así, no se muestra nada.
export const decisorCorto = (a) => {
    const fd = a.form_data && typeof a.form_data === 'object' ? a.form_data : {};
    const clave = Object.keys(fd).find(k => /decisi|decid|acompa|qui[eé]n\s+(paga|financ|apoya)|apoyo/i.test(k));
    const v = clave ? String(fd[clave] ?? '').trim() : '';
    if (!v) return null;
    if (/pareja|familia|padre|madre|espos|consult|acompa|otra persona|alguien|junto|no\b/i.test(v)) {
        return { texto: 'No decisor', solo: false, title: v };
    }
    if (/yo\b|solo|sola|m[ií] mism|por mi cuenta|s[ií]\b/i.test(v)) return { texto: 'Decisor', solo: true, title: v };
    return { texto: v.length > 20 ? `${v.slice(0, 19)}…` : v, solo: null, title: v };
};

export const avisosDe = (a) => [
    a.desplazada && 'Reagendar: horario tomado',
    a.sin_horario && 'Ningún horario le sirve',
    (a.origin || '').startsWith('Referido de') && 'Contactar y acordar fecha',
].filter(Boolean);

// Día local (AAAA-MM-DD) y minuto del día de la cita, en la zona de quien mira.
export function cuandoEs(a) {
    const { date, time } = splitLocalDateTime(a.start_time);
    const [h, m] = (time || '00:00').split(':').map(Number);
    return { dia: date, minuto: h * 60 + m, hora: time, ms: parseUtcIso(a.start_time)?.getTime() ?? 0 };
}

// ── Filtrar, ordenar y agrupar ──

export const ORDENES = [
    { valor: 'hora', titulo: 'Hora de la llamada' },
    { valor: 'puntos', titulo: 'Puntos del formulario' },
    { valor: 'etapa', titulo: 'Etapa' },
    { valor: 'nombre', titulo: 'Nombre' },
];
const indiceEtapa = (a) => ETAPAS_CONFIRMACION.findIndex(e => e.clave === etapaDeConfirmacion(a));
const COMPARAR = {
    hora: (a, b) => cuandoEs(a).ms - cuandoEs(b).ms,
    puntos: (a, b) => (Number(a.segmento_puntos) || 0) - (Number(b.segmento_puntos) || 0),
    etapa: (a, b) => indiceEtapa(a) - indiceEtapa(b),
    nombre: (a, b) => (a.lead_name || '').localeCompare(b.lead_name || ''),
};

export function aplicarVista(agendas, vista) {
    const f = vista.filtro || {};
    const hay = (lista) => Array.isArray(lista) && lista.length > 0;
    const comparar = COMPARAR[vista.orden] || COMPARAR.hora;
    return (agendas || [])
        .filter(a => !hay(f.closers) || f.closers.includes(String(a.closer_id)))
        .filter(a => !hay(f.etapas) || f.etapas.includes(etapaDeConfirmacion(a)))
        .filter(a => !hay(f.segmentos) || f.segmentos.includes(a.segmento || 'sin'))
        .sort((a, b) => (vista.asc === false ? -1 : 1) * (comparar(a, b) || COMPARAR.hora(a, b)));
}

export const AGRUPACIONES = [
    { valor: 'urgencia', titulo: 'Urgencia', detalle: 'Ahora · hoy · mañana · después', soloLista: true },
    { valor: 'etapa', titulo: 'Etapa' },
    { valor: 'closer', titulo: 'Closer', soloTriage: true },
    { valor: 'dia', titulo: 'Día' },
    { valor: 'segmento', titulo: 'Segmento' },
    { valor: 'ninguno', titulo: 'Sin agrupar', soloLista: true },
];

const DOS_HORAS = 2 * 3600000;
const fechaLarga = (dia) => {
    const d = new Date(dia + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' });
};

/** Grupos [{ clave, titulo, color, items, plegado }] en el orden de la agrupación; los vacíos no van. */
export function agrupar(agendas, por, { hoy, manana, ahora = Date.now(), nombreCloser = (a) => a.closer_name } = {}) {
    if (por === 'ninguno') return [{ clave: 'todas', titulo: 'Todas', items: agendas }];
    if (por === 'etapa') {
        return ETAPAS_CONFIRMACION.map(e => ({ clave: e.clave, titulo: e.titulo, color: e.color, items: agendas.filter(a => etapaDeConfirmacion(a) === e.clave) }));
    }
    const grupos = new Map();
    const sumar = (clave, titulo, a, extra) => {
        if (!grupos.has(clave)) grupos.set(clave, { clave, titulo, items: [], ...extra });
        grupos.get(clave).items.push(a);
    };
    agendas.forEach(a => {
        const c = cuandoEs(a);
        if (por === 'urgencia') {
            if (etapaDeConfirmacion(a) === 'confirmado') return sumar('z-confirmadas', 'Confirmadas', a, { plegado: true, color: ETAPAS_CONFIRMACION[2].color });
            if (c.dia === hoy && c.ms - ahora <= DOS_HORAS) return sumar('a-ya', 'Ahora · llamada en menos de 2 h', a, { urgente: true, color: 'var(--cl-warning, #f5b84a)' });
            if (c.dia <= hoy) return sumar('b-hoy', 'Hoy más tarde', a);
            if (c.dia === manana) return sumar('c-manana', 'Mañana', a);
            return sumar('d-despues', 'Más adelante', a);
        }
        if (por === 'closer') return sumar(nombreCloser(a) || 'Sin closer', nombreCloser(a) || 'Sin closer', a);
        if (por === 'segmento') return sumar(a.segmento || 'zz', a.segmento ? 'Segmento ' + a.segmento : 'Sin segmento', a);
        return sumar(c.dia || 'zz', c.dia === hoy ? 'Hoy' : c.dia === manana ? 'Mañana' : c.dia ? fechaLarga(c.dia) : 'Sin fecha', a);
    });
    return [...grupos.values()].sort((x, y) => x.clave.localeCompare(y.clave));
}
