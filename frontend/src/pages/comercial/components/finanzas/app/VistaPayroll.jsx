import React, { useState } from 'react';
import MenuEstado from './MenuEstado';
import PanelAjustes from './PanelAjustes';
import PanelComision from './PanelComision';
import { AREAS, MET, heroDe, iniciales, money, montoParaBanco, sum } from './modelo';
import { Humo, IconoCopiar, Numero, Titulo, useCopiado } from './piezas';

/**
 * Payroll: el total del período con cuánto ya salió, lo que falta por Mercury y por AirTM, y cada
 * persona por área con su estado, su monto (un toque lo copia para el banco) y sus dos paneles,
 * Comisiones y Ajustes.
 */

const Chips = ({ p, onMetodo, editable }) => (
    <div className="chips">
        <span className="chip rl">{p.rol}</span>
        <button type="button" className="chip mt" style={{ '--c': MET[p.metodo][1] }} disabled={!editable}
            title="Cambiar método de pago" onClick={onMetodo}>{MET[p.metodo][0]}</button>
        {p.base > 0 && <span className="chip">Base <b>{money(p.base, 0)}</b></span>}
        {p.com > 0 && <span className="chip cm">Comisión <b>{money(p.com)}</b></span>}
        {p.bonos > 0 && <span className="chip dd">Bonos <b>{money(p.bonos)}</b></span>}
        {p.recibio > 0 && <span className="chip ng" title="Lo recibió por transferencia de un cliente">Recibió <b>−{money(p.recibio)}</b></span>}
        {p.desc > 0 && <span className="chip ng">Descuento <b>−{money(p.desc)}</b></span>}
    </div>
);

const Monto = ({ p }) => {
    const [marca, copiar] = useCopiado();
    const v = montoParaBanco(p);
    const nota = p.demas ? `De más ${money(p.demas)}` : p.falta > 0 && p.trans > 0 ? `Falta ${money(p.falta)}` : null;
    return (
        <>
            <button type="button" className={`cpa${marca ? ` ${marca}` : ''}`} title={`Copiar ${v}`} aria-label={`Copiar ${v}`}
                onClick={() => copiar(v)}>
                <b>{money(p.neto)}</b><IconoCopiar />
            </button>
            {nota && <button type="button" className="falta cpa2" title={`Copiar ${v}`} onClick={() => copiar(v)}>{nota}</button>}
        </>
    );
};

export const FilaPersona = ({ p, app, titulo, abierto, onAbrir }) => {
    if (p.fijo) {
        return (
            <div className="pr off">
                <div className="av">{iniciales(p.n)}</div>
                <div className="who"><b>{p.n}</b><div className="chips"><span className="chip">{p.rol}</span></div></div>
                <div className="amt"><b>$0</b></div>
                <div className="sc"><span className="fix">Sin pago en el período</span></div>
            </div>
        );
    }
    const cm = `c:${p.k}`;
    return (
        <div className={`pr${abierto === p.k || abierto === cm ? ' open' : ''}`}>
            <div className="av">{iniciales(p.n)}</div>
            <div className="who"><b>{p.n}</b><Chips p={p} editable={app.editable} onMetodo={() => app.metodo(p)} /></div>
            <div className="amt"><Monto p={p} /></div>
            <div className="sc">
                <MenuEstado persona={p} deshabilitado={!app.editable} onElegir={(e) => app.estado(p, e)} />
                <div className="bts">
                    {p.clave && (
                        <button type="button" className="aj" aria-expanded={abierto === cm} onClick={() => onAbrir(abierto === cm ? null : cm)}>Comisiones</button>
                    )}
                    <button type="button" className="aj" aria-expanded={abierto === p.k} onClick={() => onAbrir(abierto === p.k ? null : p.k)}>
                        Ajustes{p.mov.length ? ` · ${p.mov.length}` : ''}
                    </button>
                </div>
            </div>
            {abierto === p.k && <PanelAjustes p={p} titulo={titulo} editable={app.editable} onGuardar={(m) => app.movimientos(p, m)} />}
            {abierto === cm && <PanelComision p={p} payroll={app.payroll} titulo={titulo} editable={app.editable} onExcluir={app.excluir} />}
        </div>
    );
};

const Hero = ({ personas, titulo }) => {
    const h = heroDe(personas);
    const base = Math.max(h.tot, sum(h.seg, (s) => s[1])) || 1;
    const mx = Math.max(1, ...h.metodos.map((x) => x[1]));
    const [mes, anio] = titulo.split(' ');
    return (
        <header className="hero aura">
            <Humo tam="big" />
            <div className="hgrid">
                <div>
                    <h1>{mes}{anio && <span>{anio}</span>}</h1>
                    <div className="mchips">
                        {h.metodos.map(([m, v, n]) => (
                            <div key={m} className="mc" style={{ '--c': MET[m][1] }}>
                                <span>Falta por {MET[m][0]}</span><b>{money(v)}</b>
                                <small>{n} {n === 1 ? 'persona' : 'personas'}</small>
                                <i><em style={{ width: `${(v / mx) * 100}%` }} /></i>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="tot">
                    <div className="l">Total del período</div>
                    <div className="n"><Numero valor={h.tot} dec={2} /></div>
                    <div className="stbar">{h.seg.map(([l, v, c]) => <i key={l} style={{ width: `${(v / base) * 100}%`, background: c }} />)}</div>
                    <div className="pills">
                        {h.seg.map(([l, v, c]) => <div key={l} className="pill" style={{ '--c': c }}><span>{l}</span><b>{money(v)}</b></div>)}
                    </div>
                </div>
            </div>
        </header>
    );
};

const VistaPayroll = ({ app, titulo, abierto: abiertoInicial = null }) => {
    const [abierto, setAbierto] = useState(abiertoInicial);
    const { personas } = app;
    return (
        <>
            <Titulo num="01" texto="Payroll" />
            {!personas ? <section className="card"><div className="vacio">Cargando la nómina…</div></section> : (
                <>
                    <Hero personas={personas} titulo={titulo} />
                    <section className="card">
                        <div className="head"><div><div className="eyebrow">Pagos del período</div><h2>Quién cobra y cuánto</h2></div></div>
                        <div className="areas">
                            {AREAS.map(([a, t, c]) => {
                                const ps = personas.filter((p) => p.a === a);
                                if (!ps.length) return null;
                                return (
                                    <div key={a} style={{ '--c': c }}>
                                        <div className="ah"><h3>{t}</h3><span>{money(sum(ps.filter((p) => !p.fijo), (p) => p.neto))}</span></div>
                                        <div className="plist">
                                            {ps.map((p) => <FilaPersona key={p.k} p={p} app={app} titulo={titulo} abierto={abierto} onAbrir={setAbierto} />)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {!app.editable && <div className="sync">Con un rango personalizado los pagos se ven sumados. Para marcar estados, elegí un mes.</div>}
                    </section>
                </>
            )}
        </>
    );
};

export default VistaPayroll;
