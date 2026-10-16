import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronRight, Megaphone } from 'lucide-react';
import api from '../../../../services/api';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

/**
 * Los anuncios de Meta que llenaron este taller: los de embudo Workshop (Marketing › Meta Ads), del
 * día siguiente al taller anterior al día de este (los mismos días que su
 * inversión). Campaña › conjunto › anuncio con gasto, impresiones, clics, CTR, CPC y CPM; por
 * campaña, además, las visitas a las landings y los clics al grupo de WhatsApp que trajo (el id de
 * la campaña viaja en el utm_campaign). Ver `app/services/workshop_meta_service.py`.
 *
 * Los títulos de las columnas quedan pegados debajo de la barra de pestañas mientras se scrollea la
 * página (16/10/2026). No pueden ir en el <thead> de la tabla: la tabla scrollea de costado y un
 * contenedor con scroll horizontal se queda con el `sticky`. Van en una segunda tabla con las mismas
 * columnas (mismo ancho y `table-layout: fixed`, así coinciden sin medir) que copia el scroll
 * horizontal; la tabla de datos conserva un <thead> oculto para los lectores de pantalla.
 */

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('es-AR'));
const fmtPct = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);
const fmtFecha = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '');

const NOMBRE = {
    titulo: 'Campaña › conjunto › anuncio',
    ayuda: 'Cómo está armado en Meta: cada campaña agrupa conjuntos (a quién se le muestra) y cada conjunto sus '
        + 'anuncios (lo que la gente ve). Tocá una campaña para abrirla. Solo entran los anuncios clasificados como '
        + 'Workshop en Marketing › Meta Ads.',
};

// `landings`: se mide por campaña (el utm_campaign trae el id de la campaña), no por conjunto ni anuncio.
const COLUMNAS = [
    { clave: 'gasto', titulo: 'Gasto', dinero: true,
      ayuda: 'Lo que cobró Meta en los días de este taller: del día siguiente al taller anterior hasta el día de '
        + 'este. La suma de todas las campañas es la inversión del taller.' },
    { clave: 'impresiones', titulo: 'Impresiones',
      ayuda: 'Cuántas veces se mostró. Una misma persona puede verlo varias veces: no son personas distintas.' },
    { clave: 'clics', titulo: 'Clics (todos)',
      ayuda: 'Todos los clics en el anuncio, también los que no llevan a la landing (abrir el perfil, ver más '
        + 'texto, reaccionar…). Es lo que Meta llama «Clics (todos)».' },
    { clave: 'ctr', titulo: 'CTR', pct: true,
      ayuda: 'Clics sobre impresiones: de cada 100 veces que se mostró, cuántas alguien hizo clic. Sirve para ver '
        + 'qué anuncio engancha más.' },
    { clave: 'cpc', titulo: 'CPC (enlace)', dinero: true,
      ayuda: 'Costo por clic en el enlace: el gasto dividido los clics que llevaron a la landing (no todos los '
        + 'clics). Cuánto costó cada persona que fue a ver la página.' },
    { clave: 'cpm', titulo: 'CPM', dinero: true,
      ayuda: 'Costo por mil impresiones: lo que cobró Meta por mostrar el anuncio 1.000 veces. Si sube, el público '
        + 'se está encareciendo o saturando.' },
    { clave: 'visitas', titulo: 'Visitas a la landing', landings: true,
      ayuda: 'Visitas a las landings del taller que llegaron con el id de esta campaña en el link (utm_campaign), '
        + 'en los mismos días. Se mide por campaña, no por anuncio: por eso los conjuntos y los anuncios quedan '
        + 'vacíos. La grabación no cuenta.' },
    { clave: 'clics_whatsapp', titulo: 'Clics al grupo', landings: true,
      ayuda: 'Clics al botón del grupo de WhatsApp en esas landings, de visitas que vinieron de esta campaña.' },
    { clave: 'costo_whatsapp', titulo: 'Costo por clic al grupo', dinero: true, landings: true,
      ayuda: 'El gasto de la campaña dividido los clics al grupo: cuánto costó cada persona que fue a entrar al '
        + 'grupo de WhatsApp.' },
];

