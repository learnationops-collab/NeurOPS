import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Moon, PenLine } from 'lucide-react';
import api from '../../../services/api';
import ConversationalStatsTab from '../../public/ConversationalStatsTab';
import IncomingLeadsTab from '../../public/IncomingLeadsTab';
import Resumen from './Resumen';
import { Numero } from './Piezas';
import { aFecha, aIso, desdeLectura, fmtInt, fmtPct, hoyIso, tasa } from './modelo';
import './reporteDiario.css';

/**
 * El Historial del setter: sus reportes por día, con los números que importan, en el estilo del
 * formulario nuevo. Reemplaza a "Mis reportes" (`PublicSetterStatsPage` embebido).
 *
 * Arriba, el período y sus totales; al lado de las agendas reportadas, la píldora "N generadas"
 * del sistema (las de "Mis datos" en el mismo rango), como tenía "Mis reportes": lo que el setter
 * tipeó contra lo que pasó. Abajo, un día por fila: entrantes (con su reparto por canal),
 * cualificación, agendas por canal y la respuesta a las bienvenidas. Abrir un día muestra su
 * Resumen; "Editar" lo lleva al formulario en esa fecha.
 *
 * Un reporte del formulario anterior (v1) se muestra con lo que tiene: totales, sin canales ni
 * bienvenidas.
 *
 * "Mis reportes" traía además el rendimiento conversacional (con el gestor de sus mensajes) y los
 * leads entrantes: siguen acá, como otras dos vistas. Son pantallas del panel viejo (Tailwind), así
 * que se dibujan FUERA de la isla `.dc-shell`, cuyo reset de botones les borraría los estilos.
 */

const VISTAS = [
    { key: 'reportes', label: 'Reportes' },
    { key: 'conversacional', label: 'Conversacional' },
    { key: 'leads', label: 'Leads' },
];

const PERIODOS = [
    { key: '30', label: '30 días' },
    { key: 'mes', label: 'Este mes' },
    { key: 'anterior', label: 'Mes anterior' },
    { key: 'todo', label: 'Todo' },
];

export const rangoDe = (periodo, hoy = hoyIso()) => {
    const d = aFecha(hoy);
    if (periodo === 'mes') return [aIso(new Date(d.getFullYear(), d.getMonth(), 1)), hoy];
    if (periodo === 'anterior') {
        return [aIso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), aIso(new Date(d.getFullYear(), d.getMonth(), 0))];
    }
    if (periodo === 'todo') return [null, null];
    const desde = new Date(d);
    desde.setDate(d.getDate() - 29);
    return [aIso(desde), hoy];
};

/** Los números de una fila del listado, sea v1 o v2. */
export const numerosDe = (r) => {
    const v2 = r.version === 2 && r.v2;
    const t = v2 ? r.v2.totales : null;
    const entrantes = v2 ? t.entrantes : (r.entrantes || 0);
    const cualificados = v2 ? t.cualificados : (r.leads || 0);
    return {
        v2: Boolean(v2),
        entrantes,
        cualificados,
        cualificacion: tasa(cualificados, entrantes),
        agendas: v2 ? t.agendas : (r.fun_agenda || 0),
        ads: v2 ? r.v2.canales.anuncios : null,
        inb: v2 ? r.v2.canales.inbound : null,
        bienvenidas: v2 ? tasa(r.v2.bienvenidas.respondidas, r.v2.bienvenidas.hechas) : null,
        apertura: tasa(v2 ? t.aperturas : (r.qualification_opening_submitted || 0) + (r.pain_opening_submitted || 0), entrantes),
    };
};

const diaLargo = (iso) => {
    const d = aFecha(iso);
    const dia = d.toLocaleDateString('es', { weekday: 'short' }).replace('.', '');
    return { dia: dia[0].toUpperCase() + dia.slice(1), fecha: d.toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '') };
};

const Reparto = ({ a, b }) => {
    const total = a + b;
    return (
        <span className="rd-split rd-split--fila" aria-hidden="true">
            <i className="a" style={{ width: `${total ? (a / total) * 100 : 0}%` }} />
            <i className="b" style={{ width: `${total ? (b / total) * 100 : 0}%` }} />
        </span>
    );
};

