// Lo que la ventana de Leadership rápido muestra igual en todos lados: fechas, R, estados y duraciones.

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const masDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

/** Los atajos de fecha, del reloj de la persona. «Esta semana» = el viernes; «Próxima semana» = el lunes que viene. */
export function atajosDeFecha() {
    const dow = new Date().getDay();                     // 0 = domingo
    const aViernes = dow >= 1 && dow <= 4 ? 5 - dow : 2;
    const aLunes = ((8 - dow) % 7) || 7;
    return [
        { value: iso(masDias(0)), label: 'Hoy' },
        { value: iso(masDias(1)), label: 'Mañana' },
        { value: iso(masDias(aViernes)), label: 'Esta semana' },
        { value: iso(masDias(aLunes)), label: 'Próxima semana' },
        { value: '', label: 'Sin fecha' },
    ];
}

/** Días hasta la fecha (negativo = vencida); null sin fecha. */
export function diasHasta(fecha) {
    if (!fecha) return null;
    const [y, m, d] = fecha.split('-').map(Number);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((new Date(y, m - 1, d) - hoy) / 86400000);
}

export function fechaCorta(fecha) {
    const d = diasHasta(fecha);
    if (d === null) return null;
    if (d < 0) return 'Vencida';
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Mañana';
    const [y, m, dd] = fecha.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** La R que tendría con ese arquetipo y esa fecha (SimplerClarity::r: urgencia 3 o ≤7 días = R1). */
export function rDe(arquetipo, fecha) {
    if (!arquetipo) return null;
    const d = diasHasta(fecha);
    if (arquetipo.urgente || (d !== null && d <= 7)) return 'R1';
    return arquetipo.r;
}

export const NOMBRE_R = { R1: 'Hacer ya', R2: 'Construir', R3: 'El resto' };
export const COLOR_R = { R1: 'var(--ln-danger)', R2: 'var(--ln-info)', R3: 'var(--ln-idle)' };

export const DURACIONES = [
    { value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 h' },
    { value: 120, label: '2 h' }, { value: 240, label: 'Medio día' },
];

export function duracion(min) {
    if (!min) return null;
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${m}` : `${h} h`;
}

export const ESTADOS = {
    sin_abrir: { label: 'Sin abrir', color: 'var(--ln-idle)' },
    pendiente: { label: 'Pendiente', color: 'var(--ln-idle)' },
    en_curso: { label: 'En curso', color: 'var(--ln-info)' },
    en_espera: { label: 'En espera', color: 'var(--ln-idle)' },
    en_revision: { label: 'En revisión', color: 'var(--ln-warning)' },
    optimizar: { label: 'A optimizar', color: 'var(--ln-danger)' },
    pausado: { label: 'Pausado', color: 'var(--ln-idle)' },
    hecha: { label: 'Hecha', color: 'var(--ln-success)' },
};

export const ENTREGAS = [
    { value: 'nada', label: 'Nada' }, { value: 'texto', label: 'Un texto' },
    { value: 'link', label: 'Un link' }, { value: 'video', label: 'Un video' },
];

export const esLink = (t) => /^https?:\/\/\S+$/i.test((t || '').trim());
