// Lógica pura de la tabla de postulaciones de Learnation Talent: en qué sección
// cae cada postulación, qué columnas hay, cómo se filtra, ordena y agrupa, y cómo
// se guarda la vista que cada persona arma (columnas, anchos, orden, filtros).
//
// El listado se pide entero una sola vez (`filtro=todas`) y todo lo demás se hace
// acá: cambiar de pestaña, buscar o reordenar no vuelve a pegarle al backend.

import { escalaDe, nivelDe, techoIA } from './escalas';

// --- Secciones del dock y sus pestañas ---

// Inbox: las que esperan revisión, en tandas por modalidad (primero híbridos,
// después online) más las que abandonaron el formulario a medias.
export const PESTANAS = {
    pend: [
        { id: 'hibrido', label: 'Híbridos' },
        { id: 'online', label: 'Online' },
        { id: 'incompletas', label: 'Incompletas', c: 'var(--error)' },
    ],
    anal: [
        { id: 'seleccionada', label: 'Seleccionadas', c: 'var(--success)' },
        { id: 'en_reserva', label: 'Reserva', c: 'var(--info)' },
        { id: 'descartado', label: 'Descartadas', c: 'var(--idle)' },
    ],
    fin: [
        { id: 'testeo', label: 'En prueba', c: 'var(--warning)' },
        { id: 'winner', label: 'Winner', c: 'var(--success)' },
        { id: 'top_tier', label: 'Top tier', c: 'var(--brand-secondary)' },
        { id: 'baja', label: 'Baja', c: 'var(--error)' },
    ],
};

export const ANALIZADAS = ['seleccionada', 'en_reserva', 'descartado'];
export const FINALISTAS = ['testeo', 'winner', 'top_tier', 'baja'];

/** ¿La postulación `p` entra en la pestaña `pestana` de la sección `seccion`? */
export const enPestana = (p, seccion, pestana) => {
    if (seccion === 'pend') {
        if (pestana === 'incompletas') return p.veredicto === 'incompleta';
        return p.veredicto === 'sin_analizar' && p.modalidad === pestana;
    }
    return p.veredicto === pestana;
};

/** Cuántas hay en cada pestaña y en cada sección del dock. */
export const cuentas = (filas) => {
    const c = {
        hibrido: 0, online: 0, incompletas: 0, sin_analizar: 0,
        seleccionada: 0, en_reserva: 0, descartado: 0,
        testeo: 0, winner: 0, top_tier: 0, baja: 0,
        total: filas.length, completas: 0, con_video: 0,
    };
    filas.forEach((p) => {
        if (p.completo) c.completas += 1;
        if (p.video_ok) c.con_video += 1;
        if (p.veredicto === 'incompleta') c.incompletas += 1;
        else if (p.veredicto === 'sin_analizar') {
            c.sin_analizar += 1;
            c[p.modalidad === 'hibrido' ? 'hibrido' : 'online'] += 1;
        } else if (c[p.veredicto] != null) c[p.veredicto] += 1;
    });
    c.pend = c.sin_analizar;
    c.anal = c.seleccionada + c.en_reserva + c.descartado;
    c.fin = c.testeo + c.winner + c.top_tier + c.baja;
    return c;
};

// --- Señales de cada fila ---

/** «🇻🇪  Venezuela» → «Venezuela»: una versión vieja del formulario mandaba el país con su
 * bandera adelante (y en Windows el emoji se ve como «VE»). */
export const limpiarPais = (pais) => {
    if (!pais) return pais;
    const i = String(pais).search(/\p{L}/u);
    return i < 0 ? String(pais).trim() : String(pais).slice(i).replace(/\s+/g, ' ').trim();
};

/** La fila tal como la usa el panel (por ahora, solo el país limpio). */
export const normalizar = (p) => ({ ...p, pais: limpiarPais(p.pais) });

export const pideNum = (p) => Number(String(p.remuneracion || '').replace(/[^\d]/g, '')) || 0;

const hoy = () => Date.now();

