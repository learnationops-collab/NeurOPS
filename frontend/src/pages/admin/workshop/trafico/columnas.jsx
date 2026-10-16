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

/** Un ID de Meta con su nombre: el nombre arriba y abajo, chico, la campaña (`de`) o el ID. Sin nombre (no
 *  sincronizado en Meta Ads) va el ID, con su campaña abajo si se conoce. */
const DeMeta = ({ nombre, id, de }) => {
    const abajo = de || (nombre ? id : null);
    return (
        <span className="wf-meta" title={nombre ? `${nombre}${de ? ` · ${de}` : ''} (ID ${id})`
            : `ID ${id}: no está en lo sincronizado de Meta Ads${de ? ` · ${de}` : ''}`}>
            <span className="celda">{nombre || id}</span>
            {abajo && <small className="celda mut40">{abajo}</small>}
        </span>
    );
};

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
    { key: 'anuncio', label: 'Por anuncio' },
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
        campana: { key: 'campana', header: 'Campaña', valor: (f) => f.nombre || f.campana,
            ayuda: 'Las 12 campañas con más visitas.',
            render: (f) => <DeMeta nombre={f.nombre} id={f.campana} /> },
        anuncio: { key: 'anuncio', header: 'Anuncio', valor: (f) => f.nombre || f.anuncio,
            ayuda: 'Los 12 anuncios con más visitas.',
            render: (f) => <DeMeta nombre={f.nombre} id={f.anuncio} de={f.campana_nombre} /> },
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
    anuncio: [
        { key: 'campana', label: 'Campaña', de: (f) => f.campana_nombre || f.campana_id || null },
    ],
};

export const filasRanking = (datos, agrupacion) => {
    if (!datos) return [];
    if (agrupacion === 'fuente') return datos.por_fuente || [];
    if (agrupacion === 'campana') return datos.por_campana || [];
    if (agrupacion === 'anuncio') return datos.por_anuncio || [];
    return datos.por_landing || [];
};

export const claveRanking = (agrupacion) => (f) => (
    { fuente: f.fuente, campana: f.campana, anuncio: f.anuncio }[agrupacion] ?? f.path);

/** Lo que encuentra el buscador del ranking: la clave y, en campañas y anuncios, sus nombres de Meta. */
export const buscarRanking = (agrupacion) => (f) => [claveRanking(agrupacion)(f), f.nombre, f.campana_nombre]
    .filter(Boolean).join(' ');

/* --- Detalle: cada visita --------------------------------------------------------------------- */

export const COLUMNAS_DETALLE = conCeldas([
    { key: 'fecha', header: 'Fecha', valor: (f) => f.created_at, fija: true, width: 'minmax(100px,.8fr)',
        render: (f) => fechaHora(f.created_at) },
    { key: 'landing', header: 'Landing', valor: (f) => f.landing, width: 'minmax(150px,1.5fr)' },
    { key: 'evento', header: 'Tipo', valor: (f) => EVENTO[f.evento] || f.evento, width: 'minmax(104px,.8fr)',
        render: (f) => <Evento evento={f.evento} /> },
    { key: 'fuente', header: 'Fuente', valor: (f) => f.fuente, width: 'minmax(110px,1fr)',
        ayuda: 'ig e instagram cuentan juntas; fb y facebook también.' },
    { key: 'utm_medium', header: 'Medio', valor: (f) => f.utm_medium, width: 'minmax(90px,.9fr)' },
    { key: 'utm_campaign', header: 'Campaña', valor: (f) => f.campana_nombre || f.utm_campaign, width: 'minmax(140px,1.3fr)',
        ayuda: 'El nombre de la campaña de Meta (el link manda su ID en utm_campaign).',
        render: (f) => (f.utm_campaign ? <DeMeta nombre={f.campana_nombre} id={f.utm_campaign} /> : <Texto v={null} />) },
    { key: 'utm_content', header: 'Anuncio', valor: (f) => f.anuncio_nombre || f.utm_content, width: 'minmax(140px,1.3fr)', oculta: true,
        ayuda: 'El nombre del anuncio de Meta (el link manda su ID en utm_content).',
        render: (f) => (f.utm_content ? <DeMeta nombre={f.anuncio_nombre} id={f.utm_content} /> : <Texto v={null} />) },
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
    { key: 'campana', label: 'Campaña', de: (f) => o(f.campana_nombre || f.utm_campaign, 'Sin campaña') },
    { key: 'contenido', label: 'Anuncio', de: (f) => o(f.anuncio_nombre || f.utm_content, 'Sin anuncio') },
];

export const buscarEnVisita = (f) => [f.landing, f.page_path, f.fuente, f.utm_source, f.utm_medium,
    f.utm_campaign, f.campana_nombre, f.utm_content, f.anuncio_nombre, f.referrer].filter(Boolean).join(' ');
