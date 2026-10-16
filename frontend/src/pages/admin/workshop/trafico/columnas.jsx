import { EVENTO, fechaHora, num, o, pct, referrerCorto } from './trafico';
import { useMontado } from '../../../comercial/components/Shared';

/**
 * Las columnas y las facetas de las dos listas de «Tráfico landings» (`ListaConfigurable`): el ranking
 * (por landing, fuente o campaña) y el detalle de visitas.
 */

/** La parte del total: barra fina que crece al montar y el porcentaje al lado. */
const Parte = ({ pct: p }) => {
    const montado = useMontado();
    return (
        <span className="wf-parte">
            <span className="riel riel--fino"><i style={{ width: montado ? `${p > 0 ? Math.max(p, 1.5) : 0}%` : 0 }} /></span>
            <small className="num">{p.toFixed(1)}%</small>
        </span>
    );
};

/** Texto de una celda: una línea, cortado con «…» y entero en el `title` (nada se monta sobre la columna vecina). */
const Texto = ({ v }) => (v == null || v === ''
    ? <span className="celda mut40">—</span>
    : <span className="celda" title={String(v)}>{v}</span>);

/** Las columnas de texto sin `render` propio pasan por `Texto`. */
const conCeldas = (columnas) => columnas.map((c) => (c.render || c.alinear === 'der'
    ? c : { ...c, render: (f) => <Texto v={c.valor(f)} /> }));

const Evento = ({ evento }) => (
    <span className={`chip wf-evento${evento === 'clic_whatsapp' ? ' wf-evento--clic' : ''}`}>
        <span className="trunc">{EVENTO[evento] || evento}</span>
    </span>
);

/* --- Ranking: por landing, por fuente, por campaña -------------------------------------------- */

export const AGRUPACIONES = [
    { key: 'landing', label: 'Por landing' },
    { key: 'fuente', label: 'Por fuente' },
    { key: 'campana', label: 'Por campaña' },
];

const AYUDA_TASA = 'De las visitas a landings con botón al grupo, qué porcentaje hizo clic. Solo cuenta las visitas posteriores al primer clic medido.';

/** Las columnas del ranking según la agrupación. `total` es el de visitas, para la parte de cada fila. */
export const columnasRanking = (agrupacion, total, medido) => {
    const nombre = {
        landing: { key: 'path', header: 'Landing', valor: (f) => f.path,
            render: (f) => (
                <span className="wf-landing">
                    <span className="celda" title={f.path}>{f.path}</span>
                    {f.origen_datos === 'sesiones' && (
                        <small className="wf-marca" title="La grabación se cuenta por sus sesiones, no por track-visit">Sesiones</small>
                    )}
                </span>
            ) },
        fuente: { key: 'fuente', header: 'Fuente', valor: (f) => f.fuente,
            ayuda: 'El utm_source del link. ig e instagram, fb y facebook se suman juntos.' },
        campana: { key: 'campana', header: 'Campaña', valor: (f) => f.campana,
            ayuda: 'El utm_campaign. Meta manda el ID de la campaña: se busca tal cual en el Administrador de anuncios. Las 12 con más visitas.' },
    }[agrupacion];
    const parte = (f) => (total ? (f.visitas / total) * 100 : 0);
    const columnas = [
        { ...nombre, fija: true, width: 'minmax(180px,2.2fr)' },
        { key: 'visitas', header: 'Visitas', valor: (f) => f.visitas, alinear: 'der', width: 'minmax(84px,.8fr)',
            render: (f) => num(f.visitas) },
        { key: 'parte', header: 'Del total', valor: parte, width: 'minmax(130px,1.2fr)',
            ayuda: 'Qué parte de todas las visitas del período trae esta fila.',
            render: (f) => <Parte pct={parte(f)} /> },
        { key: 'clics', header: 'Clics', valor: (f) => f.clics_whatsapp, alinear: 'der', width: 'minmax(76px,.7fr)',
            ayuda: 'Clics al botón del grupo de WhatsApp del evento.',
            render: (f) => (!medido || (agrupacion === 'landing' && !f.lleva_whatsapp) ? '—' : num(f.clics_whatsapp)) },
        { key: 'tasa', header: 'Tasa', valor: (f) => f.tasa_whatsapp, alinear: 'der', width: 'minmax(70px,.6fr)',
            ayuda: AYUDA_TASA, render: (f) => pct(f.tasa_whatsapp) },
    ];
    if (agrupacion === 'landing') {
        columnas.push(
            { key: 'fuente_principal', header: 'Fuente', valor: (f) => f.fuente_principal, width: 'minmax(110px,1fr)',
                ayuda: 'La fuente que más visitas le trajo a esa landing.' },
            { key: 'ultima', header: 'Última visita', valor: (f) => f.ultima_visita, width: 'minmax(104px,.9fr)',
                render: (f) => fechaHora(f.ultima_visita) },
        );
    }
    return conCeldas(columnas);
};

