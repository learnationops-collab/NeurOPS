import React, { useEffect, useState } from 'react';
import { money, r2, resumenDe, sum } from './modelo';
import { useCopiado } from './piezas';

/**
 * Los ajustes de una persona: pagos que ya se le hicieron («Ya le pagué») y descuentos, cada uno con
 * su monto y una nota. Se guardan al salir del campo. A la derecha, lo que le corresponde, lo que ya
 * se le pagó y lo que falta, con el resumen para mandarle.
 */
const TIPOS = [['pago', 'Ya le pagué'], ['desc', 'Descuento']];

// «1.234,56», «1234.56» o «$ 754,95»: el número que quiso escribir.
export const numero = (v) => {
    let t = String(v).trim().replace(/[$\s]/g, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = parseFloat(t);
    return Number.isNaN(n) ? 0 : Math.max(0, r2(n));
};

const Resumen = ({ p, titulo }) => {
    const [marca, copiar] = useCopiado();
    const segs = [[p.trans, 'var(--ok)'], [p.desc, 'var(--bad)'], [p.falta, 'var(--amb)']];
    const tb = Math.max(p.tot, sum(segs, (s) => s[0])) || 1;
    return (
        <div className="pr2">
            <div className="sumr"><span>Le corresponde</span><b>{money(p.tot)}</b></div>
            {p.desc > 0 && <div className="sumr"><span>Descuentos</span><b className="neg">−{money(p.desc)}</b></div>}
            {p.trans > 0 && <div className="sumr"><span>Ya le pagué</span><b className="okc">−{money(p.trans)}</b></div>}
            <div className="sbar">{segs.map(([v, c], i) => <i key={i} style={{ width: `${(v / tb) * 100}%`, background: c }} />)}</div>
            <div className="sumr big"><span>{p.demas ? 'Le pagué de más' : 'Falta transferir'}</span><b>{money(p.demas || p.falta)}</b></div>
            <button type="button" className={`cpres cp${marca ? ` ${marca}` : ''}`} onClick={() => copiar(resumenDe(p, titulo))}>
                Copiar resumen para {p.n}
            </button>
        </div>
    );
};

const PanelAjustes = ({ p, titulo, onGuardar, editable }) => {
    const [movs, setMovs] = useState(p.mov);
    useEffect(() => { setMovs(p.mov); }, [p.mov]);
    const guardar = (lista) => {
        const limpia = lista.map((x) => ({ ...x, m: typeof x.m === 'number' ? x.m : numero(x.m) }));
        setMovs(lista);
        onGuardar(limpia);
    };
    const poner = (i, campo, valor) => setMovs((l) => l.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

    return (
        <div className="pan">
            <div className="pl">
                <div className="pt">Pagos y descuentos</div>
                {movs.map((x, i) => (
                    <div key={`${x.e}-${i}`} className="mv">
                        <button type="button" className={`mvt${x.t === 'desc' ? ' ds' : ''}`} disabled={!editable}
                            title="Cambiar entre pago y descuento"
                            onClick={() => guardar(movs.map((y, j) => (j === i ? { ...y, t: y.t === 'desc' ? 'pago' : 'desc' } : y)))}>
                            {TIPOS.find(([v]) => v === x.t)?.[1] || 'Ya le pagué'}
                        </button>
                        <label className="mm"><i>$</i>
                            <input inputMode="decimal" aria-label="Monto" disabled={!editable}
                                value={typeof x.m === 'number' ? String(x.m).replace('.', ',') : x.m}
                                onChange={(e) => poner(i, 'm', e.target.value)}
                                onBlur={(e) => guardar(movs.map((y, j) => (j === i ? { ...y, m: numero(e.target.value) } : y)))}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                        </label>
                        <input className="mn" placeholder="Nota" aria-label="Nota" maxLength={80} disabled={!editable}
                            value={x.n || ''} onChange={(e) => poner(i, 'n', e.target.value)} onBlur={() => guardar(movs)} />
                        <button type="button" className="mx" aria-label="Borrar" disabled={!editable}
                            onClick={() => guardar(movs.filter((_, j) => j !== i))}>×</button>
                    </div>
                ))}
                <div className="mvadd">
                    {TIPOS.map(([v, l]) => (
                        <button key={v} type="button" disabled={!editable}
                            onClick={() => setMovs((m) => [...m, { t: v, m: '', n: '', e: Date.now() }])}>+ {l}</button>
                    ))}
                </div>
            </div>
            <Resumen p={p} titulo={titulo} />
        </div>
    );
};

export default PanelAjustes;
