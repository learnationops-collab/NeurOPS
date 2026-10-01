// Zonas horarias sin librería: el proyecto no usa date-fns/luxon (ver utils/datetime.js), así que
// la conversión hora-local-del-closer -> UTC se hace con Intl, igual que el resto del frontend.

const offsetCache = new Map();

function formatterFor(tz) {
    if (!offsetCache.has(tz)) {
        offsetCache.set(tz, new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        }));
    }
    return offsetCache.get(tz);
}

// Minutos que la zona está adelantada respecto de UTC en ese instante (negativo en América).
export function tzOffsetMinutes(utcMs, tz) {
    const parts = Object.fromEntries(formatterFor(tz).formatToParts(new Date(utcMs)).map(p => [p.type, p.value]));
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return Math.round((asUtc - utcMs) / 60000);
}

// "Martes 14:00 en Buenos Aires" -> instante UTC. Se corrige dos veces por si el offset cambia
// justo en ese día (horario de verano en Brasil/Chile).
export function zonedToUtc(year, month, day, hh, mm, tz) {
    const guess = Date.UTC(year, month - 1, day, hh, mm);
    let utc = guess - tzOffsetMinutes(guess, tz) * 60000;
    utc = guess - tzOffsetMinutes(utc, tz) * 60000;
    return utc;
}

// Fecha calendario (y, m, d) de un instante visto desde una zona.
export function ymdIn(utcMs, tz) {
    const parts = Object.fromEntries(formatterFor(tz).formatToParts(new Date(utcMs)).map(p => [p.type, p.value]));
    return { y: +parts.year, m: +parts.month, d: +parts.day };
}

export function ymdKey({ y, m, d }) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function dayOfWeek({ y, m, d }) {
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
}

export function addDays({ y, m, d }, n) {
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function hhmmToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

export function formatHora(utcMs, tz) {
    return new Intl.DateTimeFormat('es-AR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(utcMs));
}

export function formatFechaLarga(utcMs, tz) {
    const s = new Intl.DateTimeFormat('es-AR', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(utcMs));
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function browserTz() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires';
    } catch {
        return 'America/Argentina/Buenos_Aires';
    }
}

// "America/Argentina/Buenos_Aires" -> "Buenos Aires"
export function tzCiudad(tz) {
    return (tz.split('/').pop() || tz).replace(/_/g, ' ');
}