/** Horas desde que llegó la postulación (o null si no hay fecha). */
export const horasDesde = (iso, ahora = hoy()) => {
    if (!iso) return null;
    const t = Date.parse(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
    if (Number.isNaN(t)) return null;
    return Math.max(0, (ahora - t) / 36e5);
};

export const haceTxt = (h) => {
    if (h == null) return '—';
    if (h < 1) return 'Recién';
    if (h < 24) return `Hace ${Math.floor(h)} h`;
    if (h < 48) return 'Ayer';
    return `Hace ${Math.floor(h / 24)} días`;
};

export const fechaCorta = (iso) => {
    if (!iso) return '';
    const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
};

export const expCorta = (t) => {
    const e = escalaDe('experiencia', t);
    if (!t) return '—';
    if (!e.ok) return t;
    return { 0: 'Ninguna', 1: '< 1 año', 2: '1 y 2 años', 3: '3 y 5 años', 4: '+5 años' }[e.n];
};

// Las siete herramientas que la tabla muestra como íconos, prendidos si la
// respuesta dice que la maneja de verdad (no si solo la conoce).
export const APPS = [
    { id: 'sheets', t: 'Google Sheets', img: 'google-sheets' },
    { id: 'chatgpt', t: 'ChatGPT', img: 'chatgpt' },
    { id: 'claude', t: 'Claude', img: 'claude' },
    { id: 'wa', t: 'WhatsApp Business', img: 'whatsapp' },
    { id: 'notion', t: 'Notion', img: 'notion' },
    { id: 'meta', t: 'Meta Ads', img: 'meta' },
    { id: 'autom', t: 'Zapier (o análogas)', img: 'zapier' },
];

export const appsOn = (p) => ({
    sheets: nivelDe(p.sheets) >= 2,
    chatgpt: nivelDe(p.ia_nivel) >= 2,
    claude: nivelDe(p.ia_nivel) >= 3,
    wa: /^S[íi]/.test(String(p.wa_tools || '')),
    notion: escalaDe('notion', p.notion).n >= 2,
    meta: escalaDe('meta', p.meta).n >= 2,
    autom: Boolean(String(p.automatizacion_ejemplo || '').trim()) || escalaDe('automatizaciones', p.automatizaciones).n >= 2,
});

export const cuantasApps = (p) => Object.values(appsOn(p)).filter(Boolean).length;

/** Nivel de idioma 0-3 (No lo habla · Básico · Intermedio · Avanzado). */
export const nivelIdioma = (valor) => Math.min(3, nivelDe(valor));

/** Color de la barrita del score según la banda. */
export const banda = (score) => (score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--info)' : 'var(--idle)');

// --- Columnas ---

export const COLS = [
    { id: 'cand', label: 'Candidata', w: 'minmax(190px,1.6fr)', min: 190, fija: true, orden: 'nombre' },
    { id: 'fecha', label: 'Postuló', w: '88px', min: 84, orden: 'fecha' },
    { id: 'pide', label: 'Pide / mes', w: '88px', min: 84, orden: 'pide' },
    { id: 'exp', label: 'Experiencia', w: '84px', min: 80, orden: 'exp' },
    { id: 'ia', label: 'Techo de IA', w: '104px', min: 96, orden: 'ia' },
    { id: 'idi', label: 'Idiomas', w: '66px', min: 66, orden: 'idiomas' },
    { id: 'apps', label: 'Herramientas', w: '164px', min: 160, orden: 'apps' },
    { id: 'video', label: 'Video', w: '42px', min: 40, cen: true, orden: 'video' },
    { id: 'cv', label: 'CV', w: '36px', min: 36, cen: true },
    { id: 'wa', label: 'WhatsApp', w: '150px', min: 140 },
    { id: 'score', label: 'Score', w: '56px', min: 52, der: true, orden: 'score' },
];

export const ESENCIALES = ['cand', 'fecha', 'pide', 'ia', 'video', 'wa', 'score'];

export const ORDENES = [
    { id: 'score', label: 'Score', dir: 'desc', txt: { desc: 'Mayor primero', asc: 'Menor primero' } },
    { id: 'fecha', label: 'Fecha de postulación', dir: 'desc', txt: { desc: 'Más recientes', asc: 'Más antiguas' } },
    { id: 'pide', label: 'Lo que pide', dir: 'asc', txt: { asc: 'Menor primero', desc: 'Mayor primero' } },
    { id: 'exp', label: 'Experiencia', dir: 'desc', txt: { desc: 'Más primero', asc: 'Menos primero' } },
    { id: 'ia', label: 'Techo de IA', dir: 'desc', txt: { desc: 'Más alto primero', asc: 'Más bajo primero' } },
    { id: 'idiomas', label: 'Idiomas', dir: 'desc', txt: { desc: 'Más nivel primero', asc: 'Menos nivel primero' } },
    { id: 'apps', label: 'Herramientas', dir: 'desc', txt: { desc: 'Más primero', asc: 'Menos primero' } },
    { id: 'video', label: 'Video verificado', dir: 'desc', txt: { desc: 'Con video primero', asc: 'Sin video primero' } },
    { id: 'nombre', label: 'Nombre', dir: 'asc', txt: { asc: 'A → Z', desc: 'Z → A' } },
];

export const AGRUPAR = [
    { id: 'none', label: 'Sin agrupar' },
    { id: 'pais', label: 'País' },
    { id: 'mod', label: 'Modalidad' },
    { id: 'ia', label: 'Techo de IA' },
    { id: 'fecha', label: 'Día de postulación' },
];

export const PAISES = ['Argentina', 'Venezuela', 'Brasil'];
export const PIDE_TOPE = 600;
export const ANCHO_MIN = 36;
export const ANCHO_MAX = 640;

export const vistaDefault = () => ({
    cols: COLS.map((c) => c.id),
    anchos: {},
    orden: { campo: 'score', dir: 'desc' },
    agrupar: 'none',
    filtros: { paises: [], soloVideo: false, scoreMin: 0, pideMax: 0 },
});

export const filtrosActivos = (cfg) => {
    const f = cfg.filtros;
    return (f.paises.length ? 1 : 0) + (f.soloVideo ? 1 : 0) + (f.scoreMin > 0 ? 1 : 0) + (f.pideMax > 0 ? 1 : 0);
};

export const esVistaDefault = (cfg) => JSON.stringify(cfg) === JSON.stringify(vistaDefault());

// La vista armada vive en el navegador de cada quien: es una comodidad personal
// (qué columnas ve, cuánto miden), no un dato del equipo.
const CLAVE = 'neurops-talent-vista-v1';

export const leerVista = () => {
    try {
        const guardada = JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
        if (!guardada || typeof guardada !== 'object') return vistaDefault();
        const base = vistaDefault();
        const ids = new Set(COLS.map((c) => c.id));
        return {
            ...base,
            ...guardada,
            cols: Array.isArray(guardada.cols) ? guardada.cols.filter((id) => ids.has(id)) : base.cols,
            anchos: guardada.anchos && typeof guardada.anchos === 'object' ? guardada.anchos : {},
            orden: ORDENES.some((o) => o.id === guardada.orden?.campo) ? guardada.orden : base.orden,
            agrupar: AGRUPAR.some((a) => a.id === guardada.agrupar) ? guardada.agrupar : base.agrupar,
            filtros: { ...base.filtros, ...(guardada.filtros || {}) },
        };
    } catch {
        return vistaDefault();
    }
};

export const guardarVista = (cfg) => {
    try { window.localStorage.setItem(CLAVE, JSON.stringify(cfg)); } catch { /* sin almacenamiento: la vista dura la sesión */ }
};

export const colsVisibles = (cfg) => COLS.filter((c) => c.fija || cfg.cols.includes(c.id));

// La última columna (sin título) lleva la papelera y la flecha de abrir.
const COL_FIN = 44;

/** `grid-template-columns` de la tabla: los anchos que ajustó la persona mandan. */
export const plantillaCols = (cols, anchos = {}) =>
    `${cols.map((c) => (anchos[c.id] ? `${anchos[c.id]}px` : c.w)).join(' ')}${anchos.cand ? ` minmax(${COL_FIN}px,1fr)` : ` ${COL_FIN}px`}`;

/** Lo mínimo que mide la tabla con estas columnas: si no entra, scrollea de costado. */
export const minAncho = (cols, anchos = {}) => {
    const fijo = (c) => anchos[c.id] || (c.w.endsWith('px') ? parseInt(c.w, 10) : c.min);
    return Math.max(640, cols.reduce((a, c) => a + fijo(c), 0) + COL_FIN + cols.length * 12 + 34);
};

// --- Filtrar, ordenar, agrupar ---

const sinAcentos = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const coincide = (p, q) => {
    const texto = sinAcentos(`${p.nombre} ${p.pais} ${p.provincia} ${p.email || ''}`);
    return texto.includes(sinAcentos(q));
};

const claveOrden = (p, campo) => {
    switch (campo) {
        case 'score': return p.score ?? 0;
        case 'fecha': return Date.parse(p.created_at || '') || 0;
        case 'pide': return pideNum(p) || null;
        case 'exp': return escalaDe('experiencia', p.experiencia).n;
        case 'ia': return techoIA(p.ia_avanzado).n;
        case 'idiomas': return nivelIdioma(p.ingles) + nivelIdioma(p.idioma2);
        case 'apps': return cuantasApps(p);
        case 'video': return p.video_ok ? 1 : 0;
        case 'nombre': return p.nombre || '';
        default: return 0;
    }
};

export const ordenar = (lista, orden) => {
    const sg = orden.dir === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
        const va = claveOrden(a, orden.campo);
        const vb = claveOrden(b, orden.campo);
        // Sin dato, siempre al final, en cualquier dirección.
        if (va === null && vb !== null) return 1;
        if (vb === null && va !== null) return -1;
        if (typeof va === 'string') {
            const c = va.localeCompare(vb, 'es');
            if (c) return c * sg;
        } else if (va !== vb) return (va - vb) * sg;
        return (b.score ?? 0) - (a.score ?? 0);
    });
};