/** El Resumen de un v1: solo lo que tiene, sin canales. */
const ResumenV1 = ({ r }) => {
    const n = numerosDe(r);
    return (
        <div className="rd-kpis rd-vidrio rd-kpis--4">
            <div className="rd-kpi"><span className="rd-k">Entrantes</span><b>{fmtInt(n.entrantes)}</b></div>
            <div className="rd-kpi"><span className="rd-k">Cualificación</span><b>{fmtPct(n.cualificacion)}</b></div>
            <div className="rd-kpi"><span className="rd-k">Apertura</span><b>{fmtPct(n.apertura)}</b></div>
            <div className="rd-kpi"><span className="rd-k">Agendas</span><b>{fmtInt(n.agendas)}</b></div>
            <p className="rd-kpis-pie rd-nota-v1">Reportado con el formulario anterior: sin canales ni bienvenidas.</p>
        </div>
    );
};

const Historial = ({ setterId }) => {
    const [, setParams] = useSearchParams();
    const [vista, setVista] = useState('reportes');
    const [periodo, setPeriodo] = useState('30');
    const [reportes, setReportes] = useState(null);
    const [generadas, setGeneradas] = useState(null);
    const [error, setError] = useState(false);
    const [abierto, setAbierto] = useState(null);

    useEffect(() => {
        if (!setterId) return undefined;
        let vivo = true;
        const [desde, hasta] = rangoDe(periodo);
        const rango = { ...(desde ? { start_date: desde } : {}), ...(hasta ? { end_date: hasta } : {}) };
        setReportes(null);
        setError(false);
        setAbierto(null);
        api.get('/public/setter-reports', { params: { setter_id: setterId, per_page: 400, ...rango } })
            .then(res => { if (vivo) setReportes(res.data?.reports || []); })
            .catch(() => { if (vivo) { setReportes([]); setError(true); } });
        // Las generadas del sistema solo tienen sentido con un rango.
        setGeneradas(null);
        if (desde && hasta) {
            api.get('/public/setter-stats', { params: { setter_id: setterId, start_date: desde, end_date: hasta, agg_type: 'sum' } })
                .then(res => { if (vivo) setGeneradas(res.data?.generadas ?? null); })
                .catch(() => { /* sin la píldora */ });
        }
        return () => { vivo = false; };
    }, [setterId, periodo]);

    const totales = useMemo(() => {
        const laborables = (reportes || []).filter(r => !r.is_non_working_day);
        const n = laborables.map(numerosDe);
        const entrantes = n.reduce((a, x) => a + x.entrantes, 0);
        const cualificados = n.reduce((a, x) => a + x.cualificados, 0);
        return {
            reportes: (reportes || []).length,
            libres: (reportes || []).length - laborables.length,
            entrantes,
            cualificacion: tasa(cualificados, entrantes),
            agendas: n.reduce((a, x) => a + x.agendas, 0),
        };
    }, [reportes]);

    const editar = (fecha) => {
        setParams(prev => {
            const siguiente = new URLSearchParams(prev);
            siguiente.set('tab', 'hoy');
            if (fecha === hoyIso()) siguiente.delete('fecha');
            else siguiente.set('fecha', fecha);
            return siguiente;
        });
        window.scrollTo?.({ top: 0 });
    };

    return (
        <>
        <div className="dc-shell dc-shell--embebido rd rd-historial">
            <div className="rd-barra">
                <div className="rd-pasos rd-periodos" role="tablist" aria-label="Vistas del historial">
                    {VISTAS.map(v => (
                        <button key={v.key} type="button" role="tab" aria-selected={vista === v.key}
                            className="rd-pz rd-pz--periodo" onClick={() => setVista(v.key)}>{v.label}</button>
                    ))}
                </div>
                {vista === 'reportes' && (
                    <div className="rd-pasos rd-periodos" role="tablist" aria-label="Período del historial">
                        {PERIODOS.map(p => (
                            <button key={p.key} type="button" role="tab" aria-selected={periodo === p.key}
                                className="rd-pz rd-pz--periodo" onClick={() => setPeriodo(p.key)}>{p.label}</button>
                        ))}
                    </div>
                )}
            </div>
            {vista === 'reportes' && (<>

            <div className="rd-kpis rd-vidrio rd-kpis--4" aria-live="polite">
                <div className="rd-kpi">
                    <span className="rd-k">Reportes</span>
                    <Numero valor={reportes ? totales.reportes : null} />
                    {totales.libres > 0 && <span className="rd-kpi-sub">{totales.libres} no laborable{totales.libres === 1 ? '' : 's'}</span>}
                </div>
                <div className="rd-kpi"><span className="rd-k">Entrantes</span><Numero valor={reportes ? totales.entrantes : null} /></div>
                <div className="rd-kpi"><span className="rd-k">Cualificación</span><Numero valor={totales.cualificacion} tipo="pct" /></div>
                <div className="rd-kpi">
                    <span className="rd-k">Agendas reportadas</span>
                    <Numero valor={reportes ? totales.agendas : null} />
                    {generadas !== null && (
                        <span className="rd-chip" style={{ '--c': 'var(--success)' }} title="Agendas generadas en Mis datos, mismo período">
                            <b>{fmtInt(generadas)}</b> {generadas === 1 ? 'generada' : 'generadas'}
                        </span>
                    )}
                </div>
            </div>

            {reportes === null ? (
                <div className="rd-lista rd-vidrio"><p className="rd-vacio">Cargando tus reportes…</p></div>
            ) : reportes.length === 0 ? (
                <div className="rd-lista rd-vidrio">
                    <p className="rd-vacio">{error ? 'No se pudieron traer tus reportes. Probá de nuevo.' : 'No mandaste reportes en este período.'}</p>
                </div>
            ) : (
                <ul className="rd-lista rd-vidrio" aria-label="Tus reportes por día">
                    <li className="rd-fila rd-fila--cab" aria-hidden="true">
                        <span>Día</span><span>Entrantes</span><span>Cualificación</span><span>Agendas</span><span>Bienvenidas</span><span />
                    </li>
                    {reportes.map((r, i) => {
                        const n = numerosDe(r);
                        const { dia, fecha } = diaLargo(r.date);
                        const abiertoAca = abierto === r.id;
                        return (
                            <li key={r.id} className={`rd-dia-rep${abiertoAca ? ' abierto' : ''}`} style={{ '--i': i }}>
                                <div className="rd-fila">
                                    <button type="button" className="rd-fila-dia" aria-expanded={abiertoAca}
                                        aria-label={`${dia} ${fecha}: ${abiertoAca ? 'cerrar' : 'ver'} el resumen`}
                                        onClick={() => setAbierto(abiertoAca ? null : r.id)}>
                                        <ChevronDown strokeWidth={1.75} aria-hidden="true" />
                                        <span className="rd-fila-fecha"><b>{dia}</b> {fecha}</span>
                                        {r.is_non_working_day && (
                                            <span className="rd-chip" style={{ '--c': 'var(--info)' }}><Moon strokeWidth={1.75} aria-hidden="true" /><span>No laborable</span></span>
                                        )}
                                        {!r.is_non_working_day && !n.v2 && (
                                            <span className="rd-chip" style={{ '--c': 'var(--text-muted)' }}><span>Anterior</span></span>
                                        )}
                                    </button>
                                    <span className="rd-celda" data-rotulo="Entrantes">
                                        <b>{fmtInt(n.entrantes)}</b>
                                        {n.v2 && <Reparto a={n.ads.entrantes} b={n.inb.entrantes} />}
                                    </span>
                                    <span className="rd-celda" data-rotulo="Cualificación"><b>{fmtPct(n.cualificacion)}</b></span>
                                    <span className="rd-celda" data-rotulo="Agendas">
                                        <b>{fmtInt(n.agendas)}</b>
                                        {n.v2 && (
                                            <small className="rd-canales-mini">
                                                <i style={{ '--c': 'var(--ch-ads)' }} />{n.ads.agendas}
                                                <i style={{ '--c': 'var(--ch-inb)' }} />{n.inb.agendas}
                                            </small>
                                        )}
                                    </span>
                                    <span className="rd-celda" data-rotulo="Bienvenidas"><b>{fmtPct(n.bienvenidas)}</b></span>
                                    <span className="rd-celda rd-celda--acciones">
                                        <button type="button" className="rd-btn rd-btn--plain rd-btn--sm" onClick={() => editar(r.date)}
                                            aria-label={`Editar el reporte del ${dia} ${fecha}`}>
                                            <PenLine strokeWidth={1.75} aria-hidden="true" />Editar
                                        </button>
                                    </span>
                                </div>
                                {abiertoAca && (
                                    <div className="rd-fila-resumen">
                                        {n.v2 ? <Resumen estado={desdeLectura(r.v2)} /> : <ResumenV1 r={r} />}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            </>)}
        </div>
        {vista === 'conversacional' && <div className="text-slate-200"><ConversationalStatsTab /></div>}
        {vista === 'leads' && <div className="text-slate-200"><IncomingLeadsTab /></div>}
        </>
    );
};

export default Historial;
