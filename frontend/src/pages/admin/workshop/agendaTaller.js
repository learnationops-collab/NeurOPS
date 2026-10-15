// Hora de cada taller en la zona de quien mira el panel.
//
// El backend guarda el inicio como instante en UTC (`inicio_at`, con 'Z'). El formulario lo
// muestra y lo carga en la hora del navegador: Kerwin lo ve en hora de Venezuela y su jefe en
// la suya, y cualquiera de los dos lo puede editar. Las landings leen el mismo instante.

const dos = (n) => String(n).padStart(2, '0');

export const zonaNavegador = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

/** 'America/Caracas' → 'Caracas'; 'America/Argentina/Buenos_Aires' → 'Buenos Aires'. */
export const nombreZona = (zona = zonaNavegador()) => zona.split('/').pop().replace(/_/g, ' ');

/** '2026-10-19T20:00:00Z' → { fecha: '2026-10-19', hora: '16:00' } en la hora del navegador. */
export const aCamposLocales = (inicioAt) => {
    if (!inicioAt) return { fecha: '', hora: '' };
    const d = new Date(inicioAt);
    if (Number.isNaN(d.getTime())) return { fecha: '', hora: '' };
    return {
        fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
        hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
    };
};

/** Fecha y hora del formulario (hora del navegador) → instante ISO en UTC, o null sin hora. */
export const aInicioUtc = (fecha, hora) => {
    if (!fecha || !hora) return null;
    const d = new Date(`${fecha}T${hora}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** 'lun 19 oct · 16:00' en la hora del navegador. */
export const formatearInicio = (inicioAt) => {
    if (!inicioAt) return '';
    const d = new Date(inicioAt);
    if (Number.isNaN(d.getTime())) return '';
    const dia = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
    return `${dia} · ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};
