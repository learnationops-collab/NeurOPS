// Los paneles del Triage Dashboard (diseño de Claude Design, 30/10/2026): tarjetas, estados, embudo, low ticket,
// abandonos. Cada cifra que abre una lista llama a `onVer(<clave de triageFiltros>)`.

import { Fragment } from 'react';

import { CifraConCuenta } from '../../../../components/standard';
import { COLOR_DE_ESTADO, calificacionDe, cierreLowTicket, conResultado, destinosDe, embudoDe, fueraDe, motivosDe, pct, pctTexto } from './triageDatos';
import './triageTarjetas.css';

export const TARJETA = {
    position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 20, padding: 28,
    borderRadius: 32, background: 'var(--bg-element)', border: '1px solid var(--border-main)',
};
export const ROTULO = { fontSize: 11, fontWeight: 700, letterSpacing: '.24em', color: 'var(--text-muted)', textTransform: 'uppercase' };
const CAJA = { background: 'rgba(2,6,23,.35)', border: '1px solid var(--border-subtle)' };
const resplandor = (color, posicion, medidas = '260px 180px', pc = 22) => ({
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: `radial-gradient(${medidas} at ${posicion}, color-mix(in oklab, var(--${color}) ${pc}%, transparent), transparent 70%)`,
});
export const dinero = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;
const boton = { background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'inherit', cursor: 'pointer' };

export const Titulo = ({ texto, lado, children }) => (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>{texto}</span>
        {lado && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lado}</span>}
        {children}
    </div>
);

/** Una cifra con su cuenta («8 de 10») en el tooltip; cada parte abre la lista que la suma. Sin denominador, queda quieta. */
export function Porcentaje({ a, b, onVer }) {
    if (!b.n) return <>—</>;
    return (
        <CifraConCuenta onVer={(clave) => onVer(clave)}
            cuenta={{ a: { t: `${a.n} ${a.texto}`, m: a.n ? a.clave : undefined, titulo: a.titulo }, b: { t: `${b.n} ${b.texto}`, m: b.clave, titulo: b.titulo } }}>
            {pctTexto(a.n, b.n)}
        </CifraConCuenta>
    );
}

/** Un texto que abre la lista de cobros del low ticket (Revisar › Ventas, «Área: Triage»); sin `onVer`, queda quieto. */
const Cobros = ({ children, onVer }) => (onVer
    ? <button type="button" onClick={onVer} style={{ ...boton, textDecoration: 'underline dotted' }}>{children}</button>
    : <>{children}</>);

/** Lo cobrado en low ticket y las ventas de llamadas anteriores, cada parte abre los cobros. */
const CobrosLowTicket = ({ c, onVer }) => (
    <><Cobros onVer={c.ventas ? onVer : null}>{dinero(c.cobrado)} cobrados</Cobros>
        {c.anteriores > 0 && <> · <Cobros onVer={onVer}>{c.anteriores} de {c.anteriores === 1 ? 'una llamada anterior' : 'llamadas anteriores'}</Cobros></>}</>
);

// Una línea de la tarjeta con partes que abren su lista: [[n, texto, clave], ...]. Con cero no hay nada que listar y queda quieta.
const Partes = ({ partes, onVer }) => (
    <>{partes.map(([n, texto, clave], i) => (
        <Fragment key={clave}>
            {i > 0 && ' · '}
            {n > 0
                ? <button type="button" onClick={() => onVer(clave)} style={{ ...boton, textDecoration: 'underline dotted' }}>{n} {texto}</button>
                : `${n} ${texto}`}
        </Fragment>
    ))}</>
);

