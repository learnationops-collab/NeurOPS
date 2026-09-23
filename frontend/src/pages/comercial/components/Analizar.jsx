import React from 'react';
import { Barra, CardHead, Cargando, Delta, fmt, useMontado } from './Shared';

/**
 * Analizar → Dashboard.
 *
 * Layout del doc 03 del handoff: fila 1 con las tres tarjetas grandes, y después dos filas de
 * dos columnas (Payment types | Programas, Embudo | Señas) que colapsan a una sola bajo ~900px.
 *
 * Todo lo clicable lleva a Revisar ya filtrado (`irA`): el diseño pide que cada porcentaje y cada
 * segmento de barra sea un drill-down, no un adorno.
 */

const TIPS = {
    showUp: 'De las llamadas que ya tuvieron un resultado (asistió o no show), cuántas asistieron. Las canceladas y las reagendadas no entran: esa llamada no ocurrió.',
    closeRate: 'De los que asistieron a la llamada, cuántos terminaron comprando. Se cuenta sobre las llamadas, no sobre las ventas del período: una venta puede no tener agenda en estos días, y una llamada de estos días puede haber cerrado más tarde.',
    cash: 'Todo lo cobrado en el período: ventas nuevas, cuotas de ventas anteriores y señas.',
    payment: 'Cómo se cobró: de una sola vez, en dos pagos (Split Pay), como cuota de un plan ya abierto, o como seña.',
    programas: 'Cuánto aportó cada programa y con qué mezcla de tipos de pago.',
    embudo: 'De agendas a ventas, paso por paso. El porcentaje de cada fila es contra el paso anterior.',
    senas: 'Una seña es una reserva, no una venta. Lo que importa es en qué terminó: cuántas se completaron y cuánto cash destrabaron.',
    lead: 'Prospectos que entraron por ManyChat en el período.',
    conversion: 'De los prospectos entrantes, cuántos llegaron a agendar una llamada.',
    engagement: 'De los prospectos entrantes, cuántos contestaron al menos una vez.',
    tenacidad: 'Cuántos toques recibió cada lead antes de que el setter lo soltara.',
};

/** Tarjeta grande de la fila 1. */
const Tile = ({ titulo, tip, valor, color, bajada, barra, delta, onClick }) => (
    <div className="ln-panel ln-panel--sm" style={{ cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}>
        <CardHead titulo={titulo} tip={tip}><Delta delta={delta} /></CardHead>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minHeight: 54 }}>
            <span className="dc-big" style={{ color }}>{valor}</span>
            {bajada && <span className="ln-t-caption ln-muted">{bajada}</span>}
        </div>
        {barra !== undefined && <Barra valor={barra} color={color} />}
    </div>
);

/** Mini gráfico de barras del cash por día. */
const CashPorDia = ({ dias, mejor }) => {
    const montado = useMontado();
    const tope = Math.max(...dias.map(d => d.cash), 1);
    return (
        <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 44 }}>
                {dias.map(d => (
                    <div key={d.dia} title={`${fmt.fecha(d.dia)} · ${fmt.money(d.cash)}`}
                        style={{
                            flex: 1, minWidth: 2, borderRadius: 3,
                            height: montado ? `${Math.max(3, (d.cash / tope) * 100)}%` : 0,
                            background: d.cash ? 'var(--brand-secondary)' : 'var(--bg-element)',
                            opacity: d.cash ? (mejor && d.dia === mejor.dia ? 1 : .55) : 1,
                            transition: 'height .9s cubic-bezier(.22,.7,.2,1)',
                        }} />
                ))}
            </div>
            <div className="ln-t-caption ln-muted-40" style={{ marginTop: 8 }}>
                {mejor ? `mejor día ${fmt.money(mejor.cash)} · ${fmt.fecha(mejor.dia)}` : 'sin cobros en el período'}
            </div>
        </div>
    );
};

