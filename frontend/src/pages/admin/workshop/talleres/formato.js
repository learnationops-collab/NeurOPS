/**
 * Lo que comparten las piezas de la pestaña Talleres: cómo se lee cada número de un taller, su
 * embudo y el estado de su grabación. Sin React: se prueba solo (formato.test.js).
 */

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const dinero = (v) => {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    const n = Math.round(Number(v));
    return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}`;
};
export const numero = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US'));
export const porcentaje = (v) => (v == null ? '—' : `${Number(v).toFixed(1).replace(/\.0$/, '')}%`);
export const veces = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}x`);

/** `2026-10-12` → `12/10`. */
export const diaMes = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '');

/** `2026-10-12` → `Oct 2026`: la faceta «Mes» de la tabla. */
export const mesDe = (iso) => {
    if (!iso) return null;
    const [y, m] = iso.split('-');
    return `${MESES[parseInt(m, 10) - 1]} ${y}`;
};

export const ganancia = (e) => (e.cash_collected || 0) - (e.inversion || 0);
/** Lo que costó cada venta. Sin ventas no hay CAC: «—», no la inversión entera. */
export const cac = (e) => (e.sales > 0 ? e.inversion / e.sales : null);

/** El tono y el nombre del ROAS, los mismos cortes que tenía el historial viejo. */
export const roasTono = (r) => (r >= 1.5 ? 'success' : r >= 1 ? 'warning' : 'error');
export const roasRotulo = (r) => (r >= 3 ? 'Sobresaliente' : r >= 1.5 ? 'Rentable' : r >= 1 ? 'En equilibrio' : 'A pérdida');
// Cortos: son las opciones del filtro, que tiene columnas angostas.
export const ROAS_RANGOS = ['Menos de 1x', '1x a 1,5x', '1,5x a 3x', '3x o más'];
export const roasRango = (r) => (r >= 3 ? ROAS_RANGOS[3] : r >= 1.5 ? ROAS_RANGOS[2] : r >= 1 ? ROAS_RANGOS[1] : ROAS_RANGOS[0]);

/**
 * «Asistieron» se divide por las citas con resultado (`citas_reportadas`), no por todas las agendas: las
 * que nadie reportó todavía no son inasistencias. Sin ese dato (talleres viejos) vuelve a dividir por
 * el paso anterior. `citas_sin_reportar` va en la ayuda para que se vea cuántas faltan.
 */
const citasConResultado = (e) => {
    if (e.citas_reportadas == null) return { ayuda: 'Se presentaron a la llamada.' };
    const faltan = e.citas_sin_reportar > 0 ? ` ${e.citas_sin_reportar} sin reportar.` : '';
    return {
        base: { label: 'Citas con resultado', n: e.citas_reportadas },
        ayuda: `Se presentaron, sobre las citas con resultado.${faltan}`,
    };
};

/**
 * Los pasos del embudo de un taller. `corto` es el resumen de la tarjeta (sin los dos de retención
 * del pitch, que en una tarjeta son ruido). Las ayudas son las del embudo detallado de siempre.
 */
export const pasosEmbudo = (e, { corto = false } = {}) => {
    const pasos = [
        { key: 'leads', label: 'Leads', n: e.leads || 0,
          ayuda: 'Anotados al taller (Leads de Meta).' },
        { key: 'whatsapp', label: 'WhatsApp', n: e.whatsapp_leads || 0,
          ayuda: 'Entraron al grupo de WhatsApp.' },
        { key: 'show_up', label: 'Show up', n: e.show_up || 0,
          ayuda: 'Se conectaron a la clase en vivo.' },
        { key: 'pitch', label: 'En el pitch', n: e.pitch_leads || 0, largo: true,
          ayuda: 'Seguían cuando arrancó la oferta.' },
        { key: 'pitch_final', label: 'Fin del pitch', n: e.pitch_final_leads || 0, largo: true,
          ayuda: 'Seguían cuando terminó la oferta.' },
        { key: 'aplicaciones', label: 'Aplicaron', n: e.aplicaciones_form || 0,
          ayuda: 'Pidieron una llamada por formulario.' },
        { key: 'agendas', label: 'Agendas', n: e.agendas_exitosas || 0,
          ayuda: 'Personas con llamada agendada.' },
        { key: 'asistieron', label: 'Asistieron', n: e.show_up_sales_call || 0, ...citasConResultado(e) },
        { key: 'ventas', label: 'Ventas', n: e.sales || 0,
          ayuda: 'Pago completo o split. Las señas no cuentan.' },
    ];
    return corto ? pasos.filter((p) => !p.largo) : pasos;
};

/** El paso contra el anterior, en %. `null` si el anterior es cero (no hay contra qué). */
export const tasaPaso = (n, anterior) => (anterior > 0 ? (n / anterior) * 100 : null);

