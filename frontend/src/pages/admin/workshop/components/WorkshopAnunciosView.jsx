import { Fragment, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { EsqueletoFilas, PanelCab, Tip } from '../../../comercial/components/Shared';
import { useAnunciosTaller } from '../talleres/datosTaller';
import { diaMes } from '../talleres/formato';

/**
 * Los anuncios de Meta que llenaron este taller: los de embudo Workshop (Marketing › Meta Ads), del
 * día siguiente al taller anterior al día de este (los mismos días que su inversión). Campaña ›
 * conjunto › anuncio con gasto, impresiones, clics, CTR, CPC y CPM; por campaña, además, las visitas
 * a las landings y los clics al grupo de WhatsApp que trajo (el id de la campaña viaja en el
 * utm_campaign). Ver `app/services/workshop_meta_service.py`.
 *
 * Vive en el detalle de un taller (Talleres › detalle › Anuncios). La tabla scrollea dentro de su
 * caja, con los títulos pegados arriba: un `thead` sticky funciona porque el scroll de los dos ejes
 * es de la misma caja.
 */

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('es-AR'));
const fmtPct = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);
const dineroPorDefecto = (v) => `$${Number(v).toFixed(2)}`;

const NOMBRE = {
    titulo: 'Campaña › conjunto › anuncio',
    ayuda: 'Campaña › conjunto › anuncio. Solo los clasificados como Workshop.',
};

// `landings`: se mide por campaña (el utm_campaign trae el id de la campaña), no por conjunto ni anuncio.
export const COLUMNAS = [
    { clave: 'gasto', titulo: 'Gasto', dinero: true,
      ayuda: 'Gasto en los días de este taller. La suma es su inversión.' },
    { clave: 'impresiones', titulo: 'Impresiones',
      ayuda: 'Veces que se mostró (no personas).' },
    { clave: 'clics', titulo: 'Clics (todos)',
      ayuda: 'Todos los clics, no solo al enlace.' },
    { clave: 'ctr', titulo: 'CTR', pct: true,
      ayuda: 'Clics ÷ impresiones.' },
    { clave: 'cpc', titulo: 'CPC (enlace)', dinero: true,
      ayuda: 'Gasto ÷ clics al enlace.' },
    { clave: 'cpm', titulo: 'CPM', dinero: true,
      ayuda: 'Costo por 1.000 impresiones.' },
    { clave: 'visitas', titulo: 'Visitas a la landing', landings: true,
      ayuda: 'Visitas a la landing desde esta campaña (solo por campaña).' },
    { clave: 'clics_whatsapp', titulo: 'Clics al grupo', landings: true,
      ayuda: 'Clics al grupo de WhatsApp desde esta campaña.' },
    { clave: 'costo_whatsapp', titulo: 'Costo por clic al grupo', dinero: true, landings: true,
      ayuda: 'Gasto ÷ clics al grupo.' },
];

const valor = (col, v, formatCurrency) => {
    if (v == null) return '—';
    if (col.dinero) return formatCurrency(v);
    if (col.pct) return fmtPct(v);
    return fmtNum(v);
};

// `total`: el gasto del taller. Con él, debajo del gasto va una barrita con la parte que se llevó la fila.
const Celdas = ({ fila, formatCurrency, landings, total }) => COLUMNAS.map((col) => (
    <td key={col.clave} className="num">
        {col.landings && !landings ? '' : valor(col, fila[col.clave], formatCurrency)}
        {col.clave === 'gasto' && total > 0 && (
            <i className="wt-parte" aria-hidden="true" title={`${Math.round((fila.gasto / total) * 100)}% del gasto`}>
                <b style={{ width: `${Math.min(100, (fila.gasto / total) * 100)}%` }} />
            </i>
        )}
    </td>
));

// Lo que se mira primero: cuánto se gastó y qué trajo. Ocho, en dos filas de cuatro.
const RESUMEN = [
    ['gasto', 'impresiones', 'ctr', 'cpc'],
    ['cpm', 'visitas', 'clics_whatsapp', 'costo_whatsapp'],
].map((fila) => fila.map((clave) => COLUMNAS.find((col) => col.clave === clave)));

