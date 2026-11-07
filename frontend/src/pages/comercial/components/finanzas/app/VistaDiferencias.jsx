import React, { useState } from 'react';
import Diferencias from '../Diferencias';
import { money, r2, sum } from './modelo';
import { BotonAnimar, Titulo, tween, wait } from './piezas';

/**
 * Diferencias: por qué lo que llegó a Stripe y Hotmart no es lo que dice el sistema. Un puente
 * animado Sistema → En pasarelas → Llegó, con cada diferencia como una pieza que sale de la barra
 * mientras el total baja. Debajo, la conciliación de siempre (subir CSV, revisar fila por fila).
 */
const Puente = ({ puente }) => {
    const { nodos, gaps } = puente;
    const [vals, setVals] = useState(nodos.map((n) => n[1]));
    const [fuera, setFuera] = useState(new Set());
    const mx = Math.max(1, ...gaps.map((g) => sum(g, (x) => Math.abs(x[2]))));

    const animar = async () => {
        const todas = new Set(gaps.flatMap((g, j) => g.map((_, i) => `${j}-${i}`)));
        setFuera(todas);
        setVals([nodos[0][1], nodos[0][1], nodos[0][1]]);
        await wait(450);
        let acc = nodos[0][1];
        for (let j = 0; j < gaps.length; j += 1) {
            for (let i = 0; i < gaps[j].length; i += 1) {
                const v = gaps[j][i][2], a0 = acc;
                acc = r2(acc - v);
                setFuera((f) => { const n = new Set(f); n.delete(`${j}-${i}`); return n; });
                // eslint-disable-next-line no-await-in-loop
                await tween(650, (t) => setVals((vs) => vs.map((x, k) => (k === j + 1 || (j === 0 && k === 2) ? a0 - v * t : x))));
                // eslint-disable-next-line no-await-in-loop
                await wait(150);
            }
            setVals((vs) => vs.map((x, k) => (k === j + 1 ? nodos[j + 1][1] : x)));
            // eslint-disable-next-line no-await-in-loop
            await wait(300);
        }
        setVals(nodos.map((n) => n[1]));
    };

    return (
        <section className="card">
            <div className="head">
                <div><div className="eyebrow">Sistema contra pasarelas</div><h2>Por qué llega menos</h2></div>
                <BotonAnimar onAnimar={animar} auto />
            </div>
            <div className="flow">
                {nodos.map(([n], i) => (
                    <React.Fragment key={n}>
                        <div className={`node${i === nodos.length - 1 ? ' fin' : ''}`}><span>{n}</span><b>{money(vals[i])}</b></div>
                        {i < nodos.length - 1 && (
                            <div className="edge" style={{ '--c': i ? 'var(--amb)' : 'var(--bad)' }}>
                                <i className="ln"><i /></i><em>{nodos[i][1] - nodos[i + 1][1] < 0 ? '+' : '−'}{money(Math.abs(r2(nodos[i][1] - nodos[i + 1][1])))}</em>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className="gaps">
                {gaps.map((g, j) => (
                    <div key={j} className="gap">
                        <div className="gbar">
                            {g.map(([n, t, v, c], i) => (
                                <i key={n + t} className={fuera.has(`${j}-${i}`) ? 'out' : ''} title={`${n} · ${t}`}
                                    style={{ flex: `0 0 ${(Math.abs(v) / mx) * 100}%`, background: c }} />
                            ))}
                        </div>
                        <div className="gch">
                            {g.map(([n, t, v, c], i) => (
                                <span key={n + t} className={`gc${fuera.has(`${j}-${i}`) ? ' out' : ''}`} style={{ '--c': c }}>
                                    {n}<small style={{ color: 'var(--meta)' }}>{t}</small><b>{v < 0 ? '+' : '−'}{money(Math.abs(v))}</b>
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

const VistaDiferencias = ({ app, periodo }) => (
    <>
        <Titulo num="03" texto="Diferencias" chip="Sistema contra plataformas" />
        {!app.puente ? <section className="card"><div className="vacio">Cargando los cobros…</div></section>
            : app.puente.vacio ? <section className="card"><div className="vacio">Sin cobros por Stripe ni Hotmart en el período.</div></section>
                : <Puente key={app.puente.nodos.map((n) => n[1]).join('|')} puente={app.puente} />}
        <div className="fz-legado"><Diferencias periodo={periodo} /></div>
    </>
);

export default VistaDiferencias;