const valor = (col, v, formatCurrency) => {
    if (v == null) return '—';
    if (col.dinero) return formatCurrency(v);
    if (col.pct) return fmtPct(v);
    return fmtNum(v);
};

// `total`: el gasto del taller. Con él, debajo del gasto va una barrita con la parte que se llevó la fila.
const Celdas = ({ fila, formatCurrency, landings, total }) => COLUMNAS.map((col) => (
    <td key={col.clave} data-workshop={col.titulo}>
        {col.landings && !landings ? '' : valor(col, fila[col.clave], formatCurrency)}
        {col.clave === 'gasto' && total > 0 && (
            <i className="ws-anuncios-parte" aria-hidden="true" title={`${Math.round((fila.gasto / total) * 100)}% del gasto`}>
                <b style={{ width: `${Math.min(100, (fila.gasto / total) * 100)}%` }} />
            </i>
        )}
    </td>
));

// Lo que se mira primero: cuánto se gastó y qué trajo. Ocho, en dos filas de cuatro.
const RESUMEN = ['gasto', 'impresiones', 'ctr', 'cpc', 'cpm', 'visitas', 'clics_whatsapp', 'costo_whatsapp']
    .map((clave) => COLUMNAS.find((col) => col.clave === clave));

const Columnas = () => (
    <colgroup>
        <col className="ws-anuncios-col-nombre" />
        {COLUMNAS.map((col) => <col key={col.clave} />)}
    </colgroup>
);

