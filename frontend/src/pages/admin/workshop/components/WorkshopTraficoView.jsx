import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, MonitorSmartphone, MessageCircle, Percent, Globe, BarChart3, Megaphone } from 'lucide-react';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

/*
 * Tráfico de las landings de institute-site.
 *
 * Visitas: cada carga de página que la landing reporta a /api/v1/metrics/track-visit.
 * Clics al grupo: el botón que lleva al grupo de WhatsApp del evento (live-class*, live,
 * acceso, crear-evento). Se miden desde que institute-site empezó a mandarlos, así que la
 * tasa solo usa las visitas posteriores a ese primer clic (ver app/api/workshop_trafico.py).
 * La grabación (/replay/) sale de sus sesiones: su embudo está en «Landing grabación».
 */

const diaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtNum = (n) => (n ?? 0).toLocaleString('es');
const fmtPct = (n) => (n == null ? '—' : `${n.toLocaleString('es', { maximumFractionDigits: 1 })}%`);
const fmtDia = (iso) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
};
const fmtFechaHora = (iso) => (iso
    ? new Date(iso).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—');

const Kpi = ({ label, value, sub, icon: Icon, ayuda }) => (
    <article className="kpi-card">
        <div className="kpi-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {label}
                {ayuda && <InfoTooltip label={label} text={ayuda} />}
            </span>
            <Icon size={18} aria-hidden="true" />
        </div>
        <strong>{value}</strong>
        <div className="kpi-foot"><span>{sub}</span></div>
    </article>
);

/* Visitas por día: una sola serie y un solo eje. Los clics al grupo van en el
   tooltip (escala muy distinta: dibujarlos encima pediría un segundo eje). */
const GraficoDiario = ({ dias }) => {
    const [activo, setActivo] = useState(null);
    const max = Math.max(1, ...dias.map((d) => d.visitas));
    const marcas = dias.length <= 10 ? 1 : dias.length <= 31 ? 5 : 14;
    const dia = activo != null ? dias[activo] : null;

    return (
        <div className="trafico-chart" onMouseLeave={() => setActivo(null)}>
            <div className="trafico-chart-tip" aria-live="polite">
                {dia ? (
                    <>
                        <strong>{fmtDia(dia.dia)}</strong>
                        <span>{fmtNum(dia.visitas)} visitas</span>
                        <span>{fmtNum(dia.clics_whatsapp)} clics al grupo</span>
                    </>
                ) : (
                    <span>Pasá el mouse por una barra para ver el día · máximo {fmtNum(max)} visitas</span>
                )}
            </div>
            <div className="trafico-chart-plot" role="img" aria-label={`Visitas por día, ${dias.length} días, máximo ${max}`}>
                {dias.map((d, i) => (
                    <button
                        type="button"
                        key={d.dia}
                        className={`trafico-chart-col${activo === i ? ' activo' : ''}`}
                        onMouseEnter={() => setActivo(i)}
                        onFocus={() => setActivo(i)}
                        onBlur={() => setActivo(null)}
                        aria-label={`${fmtDia(d.dia)}: ${d.visitas} visitas, ${d.clics_whatsapp} clics al grupo`}
                    >
                        <i style={{ height: `${(d.visitas / max) * 100}%`, animationDelay: `${Math.min(i * 12, 400)}ms` }} />
                    </button>
                ))}
            </div>
            <div className="trafico-chart-axis" aria-hidden="true">
                {dias.map((d, i) => (
                    <span key={d.dia}>{(i % marcas === 0 || i === dias.length - 1) ? fmtDia(d.dia) : ''}</span>
                ))}
            </div>
        </div>
    );
};

const TablaAgrupada = ({ titulo, icono: Icono, filas, campo, etiqueta, medido, ayudaCampo }) => (
    <article className="panel comparison-panel trafico-tabla">
        <div className="section-heading">
            <div>
                <p className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icono size={14} /> {titulo}
                    {ayudaCampo && <InfoTooltip label={titulo} text={ayudaCampo} />}
                </p>
            </div>
        </div>
        {filas.length === 0 ? (
            <p className="secondary-copy" style={{ padding: '18px 0' }}>Sin datos en este rango.</p>
        ) : (
            <div className="comparison-scroll">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">{etiqueta}</th>
                            <th scope="col">Visitas</th>
                            <th scope="col">Clics al grupo</th>
                            <th scope="col">Tasa</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((f) => (
                            <tr key={f[campo]}>
                                <th scope="row" className={campo === 'campana' ? 'trafico-id' : ''}>{f[campo]}</th>
                                <td data-workshop="Visitas">{fmtNum(f.visitas)}</td>
                                <td data-workshop="Clics al grupo">{medido ? fmtNum(f.clics_whatsapp) : '—'}</td>
                                <td data-workshop="Tasa">{fmtPct(f.tasa_whatsapp)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </article>
);

const WorkshopTraficoView = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dias, setDias] = useState(30);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            // Días locales: el backend corta el rango a las 00:00 de La Paz, y
            // toISOString() daría el día de UTC (de noche, ya el siguiente).
            const hasta = new Date();
            const desde = new Date(hasta.getTime() - (dias - 1) * 86400000);
            const rango = `desde=${diaLocal(desde)}&hasta=${diaLocal(hasta)}`;
            const res = await api.get(`/workshop/landing/trafico?${rango}`);
            setData(res.data);
        } catch (e) {
            console.error('[trafico] Error al cargar', e);
            toast.error('No se pudo cargar el tráfico de las landings');
        } finally {
            setLoading(false);
        }
    }, [dias]);

    useEffect(() => { cargar(); }, [cargar]);

    if (loading && !data) {
        return (
            <section className="empty-state loading-state" role="status">
                <div><span /></div>
                <p className="eyebrow">Sincronizando</p>
                <h2>Cargando el tráfico de las landings…</h2>
            </section>
        );
    }

    const t = data?.totales || {};
    const landings = data?.por_landing || [];
    const medido = Boolean(data?.whatsapp_medido_desde);
    const desdeMedido = medido ? fmtFechaHora(data.whatsapp_medido_desde) : null;

    return (
        <>
            <div className="hero-actions" style={{ marginBottom: 22 }}>
                <div className="pill-toggle">
                    {[7, 30, 90].map((d) => (
                        <button type="button" key={d} className={dias === d ? 'active' : ''} onClick={() => setDias(d)}>{d} días</button>
                    ))}
                </div>
                <button type="button" className="secondary-action" onClick={cargar}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
                {data?.rango && <span className="secondary-copy">{data.rango.desde} → {data.rango.hasta}</span>}
            </div>

            {!medido && (
                <p className="trafico-aviso" role="note">
                    <MessageCircle size={14} aria-hidden="true" />
                    Los clics al grupo de WhatsApp todavía no se están midiendo: empiezan a contar cuando se
                    publique en institute-site la versión que los reporta. Hasta entonces la tasa queda vacía.
                </p>
            )}

            <section className="kpi-grid" aria-label="Indicadores de tráfico de las landings">
                <Kpi
                    label="Visitas"
                    ayuda="Cada vez que alguien abre una landing de institute-site. Si la misma persona recarga, cuenta dos veces: es tráfico, no personas."
                    value={fmtNum(t.visitas)}
                    sub={`${t.landings || 0} landings con tráfico`}
                    icon={MonitorSmartphone}
                />
                <Kpi
                    label="Clics al grupo de WhatsApp"
                    ayuda="Clics al botón que lleva al grupo de WhatsApp del evento. Es la entrada a la clase en vivo: quien no entra al grupo no recibe el link."
                    value={medido ? fmtNum(t.clics_whatsapp) : '—'}
                    sub={medido ? `Se miden desde el ${desdeMedido}` : 'Sin medir todavía'}
                    icon={MessageCircle}
                />
                <Kpi
                    label="Visita → grupo"
                    ayuda="De las visitas a landings con botón al grupo, qué porcentaje hizo clic. Solo cuenta las visitas posteriores al primer clic medido."
                    value={fmtPct(t.tasa_whatsapp)}
                    sub={`${fmtNum(t.visitas_landings_whatsapp)} visitas a landings con grupo`}
                    icon={Percent}
                />
            </section>

            <article className="panel" style={{ padding: 26, marginBottom: 22 }}>
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">Todas las landings</p>
                        <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} /> Visitas por día</h2>
                    </div>
                </div>
                <GraficoDiario dias={data?.por_dia || []} />
            </article>

            <section className="panel comparison-panel" style={{ marginTop: 0 }}>
                <div className="section-heading">
                    <div><p className="eyebrow">Por landing</p><h2>Qué landing trae el tráfico ({landings.length})</h2></div>
                </div>
                {landings.length === 0 ? (
                    <p className="all-target" style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Globe size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: .5 }} />
                        Todavía no hay visitas en este rango.
                    </p>
                ) : (
                    <div className="comparison-scroll">
                        <table className="trafico-landings">
                            <thead>
                                <tr>
                                    <th scope="col">Landing</th>
                                    <th scope="col">Visitas</th>
                                    <th scope="col">Clics al grupo</th>
                                    <th scope="col">Tasa</th>
                                    <th scope="col">Fuente principal</th>
                                    <th scope="col">Última visita</th>
                                </tr>
                            </thead>
                            <tbody>
                                {landings.map((l) => {
                                    const share = t.visitas ? (l.visitas / t.visitas) * 100 : 0;
                                    return (
                                        <tr key={l.path}>
                                            <th scope="row">
                                                <strong>{l.path}</strong>
                                                <span className="trafico-chips">
                                                    {l.lleva_whatsapp && <span className="status success">Grupo de WhatsApp</span>}
                                                    {l.origen_datos === 'sesiones' && <span className="status">Sesiones de la grabación</span>}
                                                </span>
                                            </th>
                                            <td data-workshop="Visitas">
                                                <span className="trafico-visitas">
                                                    {fmtNum(l.visitas)}
                                                    <span className="trafico-share" aria-label={`${share.toFixed(1)}% del total`}>
                                                        <i style={{ width: `${Math.max(share, 1.5)}%` }} />
                                                    </span>
                                                    <small className="trafico-share-pct">{share.toFixed(1)}% del total</small>
                                                </span>
                                            </td>
                                            <td data-workshop="Clics al grupo">{l.lleva_whatsapp && medido ? fmtNum(l.clics_whatsapp) : '—'}</td>
                                            <td data-workshop="Tasa">{fmtPct(l.tasa_whatsapp)}</td>
                                            <td data-workshop="Fuente principal">{l.fuente_principal || '—'}</td>
                                            <td data-workshop="Última visita">{fmtFechaHora(l.ultima_visita)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="trafico-pareja">
                <TablaAgrupada
                    titulo="Por fuente"
                    icono={Globe}
                    filas={data?.por_fuente || []}
                    campo="fuente"
                    etiqueta="Fuente"
                    medido={medido}
                    ayudaCampo="El utm_source del link del anuncio. ig e instagram, fb y facebook se suman juntos."
                />
                <TablaAgrupada
                    titulo="Por campaña"
                    icono={Megaphone}
                    filas={data?.por_campana || []}
                    campo="campana"
                    etiqueta="Campaña"
                    medido={medido}
                    ayudaCampo="El utm_campaign del anuncio. Meta manda el ID de la campaña: se busca tal cual en el Administrador de anuncios. Las 12 con más visitas."
                />
            </section>
        </>
    );
};

export default WorkshopTraficoView;
