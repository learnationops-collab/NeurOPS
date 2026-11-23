// Piezas visuales del reporte: cabecera de tarjeta, KPI con delta, sparkline, barra de meta y anillo.
import { useId } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import Exp from './Exp';
import { Cuenta, useCuenta, useLleno } from './animar';
import { plano } from './formato';

export function CabCard({ n, titulo, ok, warn = false, children }) {
    return (
        <div className="rp-card__cab">
            <span className={clsx('rp-card__n', ok ? 'ok' : warn && 'warn')}>{ok ? <Check size={14} strokeWidth={3} /> : n}</span>
            <h3>{titulo}</h3>
            {children}
        </div>
    );
}

export function Delta({ v, prom, menos = false, txt }) {
    if (v == null || prom == null) return null;
    const dif = v - prom, bien = menos ? dif < 0 : dif > 0, pct = prom ? Math.round(Math.abs(dif) / prom * 100) : 0;
    const cls = Math.abs(dif) < 0.05 * (prom || 1) ? 'igual' : bien ? 'sube' : 'baja';
    return (
        <span className={`rp-k__delta ${cls}`}>
            {cls === 'igual' ? '= como siempre' : (dif > 0 ? '▲ ' : '▼ ') + pct + '%'} <span>{txt}</span>
        </span>
    );
}

export function Spark({ serie }) {
    const id = useId().replace(/:/g, '');
    const vals = (serie || []).filter((x) => x != null);
    if (vals.length < 2) return null;
    const w = 160, h = 40, max = Math.max(...vals), min = Math.min(...vals), r = max - min || 1;
    const pts = vals.map((v, i) => [3 + i * (w - 6) / (vals.length - 1), 4 + (h - 8) * (1 - (v - min) / r)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const [lx, ly] = pts[pts.length - 1];
    return (
        <svg className="rp-k__viz rp-spark" viewBox={`0 0 ${w} ${h + 6}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--rp-acento)" /><stop offset="1" stopColor="var(--rp-acento)" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path className="area" d={`${d} L ${lx} ${h + 6} L 3 ${h + 6} Z`} fill={`url(#g${id})`} />
            <path className="linea" d={d} style={{ '--l': 400 }} vectorEffect="non-scaling-stroke" />
            <circle cx={lx} cy={ly} />
        </svg>
    );
}

export function MetaBar({ v, meta, txt }) {
    const lleno = useLleno();
    const p = meta ? Math.min(1, (v || 0) / meta) : 0;
    return (
        <div className="rp-meta">
            <div className="rp-meta__b"><i className={p >= 1 ? 'lleno' : ''} style={{ width: lleno ? `${(p * 100).toFixed(0)}%` : 0 }} /></div>
            <small>{txt}</small>
        </div>
    );
}

export function Anillo({ pct, k = 0 }) {
    const lleno = useLleno();
    const n = useCuenta(pct, k * 40);
    const c = 2 * Math.PI * 30, off = c * (1 - Math.min(100, Math.max(0, pct || 0)) / 100);
    return (
        <svg className="rp-anillo" viewBox="0 0 74 74" aria-hidden="true">
            <circle className="fondo" cx="37" cy="37" r="30" />
            <circle className="valor" cx="37" cy="37" r="30"
                style={{ '--c': c.toFixed(1), transitionDelay: `${300 + k * 90}ms`, strokeDashoffset: lleno ? off.toFixed(1) : c.toFixed(1) }} />
            <text x="37" y="37">{pct == null ? '—' : `${Math.round(n)}%`}</text>
        </svg>
    );
}

// Tarjeta KPI: rótulo, valor que cuenta, delta y, debajo, barra de meta o sparkline.
export function Kpi({ k, dato, txtDelta, sufijo, children, fecha }) {
    const { l, v, f = 'n', prom, meta, spark, menos } = dato;
    return (
        <Exp className="rp-k" style={{ animationDelay: `${k * 90}ms` }} dato={{ ...dato, fecha }}>
            <span className="rp-k__lbl">{l}</span>
            <span className="rp-k__val"><Cuenta v={v} f={f} delay={k * 40} />{sufijo}</span>
            <Delta v={v} prom={prom} menos={menos} txt={txtDelta} />
            {children}
            {!children && meta != null && <MetaBar v={v} meta={meta} txt={`${Math.round(Math.min(1, (v || 0) / meta) * 100)}% de la meta (${plano(meta, f)})`} />}
            {!children && meta == null && spark && <Spark serie={spark} />}
        </Exp>
    );
}
