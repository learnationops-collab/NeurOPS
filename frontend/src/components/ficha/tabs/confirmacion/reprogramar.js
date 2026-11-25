// Cuentas del reprogramar: horarios libres por persona → días y horas en la zona del lead.

export const CUALQUIERA = 'cualquiera';

const partes = (iso, tz) => {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const o = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    return { dia: `${o.year}-${o.month}-${o.day}`, hora: `${o.hour}:${o.minute}`, h: Number(o.hour), min: Number(o.minute) };
};

export const horaEn = (iso, tz) => partes(iso, tz).hora;

/** {iso: [ids libres]} de las personas elegidas (una, o todas con «cualquiera»). */
export const libresPorHorario = (porPersona, elegida) => {
    const mapa = {};
    Object.entries(porPersona || {}).forEach(([id, lista]) => {
        if (elegida !== CUALQUIERA && String(elegida) !== id) return;
        lista.forEach((iso) => { (mapa[iso] = mapa[iso] || []).push(Number(id)); });
    });
    return mapa;
};

/** Días (en la zona del lead) con sus horarios ordenados: [{dia, isos}]. */
export const diasDelLead = (mapa, tz) => {
    const dias = {};
    Object.keys(mapa).sort().forEach((iso) => { const { dia } = partes(iso, tz); (dias[dia] = dias[dia] || []).push(iso); });
    return Object.entries(dias).map(([dia, isos]) => ({ dia, isos }));
};

/** «Hoy», «Mañana» o «jue 27/11», contado en la zona del lead. */
export const rotuloDia = (dia, tz) => {
    const hoy = partes(new Date().toISOString(), tz).dia;
    const manana = partes(new Date(Date.now() + 864e5).toISOString(), tz).dia;
    if (dia === hoy) return 'Hoy';
    if (dia === manana) return 'Mañana';
    const [y, m, d] = dia.split('-').map(Number);
    const sem = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
    return `${sem} ${d}/${m}`;
};

export const FRANJAS = [
    { clave: 'manana', label: 'Mañana', desde: 0, hasta: 12 },
    { clave: 'tarde', label: 'Tarde', desde: 12, hasta: 19 },
    { clave: 'noche', label: 'Noche', desde: 19, hasta: 24 },
];

export const franjaDe = (iso, tz) => {
    const { h } = partes(iso, tz);
    return FRANJAS.find((f) => h >= f.desde && h < f.hasta).clave;
};


/** Con «cualquiera», a quién le queda: la persona que ya tenía la llamada si está libre; si no, la que
 *  tiene más horarios libres (la menos cargada). */
export const quienToma = (libres, actualId, porPersona) => {
    if (!libres?.length) return null;
    if (libres.includes(actualId)) return actualId;
    return [...libres].sort((a, b) => (porPersona[b]?.length || 0) - (porPersona[a]?.length || 0))[0];
};

/** Anticipación mínima (minutos) para ofrecer un horario: la elige cada uno y se recuerda en el navegador. */
export const ANTICIPACIONES = [
    { value: 15, label: '15 min' },
    { value: 60, label: '1 h' },
    { value: 120, label: '2 h' },
    { value: 240, label: '4 h' },
    { value: 1440, label: '1 día' },
];
const CLAVE_ANTICIPACION = 'reprogramar_anticipacion_min';

export const leerAnticipacion = () => {
    const n = Number(typeof localStorage !== 'undefined' && localStorage.getItem(CLAVE_ANTICIPACION));
    return ANTICIPACIONES.some((a) => a.value === n) ? n : 60;
};
export const guardarAnticipacion = (n) => { try { localStorage.setItem(CLAVE_ANTICIPACION, String(n)); } catch { /* sin storage: no se recuerda */ } };

export const conAnticipacion = (porPersona, minutos) => {
    const desde = Date.now() + minutos * 60000;
    return Object.fromEntries(Object.entries(porPersona || {}).map(([id, l]) => [id, l.filter((iso) => new Date(iso).getTime() >= desde)]));
};

/** «Sao Paulo» de «America/Sao_Paulo». */
export const ciudad = (tz) => String(tz || '').split('/').pop().replace(/_/g, ' ');

export const hoyEn = (tz) => partes(new Date().toISOString(), tz).dia;

const mesDe = (dia) => dia.slice(0, 7);
const sumarMes = (ym, n) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Los meses (YYYY-MM) que cubren los días con horarios, del primero al último. */
export const mesesDe = (dias) => {
    if (!dias.length) return [];
    const fin = mesDe(dias[dias.length - 1].dia);
    const out = [mesDe(dias[0].dia)];
    while (out[out.length - 1] < fin) out.push(sumarMes(out[out.length - 1], 1));
    return out;
};

/** Las celdas del mes, semana de lunes a domingo: 'YYYY-MM-DD' o null para el hueco del principio. */
export const grillaMes = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const primero = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const largo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [...Array(primero).fill(null),
        ...Array.from({ length: largo }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)];
};

export const nombreMes = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/** «jueves 27 de noviembre». */
export const diaLargo = (dia) => {
    const [y, m, d] = dia.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
};

/** Un color por persona (el rosa queda para lo elegido): el mismo en su tarjeta, en el calendario y en
 *  cada horario, así se ve de un vistazo de quién es cada uno. Fijo por orden de id. */
const COLORES = ['#3B82F6', '#F59E0B', '#10B981', '#A855F7', '#06B6D4', '#F97316', '#84CC16', '#EF4444'];
export const coloresDe = (personas) => {
    const ids = [...personas].map((p) => p.id).sort((a, b) => a - b);
    return Object.fromEntries(ids.map((id, i) => [id, COLORES[i % COLORES.length]]));
};

/** «Noviembre 2026» (sin el «de», que con capitalize quedaba «Noviembre De 2026»). */
export const mesCorto = (ym) => {
    const t = nombreMes(ym).replace(' de ', ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
};
