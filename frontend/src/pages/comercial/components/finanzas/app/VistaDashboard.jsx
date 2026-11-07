import React, { useState } from 'react';
import { PAL, agrupar, dashboardDe, money, origenDe, pctDe, porDia, procesadorDe, profitDe, r2, sum, tipoDe } from './modelo';
import { Anillo, Apilada, Barras, Humo, Leyenda, Numero, Titulo } from './piezas';

/**
 * Dashboard: lo cobrado, el payroll y el profit arriba; abajo el reparto del ingreso, la nómina por
 * departamento, los egresos por categoría, el cash por día y el cash por programa, tipo de pago,
 * origen, procesador y closer. Cada cifra de arriba lleva a su vista.
 */
const Dias = ({ filas, desde, hasta }) => {
    const d = porDia(filas, desde, hasta);
    const mx = Math.max(1, ...d.map((x) => x.v));
    const [tip, setTip] = useState(null);
    const marcas = [0, Math.floor(d.length / 4), Math.floor(d.length / 2), Math.floor((3 * d.length) / 4), d.length - 1];
    const fecha = (iso) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
    return (
        <>
            <div className="days" onPointerLeave={() => setTip(null)}>
                {d.map((x, i) => (
                    <i key={x.iso} className={x.v ? '' : 'z'} style={{ height: `${x.v ? Math.max(3, (x.v / mx) * 100) : 2}%`, '--d': `${i * 0.025}s` }}
                        onPointerOver={(e) => setTip({ i, left: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2, top: e.currentTarget.offsetTop })} />
                ))}
                {tip && (
                    <div className="dtip" style={{ left: tip.left, top: tip.top }}>
                        {fecha(d[tip.i].iso)} · {d[tip.i].v ? `${money(d[tip.i].v)} · ${d[tip.i].n} ${d[tip.i].n === 1 ? 'cobro' : 'cobros'}` : 'sin cobros'}
                    </div>
                )}
            </div>
            <div className="dax">{[...new Set(marcas)].map((i) => <span key={i}>{fecha(d[i].iso)}</span>)}</div>
        </>
    );
};

const Tarjeta = ({ titulo, sub, clase, children }) => (
    <div className="card dc"><h3>{titulo}</h3><p>{sub}</p><div className={clase}>{children}</div></div>
);

