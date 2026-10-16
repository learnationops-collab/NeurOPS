// Hora de cada taller en la zona de quien mira el panel.
//
// El backend guarda el inicio como instante en UTC (`inicio_at`, con 'Z'). El formulario lo
// muestra y lo carga en la hora del navegador: Kerwin lo ve en hora de Venezuela y su jefe en
// la suya, y cualquiera de los dos lo puede editar. Las landings leen el mismo instante.

const DURACION_MS = 30 * 60 * 1000; // lo que dura el taller para las landings (workshops.js)

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

const hoyLocal = (ahora) => `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;

/** Todavía no empezó. Sin hora cargada, cuenta el día (el de hoy ya es del historial). */
export const esProximo = (evento, ahora = new Date()) => {
    if (evento.inicio_at) return new Date(evento.inicio_at).getTime() > ahora.getTime();
    return evento.date > hoyLocal(ahora);
};

/** El que las landings muestran ahora: el primero con hora que no terminó. */
export const enLaLanding = (eventos, ahora = new Date()) => eventos
    .filter((e) => e.inicio_at && new Date(e.inicio_at).getTime() + DURACION_MS > ahora.getTime())
    .sort((a, b) => new Date(a.inicio_at) - new Date(b.inicio_at))[0] || null;

/** Lo que dura «En vivo» en el panel desde que empieza el taller (Kerwin, 16/10/2026: «por 2 horas,
 *  mientras termina el evento»). Las landings lo dan por terminado antes (DURACION_MS). */
export const EN_VIVO_MS = 2 * 60 * 60 * 1000;

/**
 * El rótulo de arriba del panel: `{ fase: 'en_vivo', evento, terminaEn }` si un taller empezó hace
 * menos de 2 horas; si no, `{ fase: 'cuenta', evento, faltan }` con el próximo programado (ms que
 * faltan); `null` si no hay ninguno con hora por delante.
 */
export const estadoDelTaller = (eventos, ahora = new Date()) => {
    const t = ahora.getTime();
    const conHora = (eventos || []).filter((e) => e.inicio_at && !Number.isNaN(new Date(e.inicio_at).getTime()))
        .sort((a, b) => new Date(a.inicio_at) - new Date(b.inicio_at));
    const enVivo = conHora.find((e) => {
        const inicio = new Date(e.inicio_at).getTime();
        return inicio <= t && t < inicio + EN_VIVO_MS;
    });
    if (enVivo) return { fase: 'en_vivo', evento: enVivo, terminaEn: new Date(enVivo.inicio_at).getTime() + EN_VIVO_MS - t };
    const proximo = conHora.find((e) => new Date(e.inicio_at).getTime() > t);
    return proximo ? { fase: 'cuenta', evento: proximo, faltan: new Date(proximo.inicio_at).getTime() - t } : null;
};

/** 93_784_000 ms → '1 d 02:03:04'; menos de un día → '02:03:04'. */
export const formatearCuenta = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const dias = Math.floor(total / 86400);
    const resto = `${dos(Math.floor((total % 86400) / 3600))}:${dos(Math.floor((total % 3600) / 60))}:${dos(total % 60)}`;
    return dias ? `${dias} d ${resto}` : resto;
};

/** Propuesta para «Programar»: una semana después del último, a la misma hora y con sus links. */
export const sugerenciaProgramar = (eventos, ahora = new Date()) => {
    const conHora = eventos.filter((e) => e.inicio_at)
        .sort((a, b) => new Date(b.inicio_at) - new Date(a.inicio_at));
    const ultimo = conHora[0];
    if (!ultimo) return { fecha: '', hora: '', meet_url: '', whatsapp_url: '' };
    const d = new Date(ultimo.inicio_at);
    do {
        d.setDate(d.getDate() + 7);
    } while (d.getTime() <= ahora.getTime());
    const { fecha, hora } = aCamposLocales(d.toISOString());
    // Los links del último que los tenga (como hacen las landings con uno que no los trae).
    const meet = conHora.find((e) => e.meet_url)?.meet_url || '';
    const whatsapp = conHora.find((e) => e.whatsapp_url)?.whatsapp_url || '';
    return { fecha, hora, meet_url: meet, whatsapp_url: whatsapp };
};
