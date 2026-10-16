/**
 * Las columnas, facetas y agrupaciones de Marketing › Entrantes (`ListaConfigurable`): una fila por
 * persona que entró por ManyChat, con su estado y en qué paso del flujo va.
 */

export const ESTADOS = {
    calificado: { label: 'Calificado', c: 'var(--success)' },
    en_conversacion: { label: 'En conversación', c: 'var(--cat-6)' },
    sin_respuesta: { label: 'Sin respuesta', c: 'var(--idle)' },
    descalificado: { label: 'Descalificado', c: 'var(--error)' },
};
export const ORDEN_ESTADOS = ['calificado', 'descalificado', 'en_conversacion', 'sin_respuesta'];

const CATEGORIAS = { opening: 'Apertura', cualificacion: 'Cualificación', dolor: 'Dolor', seguimiento: 'Seguimiento' };
export const categoriaDe = (mensaje) => CATEGORIAS[mensaje?.categoria] || null;

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** «10/10 16:17» en la hora de quien mira. El log de webhooks manda UTC sin zona: se le agrega la Z. */
export const fechaHora = (iso) => {
    if (!iso) return '—';
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
    const dos = (n) => String(n).padStart(2, '0');
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};
export const diaDe = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const Estado = ({ estado }) => {
    const e = ESTADOS[estado] || { label: estado, c: 'var(--idle)' };
    return <span className="chip en-estado" style={{ '--c': e.c }}><span className="trunc">{e.label}</span></span>;
};

/** Un texto de una línea, cortado con «…» y entero en el `title`. */
const Texto = ({ v, sub }) => (v == null || v === ''
    ? <span className="celda mut40">—</span>
    : (
        <span className="en-celda" title={sub ? `${v} · ${sub}` : String(v)}>
            <span className="celda">{v}</span>
            {sub && <small className="celda mut40">{sub}</small>}
        </span>
    ));

export const COLUMNAS = [
    { key: 'persona', header: 'Persona', fija: true, width: 'minmax(130px,1.5fr)', valor: (f) => f.nombre || f.ig,
        render: (f) => <Texto v={f.nombre || f.ig} sub={f.ig ? `@${f.ig}` : null} /> },
    { key: 'estado', header: 'Estado', width: 'minmax(112px,.9fr)', valor: (f) => ORDEN_ESTADOS.indexOf(f.estado),
        render: (f) => <Estado estado={f.estado} /> },
    { key: 'etapa', header: 'Paso', width: 'minmax(112px,1fr)', valor: (f) => f.ultimo_enviado?.titulo,
        ayuda: 'El último mensaje que ManyChat le mandó.',
        render: (f) => <Texto v={f.ultimo_enviado?.titulo} sub={categoriaDe(f.ultimo_enviado)} /> },
    { key: 'respondio', header: 'Respondió', width: 'minmax(120px,1fr)', valor: (f) => f.ultimo_respondido?.titulo,
        ayuda: 'El último mensaje que contestó.', oculta: true,
        render: (f) => <Texto v={f.ultimo_respondido?.titulo} /> },
    { key: 'clave', header: 'Clave', width: 'minmax(100px,1fr)', valor: (f) => f.clave,
        render: (f) => <Texto v={f.clave} /> },
    { key: 'campana', header: 'Campaña', width: 'minmax(110px,1.3fr)', valor: (f) => f.campana,
        render: (f) => <Texto v={f.campana} sub={f.conjunto} /> },
    { key: 'setter', header: 'Setter', width: 'minmax(80px,.8fr)', valor: (f) => f.setter,
        render: (f) => <Texto v={f.setter} /> },
    { key: 'seguidor', header: 'Seguidor', width: 'minmax(80px,.6fr)', valor: (f) => (f.follower ? 1 : 0), oculta: true,
        render: (f) => (f.follower ? 'Sí' : 'No') },
    { key: 'interacciones', header: 'Webhooks', width: 'minmax(84px,.6fr)', alinear: 'der', valor: (f) => f.interacciones,
        ayuda: 'Cuántas veces escribió ManyChat por esta persona.', oculta: true },
    { key: 'entro', header: 'Entró', width: 'minmax(92px,.8fr)', valor: (f) => f.primera_at, oculta: true,
        render: (f) => <span className="celda num">{fechaHora(f.primera_at)}</span> },
    { key: 'ultima', header: 'Última', width: 'minmax(84px,.8fr)', valor: (f) => f.ultima_at,
        render: (f) => <span className="celda num">{fechaHora(f.ultima_at)}</span> },
];

const o = (v, vacio) => (v == null || v === '' ? vacio : v);

export const FACETAS = [
    { key: 'estado', label: 'Estado', de: (f) => ESTADOS[f.estado]?.label || f.estado },
    { key: 'etapa', label: 'Paso', de: (f) => o(f.ultimo_enviado?.titulo, 'Sin mensaje') },
    { key: 'clave', label: 'Palabra clave', de: (f) => o(f.clave, 'Sin palabra clave') },
    { key: 'campana', label: 'Campaña', de: (f) => o(f.campana, 'Sin campaña') },
    { key: 'setter', label: 'Setter', de: (f) => o(f.setter, 'Sin setter') },
    { key: 'seguidor', label: 'Seguidor', de: (f) => (f.follower ? 'Sí' : 'No') },
    { key: 'dia', label: 'Día de entrada', de: (f) => diaDe(f.primera_at) },
];

export const AGRUPABLES = [
    { key: 'estado', label: 'Estado', de: (f) => ESTADOS[f.estado]?.label || f.estado },
    { key: 'etapa', label: 'Paso', de: (f) => f.ultimo_enviado?.titulo },
    { key: 'clave', label: 'Palabra clave', de: (f) => f.clave },
    { key: 'campana', label: 'Campaña', de: (f) => f.campana },
    { key: 'setter', label: 'Setter', de: (f) => f.setter },
    { key: 'dia', label: 'Día de entrada', de: (f) => diaDe(f.primera_at) },
];

export const buscarEnEntrante = (f) => [f.nombre, f.ig, f.clave, f.campana, f.conjunto, f.setter,
    f.ultimo_enviado?.titulo, f.manychat_id].filter(Boolean).join(' ');
