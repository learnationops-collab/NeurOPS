// Única fuente de verdad para conversión UTC (backend) <-> hora local del navegador (frontend).
// El backend guarda datetime naive en UTC y devuelve datetime.isoformat() SIN sufijo 'Z',
// así que hay que anteponerlo explícitamente antes de construir un Date, o el motor JS lo
// interpretaría como hora local en vez de UTC.

export function localInputsToUtcIso(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

export function parseUtcIso(isoStr) {
    if (!isoStr) return null;
    const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(isoStr);
    const d = new Date(hasZone ? isoStr : `${isoStr}Z`);
    return isNaN(d.getTime()) ? null : d;
}

export function splitLocalDateTime(isoStr) {
    const d = parseUtcIso(isoStr);
    if (!d) return { date: '', time: '' };
    const pad = (n) => String(n).padStart(2, '0');
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
}

export function browserTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return null;
    }
}

// Fecha calendario LOCAL (YYYY-MM-DD) de un Date. Nunca usar `date.toISOString().split('T')[0]`
// directamente: eso da la fecha en UTC, que puede ser "mañana" varias horas antes de medianoche
// local en zonas UTC negativas (ej. 21:00 en UTC-4 ya es la 1am UTC del día siguiente).
export function toLocalDateStr(date) {
    return splitLocalDateTime(date.toISOString()).date;
}

export function localToday() {
    return toLocalDateStr(new Date());
}

export function localDateFromNow(days) {
    return toLocalDateStr(new Date(Date.now() + days * 86400000));
}

// ---------------------------------------------------------------------------
// Cuenta regresiva en vivo
// ---------------------------------------------------------------------------
// Todo lo de abajo trabaja siempre sobre el INSTANTE (el ISO UTC que manda el backend) y lo
// renderiza en la zona del navegador de quien está mirando. Eso es lo que hace que, simulando
// a un closer de otro país, las agendas se sigan viendo en la hora del que simula: la zona del
// usuario simulado nunca entra en la cuenta.

const pad2 = (n) => String(n).padStart(2, '0');

export function countdownParts(isoStr, nowMs) {
    const start = parseUtcIso(isoStr);
    if (!start) return null;
    const diffMs = start.getTime() - nowMs;
    const totalSec = Math.floor(Math.abs(diffMs) / 1000);
    return {
        diffMs,
        isPast: diffMs < 0,
        totalSec,
        days: Math.floor(totalSec / 86400),
        hours: Math.floor((totalSec % 86400) / 3600),
        minutes: Math.floor((totalSec % 3600) / 60),
        seconds: totalSec % 60
    };
}

// Ventana en la que la cita se considera "ocurriendo": ni el closer ni el lead miran el reloj
// al segundo, así que ±5 min alrededor de la hora agendada se muestra como "Ahora mismo".
const VENTANA_AHORA_SEG = 5 * 60;

// `withSeconds` enciende el modo cronómetro (mm:ss / h:mm:ss). Solo aplica al tiempo que FALTA
// y por debajo de un día: para algo ya pasado los segundos no aportan nada, y "Hace 6:00" se
// leería como "hace 6 horas" en vez de "hace 6 minutos".
export function formatCountdown(isoStr, nowMs, { withSeconds = false } = {}) {
    const p = countdownParts(isoStr, nowMs);
    if (!p) return null;
    if (p.totalSec <= VENTANA_AHORA_SEG) return { ...p, kind: 'now', label: 'Ahora mismo' };

    const cronometro = withSeconds && !p.isPast;
    let amount;
    if (p.days >= 1) {
        amount = `${p.days} día${p.days !== 1 ? 's' : ''}${p.hours > 0 ? ` ${p.hours} h` : ''}`;
    } else if (p.hours >= 1) {
        amount = cronometro
            ? `${p.hours}:${pad2(p.minutes)}:${pad2(p.seconds)}`
            : `${p.hours} h${p.minutes > 0 ? ` ${p.minutes} min` : ''}`;
    } else {
        amount = cronometro ? `${p.minutes}:${pad2(p.seconds)}` : `${p.minutes} min`;
    }

    if (p.isPast) return { ...p, kind: 'past', label: `Hace ${amount}` };
    return { ...p, kind: p.hours < 2 && p.days === 0 ? 'soon' : 'future', label: `En ${amount}` };
}

// ---------------------------------------------------------------------------
// Formato para el usuario que mira
// ---------------------------------------------------------------------------

// Hora de la cita en la zona del navegador. Es la contracara de `formatCountdown`: el contador
// dice cuánto falta, esto dice a qué hora es en el reloj de quien lee.
export function formatAgendaDateTime(isoStr, { withDate = true } = {}) {
    const d = parseUtcIso(isoStr);
    if (!d) return '';
    const opts = withDate
        ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' };
    return d.toLocaleString('es-ES', opts);
}

// Etiqueta corta de la zona del navegador ("GMT-3"), para poder poner al lado de una hora y que
// no quede ninguna duda de en qué reloj está expresada.
export function viewerTimezoneLabel() {
    try {
        const parts = new Intl.DateTimeFormat('es-ES', { timeZoneName: 'shortOffset' }).formatToParts(new Date());
        const zona = parts.find(p => p.type === 'timeZoneName');
        if (zona?.value) return zona.value;
    } catch { /* shortOffset no soportado: se cae al nombre de la zona */ }
    return browserTimezone() || '';
}

// ---------------------------------------------------------------------------
// <input type="datetime-local"> <-> ISO UTC
// ---------------------------------------------------------------------------
// El valor de un datetime-local es hora local SIN zona, así que no se puede mandar al backend
// tal cual (la columna guarda UTC) ni pintar en él un ISO UTC crudo.

export function toDatetimeLocalValue(isoStr) {
    const { date, time } = splitLocalDateTime(isoStr);
    return date && time ? `${date}T${time}` : '';
}

export function datetimeLocalToUtcIso(value) {
    if (!value) return null;
    const [date, time] = String(value).split('T');
    return localInputsToUtcIso(date, time ? time.slice(0, 5) : null);
}
