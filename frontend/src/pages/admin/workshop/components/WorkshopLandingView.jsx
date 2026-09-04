import React, { useState, useEffect, useCallback } from 'react';
import {
    Loader2, Users, PlayCircle, Timer, Target, RefreshCw,
    MonitorSmartphone, Video, MousePointerClick, Radio
} from 'lucide-react';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

/*
 * Panel de la landing de la GRABACIÓN (/replay/).
 *
 * Ojo con no confundir los dos embudos que viven en esta pestaña:
 *   · Workshop en vivo  -> la clase en vivo, fuente 'workshop'
 *   · Workshop landing  -> esta grabación, fuente 'workshop landing'
 * Hasta ahora las agendas de los dos caían en la misma bolsa porque la fuente
 * se detectaba con un substring de 'workshop'.
 */

const fmtDuracion = (segundos) => {
    const s = Math.max(0, Math.round(segundos || 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return `${m}m ${String(r).padStart(2, '0')}s`;
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

const fmtFecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ETAPAS = {
    entro: { texto: 'Entró', tone: '' },
    abrio_gate: { texto: 'Abrió el registro', tone: 'warning' },
    completo_gate: { texto: 'Se registró', tone: 'success' },
    dio_play: { texto: 'Dio play', tone: 'success' },
    vio_oferta: { texto: 'Llegó a la oferta', tone: 'success' },
    clic_agenda: { texto: 'Clic en Calendly', tone: 'success' },
};

const Chip = ({ etapa }) => {
    const e = ETAPAS[etapa] || ETAPAS.entro;
    return <span className={`status ${e.tone}`}>{e.texto}</span>;
};

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

/* Barra del embudo. El ancho es relativo a las VISITAS, no al paso anterior:
   así se ve de un vistazo dónde se cae la gente respecto del total. */
const PasoEmbudo = ({ idx, label, ayuda, valor, base, pctPaso }) => {
    const share = base > 0 ? (valor / base) * 100 : 0;
    const width = base > 0 ? 14 + 86 * Math.sqrt(Math.max(0, valor) / base) : 14;
    return (
        <React.Fragment>
            {idx > 0 && pctPaso !== null && (
                <div className="rate-pill green">
                    <strong>{pctPaso}%</strong>
                    <span>{label}</span>
                    <small>retención del paso anterior</small>
                </div>
            )}
            <div className="funnel-stage">
                <span className="stage-index">{idx + 1}</span>
                <div>
                    <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {label}
                        {ayuda && <InfoTooltip label={label} text={ayuda} />}
                    </strong>
                </div>
                <div className="stage-bar" role="img" aria-label={`${label}: ${valor}, ${share.toFixed(1)}% del total`}>
                    <i style={{ width: `${width}%` }}><b>{valor.toLocaleString()}</b></i>
                </div>
                <span className="stage-share">{share.toFixed(1)}%<small>del total</small></span>
            </div>
        </React.Fragment>
    );
};

const WorkshopLandingView = () => {
    const [stats, setStats] = useState(null);
    const [sesiones, setSesiones] = useState([]);
    const [agendas, setAgendas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('todas');   // 'todas' | 'dio_play' | 'sin_registro'
    const [dias, setDias] = useState(30);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const hasta = new Date();
            const desde = new Date(hasta.getTime() - dias * 86400000);
            const rango = `desde=${desde.toISOString().slice(0, 10)}&hasta=${hasta.toISOString().slice(0, 10)}`;
            const etapa = filtro === 'todas' ? '' : `&etapa=${filtro}`;

            const [rStats, rSes, rAg] = await Promise.all([
                api.get(`/workshop/landing/stats?${rango}`),
                api.get(`/workshop/landing/sesiones?${rango}${etapa}`),
                api.get(`/workshop/landing/agendas?${rango}`),
            ]);
            setStats(rStats.data);
            setSesiones(rSes.data || []);
            setAgendas(rAg.data);
        } catch (e) {
            console.error('[landing] Error al cargar', e);
            toast.error('No se pudieron cargar las métricas de la landing');
        } finally {
            setLoading(false);
        }
    }, [dias, filtro]);

    useEffect(() => { cargar(); }, [cargar]);

    if (loading && !stats) {
        return (
            <section className="empty-state loading-state" role="status">
                <div><span /></div>
                <p className="eyebrow">Sincronizando</p>
                <h2>Cargando métricas de la grabación…</h2>
            </section>
        );
    }

    const e = stats?.embudo || {};
    const c = stats?.conversion || {};
    const p = stats?.permanencia || {};
    const visitas = e.visitas || 0;

    const pasos = [
        { label: 'Entraron', ayuda: 'Todas las visitas a la página. Es la base contra la que se dibujan las barras.', valor: visitas, pctPaso: null },
        { label: 'Abrieron el registro', ayuda: 'Abrieron el formulario de la página (no es Calendly: es el formulario que destraba el video).', valor: e.abrio_gate || 0, pctPaso: c.visita_a_gate },
        { label: 'Se registraron', ayuda: 'Completaron ese formulario. Ojo: el formulario no pide dato de contacto, así que sirve para medir, no para escribirle a nadie.', valor: e.completo_gate || 0, pctPaso: c.gate_a_registro },
        { label: 'Dieron play', ayuda: 'Arrancaron el video de la grabación.', valor: e.dio_play || 0, pctPaso: c.registro_a_play },
        { label: 'Llegaron a la oferta (en pantalla)', ayuda: 'Siguieron en la página hasta el momento del video donde aparece la oferta.', valor: e.vio_oferta || 0, pctPaso: c.play_a_oferta },
        { label: 'Clic en Calendly', ayuda: 'Hicieron clic en el botón para agendar la llamada. Es el paso que después se convierte en agenda.', valor: e.clic_agenda || 0, pctPaso: c.oferta_a_agenda },
    ];

    return (
        <>
            {/* Controles */}
            <div className="hero-actions" style={{ marginBottom: 22 }}>
                <div className="pill-toggle">
                    {[7, 30, 90].map((d) => (
                        <button type="button" key={d} className={dias === d ? 'active' : ''} onClick={() => setDias(d)}>{d} días</button>
                    ))}
                </div>
                <button type="button" className="secondary-action" onClick={cargar}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
                {stats?.rango && <span className="secondary-copy">{stats.rango.desde} → {stats.rango.hasta}</span>}
            </div>

            {/* KPIs */}
            <section className="kpi-grid" aria-label="Indicadores de la landing">
                <Kpi label="Visitas" ayuda="Cuánta gente distinta abrió la página de la grabación, se haya registrado o no." value={visitas} sub="Sesiones únicas" icon={MonitorSmartphone} />
                <Kpi label="Registrados" ayuda="De esas visitas, cuántas completaron el formulario para poder ver la clase." value={e.completo_gate || 0} sub={`${c.visita_a_registro || 0}% de las visitas`} icon={Users} />
                <Kpi label="Dieron play" ayuda="Cuántos le dieron play al video. Si hay muchos registrados y pocos plays, el problema está en la página, no en el anuncio." value={e.dio_play || 0} sub={`${c.registro_a_play || 0}% de los registrados`} icon={PlayCircle} />
                <Kpi label="Permanencia media" ayuda="Cuánto tiempo se queda la persona típica en la página (mediana: la mitad se queda menos y la mitad más). El promedio se distorsiona con quien deja la pestaña abierta." value={fmtDuracion(p.mediana_segundos)} sub={`Promedio ${fmtDuracion(p.promedio_segundos)}`} icon={Timer} />
            </section>

            <section className="detail-grid">
                {/* Embudo */}
                <article className="panel funnel-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Landing de la grabación</p>
                            <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Target size={18} /> Embudo de la grabación</h2>
                        </div>
                    </div>
                    <div className="funnel-list">
                        {pasos.map((paso, idx) => <PasoEmbudo key={paso.label} idx={idx} base={visitas} {...paso} />)}
                    </div>
                    <p className="secondary-copy" style={{ marginTop: 12, fontSize: 10 }}>
                        El porcentaje es respecto del paso anterior. La barra, respecto del total de visitas.
                    </p>

                    {/* Qué mide cada paso. Sin esto "abrió el registro" y "llegó a
                        la oferta" se prestan a confundirse con Calendly. */}
                    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                        <p className="eyebrow">De dónde sale cada dato</p>
                        <dl style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {[
                                ['Entraron', 'Cargaron /replay/. Una fila por visita.'],
                                ['Abrieron el registro', 'Tocaron un botón de "Ver la clase" y se les abrió el formulario de 4 pasos (nombre, profesión, etapa, examen). NO es Calendly.'],
                                ['Se registraron', 'Completaron esos 4 pasos. Acá es donde aparecen en la lista de abajo con nombre.'],
                                ['Dieron play', 'Tocaron el póster y se montó el reproductor de Loom.'],
                                ['Llegaron a la oferta', 'El bloque de la Sesión de Aceleración entró de verdad en su pantalla, al menos un cuarto. No alcanza con que se haya desbloqueado.'],
                                ['Clic en Calendly', 'Tocaron el botón de agendar. Recién acá aparece el formulario de Calendly, que es otro y vive fuera de la landing.'],
                            ].map(([t, d]) => (
                                <div key={t} style={{ display: 'flex', gap: 8, fontSize: 10, lineHeight: 1.5 }}>
                                    <dt style={{ fontWeight: 900, color: '#fff', flex: '0 0 auto' }}>{t}:</dt>
                                    <dd style={{ margin: 0, color: 'var(--text-muted)' }}>{d}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="secondary-copy" style={{ marginTop: 10, fontSize: 10 }}>
                            El embudo mide <strong style={{ color: '#fff' }}>cada visita por separado</strong>. Quien ya se
                            registró antes y vuelve entra directo a la clase: va a figurar como "entró → dio play" sin los pasos
                            de registro, porque en esa visita no los hizo.
                        </p>
                    </div>
                </article>

                <aside className="detail-sidebar">
                    {/* Fuente: vivo vs grabación */}
                    <article className="panel" style={{ padding: 22 }}>
                        <p className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Radio size={14} /> Agendas por fuente</p>
                        <div className="source-grid" style={{ marginTop: 14 }}>
                            <article>
                                <div className="source-title"><span>Workshop en vivo</span></div>
                                <strong style={{ display: 'block', fontSize: 26, fontVariantNumeric: 'tabular-nums' }}>{agendas?.workshop_vivo?.total ?? 0}</strong>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{agendas?.workshop_vivo?.con_closer ?? 0} con closer</span>
                            </article>
                            <article>
                                <div className="source-title"><span>Workshop landing</span></div>
                                <strong style={{ display: 'block', fontSize: 26, fontVariantNumeric: 'tabular-nums', color: 'var(--pink)' }}>{agendas?.workshop_landing?.total ?? 0}</strong>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{agendas?.workshop_landing?.con_closer ?? 0} con closer</span>
                            </article>
                        </div>
                        <p className="secondary-copy" style={{ marginTop: 14, fontSize: 10 }}>
                            Antes las dos caían juntas: la fuente se detectaba buscando "workshop" dentro del texto,
                            así que "workshop landing" también entraba en el vivo.
                        </p>
                    </article>

                    <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <Kpi label="Video visto" value={fmtDuracion(p.promedio_video_segundos)} sub="Prom. de quienes dieron play" icon={Video} />
                        <Kpi label="Clic Calendly" value={e.clic_agenda || 0} sub={`${c.oferta_a_agenda || 0}% vieron oferta`} icon={MousePointerClick} />
                    </div>

                    {(stats?.por_examen?.length > 0) && (
                        <article className="panel" style={{ padding: 22 }}>
                            <p className="eyebrow">Registrados por examen</p>
                            <div className="rating-chips" style={{ marginTop: 10 }}>
                                {stats.por_examen.map((x) => (
                                    <span key={x.examen}>{x.examen} · {x.total}</span>
                                ))}
                            </div>
                        </article>
                    )}
                </aside>
            </section>

            {/* Listado */}
            <section className="panel comparison-panel" style={{ marginTop: 22 }}>
                <div className="section-heading">
                    <div><p className="eyebrow">Sesiones</p><h2>Personas que entraron ({sesiones.length})</h2></div>
                    <div className="pill-toggle">
                        {[
                            { k: 'todas', t: 'Todas' },
                            { k: 'dio_play', t: 'Dieron play' },
                            { k: 'sin_registro', t: 'Sin registrarse' },
                        ].map((o) => (
                            <button type="button" key={o.k} className={filtro === o.k ? 'active' : ''} onClick={() => setFiltro(o.k)}>{o.t}</button>
                        ))}
                    </div>
                </div>

                {sesiones.length === 0 ? (
                    <p className="all-target" style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Users size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: .5 }} />
                        Todavía no hay visitas en este rango.
                    </p>
                ) : (
                    <div className="comparison-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th scope="col" style={{ textAlign: 'left' }}>Persona</th>
                                    <th scope="col" style={{ textAlign: 'left' }}>Examen</th>
                                    <th scope="col" style={{ textAlign: 'left' }}>Etapa</th>
                                    <th scope="col">Permanencia</th>
                                    <th scope="col">Video</th>
                                    <th scope="col" style={{ textAlign: 'left' }}>Origen</th>
                                    <th scope="col" style={{ textAlign: 'left' }}>Entró</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sesiones.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ textAlign: 'left' }}>
                                            {s.lead ? <strong style={{ color: '#fff' }}>{s.lead.full_name}</strong> : <em style={{ color: 'var(--text-muted)' }}>Sin registrarse</em>}
                                        </td>
                                        <td style={{ textAlign: 'left' }}>{s.lead?.examen || '—'}</td>
                                        <td style={{ textAlign: 'left' }}><Chip etapa={s.etapa} /></td>
                                        <td>{fmtDuracion(s.segundos_visible)}</td>
                                        <td>{s.dio_play ? fmtDuracion(s.segundos_video) : '—'}</td>
                                        <td style={{ textAlign: 'left' }}>
                                            {s.utm_source || 'directo'}{s.dispositivo === 'movil' && ' · móvil'}
                                        </td>
                                        <td style={{ textAlign: 'left' }}>{fmtFecha(s.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
};

export default WorkshopLandingView;