const WorkshopAnunciosView = ({ evento, formatCurrency = dineroPorDefecto }) => {
    const { datos, error } = useAnunciosTaller(evento?.id);
    const [abiertas, setAbiertas] = useState({});

    // La campaña que más gastó, abierta.
    useEffect(() => {
        if (datos?.campanas?.length) setAbiertas({ [datos.campanas[0].campana_id]: true });
    }, [datos]);

    const alternar = (id) => setAbiertas((a) => ({ ...a, [id]: !a[id] }));
    const abrirTodas = (abrir) => setAbiertas(abrir
        ? Object.fromEntries(datos.campanas.map((c) => [c.campana_id, true])) : {});
    const cantidadAnuncios = datos?.campanas?.reduce(
        (n, c) => n + c.conjuntos.reduce((m, s) => m + s.anuncios.length, 0), 0) ?? 0;
    const todasAbiertas = !!datos?.campanas?.length && datos.campanas.every((c) => abiertas[c.campana_id]);
    const gastoTotal = datos?.totales?.gasto || 0;

    return (
        <div className="vista wt-vista">
            {error ? (
                <section className="panel wt-panel"><p className="t-body mut">No se pudieron traer los anuncios de Meta.</p></section>
            ) : !datos ? (
                <section className="panel wt-panel"><EsqueletoFilas rotulo="Cargando los anuncios…" lineas={6} /></section>
            ) : !datos.anuncios_workshop ? (
                <section className="panel wt-panel">
                    <p className="t-body mut">
                        Todavía no hay anuncios clasificados como Workshop. Se clasifican solos al sincronizar con Meta y se
                        corrigen en Marketing › Meta Ads.
                    </p>
                </section>
            ) : !datos.campanas.length ? (
                <section className="panel wt-panel">
                    <p className="t-body mut">Los anuncios de Workshop no gastaron del {diaMes(datos.desde)} al {diaMes(datos.hasta)}.</p>
                </section>
            ) : (
                <>
                    <section className="panel wt-panel">
                        <PanelCab titulo="Lo que trajeron"
                            tip="Desde el día después del taller anterior hasta este.">
                            <span className="t-cap mut num">Meta Ads · del {diaMes(datos.desde)} al {diaMes(datos.hasta)}</span>
                        </PanelCab>
                        <div className="wt-resumen-anuncios">
                            {RESUMEN.map((fila, i) => (
                                <dl key={i} className="pareja wt-cifras" style={{ '--min': '130px', '--g': 'var(--s3)' }}>
                                    {fila.map((col) => (
                                        <div key={col.clave} className="tarjeta wt-cifra">
                                            <dt>{col.titulo} <Tip titulo={col.titulo} texto={col.ayuda} /></dt>
                                            <dd className="num">{valor(col, datos.totales[col.clave], formatCurrency)}</dd>
                                        </div>
                                    ))}
                                </dl>
                            ))}
                        </div>
                    </section>

                    <section className="panel wt-panel">
                        <PanelCab titulo="Campañas, conjuntos y anuncios" tip={NOMBRE.ayuda}>
                            <span className="t-cap mut num">
                                {datos.campanas.length} {datos.campanas.length === 1 ? 'campaña' : 'campañas'} · {cantidadAnuncios}{' '}
                                {cantidadAnuncios === 1 ? 'anuncio' : 'anuncios'} con gasto
                            </span>
                            <button type="button" className="btn btn--linea btn--sm" onClick={() => abrirTodas(!todasAbiertas)}>
                                {todasAbiertas ? 'Cerrar todas' : 'Abrir todas'}
                            </button>
                        </PanelCab>
                        <div className="wt-anuncios-caja">
                            <table className="wt-anuncios">
                                <thead>
                                    <tr>
                                        {[NOMBRE, ...COLUMNAS].map((col) => (
                                            <th key={col.titulo} scope="col">
                                                <span className="wt-anuncios-titulo">
                                                    <span>{col.titulo}</span>
                                                    <Tip titulo={col.titulo} texto={col.ayuda} />
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {datos.campanas.map((c) => (
                                        <Fragment key={c.campana_id}>
                                            <tr className="wt-anuncios-campana">
                                                <th scope="row">
                                                    <button type="button" className="wt-anuncios-abrir" onClick={() => alternar(c.campana_id)}
                                                        aria-expanded={!!abiertas[c.campana_id]} title={c.nombre}>
                                                        <ChevronRight className="wt-anuncios-flecha" aria-hidden="true" />
                                                        <span className="trunc">{c.nombre}</span>
                                                    </button>
                                                </th>
                                                <Celdas fila={c} formatCurrency={formatCurrency} landings total={gastoTotal} />
                                            </tr>
                                            {abiertas[c.campana_id] && c.conjuntos.map((s) => (
                                                <Fragment key={`${c.campana_id}-${s.nombre}`}>
                                                    <tr className="wt-anuncios-conjunto">
                                                        <th scope="row" title={s.nombre || 'Sin conjunto'}>
                                                            <span className="trunc">{s.nombre || 'Sin conjunto'}</span>
                                                        </th>
                                                        <Celdas fila={s} formatCurrency={formatCurrency} total={gastoTotal} />
                                                    </tr>
                                                    {s.anuncios.map((a) => (
                                                        <tr key={a.meta_ad_id} className="wt-anuncios-anuncio">
                                                            <th scope="row" title={a.nombre}><span className="trunc">{a.nombre}</span></th>
                                                            <Celdas fila={a} formatCurrency={formatCurrency} total={gastoTotal} />
                                                        </tr>
                                                    ))}
                                                </Fragment>
                                            ))}
                                        </Fragment>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="wt-anuncios-total">
                                        <th scope="row">Total del taller</th>
                                        <Celdas fila={datos.totales} formatCurrency={formatCurrency} landings />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

export default WorkshopAnunciosView;