export const pasaFiltros = (p, filtros) => {
    if (filtros.paises.length && !filtros.paises.includes(p.pais)) return false;
    if (filtros.soloVideo && !p.video_ok) return false;
    if (filtros.scoreMin && (p.score ?? 0) < filtros.scoreMin) return false;
    if (filtros.pideMax && (!pideNum(p) || pideNum(p) > filtros.pideMax)) return false;
    return true;
};

export const grupoDe = (p, agrupar, ahora = hoy()) => {
    if (agrupar === 'pais') return { id: p.pais || '—', label: p.pais || 'Sin país', orden: PAISES.indexOf(p.pais) + 1 || 9 };
    if (agrupar === 'mod') return p.modalidad === 'hibrido'
        ? { id: 'hibrido', label: 'Híbrido', orden: 0 } : { id: 'online', label: 'Online', orden: 1 };
    if (agrupar === 'ia') {
        const t = techoIA(p.ia_avanzado);
        return { id: `ia${t.n}`, label: t.ok ? t.label : 'Sin respuesta', orden: -t.n };
    }
    if (agrupar === 'fecha') {
        const h = horasDesde(p.created_at, ahora) ?? 1e9;
        if (h < 24) return { id: 'hoy', label: 'Últimas 24 h', orden: 0 };
        if (h < 48) return { id: 'ayer', label: 'Ayer', orden: 1 };
        if (h < 168) return { id: 'semana', label: 'Esta semana', orden: 2 };
        return { id: 'antes', label: 'Hace más de una semana', orden: 3 };
    }
    return null;
};

/** Grupos [{g, filas}] ya ordenados; sin agrupar es un solo grupo con g=null. */
export const agrupar = (filas, modo, ahora = hoy()) => {
    if (modo === 'none') return [{ g: null, filas }];
    const grupos = new Map();
    filas.forEach((p) => {
        const g = grupoDe(p, modo, ahora);
        if (!grupos.has(g.id)) grupos.set(g.id, { g, filas: [] });
        grupos.get(g.id).filas.push(p);
    });
    return [...grupos.values()].sort((a, b) => (a.g.orden - b.g.orden) || (b.filas.length - a.filas.length));
};