/** Las tarjetas de arriba (triage y closing); «Ver registros ›» abre su lista. */
export function Tarjetas({ m, onVer, onVerCobros }) {
    const lt = cierreLowTicket(m);
    // El % de asistencia es sobre las agendas con destino, la misma base de closing (ADR-W145).
    const base = conResultado(m);
    const conRes = { n: base, texto: 'con destino', clave: 'base', titulo: 'Agendas con destino' };
    const fuera = fueraDe(m).filter(([n]) => n > 0);
    // Con el closer igual: las pendientes de llamada no restan al % de quienes ya tuvieron la llamada.
    const closerConRes = { n: m.closer_asistieron + m.closer_no_asistieron, texto: 'con resultado', clave: undefined, titulo: 'Con resultado' };
    const closerAsistieron = { n: m.closer_asistieron, texto: 'asistieron', clave: 'closer_asistieron', titulo: 'Asistieron al closer' };
    const tarjetas = [
        { rotulo: 'AGENDAS', valor: m.agendas, sub: `${m.agendas} ${m.agendas === 1 ? 'llamada' : 'llamadas'} en el período`, color: 'info', ver: 'agendas' },
        { rotulo: 'ASISTENCIA', valor: <Porcentaje onVer={onVer} a={{ n: m.asistencias, texto: 'asistieron', clave: 'asistencias', titulo: 'Asistieron' }} b={conRes} />,
            sub: <><Partes onVer={onVer} partes={[[m.asistencias, 'asistieron', 'asistencias']]} /> de <Partes onVer={onVer} partes={[[base, 'con destino', 'base']]} /></>,
            sub2: <Partes onVer={onVer} partes={[[m.no_show, 'no show', 'no_show'], [m.canceladas, 'canceló', 'canceladas'],
                ...[[m.reagendadas || 0, 'reprogramó', 'reagendadas'], [m.sin_reporte, 'sin reportar', 'sin_reporte']].filter(([n]) => n > 0)]} />,
            sub3: fuera.length ? <>No cuentan: <Partes onVer={onVer} partes={fuera} /></> : null,
            color: 'success', ver: 'asistencias' },
        { rotulo: 'CALIFICADOS', valor: pctTexto(m.calificados, m.asistencias), sub: `${m.calificados} pasados al closer · ${m.closer_asistieron} ya asistieron con él`, color: 'brand-secondary', ver: 'calificados' },
        // Por cobro (ADR-W189): la venta del low ticket es un cierre aunque la llamada sea de antes.
        { rotulo: 'CIERRES LOW TICKET', valor: pctTexto(lt.cierres, lt.base), sub: `${lt.cierres} de ${lt.base}`,
            sub2: <CobrosLowTicket c={lt} onVer={onVerCobros} />, color: lt.cierres ? 'success' : 'error', ver: 'cerrado' },
        { rotulo: 'ASISTENCIA AL CLOSER', valor: <Porcentaje onVer={onVer} a={closerAsistieron} b={closerConRes} />, ancha: true, barra: pct(m.closer_asistieron, closerConRes.n),
            sub: <Partes onVer={onVer} partes={[[m.closer_asistieron, 'asistieron', 'closer_asistieron'], [m.closer_no_asistieron, 'no asistieron', 'closer_no_asistieron']]} />,
            // La llamada que todavía no llega no es una falta: va aparte de la que ya pasó sin reporte.
            sub2: <>de {m.pasaron} que pasaron a closing{m.closer_pendientes > 0 && <> · <Partes onVer={onVer} partes={
                m.closer_sin_reporte == null ? [[m.closer_pendientes, 'pendientes de llamada', 'closer_pendientes']]
                    : [[m.closer_sin_reporte, 'sin reportar', 'closer_sin_reporte'], [m.closer_por_venir, 'por venir', 'closer_por_venir']].filter(([n]) => n > 0)} /></>}</>,
            color: 'info', ver: 'closer_asistieron' },
        { rotulo: 'CONVERSIÓN CON EL CLOSER', valor: <Porcentaje onVer={onVer} a={{ n: m.closer_cerraron, texto: 'cerraron', clave: 'closer_cerraron', titulo: 'Cerraron con el closer' }} b={closerAsistieron} />,
            ancha: true, barra: pct(m.closer_cerraron, m.closer_asistieron),
            sub: `${m.closer_cerraron} cierres de ${m.closer_asistieron} que asistieron`,
            sub2: <><Partes onVer={onVer} partes={[[m.closer_senas, 'señas', 'closer_senas']]} /> · {dinero(m.closer_cobrado)} cobrados</>,
            color: 'success', ver: 'closer_cerraron' },
    ];
    return (
        <div className="tg-kpis">
            {tarjetas.map((t) => (
                <div key={t.rotulo} className={t.ancha ? 'tg-kpi--ancha' : undefined} style={{ ...TARJETA, gap: 6, padding: '22px 22px 18px', borderRadius: 28 }}>
                    <div style={resplandor(t.color, '100% 100%')} />
                    <small style={{ ...ROTULO, position: 'relative' }}>{t.rotulo}</small>
                    <span style={{ position: 'relative', fontSize: 40, fontWeight: 900, lineHeight: 1.1, color: `var(--${t.color})` }}>{t.valor}</span>
                    <span style={{ position: 'relative', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.sub}</span>
                    {t.sub2 && <span style={{ position: 'relative', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.sub2}</span>}
                    {t.sub3 && <span style={{ position: 'relative', fontSize: 12, color: 'var(--text-muted-40)', lineHeight: 1.4 }}>{t.sub3}</span>}
                    {t.ancha && (
                        <span style={{ position: 'relative', display: 'block', height: 6, borderRadius: 6, marginTop: 4, background: 'rgba(255,255,255,.08)' }}>
                            <span style={{ display: 'block', height: 6, borderRadius: 6, width: `${Math.min(100, t.barra)}%`, background: `var(--${t.color})` }} />
                        </span>
                    )}
                    <button type="button" onClick={() => onVer(t.ver)}
                        style={{ ...boton, position: 'relative', alignSelf: 'flex-end', marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--brand-secondary)' }}>
                        Ver registros ›
                    </button>
                </div>
            ))}
        </div>
    );
}

/** Estados de las llamadas: la dona con el % que se presentó sobre las agendas con destino (la base de closing), cada
 *  destino con su barra, lo que no cuenta en la base y, de los que se presentaron, cómo quedó la calificación. */
export function Estados({ m, onVer }) {
    const destinos = destinosDe(m);
    const base = conResultado(m);
    const fuera = fueraDe(m).filter(([n]) => n > 0);
    let acumulado = 0;
    const tramos = destinos.map((e) => { const desde = acumulado; acumulado += e.pct; return `var(--${e.color}) ${desde}% ${acumulado}%`; });
    return (
        <div style={TARJETA}>
            <div style={resplandor('brand-secondary', '100% 100%', '420px 260px', 18)} />
            <Titulo texto="Estados" lado={<span title="Cada persona cuenta una vez, aunque haya reagendado."><b style={{ color: '#fff' }}>{m.agendas}</b> llamadas</span>} />
            <div style={{ ...CAJA, position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28, padding: 22, borderRadius: 20 }}>
                <div style={{ width: 150, height: 150, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: base ? `conic-gradient(${tramos.join(', ')})` : 'rgba(255,255,255,.08)' }}>
                    <div style={{ width: 108, height: 108, borderRadius: '50%', background: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{base ? `${Math.round(pct(m.asistencias, base))}%` : '—'}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>se presentaron</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.asistencias} de {base}</span>
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {destinos.map((e) => (
                        <button key={e.clave} type="button" onClick={() => onVer(e.filtro)} style={{ ...boton, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, fontWeight: 700 }}>
                                <span>{e.clave}</span><span style={{ color: `var(--${e.color})` }}>{e.n} · {e.pct}%</span>
                            </span>
                            <span style={{ display: 'block', height: 4, borderRadius: 4, background: 'rgba(255,255,255,.08)' }}>
                                <span style={{ display: 'block', height: 4, borderRadius: 4, width: `${e.pct}%`, background: `var(--${e.color})` }} />
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            {fuera.length > 0 && (
                <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'baseline', fontSize: 13, color: 'var(--text-muted)' }}>
                    <small style={ROTULO} title="No son un destino: quedan fuera del % de asistencia.">NO CUENTAN</small>
                    <span><Partes onVer={onVer} partes={fuera} /></span>
                </div>
            )}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <small style={ROTULO}>DE LOS {m.asistencias} QUE SE PRESENTARON</small>
                <div className="tg-desglose">
                    {calificacionDe(m).map((c) => {
                        const Caja = c.n ? 'button' : 'span';
                        return (
                            <Caja key={c.clave} {...(c.n ? { type: 'button', onClick: () => onVer(c.filtro) } : null)}
                                style={{ ...(c.n ? boton : null), display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <b style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1, color: c.n ? `var(--${c.color})` : 'var(--text-muted-40)' }}>{c.n}</b>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.3 }}>{c.clave}</span>
                            </Caja>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const BarraDeEtapa = ({ e, mayor, partes, onVer }) => {
    const caja = { width: e.n ? `max(${(e.n / mayor) * 100}%, 56px)` : 'auto', height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900 };
    if (partes?.length) {
        return (
            <span style={{ ...caja, gap: 2, overflow: 'hidden' }}>
                {partes.map((p) => (
                    <button key={p.filtro} type="button" onClick={() => onVer(p.filtro)} title={`${p.nombre} · ${p.n}`}
                        style={{ ...boton, flex: p.n, minWidth: 26, height: '100%', background: p.color, color: 'var(--ink)', textAlign: 'center', fontSize: 15, fontWeight: 900 }}>{p.n}</button>
                ))}
            </span>
        );
    }
    return (
        <button type="button" onClick={() => onVer(e.filtro)} style={{ ...boton, ...caja, background: e.n ? `var(--${e.color})` : 'none',
            color: !e.n ? 'var(--text-muted-40)' : ['brand-secondary', 'success'].includes(e.color) ? 'var(--ink)' : '#fff', textAlign: 'center' }}>{e.n}</button>
    );
};

// Las etapas del closer se parten por closer (su color), cada parte abre las llamadas de ese closer.
const partesDe = (etapa, closers, colores) => {
    const cuenta = { pasaron: 'pasaron', closer_asistieron: 'asistieron', closer_cerraron: 'cerraron' }[etapa.filtro];
    if (!cuenta) return null;
    return closers.filter((c) => c[cuenta] > 0).map((c) => ({ n: c[cuenta], color: colores[c.id], nombre: c.nombre, filtro: `cl:${c.id}:${cuenta}` }));
};

/** El embudo de etapas y la que más se cae; lo del closer, partido por closer. */
export function Embudo({ m, onVer, closers = [], colores = {} }) {
    const { etapas, cuello } = embudoDe(m);
    const mayor = Math.max(1, ...etapas.map((e) => e.n));
    return (
        <div style={TARJETA}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <small style={ROTULO}>EMBUDO</small>
                {cuello && (
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', padding: '5px 12px', borderRadius: 999, color: 'var(--error)',
                        background: 'var(--error-surface)', border: '1px solid var(--error-border)' }}>
                        CUELLO DE BOTELLA · {cuello}
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {etapas.map((e) => (
                    <Fragment key={e.filtro}>
                        {e.grupo && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                                <small style={ROTULO}>{e.grupo}</small>
                                {closers.map((c) => (
                                    <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                                        <i style={{ width: 9, height: 9, borderRadius: '50%', background: colores[c.id] }} />{c.nombre}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '124px minmax(0,1fr) 56px', alignItems: 'center', gap: 12 }}>
                            <button type="button" onClick={() => onVer(e.filtro)} style={{ ...boton, alignSelf: 'start', paddingTop: 12 }}>
                                <small style={{ ...ROTULO, letterSpacing: '.16em' }}>{e.rotulo || e.clave}</small>
                            </button>
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                {/* Cero es nada: sin barra, solo el número atenuado. */}
                                <BarraDeEtapa e={e} mayor={mayor} partes={e.n ? partesDe(e, closers, colores) : null} onVer={onVer} />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.35 }}>{e.nota || ' '}</span>
                            </span>
                            <span style={{ textAlign: 'right', fontSize: 15, fontWeight: 800, paddingTop: 7, alignSelf: 'start', color: cuello === e.clave ? 'var(--error)' : 'var(--text-on-surface)' }}>
                                {e.de ? pctTexto(e.n, e.de) : ''}
                            </span>
                        </div>
                    </Fragment>
                ))}
            </div>
            <small style={ROTULO}>DE {m.agendas} AGENDAS A {m.closer_cerraron} CIERRES CON EL CLOSER</small>
        </div>
    );
}

/** El low ticket de 100 USD de los descalificados: el cierre por cobro (ADR-W189), lo cobrado y cómo quedaron las
 *  presentaciones del período. */
export function LowTicket({ m, onVer, onVerCobros }) {
    const lt = cierreLowTicket(m);
    const cajas = [['CERRÓ', m.cerrado, 'success', 'cerrado'], ['NO CERRÓ', m.no_cerrado, 'error', 'no_cerrado'],
        ['SEGUIMIENTO', m.seguimiento, 'info', 'seguimiento'], ['PERDIDO', m.descartado, 'idle', 'descartado']];
    return (
        <div style={TARJETA}>
            <div style={resplandor('warning', '0% 0%', '380px 240px', 14)} />
            <Titulo texto="Low ticket" lado="Descalificados · oferta de 100 USD" />
            <div style={{ ...CAJA, position: 'relative', display: 'flex', alignItems: 'baseline', gap: 12, padding: '20px 22px', borderRadius: 20 }}>
                <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: lt.cierres ? 'var(--success)' : 'var(--error)' }}>{Math.round(pct(lt.cierres, lt.base))}%</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    <span>cierre · {lt.cierres} {lt.cierres === 1 ? 'venta' : 'ventas'} de {lt.base}
                        {lt.anteriores > 0 && ` (${m.pitch_low_ticket} presentaciones + ${lt.anteriores} de ${lt.anteriores === 1 ? 'una llamada anterior' : 'llamadas anteriores'})`}</span>
                    <span style={{ color: 'var(--success)' }}>
                        <Cobros onVer={lt.ventas ? onVerCobros : null}>{dinero(lt.cobrado)} cobrados</Cobros> · {dinero(lt.neto)} neto
                    </span>
                </span>
            </div>
            <small style={{ ...ROTULO, position: 'relative', letterSpacing: '.12em', marginBottom: -12 }}>
                Cómo quedaron las {m.pitch_low_ticket} presentaciones del período
            </small>
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                {cajas.map(([rotulo, n, color, ver]) => (
                    <button key={rotulo} type="button" onClick={() => onVer(ver)}
                        style={{ ...boton, display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 0', borderTop: `2px solid var(--${color})` }}>
                        <small style={{ ...ROTULO, letterSpacing: '.2em' }}>{rotulo}</small>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            <b style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>{n}</b> {pctTexto(n, m.pitch_low_ticket)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Por qué no pasaron a closing los que no califican (ADR-W153): una barra por motivo; cada una abre su lista. */
export function Motivos({ m, onVer }) {
    const filas = motivosDe(m);
    const mayor = Math.max(1, ...filas.map((f) => f.n));
    return (
        <div style={TARJETA}>
            <div style={resplandor('warning', '100% 0%', '380px 240px', 12)} />
            <Titulo texto="Por qué no pasaron a closing" lado={`${m.descalificados} no califican`} />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filas.map((f) => (
                    <button key={f.clave} type="button" disabled={!f.n} onClick={() => onVer(f.filtro)} aria-label={`${f.texto}: ${f.n}`}
                        style={{ ...boton, cursor: f.n ? 'pointer' : 'default', display: 'grid', alignItems: 'center', gap: 14, padding: '8px 0',
                            gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr) 76px', opacity: f.n ? 1 : 0.55 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{f.texto}</span>
                        <span style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                            <i style={{ display: 'block', height: '100%', width: `${(f.n / mayor) * 100}%`, borderRadius: 999,
                                background: f.clave === 'sin_dato' ? 'var(--idle)' : 'var(--warning)' }} />
                        </span>
                        <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            <b style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{f.n}</b> {pctTexto(f.n, m.descalificados)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Los que dejaron el formulario a medias: cuántos y qué se hizo con ellos. */
export function Abandonos({ a }) {
    if (!a) return null;
    const sinTocar = Math.max(0, a.total - a.contactados - a.no_contesta);
    const filas = [['Contactados', a.contactados, 'success'], ['No contestó', a.no_contesta, 'warning'], ['Sin tocar', sinTocar, 'idle']];
    return (
        <div style={TARJETA}>
            <Titulo texto="Abandonos del formulario" lado="No terminaron de agendar" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1 }}>{a.total}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>sin agendar</span>
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', gap: 3 }}>
                {filas.filter(([, n]) => n > 0).map(([rotulo, n, color]) => <div key={rotulo} style={{ flex: n, background: `var(--${color})` }} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filas.map(([rotulo, n, color]) => (
                    <div key={rotulo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${color})` }} />{rotulo}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}><b style={{ color: '#fff', fontSize: 16 }}>{n}</b> · {pctTexto(n, a.total)}</span>
                    </div>
                ))}
            </div>
            {sinTocar > 0 && (
                <div style={{ padding: '12px 16px', borderRadius: 16, background: 'var(--warning-surface)', border: '1px solid var(--warning-border)', fontSize: 13, lineHeight: 1.45 }}>
                    {sinTocar} de {a.total} todavía no {sinTocar === 1 ? 'recibió' : 'recibieron'} contacto.
                </div>
            )}
        </div>
    );
}

export { COLOR_DE_ESTADO };
