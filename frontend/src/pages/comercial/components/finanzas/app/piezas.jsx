import React, { useEffect, useRef, useState } from 'react';
import { money, pctDe } from './modelo';

/**
 * Las piezas visuales de la app de Finanzas: humo, números que cuentan, donas, barras y el botón
 * «Ver animado». Son las del artifact, en React; las animaciones de entrada son CSS (`fz-grow`,
 * `fz-seg`), así que cada gráfico se anima solo al montarse.
 */

const RM = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => 1 - Math.pow(1 - t, 3);
export const wait = (ms) => new Promise((r) => setTimeout(r, RM ? 0 : ms));
export const tween = (ms, fn) => new Promise((res) => {
    if (RM || !ms) { fn(1); res(); return; }
    const t0 = performance.now();
    const step = (now) => {
        const t = Math.max(0, Math.min(1, (now - t0) / ms));
        fn(ease(t));
        if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
});

export const Humo = ({ tam = 'mid' }) => (
    <div className={`humo ${tam}`} aria-hidden="true"><i /><i /><i /><i /></div>
);

/** Un monto que cuenta desde 0 hasta su valor cada vez que el valor cambia. */
export const Numero = ({ valor, dec = 0, className, signo = false }) => {
    const [v, setV] = useState(0);
    const ultimo = useRef(0);
    useEffect(() => {
        let vivo = true;
        const desde = ultimo.current;
        tween(900, (t) => { if (vivo) setV(desde + (valor - desde) * t); });
        ultimo.current = valor;
        return () => { vivo = false; };
    }, [valor]);
    const txt = money(Math.abs(v), dec);
    return <b className={className}>{signo && valor < 0 ? `−${txt}` : signo && valor > 0 ? `+${txt}` : money(v, dec)}</b>;
};

export const Anillo = ({ items, total, centro, sub }) => {
    let acc = 0;
    return (
        <div className="ring">
            <svg viewBox="0 0 42 42" aria-hidden="true">
                <circle cx="21" cy="21" r="17" pathLength="100" stroke="var(--off)" style={{ strokeWidth: 6 }} fill="none" />
                {items.map(([n, v, c], i) => {
                    const p = total ? (v / total) * 100 : 0, s = acc;
                    acc += p;
                    return (
                        <circle key={n} className="sg" cx="21" cy="21" r="17" pathLength="100" stroke={c} fill="none"
                            style={{ strokeWidth: 6, '--d': `${i * 0.12}s` }} strokeDasharray={`${Math.max(0, p - 0.6)} 100`}
                            strokeDashoffset={-s} />
                    );
                })}
            </svg>
            <div><Numero valor={centro} /><small>{sub}</small></div>
        </div>
    );
};

export const Leyenda = ({ items, total, pie = null }) => {
    const mx = Math.max(1, ...items.map((x) => x[1]));
    return (
        <div className="lg">
            {items.map(([n, v, c, s], i) => (
                <div key={n} className="li" style={{ '--c': c }}>
                    <span title={n}>{n}{s ? <small style={{ color: 'var(--meta)' }}> {s}</small> : null}</span>
                    <b>{money(v, 0)}</b><em>{pctDe(v, total)}%</em>
                    <div className="ln"><i className="grow" style={{ width: `${(v / mx) * 100}%`, '--d': `${0.1 + i * 0.08}s` }} /></div>
                </div>
            ))}
            {pie}
        </div>
    );
};

export const Barras = ({ items, unidad = (v) => money(v, 0) }) => {
    const mx = Math.max(1, ...items.map((x) => x[1]));
    return items.map(([n, v, c, s], i) => (
        <div key={n} className="hr" style={{ '--c': c }}>
            <div><b>{n}</b><small>{s || ''}</small></div>
            <div className="tr"><i className="grow" style={{ width: `${(v / mx) * 100}%`, '--d': `${i * 0.08}s` }} /></div>
            <b>{unidad(v)}</b>
        </div>
    ));
};

export const Apilada = ({ items, total }) => (
    <>
        <div className="tr">
            {items.map(([n, v, c], i) => (
                <i key={n} className="grow" title={`${n} ${money(v, 0)}`}
                    style={{ width: `${total ? (v / total) * 100 : 0}%`, background: c, '--d': `${i * 0.1}s` }} />
            ))}
        </div>
        <Leyenda items={items} total={total} />
    </>
);

/** «Ver animado»: corre `fn` una vez por clic; `auto` la corre sola la primera vez que se monta. */
export const BotonAnimar = ({ onAnimar, auto = false }) => {
    const [estado, setEstado] = useState('Ver animado');
    const ocupado = useRef(false);
    const correr = async () => {
        if (ocupado.current) return;
        ocupado.current = true;
        setEstado('Animando');
        try { await onAnimar(); } finally { ocupado.current = false; setEstado('Ver de nuevo'); }
    };
    useEffect(() => {
        if (!auto) return undefined;
        const t = setTimeout(correr, 400);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <button type="button" className="play" data-on={estado === 'Animando' ? 1 : 0} onClick={correr}>{estado}</button>;
};

/** Copiar al portapapeles: el ícono pasa a tilde verde, sin texto. */
export const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); return true; } catch {
        try {
            const t = document.createElement('textarea');
            t.value = texto; document.body.appendChild(t); t.select();
            const ok = document.execCommand('copy'); t.remove(); return ok;
        } catch { return false; }
    }
};

export const IconoCopiar = () => (
    <span className="cpi" aria-hidden="true">
        <svg className="i1" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
        <svg className="i2" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
);

/** El botón que copia `valor` y avisa con el ícono (clases `okd` / `err` del artifact). */
export const useCopiado = () => {
    const [marca, setMarca] = useState(null);
    const t = useRef(null);
    const hacer = async (valor) => {
        const ok = await copiar(valor);
        setMarca(ok ? 'okd' : 'err');
        clearTimeout(t.current);
        t.current = setTimeout(() => setMarca(null), 1600);
    };
    useEffect(() => () => clearTimeout(t.current), []);
    return [marca, hacer];
};

export const Titulo = ({ num, texto, chip = null }) => (
    <div className="vh">
        <h1 className="vt"><span className="vnum">{num}</span>{texto}</h1>
        {chip && <span className="vchip">{chip}</span>}
    </div>
);
