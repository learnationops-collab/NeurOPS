// Historial: KPIs del período, barras por día, constancia y el día por día (con «Editar este día»).
import { useState } from 'react';
import clsx from 'clsx';
import { Chip, Segmented, Skeleton, SkeletonKpi, SkeletonPanel } from '../../components/standard';
import useHistorial from './useHistorial';
import Exp from './Exp';
import { AnimCtx, useListo } from './animar';
import { Kpi, MetaBar } from './piezas';
import { CLASE_ESTADO, COLOR_ESTADO, TEXTO_ESTADO, nomDia, plano } from './formato';

const PERIODOS = [{ value: '7', label: '7 días' }, { value: 'mes', label: 'Este mes' }, { value: '30', label: '30 días' }];
const NOMBRE_PERIODO = { 7: '7 días', mes: 'este mes', 30: '30 días' };

function Barras({ barras, hoy }) {
    const dias = [...(barras.dias || [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const max = Math.max(1, ...dias.map((d) => d.v || 0));
    const lleno = useListo();
    return (
        <div className="rp-caja">
            <h4>{barras.l} por día</h4>
            <div className="rp-barras">
                {dias.map((d, k) => {
                    const libre = d.estado === 'no_laborable';
                    const h = libre || !d.v ? 3 : Math.max(3, d.v / max * 100);
                    const t = `${nomDia(d.fecha)}: ${libre ? 'no laborable' : plano(d.v, barras.f)}`;
                    return (
                        <Exp key={d.fecha} className={clsx(libre && 'vacio')} data-t={t} title={t}
                            dato={libre ? null : { clave: barras.clave, l: barras.l, v: d.v, f: barras.f, fecha: d.fecha, ctx: `Historial · ${d.fecha === hoy ? 'hoy' : nomDia(d.fecha)}` }}>
                            <i style={{ height: lleno ? `${h.toFixed(0)}%` : 0, transitionDelay: `${200 + k * (600 / (dias.length || 1))}ms` }} />
                        </Exp>
                    );
                })}
            </div>
            {dias.length > 0 && <div className="rp-ejes"><span>{nomDia(dias[0].fecha)}</span><span>{nomDia(dias[dias.length - 1].fecha)}</span></div>}
        </div>
    );
}

function Constancia({ dias }) {
    const crono = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return (
        <div className="rp-caja">
            <h4>Constancia</h4>
            <div className="rp-consta">
                {crono.map((d, k) => <i key={d.fecha} className={CLASE_ESTADO[d.estado] || ''} title={`${nomDia(d.fecha)} · ${TEXTO_ESTADO[d.estado] || ''}`} style={{ animationDelay: `${k * 25}ms` }} />)}
            </div>
            <div className="rp-leyenda">
                <span style={{ '--c': 'var(--rp-ok)' }}>Completo</span><span style={{ '--c': 'var(--rp-mal)' }}>Incompleto</span>
                <span style={{ '--c': 'var(--rp-warn)' }}>En curso</span><span style={{ '--c': 'var(--ln-border-subtle)' }}>No laborable</span>
            </div>
        </div>
    );
}

function Dia({ d, k, hoy, onEditar }) {
    const libre = d.estado === 'no_laborable';
    const primero = d.numeros?.[0];
    return (
        <details className="rp-dia" style={{ animationDelay: `${Math.min(k, 12) * 40}ms` }}>
            <summary>
                <b>{nomDia(d.fecha)}</b>
                <Chip subtle color={COLOR_ESTADO[d.estado]}>{TEXTO_ESTADO[d.estado] || d.estado}</Chip>
                <span className="txt">{libre ? '' : d.victoria || '—'}</span>
                <span className="num">{libre || !primero ? '' : plano(primero.v, primero.f)}</span>
            </summary>
            <div className="rp-dia__cuerpo">
                {libre ? <p>No laborable.</p> : (
                    <>
                        {d.estado === 'incompleto' && !d.victoria && !d.manana
                            ? <p className="rp-mal">Se cerró a las 10:00 del día siguiente sin la victoria ni el «mañana». Los números quedaron guardados.</p>
                            : <><p><b>Victoria</b> · {d.victoria || '—'}</p><p><b>Mañana</b> · {d.manana || '—'}</p></>}
                        {d.numeros?.length > 0 && (
                            <p>{d.numeros.map((n, i) => <span key={n.l}>{i > 0 && ' · '}<b>{plano(n.v, n.f)}</b> {String(n.l).toLowerCase()}</span>)}</p>
                        )}
                    </>
                )}
                <p><button type="button" className="rp-otra" onClick={() => onEditar(d.fecha)}>{d.fecha === hoy ? 'Ir a hoy' : 'Editar este día'}</button></p>
            </div>
        </details>
    );
}

const Esqueleto = () => (
    <Skeleton label="Cargando el historial…" className="rp-col">
        <div className="rp-hero">{[0, 1, 2, 3].map((i) => <SkeletonKpi key={i} className="rp-k rp-k--skel" step={i} />)}</div>
        <SkeletonPanel className="rp-card ui-panel" rows={6} rowHeight={40} />
    </Skeleton>
);

export default function Historial({ userId, hoy, onEditar }) {
    const [periodo, setPeriodo] = useState('7');
    const { datos, cargando, error } = useHistorial({ userId, periodo });
    const listo = useListo(!!datos);
    if (!datos) return error ? <p className="rp-sub">{error}</p> : <Esqueleto />;
    const ctx = `Historial · ${NOMBRE_PERIODO[periodo]}`;
    const dias = datos.dias || [];
    const consta = datos.barras?.dias?.length ? datos.barras.dias : dias;
    return (
        <AnimCtx.Provider value={listo}>
            <div className={clsx('rp-col', cargando && 'rp-cargando')}>
                <section className="rp-card ui-panel">
                    <div className="rp-hi-top">
                        <h3>Tu historial</h3>
                        <Segmented size="sm" value={periodo} options={PERIODOS} onChange={setPeriodo} label="Período" />
                    </div>
                    <div className="rp-hero">
                        {(datos.kpis || []).map((k, i) => {
                            const dato = { ...k, l: k.modo === 'avg' ? `${k.l} (promedio)` : k.l, prom: k.prev, spark: k.serie, ctx, periodo, fecha: hoy };
                            return (
                                <Kpi key={k.clave || k.l} k={i} dato={dato} fecha={hoy} txtDelta="vs. período anterior"
                                    sufijo={k.de != null ? <small> / {k.de}</small> : null}>
                                    {k.de != null ? <MetaBar v={k.v} meta={k.de || 1} txt={`de ${k.de} días laborables ya cerrados`} /> : null}
                                </Kpi>
                            );
                        })}
                    </div>
                    <div className="rp-bajo">
                        {datos.barras && <Barras barras={datos.barras} hoy={hoy} />}
                        {consta.length > 0 && <Constancia dias={consta} />}
                    </div>
                </section>
                <section className="rp-card ui-panel">
                    <div className="rp-card__cab"><h3>Día por día</h3><small>Tocá un día para ver el cierre completo</small></div>
                    <div className="rp-dias">
                        {dias.map((d, k) => <Dia key={d.fecha} d={d} k={k} hoy={hoy} onEditar={onEditar} />)}
                        {dias.length === 0 && <p className="rp-sub">Todavía no hay días en este período.</p>}
                    </div>
                </section>
            </div>
        </AnimCtx.Provider>
    );
}