/** Barra apilada que anima el `flex-grow` de cada segmento. */
const Apilada = ({ segmentos, alta, onSeg }) => {
    const montado = useMontado();
    const total = segmentos.reduce((a, s) => a + s.valor, 0);
    if (!total) return <div className="dc-stack"><div className="dc-stack-seg" style={{ flexGrow: 1, background: 'var(--bg-element)' }} /></div>;
    return (
        <div className={`dc-stack${alta ? ' dc-stack--tall' : ''}`}>
            {segmentos.filter(s => s.valor > 0).map(s => (
                <button key={s.key} type="button" className="dc-stack-seg" title={`${s.label} · ${s.titulo}`}
                    onClick={onSeg ? () => onSeg(s) : undefined}
                    style={{ flexGrow: montado ? s.valor : 0, background: s.color, cursor: onSeg ? 'pointer' : 'default' }} />
            ))}
        </div>
    );
};

const COLOR_TIPO = {
    completo: 'var(--success)', parcial: 'var(--info)', cuota: 'var(--idle)', 'seña': 'var(--warning)',
};

const PaymentTypes = ({ bloque, irA }) => {
    const total = bloque.payment_types.reduce((a, t) => a + t.ventas, 0);
    return (
        <div className="ln-panel ln-panel--sm">
            <CardHead titulo="Payment types" tip={TIPS.payment}>
                <span className="ln-t-caption ln-muted dc-num">{fmt.plural(total, 'cobro', 'cobros')}</span>
            </CardHead>
            <Apilada segmentos={bloque.payment_types.map(t => ({
                key: t.key, valor: t.ventas, color: COLOR_TIPO[t.key], label: t.label, titulo: `${t.ventas}`,
            }))} onSeg={(s) => irA('ventas', { tipo_pago: s.key })} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
                {bloque.payment_types.map(t => (
                    <button key={t.key} type="button" className="dc-total-card" style={{ textAlign: 'left', cursor: 'pointer' }}
                        onClick={() => irA('ventas', { tipo_pago: t.key })}>
                        <div className="dc-total-label" style={{ color: COLOR_TIPO[t.key] }}>{t.label}</div>
                        <div className="dc-total-value">{t.ventas}</div>
                        <div className="dc-total-hint">{fmt.money(t.cash)}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};

const Programas = ({ bloque, irA }) => {
    const ventas = bloque.programas.reduce((a, p) => a + p.ventas, 0);
    const cash = bloque.programas.reduce((a, p) => a + p.cash, 0);
    return (
        <div className="ln-panel ln-panel--sm">
            <CardHead titulo="Programas" tip={TIPS.programas}>
                <span className="ln-t-caption ln-muted dc-num">
                    {fmt.plural(ventas, 'venta', 'ventas')} · {fmt.money(cash)}
                </span>
            </CardHead>
            {bloque.programas.length === 0 && <p className="ln-t-body-sm ln-muted-40">Sin ventas en el período.</p>}
            {bloque.programas.map(p => (
                <div key={p.programa} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span className="ln-program">
                                <span className="ln-program-dot" style={{
                                    background: p.programa === 'Residency Roadmap' ? 'var(--prog-elite-b)' : 'var(--prog-ace)',
                                }} />
                                {p.programa}
                            </span>
                            <span className="ln-t-caption ln-muted-40 dc-num">
                                {fmt.plural(p.ventas, 'venta', 'ventas')} · ticket {fmt.money(p.ticket)}
                                {p.cobros !== p.ventas && ` · ${fmt.plural(p.cobros, 'cobro', 'cobros')}`}
                            </span>
                        </span>
                        <span className="dc-num" style={{ fontSize: 19, fontWeight: 700 }}>{fmt.money(p.cash)}</span>
                    </div>
                    <Apilada alta segmentos={p.por_tipo.map(t => ({
                        key: t.key, valor: t.ventas, color: COLOR_TIPO[t.key], label: t.label, titulo: `${t.ventas}`,
                    }))} onSeg={(s) => irA('ventas', { tipo_pago: s.key, programa: p.programa })} />
                </div>
            ))}
            <div className="dc-legend">
                {['completo', 'parcial', 'cuota'].map(k => (
                    <span key={k} className="dc-legend-item">
                        <span className="dc-dot" style={{ background: COLOR_TIPO[k] }} />
                        {k === 'completo' ? 'Pago completo' : k === 'parcial' ? 'Split Pay' : 'Cuotas'}
                    </span>
                ))}
            </div>
        </div>
    );
};

/**
 * Embudo del doc 03: barras centradas con cuello trapezoidal entre una y la siguiente, color en
 * degradado de info a magenta, y el paso de menor conversión marcado en error.
 */
const Embudo = ({ pasos, irA }) => {
    const montado = useMontado();
    const primero = pasos[0]?.n || 0;
    const ancho = (n) => Math.max(14, primero ? (n / primero) * 100 : 14);

    // Cuello de botella: el salto de menor conversión, sin contar el primero (que no tiene
    // paso anterior contra el cual medirse).
    let cuello = null;
    let peor = 101;
    pasos.forEach((p, i) => {
        if (i === 0) return;
        const previo = pasos[i - 1].n;
        if (!previo) return;
        const tasa = (p.n / previo) * 100;
        if (tasa < peor) { peor = tasa; cuello = i; }
    });

    const color = (i) => {
        if (i === cuello) return 'var(--error)';
        const mezcla = pasos.length > 1 ? Math.round((i / (pasos.length - 1)) * 100) : 100;
        return `color-mix(in oklch, var(--brand-secondary) ${mezcla}%, var(--info))`;
    };
    const final = primero ? ((pasos[pasos.length - 1].n / primero) * 100).toFixed(1) : '0.0';

    return (
        <div className="ln-panel ln-panel--sm">
            <CardHead titulo="Embudo" tip={TIPS.embudo}>
                {cuello !== null && (
                    <span className="dc-bottleneck">Cuello de botella · {pasos[cuello].paso}</span>
                )}
            </CardHead>
            {pasos.map((p, i) => {
                const pct = i === 0 ? null : pasos[i - 1].n ? ((p.n / pasos[i - 1].n) * 100).toFixed(1) : null;
                const anchoAqui = montado ? ancho(p.n) : 14;
                const anchoSig = i < pasos.length - 1 ? (montado ? ancho(pasos[i + 1].n) : 14) : null;
                return (
                    <div key={p.paso}>
                        <div className="dc-funnel-row">
                            <span className="dc-funnel-label" style={i === cuello ? { color: 'var(--error)' } : undefined}>
                                {p.paso}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div className="dc-funnel-bar"
                                    style={{ width: `${anchoAqui}%`, background: color(i), transitionDelay: `${120 + i * 90}ms` }}>
                                    {p.n}
                                </div>
                            </div>
                            <span className="dc-funnel-pct" style={i === cuello ? { color: 'var(--error)' } : undefined}>
                                {pct === null ? '' : `${pct}%`}
                            </span>
                        </div>
                        {anchoSig !== null && (
                            <div className="dc-funnel-row">
                                <span />
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div className="dc-funnel-neck" style={{
                                        width: '100%', background: color(i),
                                        transitionDelay: `${120 + i * 90}ms`,
                                        clipPath: `polygon(${(100 - anchoAqui) / 2}% 0, ${100 - (100 - anchoAqui) / 2}% 0, `
                                            + `${100 - (100 - anchoSig) / 2}% 100%, ${(100 - anchoSig) / 2}% 100%)`,
                                    }} />
                                </div>
                                <span />
                            </div>
                        )}
                    </div>
                );
            })}
            <div className="dc-legend" style={{ justifyContent: 'space-between' }}>
                <span className="ln-t-caption ln-muted dc-num">
                    de {primero} {pasos[0]?.paso.toLowerCase()} a {pasos[pasos.length - 1]?.n} {pasos[pasos.length - 1]?.paso.toLowerCase()}
                </span>
                <button type="button" className="ln-t-caption ln-accent dc-num"
                    style={{ background: 'none', border: 0, cursor: 'pointer' }}
                    onClick={() => irA('agendas', {})}>
                    {final}% final
                </button>
            </div>
        </div>
    );
};

const Senas = ({ senas, delta, irA }) => {
    const grupos = [
        { key: 'completo', label: 'Pago completo', color: 'var(--success)' },
        { key: 'parcial', label: 'Pago parcial', color: 'var(--info)' },
        { key: 'espera', label: 'En espera', color: 'var(--warning)' },
        { key: 'caida', label: 'Caída', color: 'var(--error)' },
    ];
    const stats = [
        { label: 'Convirtió', valor: fmt.pct(senas.conversion), color: 'var(--success)',
            tip: 'De las señas del período, cuántas terminaron en un pago completo o en un Split Pay.' },
        { label: 'Cobrado', valor: fmt.money(senas.cobrado), tip: 'La suma de las señas del período.' },
        { label: 'Ticket', valor: fmt.money(senas.ticket), tip: 'Cuánto se pide de seña en promedio.' },
        { label: 'Desbloqueado', valor: fmt.money(senas.desbloqueado), color: 'var(--brand-secondary)',
            tip: 'El cash de las ventas que esas señas destrabaron. Es el argumento para seguir pidiéndolas.' },
    ];
    return (
        <div className="ln-panel ln-panel--sm">
            <CardHead titulo="Señas" tip={TIPS.senas}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="ln-t-caption ln-muted dc-num">
                        {fmt.plural(senas.total, 'seña', 'señas')}
                    </span>
                    <Delta delta={delta} />
                </span>
            </CardHead>
            <Apilada segmentos={grupos.map(g => ({ ...g, valor: senas[g.key], titulo: `${senas[g.key]}` }))} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grupos.map(g => {
                    const clicable = g.key === 'completo' || g.key === 'parcial';
                    const Fila = clicable ? 'button' : 'div';
                    return (
                        <Fila key={g.key} type={clicable ? 'button' : undefined}
                            onClick={clicable ? () => irA('ventas', { tipo_pago: g.key }) : undefined}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0,
                                background: 'transparent', color: 'inherit', padding: 0, textAlign: 'left',
                                cursor: clicable ? 'pointer' : 'default',
                            }}>
                            <span className="dc-dot" style={{ background: g.color }} />
                            <span className="ln-t-body-sm" style={{ flex: 1 }}>{g.label}</span>
                            <span className="dc-num" style={{ fontSize: 15, fontWeight: 700 }}>{senas[g.key]}</span>
                            <span className="ln-t-caption ln-muted-40 dc-num" style={{ minWidth: 92, textAlign: 'right' }}>
                                {senas.total ? `${Math.round((senas[g.key] / senas.total) * 100)}% de las ${senas.total}` : '—'}
                            </span>
                        </Fila>
                    );
                })}
            </div>
            <div className="dc-legend" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
                {stats.map(s => (
                    <div key={s.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="dc-total-label">{s.label}</span>
                        </div>
                        <div className="dc-num" style={{ fontSize: 20, fontWeight: 700, color: s.color, marginTop: 2 }}>
                            {s.valor}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DashboardClosers = ({ bloque, deltas, irA }) => (
    <>
        <div className="dc-grid-tiles">
            <Tile titulo="Show up" tip={TIPS.showUp} valor={fmt.pct(bloque.show_up)} color="var(--success)"
                bajada={`${bloque.asistieron} de ${bloque.realizadas} realizadas`} barra={bloque.show_up || 0}
                delta={deltas.show_up} onClick={() => irA('agendas', { post_call: 'asistio' })} />
            <Tile titulo="Close rate" tip={TIPS.closeRate} valor={fmt.pct(bloque.close_rate)} color="var(--brand-secondary)"
                bajada={`${bloque.cerradas} de ${bloque.asistieron} asistieron`} barra={bloque.close_rate || 0}
                delta={deltas.close_rate}
                onClick={() => irA('agendas', { post_call: 'Venta' })} />
            <div className="ln-panel ln-panel--sm">
                <CardHead titulo="Cash collected" tip={TIPS.cash}><Delta delta={deltas.cash} /></CardHead>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minHeight: 54 }}>
                    <span className="dc-big">{fmt.money(bloque.cash)}</span>
                    <span className="ln-t-caption ln-muted dc-num">ticket {fmt.money(bloque.ticket)}</span>
                </div>
                <CashPorDia dias={bloque.cash_por_dia} mejor={bloque.mejor_dia} />
            </div>
        </div>
        <div className="dc-grid-2">
            <PaymentTypes bloque={bloque} irA={irA} />
            <Programas bloque={bloque} irA={irA} />
        </div>
        <div className="dc-grid-2">
            <Embudo pasos={bloque.funnel} irA={irA} />
            <Senas senas={bloque.senas} delta={deltas.senas} irA={irA} />
        </div>
    </>
);

const DashboardSetters = ({ bloque, deltas, irA }) => (
    <>
        <div className="dc-grid-tiles">
            <Tile titulo="Lead discovery" tip={TIPS.lead} valor={fmt.num(bloque.leads)}
                bajada="entrantes del período" delta={deltas.leads} onClick={() => irA('leads', {})} />
            <Tile titulo="Conversión" tip={TIPS.conversion} valor={fmt.pct(bloque.conversion)}
                color="var(--brand-secondary)" bajada={`${bloque.agendas} agendas generadas`}
                barra={bloque.conversion || 0} delta={deltas.conversion}
                onClick={() => irA('generadas', {})} />
            <Tile titulo="Engagement" tip={TIPS.engagement} valor={fmt.pct(bloque.respuesta)}
                color="var(--info)" bajada={`${bloque.respondieron} de ${bloque.leads} respondieron`}
                barra={bloque.respuesta || 0} delta={deltas.respuesta}
                onClick={() => irA('leads', { estado: 'en_conversacion' })} />
        </div>
        <div className="dc-grid-2">
            <Embudo pasos={bloque.funnel} irA={irA} />
            <div className="ln-panel ln-panel--sm">
                <CardHead titulo="Tenacidad del seguimiento" tip={TIPS.tenacidad}>
                    <span className="ln-t-caption ln-muted dc-num">
                        {bloque.mensajes} mensajes · {bloque.respondieron} respondidos
                    </span>
                </CardHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {bloque.tenacidad.map(t => {
                        const tope = Math.max(...bloque.tenacidad.map(x => x.leads), 1);
                        return (
                            <div key={t.toques} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className="ln-t-caption ln-muted" style={{ width: 54 }}>{t.toques} toques</span>
                                <div className="dc-rank-track" style={{ flex: 1 }}>
                                    <div className="dc-rank-fill"
                                        style={{ width: `${(t.leads / tope) * 100}%`, background: 'var(--info)' }} />
                                </div>
                                <span className="dc-num" style={{ fontSize: 14, fontWeight: 700, width: 34, textAlign: 'right' }}>
                                    {t.leads}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    </>
);

const Analizar = ({ datos, rol, irA }) => {
    if (!datos) return <Cargando />;
    const { actual, deltas } = datos;
    return rol === 'setters'
        ? <DashboardSetters bloque={actual} deltas={deltas} irA={irA} />
        : <DashboardClosers bloque={actual} deltas={deltas} irA={irA} />;
};

export default Analizar;