// --- Grabación ----------------------------------------------------------------------------------

export const ESTADOS_GRABACION = {
    // `corto`: la opción del filtro de la tabla.
    sin_grabacion: { texto: 'Sin Loom', corto: 'Sin Loom', tono: 'idle' },
    sin_publicar: { texto: 'Sin publicar', corto: 'Sin publicar', tono: 'idle' },
    programada: { texto: 'Programada', corto: 'Programada', tono: 'warning' },
    activa: { texto: 'Publicada', corto: 'Publicada', tono: 'success' },
    vencida: { texto: 'Ya cerró', corto: 'Ya cerró', tono: 'idle' },
};

/**
 * Dónde está la grabación de un taller: guardarla no la publica (16/10/2026); publicada es con Loom,
 * desde y vence. Las fechas llegan en hora local sin zona, como las arma el panel.
 */
export const estadoGrabacion = (e, ahora = Date.now()) => {
    if (!e?.replay_loom_id) return { tipo: 'sin_grabacion' };
    if (!e.replay_activo_desde || !e.replay_vence_hasta) return { tipo: 'sin_publicar' };
    const desde = new Date(e.replay_activo_desde).getTime();
    const hasta = new Date(e.replay_vence_hasta).getTime();
    if (ahora < desde) return { tipo: 'programada', restanteMs: desde - ahora };
    if (ahora >= hasta) return { tipo: 'vencida' };
    return { tipo: 'activa', restanteMs: hasta - ahora };
};

export const estaPublicada = (estado) => estado.tipo === 'activa' || estado.tipo === 'programada';

/** El input datetime-local (y el backend) quieren la hora LOCAL «YYYY-MM-DDTHH:mm». */
export const aInputLocal = (date) => {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

/** «47 h 12 m» / «12 m»; con `segundos`, «47 h 12 m 05 s» (el panel que cuenta cada segundo). */
export const restante = (ms, { segundos = false } = {}) => {
    if (!ms || ms <= 0) return segundos ? '0 m 00 s' : '0 m';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cola = segundos ? ` ${String(s).padStart(2, '0')} s` : '';
    if (h > 0) return `${h} h ${String(m).padStart(2, '0')} m${cola}`;
    return `${m} m${cola}`;
};

/** Publicar ahora por `horas`: la landing la muestra desde ya y se cierra sola. */
export const cuerpoPublicar = (evento, { horas = 48, loomId, infoSegundos, ofertaSegundos } = {}, ahora = new Date()) => {
    const hasta = new Date(ahora.getTime() + (parseFloat(horas) || 48) * 3600000);
    return {
        replay_loom_id: loomId ?? evento.replay_loom_id,
        replay_info_segundos: infoSegundos ?? evento.replay_info_segundos ?? 0,
        replay_oferta_segundos: ofertaSegundos ?? evento.replay_oferta_segundos ?? 120,
        replay_activo_desde: aInputLocal(ahora),
        replay_vence_hasta: aInputLocal(hasta),
    };
};

/** Dejar de publicar = vence ahora (la landing pasa a «vencido»). Si estaba programada, tampoco abre. */
export const cuerpoDespublicar = (estado, ahora = new Date()) => {
    const ya = aInputLocal(ahora);
    return estado.tipo === 'programada'
        ? { replay_vence_hasta: ya, replay_activo_desde: ya }
        : { replay_vence_hasta: ya };
};

export const REPLAY_URL = 'https://institute.thelearnation.com/replay/';

export const duracion = (segundos) => {
    const s = Math.max(0, Math.round(segundos || 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return `${m}m ${String(r).padStart(2, '0')}s`;
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

// --- De dónde sale cada paso ---------------------------------------------------------------------

/**
 * El color dice el origen del número (Kerwin, 29/10/2026): los leads son de Meta, lo del taller (WhatsApp, clase,
 * pitch, formulario) lo carga o sincroniza el taller, y desde las agendas son personas del libro de los closers.
 * Lo usan el Resumen, las tarjetas y el detalle de un taller.
 */
export const ORIGEN = {
    meta: { label: 'Meta', color: 'var(--info)' },
    taller: { label: 'Taller', color: 'var(--brand-secondary)' },
    personas: { label: 'Personas', color: 'var(--success)' },
};
const ORIGEN_DE_PASO = {
    leads: 'meta', whatsapp: 'taller', show_up: 'taller', pitch: 'taller', pitch_final: 'taller', aplicaciones: 'taller',
    agendas: 'personas', asistieron: 'personas', ventas: 'personas',
};
export const origenDePaso = (key) => ORIGEN[ORIGEN_DE_PASO[key]] || ORIGEN.taller;
