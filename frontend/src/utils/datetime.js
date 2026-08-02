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
