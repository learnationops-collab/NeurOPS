import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

/**
 * Piezas compartidas del dashboard comercial.
 *
 * Todas las cifras pasan por `fmt`: el diseño pide `tabular-nums` en TODAS y que un valor sin
 * denominador se muestre como "—" en vez de 0 (un "0% de show up" sobre cero llamadas con
 * resultado es una afirmación falsa, no un dato). El backend ya manda `null` en esos casos; acá
 * solo hay que no convertirlo en 0.
 */

export const fmt = {
    money: (v) => (v === null || v === undefined ? '—' : `$${Math.round(v).toLocaleString('en-US')}`),
    pct: (v) => (v === null || v === undefined ? '—' : `${v}%`),
    num: (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-US')),
    porFormato: (v, formato) => (formato === 'money' ? fmt.money(v) : formato === 'pct' ? fmt.pct(v) : fmt.num(v)),
    hora: (iso) => (iso ? iso.slice(11, 16) : ''),
    fecha: (iso) => {
        if (!iso) return '—';
        const [y, m, d] = iso.slice(0, 10).split('-');
        return `${d}/${m}`;
    },
    fechaLarga: (iso) => {
        if (!iso) return '';
        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
            'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const f = new Date(`${iso.slice(0, 10)}T12:00:00`);
        return `${dias[f.getDay()]} ${f.getDate()} de ${meses[f.getMonth()]}`;
    },
    iniciales: (nombre) => (nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase(),
    /** "1 venta" / "2 ventas": el plural a mano se notaba en cuanto un closer cerraba una sola. */
    plural: (n, singular, plural) => `${fmt.num(n)} ${n === 1 ? singular : plural}`,
};

export const tono = (t) => `var(--${t === 'brand' ? 'brand-secondary' : t})`;

/** Badge de variación vs el período comparado. Las tasas van en puntos y los montos en %. */
export const Delta = ({ delta }) => {
    if (!delta) return null;
    const sube = delta.valor >= 0;
    const unidad = delta.modo === 'pts' ? ' pts' : '%';
    return (
        <span className={`dc-delta ${sube ? 'dc-delta--up' : 'dc-delta--down'}`}>
            {sube ? '▲' : '▼'} {Math.abs(delta.valor)}{unidad}
        </span>
    );
};

/** Chip de estado con el tono que manda el backend (nunca uno elegido en el frontend). */
export const Chip = ({ chip, sm }) => {
    if (!chip) return null;
    return <span className={`ln-chip ln-chip--${chip.tone}${sm ? ' ln-chip--sm' : ''}`}>{chip.label}</span>;
};

/**
 * Ícono "i" con la explicación de la métrica. Si la burbuja no entra a la derecha se abre hacia
 * la izquierda — se mide contra el ancho de la ventana al abrirla, igual que el prototipo.
 */
export const Tip = ({ texto }) => {
    const [abierto, setAbierto] = useState(false);
    const [lado, setLado] = useState('right');
    const ref = useRef(null);

    const abrir = () => {
        if (ref.current) {
            const { left } = ref.current.getBoundingClientRect();
            setLado(left + 258 > window.innerWidth - 16 ? 'left' : 'right');
        }
        setAbierto(true);
    };

    if (!texto) return null;
    return (
        <span className="dc-tip-wrap" ref={ref} onMouseEnter={abrir} onMouseLeave={() => setAbierto(false)}>
            <span className="dc-tip-dot">i</span>
            {abierto && <span className={`dc-tip dc-tip--${lado}`}>{texto}</span>}
        </span>
    );
};

/** Cabecera de tarjeta: eyebrow + tooltip a la izquierda, lo que le pasen a la derecha. */
export const CardHead = ({ titulo, tip, children }) => (
    <div className="dc-card-head">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dc-eyebrow">{titulo}</span>
            <Tip texto={tip} />
        </span>
        {children}
    </div>
);

/** Tabs segmentadas blancas. El mismo patrón que el selector de métrica y el cierre del reporte. */
export const Segmented = ({ opciones, valor, onChange, ariaLabel }) => (
    <div className="dc-seg" role="tablist" aria-label={ariaLabel}>
        {opciones.map(o => (
            <button key={o.key} type="button" role="tab" aria-selected={valor === o.key}
                className="dc-seg-tab" onClick={() => onChange(o.key)}>
                {o.label}
            </button>
        ))}
    </div>
);

/** Píldora del header con su menú. Se cierra al elegir o al clickear afuera. */
export const PillMenu = ({ icono, texto, detalle, opciones, valor, onChange, ancho }) => {
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto]);

    return (
        <div className="dc-pop-wrap" ref={ref}>
            <button type="button" className="dc-pill" onClick={() => setAbierto(a => !a)}>
                {icono}
                <span>{texto}</span>
                {detalle && <span className="ln-muted-40" style={{ fontSize: 12 }}>{detalle}</span>}
                <ChevronDown size={14} />
            </button>
            {abierto && (
                <div className="dc-pop" style={ancho ? { minWidth: ancho } : undefined}>
                    {opciones.map(o => (
                        <button key={o.key} type="button" className="dc-pop-item" aria-selected={valor === o.key}
                            onClick={() => { onChange(o.key); setAbierto(false); }}>
                            <span>{o.label}</span>
                            {valor === o.key && <Check size={14} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const Cargando = ({ texto = 'Cargando…' }) => (
    <div className="dc-loading"><Loader2 size={18} className="dc-spin" /> {texto}</div>
);

/** Barra que anima de 0 al valor al montar (.9s, la curva del diseño). */
export const useMontado = () => {
    const [montado, setMontado] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMontado(true));
        return () => cancelAnimationFrame(id);
    }, []);
    return montado;
};

export const Barra = ({ valor, color = 'var(--brand-secondary)' }) => {
    const montado = useMontado();
    return (
        <div className="dc-bar">
            <div className="dc-bar-fill"
                style={{ width: montado ? `${Math.max(0, Math.min(100, valor || 0))}%` : 0, background: color }} />
        </div>
    );
};
