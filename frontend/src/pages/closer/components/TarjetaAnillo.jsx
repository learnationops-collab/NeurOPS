// Tarjeta chica del sidebar del Workspace (25/11/2026): un anillo que se llena con el porcentaje, la
// cuenta («7/11») y la racha. Reemplaza a la tarjeta ancha con barra y dos renglones de texto.
import { useEffect, useState } from 'react';

const R = 26, VUELTA = 2 * Math.PI * R;

// Cuenta de 0 al valor al aparecer o cambiar (respeta reduced-motion).
function useCuenta(valor) {
    const [v, setV] = useState(0);
    useEffect(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(valor); return undefined; }
        let raf, t0;
        const paso = (t) => {
            if (t0 == null) t0 = t;
            const p = Math.min(1, (t - t0) / 900);
            setV(Math.round(valor * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(raf);
    }, [valor]);
    return v;
}

export default function TarjetaAnillo({ rotulo, pct, cuenta, racha, chips = [] }) {
    const n = useCuenta(pct);
    return (
        <div className="tud-v6 ws-anillo">
            <div className="ws-anillo__fila">
                <svg className="ws-anillo__svg" viewBox="0 0 64 64" aria-hidden="true">
                    <defs>
                        <linearGradient id="ws-anillo-g" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="var(--cl-magenta, #FF3FA4)" />
                            <stop offset="1" stopColor="var(--cl-lila, #7D8BFF)" />
                        </linearGradient>
                    </defs>
                    <circle cx="32" cy="32" r={R} className="ws-anillo__pista" />
                    <circle cx="32" cy="32" r={R} className="ws-anillo__arco" stroke="url(#ws-anillo-g)" style={{ '--vuelta': VUELTA }}
                        strokeDasharray={VUELTA} strokeDashoffset={VUELTA * (1 - Math.min(100, pct) / 100)} />
                </svg>
                <span className="ws-anillo__pct">{n}<small>%</small></span>
                <div className="ws-anillo__txt">
                    <span className="tud-lbl-v6">{rotulo}</span>
                    {cuenta && <b>{cuenta}</b>}
                    {racha != null && <span className="ws-racha" title={`Racha de ${racha} ${racha === 1 ? 'día' : 'días'}`}>🔥 {racha} d</span>}
                </div>
            </div>
            {chips.length > 0 && (
                <div className="ws-chips">
                    {chips.map((c, i) => <span key={c.k} className="ws-chip" data-tipo={c.tipo} style={{ animationDelay: `${300 + i * 60}ms` }} title={c.title}>{c.t}</span>)}
                </div>
            )}
        </div>
    );
}