const WorkshopAnunciosView = ({ evento, eventos = [], onSelectEvent, formatDate = (d) => d, formatCurrency }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [abiertas, setAbiertas] = useState({});
    const cabezaRef = useRef(null);

    // Un taller por montaje: el panel la monta con key={evento.id}, así que arranca vacía.
    useEffect(() => {
        if (!evento?.id) return undefined;
        const control = new AbortController();
        api.get(`workshop/events/${evento.id}/anuncios`, { signal: control.signal })
            .then((r) => {
                setDatos(r.data);
                // La campaña que más gastó, abierta.
                setAbiertas(r.data.campanas.length ? { [r.data.campanas[0].campana_id]: true } : {});
            })
            .catch((e) => { if (e?.name !== 'CanceledError') setError('No se pudieron traer los anuncios de Meta.'); });
        return () => control.abort();
    }, [evento?.id]);

    const alternar = (id) => setAbiertas((a) => ({ ...a, [id]: !a[id] }));
    const abrirTodas = (abrir) => setAbiertas(abrir
        ? Object.fromEntries(datos.campanas.map((c) => [c.campana_id, true])) : {});
    const cantidadAnuncios = datos?.campanas.reduce(
        (n, c) => n + c.conjuntos.reduce((m, s) => m + s.anuncios.length, 0), 0) ?? 0;
    const todasAbiertas = !!datos?.campanas.length && datos.campanas.every((c) => abiertas[c.campana_id]);
    const gastoTotal = datos?.totales?.gasto || 0;
    // Los títulos pegados siguen el scroll horizontal de la tabla.
    const copiarScroll = (e) => { if (cabezaRef.current) cabezaRef.current.scrollLeft = e.currentTarget.scrollLeft; };

    return (
        <section className="panel ws-anuncios" aria-labelledby="ws-anuncios-titulo">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">
                        Meta Ads{datos && ` · del ${fmtFecha(datos.desde)} al ${fmtFecha(datos.hasta)}`}
                    </p>
                    <h2 id="ws-anuncios-titulo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Megaphone size={18} /> Anuncios que llenaron este taller
                    </h2>
                </div>
                {/* El mismo taller que está abierto en Embudo: cambiarlo acá lo cambia allá. */}
                {onSelectEvent && eventos.length > 0 && (
                    <label className="ws-anuncios-taller">
                        <span>Taller</span>
                        <select value={evento.id}
                            onChange={(e) => onSelectEvent(eventos.find((x) => String(x.id) === e.target.value))}>
                            {eventos.map((x) => (
                                <option key={x.id} value={x.id}>{formatDate(x.date)} · {x.name}</option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
            {error ? (
                <p className="all-target ws-anuncios-vacio">{error}</p>
            ) : !datos ? (
                <p className="all-target ws-anuncios-vacio" role="status">Cargando los anuncios…</p>
            ) : !datos.anuncios_workshop ? (
                <p className="all-target ws-anuncios-vacio">
                    Todavía no hay anuncios clasificados como Workshop. Se clasifican solos al sincronizar con Meta y se
                    corrigen en Marketing › Meta Ads: acá vas a ver el gasto y los resultados de cada uno entre este
                    taller y el anterior.
                </p>
            ) : !datos.campanas.length ? (
                <p className="all-target ws-anuncios-vacio">Los anuncios de Workshop no gastaron en estos días.</p>
            ) : (
                <>
                <dl className="ws-anuncios-resumen">
                    {RESUMEN.map((col) => (
                        <div key={col.clave}>
                            <dt>{col.titulo} <InfoTooltip label={col.titulo} text={col.ayuda} size={11} /></dt>
                            <dd>{valor(col, datos.totales[col.clave], formatCurrency)}</dd>
                        </div>
                    ))}
                </dl>
                <div className="ws-anuncios-barra">
                    <span>
                        {datos.campanas.length} {datos.campanas.length === 1 ? 'campaña' : 'campañas'} · {cantidadAnuncios}{' '}
                        {cantidadAnuncios === 1 ? 'anuncio' : 'anuncios'} con gasto
                    </span>
                    <button type="button" className="text-action" onClick={() => abrirTodas(!todasAbiertas)}>
                        {todasAbiertas ? 'Cerrar todas' : 'Abrir todas'}
                    </button>
                </div>
                <div className="ws-anuncios-marco">
                    {/* Títulos pegados: lo visible. La tabla es de presentación; los tooltips sí se leen. */}
                    <div className="ws-anuncios-cabeza" ref={cabezaRef}>
                        <table className="ws-anuncios-tabla" role="presentation">
                            <Columnas />
                            <thead>
                                <tr>
                                    {[NOMBRE, ...COLUMNAS].map((col) => (
                                        <th key={col.titulo}>
                                            <span className="ws-anuncios-titulo">
                                                <span>{col.titulo}</span>
                                                <InfoTooltip label={col.titulo} text={col.ayuda} size={11} />
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        </table>
                    </div>
                    <div className="ws-anuncios-scroll" onScroll={copiarScroll}>
                        <table className="ws-anuncios-tabla">
                            <Columnas />
                            <thead className="ws-anuncios-thead-lector">
                                <tr>
                                    {[NOMBRE, ...COLUMNAS].map((col) => <th key={col.titulo} scope="col">{col.titulo}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {datos.campanas.map((c) => (
                                    <Fragment key={c.campana_id}>
                                        <tr className="ws-anuncios-campana">
                                            <th scope="row">
                                                <button type="button" className="ws-anuncios-abrir" onClick={() => alternar(c.campana_id)}
                                                    aria-expanded={!!abiertas[c.campana_id]} title={c.nombre}>
                                                    <ChevronRight size={14} className="ws-anuncios-flecha" />
                                                    <strong>{c.nombre}</strong>
                                                </button>
                                            </th>
                                            <Celdas fila={c} formatCurrency={formatCurrency} landings total={gastoTotal} />
                                        </tr>
                                        {abiertas[c.campana_id] && c.conjuntos.map((s) => (
                                            <Fragment key={`${c.campana_id}-${s.nombre}`}>
                                                <tr className="ws-anuncios-conjunto">
                                                    <th scope="row" title={s.nombre || 'Sin conjunto'}>
                                                        <span>{s.nombre || 'Sin conjunto'}</span>
                                                    </th>
                                                    <Celdas fila={s} formatCurrency={formatCurrency} total={gastoTotal} />
                                                </tr>
                                                {s.anuncios.map((a) => (
                                                    <tr key={a.meta_ad_id} className="ws-anuncios-anuncio">
                                                        <th scope="row" title={a.nombre}><span>{a.nombre}</span></th>
                                                        <Celdas fila={a} formatCurrency={formatCurrency} total={gastoTotal} />
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="ws-anuncios-total">
                                    <th scope="row">Total del taller</th>
                                    <Celdas fila={datos.totales} formatCurrency={formatCurrency} landings />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                </>
            )}
        </section>
    );
};

export default WorkshopAnunciosView;