export const FACETAS_RANKING = {
    landing: [
        { key: 'grupo', label: 'Botón al grupo', de: (f) => (f.lleva_whatsapp ? 'Con grupo de WhatsApp' : 'Sin grupo') },
        { key: 'fuente', label: 'Fuente principal', de: (f) => o(f.fuente_principal, null) },
    ],
    fuente: [],
    campana: [],
};

export const filasRanking = (datos, agrupacion) => {
    if (!datos) return [];
    if (agrupacion === 'fuente') return datos.por_fuente || [];
    if (agrupacion === 'campana') return datos.por_campana || [];
    return datos.por_landing || [];
};

export const claveRanking = (agrupacion) => (f) => (
    agrupacion === 'fuente' ? f.fuente : agrupacion === 'campana' ? f.campana : f.path);

/* --- Detalle: cada visita --------------------------------------------------------------------- */

export const COLUMNAS_DETALLE = conCeldas([
    { key: 'fecha', header: 'Fecha', valor: (f) => f.created_at, fija: true, width: 'minmax(100px,.8fr)',
        render: (f) => fechaHora(f.created_at) },
    { key: 'landing', header: 'Landing', valor: (f) => f.landing, width: 'minmax(150px,1.5fr)' },
    { key: 'evento', header: 'Tipo', valor: (f) => EVENTO[f.evento] || f.evento, width: 'minmax(104px,.8fr)',
        render: (f) => <Evento evento={f.evento} /> },
    { key: 'fuente', header: 'Fuente', valor: (f) => f.fuente, width: 'minmax(110px,1fr)',
        ayuda: 'utm_source normalizado: ig e instagram, fb y facebook son la misma fuente.' },
    { key: 'utm_medium', header: 'Medio', valor: (f) => f.utm_medium, width: 'minmax(90px,.9fr)' },
    { key: 'utm_campaign', header: 'Campaña', valor: (f) => f.utm_campaign, width: 'minmax(120px,1.1fr)' },
    { key: 'utm_content', header: 'Contenido', valor: (f) => f.utm_content, width: 'minmax(120px,1.1fr)', oculta: true },
    { key: 'utm_source', header: 'utm_source', valor: (f) => f.utm_source, width: 'minmax(90px,.9fr)', oculta: true,
        ayuda: 'Tal cual llegó en el link, sin unificar.' },
    { key: 'page_path', header: 'Página', valor: (f) => f.page_path, width: 'minmax(160px,1.6fr)', oculta: true,
        ayuda: 'La dirección que mandó la landing, con su query si la tenía.' },
    { key: 'referrer', header: 'Referrer', valor: (f) => referrerCorto(f.referrer), width: 'minmax(160px,1.6fr)', oculta: true },
]);

export const FACETAS_DETALLE = [
    { key: 'evento', label: 'Tipo', de: (f) => EVENTO[f.evento] || f.evento },
    { key: 'landing', label: 'Landing', de: (f) => f.landing },
    { key: 'fuente', label: 'Fuente', de: (f) => f.fuente },
    { key: 'medio', label: 'Medio', de: (f) => o(f.utm_medium, 'Sin medio') },
    { key: 'campana', label: 'Campaña', de: (f) => o(f.utm_campaign, 'Sin campaña') },
    { key: 'contenido', label: 'Contenido', de: (f) => o(f.utm_content, 'Sin contenido') },
];

export const buscarEnVisita = (f) => [f.landing, f.page_path, f.fuente, f.utm_source, f.utm_medium,
    f.utm_campaign, f.utm_content, f.referrer].filter(Boolean).join(' ');