const VistaDashboard = ({ app, periodo, onIr }) => {
    if (!app.cobros || !app.personas) {
        return <><Titulo num="00" texto="Dashboard" /><section className="card"><div className="vacio">Cargando el período…</div></section></>;
    }
    const D = dashboardDe({ cobros: app.cobros, personas: app.personas, puente: app.puente });
    const pro = app.foto ? profitDe({ personas: app.personas, foto: app.foto, presupuesto: app.anuncios?.budget || 0 }).pro : null;
    const queda = r2(D.bruto - D.fees - D.out);
    const ing = [['Equipo', D.out, 'var(--mag)'], ['Plataformas', D.fees, 'var(--bad)'], ['Queda', Math.max(0, queda), 'var(--ok)']];
    const prog = agrupar(D.filas, 'programa').map(([k, v, n], i) => [k, v, PAL[i % PAL.length], `${n}`]);
    const tipo = agrupar(D.filas, tipoDe);
    const ir = (s) => (e) => { e.preventDefault(); onIr(s); };
    const ctot = sum(D.cats, (c) => c[1]) || 1;
    return (
        <>
            <Titulo num="00" texto="Dashboard" />
            <div className="card kpi aura">
                <Humo />
                <div className="krow">
                    <a className="k" href="#diferencias" onClick={ir('diferencias')}><span>Cash collected</span><Numero valor={D.cobrado} />
                        <small>{D.n} cobros · ticket {money(D.n ? D.cobrado / D.n : 0, 0)}</small></a>
                    <a className="k" href="#payroll" onClick={ir('payroll')}><span>Payroll</span><Numero valor={D.out} /><small>{pctDe(D.out, D.cobrado)}% de lo cobrado</small></a>
                    <a className="k big" href="#profit" onClick={ir('profit')}><span>Profit libre</span>
                        {pro == null ? <b>—</b> : <Numero valor={pro} className={pro < 0 ? 'neg' : undefined} />}<small>{pro == null ? 'faltan los saldos' : 'libre hoy en las cuentas'}</small></a>
                </div>
                <div className="krow sm">
                    <div className="k"><span>Neto sistema</span><Numero valor={D.sis} /></div>
                    <div className="k"><span>Fees de plataformas</span><b className="neg">−{money(D.fees, 0)}</b></div>
                    <a className="k" href="#diferencias" onClick={ir('diferencias')}><span>Diferencias</span><b className="amb">−{money(D.dif, 0)}</b></a>
                </div>
                <div className="kbars">
                    <div className="kb"><span>Ingresos</span><div className="tr"><i className="grow" style={{ width: '100%', background: 'var(--mag)' }} /></div><b>{money(D.cobrado, 0)}</b></div>
                    <div className="kb"><span>Payroll</span>
                        <div className="tr" style={{ background: 'none' }}>
                            <div style={{ display: 'flex', gap: 2, width: `${Math.min(100, D.cobrado ? (D.out / D.cobrado) * 100 : 0)}%` }}>
                                {D.areas.map(([t, v, c], i) => <i key={t} className="grow" title={`${t} ${money(v, 0)}`} style={{ flex: v, background: c, '--d': `${0.2 + i * 0.12}s` }} />)}
                            </div>
                            <div style={{ flex: 1, background: 'var(--off)', borderRadius: '0 999px 999px 0' }} />
                        </div>
                        <b>{money(D.out, 0)}</b></div>
                </div>
            </div>
            <div className="dgrid">
                <Tarjeta titulo="Reparto del ingreso" sub="Qué pasó con cada dólar cobrado" clase="dn">
                    <Anillo items={ing} total={D.bruto} centro={D.bruto} sub="cobrado bruto" />
                    <Leyenda items={ing} total={D.bruto} pie={<div className="lgf"><span>Queda para la empresa</span><b>{money(queda, 0)}</b></div>} />
                </Tarjeta>
                <Tarjeta titulo="Nómina por departamento" sub="Ventas, Fulfillment y Operaciones" clase="hb">
                    <Barras items={D.areas.map(([t, v, c, n]) => [t, v, c, `${n} ${n === 1 ? 'persona' : 'personas'} · ${pctDe(v, D.out)}%`])} />
                </Tarjeta>
            </div>
            <div className="card dc"><h3>Egresos por categoría</h3><p>Cómo se compone el payroll</p>
                <div className="tiles">
                    {D.cats.map(([n, v, c], i) => (
                        <div key={n} className="tile" style={{ '--c': c, '--w': `${(v / ctot) * 100}%`, '--d': `${i * 0.1}s` }}>
                            <span>{n}</span><Numero valor={v} /><small>{pctDe(v, ctot)}% del payroll</small>
                        </div>
                    ))}
                </div>
            </div>
            <div className="card dc"><h3>Cash por día</h3><p>Lo que entró cada día del período</p><Dias filas={D.filas} desde={periodo.desde} hasta={periodo.hasta} /></div>
            <div className="dgrid">
                <Tarjeta titulo="Por programa" sub="Qué producto sostiene el período" clase="dn">
                    <Anillo items={prog} total={D.cobrado} centro={D.cobrado} sub="cash collected" />
                    <Leyenda items={prog.map((x) => [x[0], x[1], x[2]])} total={D.cobrado} />
                </Tarjeta>
                <Tarjeta titulo="Por tipo de pago" sub="Cómo se compone el cobro" clase="st">
                    <Apilada items={tipo.map(([k, v], i) => [k, v, PAL[i % PAL.length]])} total={D.cobrado} />
                </Tarjeta>
                <Tarjeta titulo="Por origen de la venta" sub="De dónde vino cada venta" clase="hb">
                    <Barras items={agrupar(D.filas, origenDe).map(([k, v, n], i) => [k, v, PAL[i % PAL.length], `${n} ${n === 1 ? 'cobro' : 'cobros'}`])} />
                </Tarjeta>
                <Tarjeta titulo="Por procesador" sub="Dónde entró la plata" clase="st">
                    <Apilada items={agrupar(D.filas, procesadorDe).map(([k, v], i) => [k, v, PAL[i % PAL.length]])} total={D.cobrado} />
                </Tarjeta>
                <Tarjeta titulo="Por closer" sub="Quién cerró cada cobro" clase="hb">
                    <Barras items={agrupar(D.filas, 'closer').map(([k, v, n], i) => [k, v, PAL[i % PAL.length], `${n} ${n === 1 ? 'cobro' : 'cobros'}`])} />
                </Tarjeta>
                <Tarjeta titulo="Ticket por tipo" sub="Promedio que entra por cobro" clase="hb">
                    <Barras items={tipo.map(([k, v, n], i) => [k, r2(v / n), PAL[i % PAL.length], `${n} ${n === 1 ? 'cobro' : 'cobros'}`]).sort((a, b) => b[1] - a[1])} />
                </Tarjeta>
            </div>
        </>
    );
};

export default VistaDashboard;
