import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

/**
 * Piezas compartidas del dashboard comercial.
 *
 * El marcado usa las clases de la referencia visual (`.pastilla`, `.menu`, `.tabs`, `.tip`,
 * `.delta`, `.chip`, `.riel`, `.panel-cab`, `.t-*`). Las `.dc-*` de la primera versión dejaron de
 * existir cuando el CSS del tablero se rehízo sobre la referencia: como estas piezas las usan las
 * cuatro secciones, migrarlas acá arregla el header, los tooltips, los deltas y los chips de todas
 * de una sola vez.
 *
 * Convención de la referencia: **el color de un dato se pasa con la custom property `--c`**, no
 * con una clase por tono. Por eso `Chip` y `Delta` escriben `style={{ '--c': ... }}` en vez de
 * `--success`/`--error` en el nombre de la clase.
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
        const [, m, d] = iso.slice(0, 10).split('-');
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

/**
 * El "humo": cuatro auras desenfocadas que se mueven despacio detrás de una superficie. Es
 * decorativo — ningún dato adentro — y se apaga solo con `prefers-reduced-motion`.
 *
 * Va dentro de un elemento con `.caja`, que es lo que crea el contexto de apilamiento; sin esa
 * clase el humo se dibuja por encima del contenido. `tarjeta` usa el desenfoque grande de la
 * referencia (`.humo--tarjeta`), para cuando el fondo es una tarjeta y no una barra.
 *
 * Vive acá y no en cada sección porque estaba copiado en `DashboardComercial` y en `Analizar`
 * con dos implementaciones distintas del mismo `style`, y Variabilidad iba a ser la tercera.
 */
export const Humo = ({ colores = [], clase, tarjeta }) => (
    <span className={`humo${tarjeta ? ' humo--tarjeta' : ''}${clase ? ` ${clase}` : ''}`}
        aria-hidden="true"
        style={Object.fromEntries(colores.map((c, i) => [`--h${i + 1}`, c]))}>
        <i /><i /><i /><i />
    </span>
);

/** Badge de variación vs el período comparado. Las tasas van en puntos y los montos en %. */
export const Delta = ({ delta, grande }) => {
    if (!delta) return null;
    const sube = delta.valor >= 0;
    const unidad = delta.modo === 'pts' ? ' pts' : '%';
    return (
        <span className={`delta${grande ? ' delta--g' : ''}`}
            style={{ '--c': `var(--${sube ? 'success' : 'error'})` }}>
            {sube ? '▲' : '▼'} {Math.abs(delta.valor)}{unidad}
        </span>
    );
};

/** Chip de estado con el tono que manda el backend (nunca uno elegido en el frontend). */
export const Chip = ({ chip }) => {
    if (!chip) return null;
    return <span className="chip" style={{ '--c': `var(--${chip.tone})` }}>{chip.label}</span>;
};

/**
 * Ícono "i" con la explicación de la métrica.
 *
 * El globo se muestra por CSS (`:hover`/`:focus-within`), como en la referencia: no hace falta
 * estado de React para algo que el navegador ya sabe hacer. Lo único que sí se calcula es de qué
 * lado abrirlo, porque contra el borde derecho de la ventana se cortaba.
 */
export const Tip = ({ texto, titulo }) => {
    const [derecha, setDerecha] = useState(false);
    const ref = useRef(null);

    const decidirLado = () => {
        if (!ref.current) return;
        const { left } = ref.current.getBoundingClientRect();
        setDerecha(left + 288 > window.innerWidth - 16);
    };

    if (!texto) return null;
    return (
        <span ref={ref} className={`tip${derecha ? ' tip--der' : ''}`} tabIndex={0} role="note"
            aria-label={`${titulo ? `${titulo}: ` : ''}${texto}`}
            onMouseEnter={decidirLado} onFocus={decidirLado}>
            <span className="tip-dot" aria-hidden="true">i</span>
            <span className="tip-burbuja" aria-hidden="true">
                {titulo && <b>{titulo}</b>}
                {texto}
            </span>
        </span>
    );
};

/** Cabecera de panel: título + tooltip a la izquierda, lo que le pasen a la derecha. */
export const PanelCab = ({ titulo, tip, children, eyebrow }) => (
    <div className="panel-cab">
        {eyebrow
            ? <p className="t-eyebrow">{titulo}</p>
            : <h2 className="t-h3">{titulo}</h2>}
        <Tip texto={tip} titulo={titulo} />
        {children && <div className="panel-cab-der">{children}</div>}
    </div>
);

/** Se mantiene el nombre viejo como alias: lo importan varias secciones. */
export const CardHead = ({ titulo, tip, children }) => (
    <PanelCab titulo={titulo} tip={tip} eyebrow>{children}</PanelCab>
);

/**
 * Pestañas segmentadas. `chico` usa la variante `tab--sm` de la referencia, para cuando el
 * selector vive dentro de la cabecera de una tarjeta y 36px de alto la agrandan demasiado.
 */
export const Segmented = ({ opciones, valor, onChange, ariaLabel, chico }) => (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
        {opciones.map(o => (
            <button key={o.key} type="button" role="tab" aria-selected={valor === o.key}
                className={`tab${chico ? ' tab--sm' : ''}`} onClick={() => onChange(o.key)}>
                {o.label}
            </button>
        ))}
    </div>
);

const ariaLabel_ = (texto) => `Opciones de ${String(texto || '').toLowerCase()}`;

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
        <div style={{ position: 'relative' }} ref={ref}>
            <button type="button" className={`pastilla${abierto ? ' pastilla--on' : ''}`}
                aria-expanded={abierto} aria-haspopup="true" onClick={() => setAbierto(a => !a)}>
                {icono}
                <span className="trunc">{texto}</span>
                {detalle && <span className="mut40 num" style={{ fontSize: 11.5 }}>{detalle}</span>}
                <ChevronDown size={14} />
            </button>
            {abierto && (
                <div className="menu menu--der" role="menu" aria-label={ariaLabel_(texto)}
                    style={ancho ? { minWidth: ancho } : undefined}>
                    {opciones.map(o => (
                        <button key={o.key} type="button" className="menu-item" role="menuitemradio"
                            aria-checked={valor === o.key}
                            onClick={() => { onChange(o.key); setAbierto(false); }}>
                            <span className="trunc">{o.label}</span>
                            {valor === o.key && <Check size={13} style={{ marginLeft: 'auto' }} />}
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

/** Barra que anima de 0 al valor al montar (1s, la curva `--crecer` del diseño). */
export const useMontado = () => {
    const [montado, setMontado] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMontado(true));
        return () => cancelAnimationFrame(id);
    }, []);
    return montado;
};

export const Barra = ({ valor, color = 'var(--brand-secondary)', fino }) => {
    const montado = useMontado();
    return (
        <span className={`riel${fino ? ' riel--fino' : ''}`}>
            <i style={{ width: montado ? `${Math.max(0, Math.min(100, valor || 0))}%` : 0, background: color }} />
        </span>
    );
};
