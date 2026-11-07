import React, { useEffect, useRef, useState } from 'react';
import { numero } from './PanelAjustes';
import { CUENTAS, money, profitDe, r2, sum } from './modelo';
import { BotonAnimar, Humo, Titulo, tween, wait } from './piezas';

/**
 * Profit: lo que queda libre en las cuentas. Los saldos se cargan ANTES de pagar el payroll (botón
 * Saldos): desde ese momento el payroll que resta queda fijo aunque se marque gente como pagada, porque
 * esa plata sale de estas mismas cuentas. Lo ya pagado se ve rayado, igual que lo gastado en anuncios.
 */
const fechaFoto = (iso) => {
    if (!iso) return 'Sin saldos';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `Saldos al ${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const EditorSaldos = ({ foto, gastadoPlataforma, onGuardar, onCerrar }) => {
    const inicial = () => {
        const c = foto?.accounts || {};
        return {
            ...Object.fromEntries(CUENTAS.map(([k, , , n]) => [k, Array.from({ length: n }, (_, i) => String((c[k] || [])[i] ?? 0).replace('.', ','))])),
            ads: String(foto?.ads_spent ?? gastadoPlataforma ?? 0).replace('.', ','),
            sig: Array.from({ length: 2 }, (_, i) => String((foto?.next_income || [])[i] ?? 0).replace('.', ',')),
        };
    };
    const [v, setV] = useState(inicial);
    const primero = useRef(null);
    useEffect(() => { primero.current?.focus(); primero.current?.select(); }, []);
    const poner = (k, i, x) => setV((s) => ({ ...s, [k]: Array.isArray(s[k]) ? s[k].map((y, j) => (j === i ? x : y)) : x }));
    const guardar = () => onGuardar({
        accounts: Object.fromEntries(CUENTAS.map(([k]) => [k, v[k].map(numero)])),
        ads_spent: numero(v.ads), next_income: v.sig.map(numero),
    });
    const fila = (k, l, c, vals, i0 = 0) => (
        <div className="se-r" style={{ '--c': c }}>
            <span>{l}</span>
            <div className="se-in">
                {vals.map((x, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <em>+</em>}
                        <label><i>$</i><input ref={k === 'mercury' && i === 0 && !i0 ? primero : undefined} inputMode="decimal" value={x}
                            aria-label={`${l}${vals.length > 1 ? ` ${i + 1}` : ''}`}
                            onChange={(e) => (Array.isArray(v[k]) ? poner(k, i, e.target.value) : setV((s) => ({ ...s, [k]: e.target.value })))} /></label>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
    return (
        <div className="saled" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } else if (e.key === 'Escape') onCerrar(); }}>
            <div className="se-g">
                {CUENTAS.map(([k, n, c]) => <React.Fragment key={k}>{fila(k, n, c, v[k])}</React.Fragment>)}
                <div className="se-sep" />
                {fila('ads', 'Anuncios gastado', 'var(--neu)', [v.ads])}
                {fila('sig', 'Mes siguiente', 'var(--mag)', v.sig)}
            </div>
            <div className="se-f">
                <button type="button" className="undo" onClick={onCerrar}>Cancelar</button>
                <button type="button" className="save" onClick={guardar}>Guardar saldos</button>
            </div>
        </div>
    );
};

const Liquidez = ({ app }) => {
    const [editando, setEditando] = useState(false);
    const [lq, setLq] = useState(1);
    const [w, setW] = useState(1);
    const presupuesto = app.anuncios?.budget || 0;
    const datos = profitDe({ personas: app.personas || [], foto: app.foto, presupuesto });
    const { liq, res, pro, mb } = datos;
    const cuentas = app.foto?.accounts || {};

    const shown = Math.min(res.length, Math.floor(lq * res.length + 1e-9));
    const part = lq * res.length - shown;
    let usado = 0;
    const seg = res.map((r, i) => {
        const f = i < shown ? 1 : i === shown ? part : 0;
        usado += r[1] * f;
        return [r[1] * f, r[2]];
    });
    const base = Math.max(liq, sum(res, (r) => r[1])) || 1;

    const animar = async () => {
        setLq(0); setW(0);
        await wait(250);
        await tween(900, setW);
        await wait(250);
        await tween(2200, setLq);
        setLq(1);
    };

    return (
        <section className="liq aura">
            <Humo />
            <div className="head" style={{ margin: 0 }}>
                <div><div className="eyebrow">Liquidez</div><h2>Lo que queda libre</h2></div>
                <div className="lqb">
                    {app.editable && (
                        <button type="button" className="salb" aria-expanded={editando} title="Actualizar saldos" onClick={() => setEditando((e) => !e)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>Saldos
                        </button>
                    )}
                    <BotonAnimar onAnimar={animar} auto={!!app.foto} />
                </div>
            </div>
            {editando && (
                <EditorSaldos foto={app.foto} gastadoPlataforma={app.anuncios?.spent}
                    onCerrar={() => setEditando(false)}
                    onGuardar={async (f) => { setEditando(false); await app.guardarFoto(f); }} />
            )}
            {!app.foto ? (
                <div className="vacio">{app.editable ? 'Cargá los saldos de las cuentas antes de pagar el payroll.' : 'Elegí un mes para ver la liquidez.'}</div>
            ) : (
                <div className="lgrid">
                    <div className="lbig">
                        <div className="l">Disponible</div>
                        <div className="n">{money(liq * w)}</div>
                        <div className="lbar">
                            {CUENTAS.flatMap(([k, n, c]) => (cuentas[k] || []).map((x, i) => (
                                <i key={`${k}${i}`} title={`${n} ${money(x)}`} style={{ width: `${liq ? (x / liq) * 100 * w : 0}%`, background: c }} />
                            )))}
                        </div>
                        <div className="lchips">
                            {CUENTAS.map(([k, n, c]) => <span key={k} className="lc" style={{ '--c': c }}>{n}<b>{money(sum(cuentas[k] || []))}</b></span>)}
                        </div>
                    </div>
                    <div className="lbig">
                        <div className="l">Profit</div>
                        <div className={`n ok${pro < 0 ? ' neg' : ''}`}>{money(r2(liq - usado))}</div>
                        <div className="lbar">
                            {[...seg, [Math.max(0, liq - usado), 'var(--ok)']].map(([x, c], i) => (
                                <i key={i} style={{ width: `${(x / base) * 100}%`, background: c }} />
                            ))}
                        </div>
                        <div className="wf">
                            {res.map(([n, x, c, ps], i) => (
                                <div key={n} className={`wr${i < shown || (i === shown && part > 0) ? '' : ' out'}`} style={{ '--c': c }}>
                                    <span>{n}</span>
                                    <div className="mb">{ps.map(([y, k, t], j) => <i key={j} className={k} title={t} style={{ width: `${mb ? (y / mb) * 100 : 0}%` }} />)}</div>
                                    <b>−{money(x)}</b>
                                </div>
                            ))}
                            <div className={`wr pf${lq < 1 ? ' out' : ''}`} style={{ '--c': 'var(--ok)' }}><span>Profit</span><div /><b className={pro < 0 ? 'neg' : undefined}>{money(pro)}</b></div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

const VistaProfit = ({ app }) => (
    <>
        <Titulo num="04" texto="Profit" chip={fechaFoto(app.foto?.taken_at)} />
        {app.foto === undefined || !app.personas ? <section className="card"><div className="vacio">Cargando…</div></section> : <Liquidez app={app} />}
    </>
);

export default VistaProfit;
