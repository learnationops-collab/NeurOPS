export const GRUPOS = [
    { value: 'grupales', label: 'Grupales' },
    { value: 'alumnos', label: 'Con alumnos' },
    { value: 'otras', label: 'Otras' },
];

export const ACLARA = {
    grupales: 'Reuniones del equipo que no cuelgan de ninguna agenda de venta.',
    alumnos: 'Sesiones con alumnos (Scale, Exam, Consultoría…) que no cuelgan de ninguna agenda.',
    otras: 'Lo demás sin agenda: 1:1, entrevistas y lo que Work no supo clasificar. Si alguna es grupal o con un alumno, cambiale la categoría y pasa a su pestaña.',
};

export const COLOR_CATEGORIA = {
    team: 'var(--ln-brand-2, #5B7CFF)',
    student: 'var(--ln-success, #10B981)',
    interview: 'var(--ln-warning, #F59E0B)',
    sales: 'var(--ln-brand, #FF3FA4)',
    other: 'var(--ln-text-muted)',
};

/** «20 nov · 10:00» en la hora de quien mira. */
export const cuando = (iso) => {
    if (!iso) return { dia: '—', hora: '' };
    const d = new Date(iso);
    return {
        dia: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', ''),
        hora: d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };
};

/** El título sin la cola que le pone Gemini («: 2026/11/06 19:02 GMT-03:00 - Notas de Gemini»). */
export const tituloCorto = (t) => (t || '').replace(/\s*[-–]\s*Notas de Gemini.*$/i, '')
    .replace(/[:\s]*\d{4}\/\d{2}\/\d{2}\s+\d{1,2}:\d{2}.*$/, '').trim() || 'Reunión sin título';
