import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Tip from './Tip';
import { Esqueleto, Hueso } from '../../../components/huesos/Huesos';

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

/**
 * Isotipo de Learnation, con el degradado de marca. Lo firman el header del dashboard y el del
 * espacio del setter; `idGrad` existe porque un `id` repetido en la página hace que el segundo
 * SVG tome el degradado del primero.
 */
export const Isotipo = ({ idGrad = 'lnGrad' }) => (
    <svg width="36" height="36" viewBox="0 0 100 100" role="img" aria-label="Learnation">
        <defs>
            <linearGradient id={idGrad} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--brand-secondary)" />
                <stop offset="100%" stopColor="var(--brand-secondary-light)" />
            </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" rx="26" fill={`url(#${idGrad})`} />
        <g fill="#FFFFFF" stroke="#FFFFFF">
            <path d="M49 18 L23 44 L23 83 L77 83 L77 61 L49 61 Z" strokeWidth="5" strokeLinejoin="round" />
            <path d="M23 18 L42 18 L23 37 Z" strokeWidth="5" strokeLinejoin="round" />
        </g>
    </svg>
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

// El ícono "i" se fue a `Tip.jsx` cuando la burbuja pasó a dibujarse en un portal (acá se elegía
// el lado a ojo contra un ancho de 288 fijo y aun así se cortaba). Se re-exporta porque las cuatro
// secciones lo importan por este camino.
export { Tip };

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

/**
 * Lo que se ve mientras el tablero carga: la forma de los cuatro KPIs y de los paneles que vienen
 * abajo, no un círculo girando.
 *
 * El spinner que había acá tenía un `min-height` fijo de 240 px, así que al llegar los datos la
 * página crecía de golpe y todo lo de abajo saltaba. El esqueleto ocupa el lugar real: los KPIs
 * con el alto de la cifra, los paneles con el alto de sus filas.
 */
const HuesoPanel = ({ paso = 0, lineas = 5, alto = 26 }) => (
    <section className="panel" aria-hidden="true">
        <div className="panel-cab"><Hueso alto={12} ancho={150} paso={paso} /></div>
        <div className="huesos">
            {Array.from({ length: lineas }, (_, i) => (
                <Hueso key={i} alto={alto} paso={paso + i + 1} />
            ))}
        </div>
    </section>
);

/** El esqueleto de una sección entera. `alto` es para las que no son filas: una curva es un solo
 *  bloque alto, y dibujarla como seis renglones prometería una tabla que no viene. */
export const EsqueletoPanel = ({ rotulo = 'Cargando…', lineas = 6, alto }) => (
    <Esqueleto rotulo={rotulo}><HuesoPanel lineas={lineas} alto={alto} /></Esqueleto>
);

/** Huesos sueltos, sin caja: para cuando el esqueleto va DENTRO de un panel que ya está dibujado
 *  (si no, la caja quedaba anidada y se veían dos bordes). */
export const EsqueletoFilas = ({ rotulo = 'Cargando…', lineas = 5, alto = 26 }) => (
    <Esqueleto rotulo={rotulo} className="huesos">
        {Array.from({ length: lineas }, (_, i) => <Hueso key={i} alto={alto} paso={i} />)}
    </Esqueleto>
);

export const EsqueletoTablero = ({ rotulo = 'Cargando el tablero…' }) => (
    <Esqueleto rotulo={rotulo} style={{ display: 'grid', gap: 'var(--s4)' }}>
        <div className="grid grid--4">
            {[0, 1, 2, 3].map(i => (
                <section key={i} className="kpi" aria-hidden="true">
                    <Hueso alto={10} ancho="48%" paso={i} />
                    {/* 34 px es el alto de `.kpi-n`: el hueso de la cifra tiene que medir lo que
                        va a medir la cifra, o el KPI cambia de alto al llegar el número. */}
                    <Hueso alto={34} ancho="72%" paso={i + 1} style={{ marginTop: 'var(--s4)' }} />
                    <Hueso alto={10} ancho="60%" paso={i + 2} style={{ marginTop: 'var(--s3)' }} />
                </section>
            ))}
        </div>
        <div className="grid-2">
            <HuesoPanel paso={4} />
            <HuesoPanel paso={5} />
        </div>
    </Esqueleto>
);

/** Igual, más la barra del header: es lo que se dibuja antes de saber quién es el que mira. */
export const EsqueletoPagina = ({ rotulo = 'Abriendo el dashboard…' }) => (
    <div style={{ display: 'grid', gap: 'var(--s5)' }}>
        <div className="fila" style={{ gap: 'var(--s2)' }} aria-hidden="true">
            <Hueso alto={32} ancho={190} radio="var(--radius-pill)" />
            <Hueso alto={32} ancho={150} radio="var(--radius-pill)" paso={1} />
            <Hueso alto={32} ancho={120} radio="var(--radius-pill)" paso={2} />
        </div>
        <EsqueletoTablero rotulo={rotulo} />
    </div>
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
