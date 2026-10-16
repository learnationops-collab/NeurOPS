import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Megaphone } from 'lucide-react';
import api from '../../../../services/api';

/**
 * Los anuncios de Meta que llenaron este taller: los de embudo Workshop (Marketing › Meta Ads), del
 * día siguiente al taller anterior al día de este (los mismos días que su
 * inversión). Campaña › conjunto › anuncio con gasto, impresiones, clics, CTR, CPC y CPM; por
 * campaña, además, las visitas a las landings y los clics al grupo de WhatsApp que trajo (el id de
 * la campaña viaja en el utm_campaign). Ver `app/services/workshop_meta_service.py`.
 */

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('es-AR'));
const fmtPct = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);
const fmtFecha = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '');

const Celdas = ({ fila, formatCurrency, landings }) => (
    <>
        <td data-workshop="Gasto">{formatCurrency(fila.gasto)}</td>
        <td data-workshop="Impresiones">{fmtNum(fila.impresiones)}</td>
        <td data-workshop="Clics">{fmtNum(fila.clics)}</td>
        <td data-workshop="CTR">{fmtPct(fila.ctr)}</td>
        <td data-workshop="CPC (enlace)">{fila.cpc == null ? '—' : formatCurrency(fila.cpc)}</td>
        <td data-workshop="CPM">{fila.cpm == null ? '—' : formatCurrency(fila.cpm)}</td>
        <td data-workshop="Visitas a la landing">{landings ? fmtNum(fila.visitas) : ''}</td>
        <td data-workshop="Clics al grupo">{landings ? fmtNum(fila.clics_whatsapp) : ''}</td>
        <td data-workshop="Costo por clic al grupo">
            {landings ? (fila.costo_whatsapp == null ? '—' : formatCurrency(fila.costo_whatsapp)) : ''}
        </td>
    </>
);

const WorkshopAnunciosView = ({ evento, eventos = [], onSelectEvent, formatDate = (d) => d, formatCurrency }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [abiertas, setAbiertas] = useState({});

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

    return (
        <section className="panel comparison-panel ws-anuncios" aria-labelledby="ws-anuncios-titulo">
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
                <div className="comparison-scroll">
                    <table className="trafico-landings ws-anuncios-tabla">
                        <thead>
                            <tr>
                                <th scope="col">Campaña › conjunto › anuncio</th>
                                <th scope="col">Gasto</th>
                                <th scope="col">Impresiones</th>
                                <th scope="col">Clics</th>
                                <th scope="col">CTR</th>
                                <th scope="col">CPC (enlace)</th>
                                <th scope="col">CPM</th>
                                <th scope="col">Visitas a la landing</th>
                                <th scope="col">Clics al grupo</th>
                                <th scope="col">Costo por clic al grupo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datos.campanas.map((c) => (
                                <Fragment key={c.campana_id}>
                                    <tr className="ws-anuncios-campana">
                                        <th scope="row">
                                            <button type="button" className="ws-anuncios-abrir" onClick={() => alternar(c.campana_id)}
                                                aria-expanded={!!abiertas[c.campana_id]}>
                                                {abiertas[c.campana_id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                <strong>{c.nombre}</strong>
                                            </button>
                                        </th>
                                        <Celdas fila={c} formatCurrency={formatCurrency} landings />
                                    </tr>
                                    {abiertas[c.campana_id] && c.conjuntos.map((s) => (
                                        <Fragment key={`${c.campana_id}-${s.nombre}`}>
                                            <tr className="ws-anuncios-conjunto">
                                                <th scope="row">{s.nombre || 'Sin conjunto'}</th>
                                                <Celdas fila={s} formatCurrency={formatCurrency} />
                                            </tr>
                                            {s.anuncios.map((a) => (
                                                <tr key={a.meta_ad_id} className="ws-anuncios-anuncio">
                                                    <th scope="row">{a.nombre}</th>
                                                    <Celdas fila={a} formatCurrency={formatCurrency} />
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
            )}
        </section>
    );
};

export default WorkshopAnunciosView;
