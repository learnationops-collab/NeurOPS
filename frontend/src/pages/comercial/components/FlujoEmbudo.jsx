import React, { useLayoutEffect, useRef, useState } from 'react';
import Cifra from './Cifra';
import { fmt, useMontado } from './Shared';
import './flujo.css';

/**
 * Embudo horizontal en el lenguaje del reporte diario nuevo de los setters (el artifact que aprobó
 * Kerwin el 10/10/2026, `flujo()`/`moverFlujo()`): una barra por etapa, una banda que une cada barra
 * con la siguiente y, en el medio de la banda, una píldora con la conversión.
 *
 *   <FlujoEmbudo etapas={[{ key, label, n, partes?, color?, cruce?, ir?, ayuda? }]} max={...} />
 *
 * - `n` es el conteo de la etapa; `partes` ([{ key, n, color }]) la parte en tramos apilados del
 *   mismo alto total (las agendas por canal). Las partes tienen que sumar `n`.
 * - `max` es la escala: el valor que llena el alto entero. Por defecto, la etapa más grande; varios
 *   embudos que se comparan (los setters de Comparativas) reciben el MISMO `max`.
 * - La píldora de cada banda es la etapa sobre la anterior. `cruce` marca la etapa donde cambia la
 *   fuente (del reporte al sistema): ahí la píldora no es una conversión sino cuánto registra el
 *   sistema de lo que se reportó, y se dibuja punteada. Arriba de 100% va en ámbar, como en el
 *   formulario: casi siempre es un número que no cuadra.
 * - `ir` hace la etapa cliqueable (el drill-down a su lista).
 *
 * Mide su ancho y dibuja el SVG a escala 1:1 (1 unidad = 1 px), así los textos nunca se achican.
 * Cuando las etapas no entran con sus rótulos —un teléfono, una columna angosta— se apila: una fila
 * por etapa con la barra horizontal centrada y la banda entre filas, que es el mismo dibujo girado.
 *
 * Las barras crecen desde cero al montar (transiciones CSS, ver flujo.css); con movimiento reducido
 * el reset de `.dc-shell` las deja quietas en su valor.
 */

const MX = 30;                 // margen lateral: los números de las puntas se salen de su barra
const ALTO_MAX = 88;           // alto de la barra más grande
const ARRIBA = 30;             // lugar para el número arriba de la barra
const CON_ROTULOS = 26;        // lugar para el rótulo abajo
const PILDORA = { alto: 22, ancho: 44 };
const ANCHO_SUPUESTO = 960;    // sin medida (jsdom, primer cuadro)

/** El ancho de un elemento, al día con su contenedor. 0 hasta la primera medida. */
export const useAncho = () => {
    const ref = useRef(null);
    const [ancho, setAncho] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const medir = () => setAncho(Math.round(el.getBoundingClientRect().width));
        medir();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, ancho];
};

/** Etapa sobre la anterior, en %, o null sin denominador. */
export const conversion = (n, anterior) => (anterior ? Math.round((n / anterior) * 1000) / 10 : null);

const textoPildora = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);

const tituloPildora = (etapa, anterior, v) => (etapa.cruce
    ? `${etapa.label}: el sistema registra ${fmt.num(etapa.n)} y se reportaron ${fmt.num(anterior.n)}`
    : `${etapa.label}: ${textoPildora(v)} de ${anterior.label.toLowerCase()} (${fmt.num(etapa.n)} de ${fmt.num(anterior.n)})`);

const clasePildora = (etapa, v) => ['flj-pildora', etapa.cruce && 'flj-pildora--cruce',
    v !== null && v > 100 && 'flj-pildora--alta'].filter(Boolean).join(' ');

/** Cuánto ancho necesita cada etapa para que su rótulo no pise al de al lado. */
const geometria = (ancho, n, rotulos) => {
    // Con pocas etapas, barras anchas (las del artifact miden 64); con nueve, más finas.
    const anchoBarra = Math.max(24, Math.min(64, Math.round(ancho / (Math.max(n, 1) * 2.6))));
    const hueco = n > 1 ? (ancho - 2 * MX - n * anchoBarra) / (n - 1) : 0;
    const entra = n < 2 || (hueco >= PILDORA.ancho + 6 && anchoBarra + hueco >= (rotulos ? 100 : 64));
    return { anchoBarra, hueco, entra };
};

const accion = (etapa) => (etapa.ir ? {
    role: 'button', tabIndex: 0, 'aria-label': `Ver la lista: ${etapa.label}, ${fmt.num(etapa.n)}`,
    onClick: etapa.ir,
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); etapa.ir(); } },
} : {});

const Horizontal = ({ etapas, escala, ancho, rotulos, bandas, color, montado }) => {
    const n = etapas.length;
    const { anchoBarra: fb, hueco: fg } = geometria(ancho, n, rotulos);
    const alto = ARRIBA + ALTO_MAX + (rotulos ? CON_ROTULOS : 6);
    const cy = ARRIBA + ALTO_MAX / 2;
    const altoDe = (v) => Math.max(2, escala ? (v / escala) * ALTO_MAX : 0);
    const x = (i) => MX + i * (fb + fg);
    return (
        <svg className="flj-svg" width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="group"
            aria-label={etapas.map(e => `${e.label} ${fmt.num(e.n)}`).join(', ')}>
            {bandas && etapas.slice(1).map((e, j) => {
                const i = j + 1, a = altoDe(etapas[i - 1].n) / 2, b = altoDe(e.n) / 2;
                const x1 = x(i - 1) + fb, x2 = x(i), xm = (x1 + x2) / 2;
                return (
                    <path key={`b-${e.key}`} className={`flj-banda${montado ? ' on' : ''}`}
                        style={{ '--c': e.color || color, transitionDelay: `${200 + i * 70}ms` }}
                        d={`M${x1},${cy - a} C${xm},${cy - a} ${xm},${cy - b} ${x2},${cy - b} L${x2},${cy + b} `
                            + `C${xm},${cy + b} ${xm},${cy + a} ${x1},${cy + a} Z`} />
                );
            })}
            {etapas.map((e, i) => {
                const t = altoDe(e.n), y0 = cy - t / 2, cx = x(i) + fb / 2;
                let acum = y0;
                const tramos = e.partes?.filter(p => p.n > 0) || [];
                return (
                    <g key={e.key} className={`flj-etapa${e.ir ? ' flj-etapa--ir' : ''}`} {...accion(e)}>
                        {e.ayuda && <title>{e.ayuda}</title>}
                        <g className={`flj-barra${montado ? ' on' : ''}`} style={{ transitionDelay: `${i * 60}ms` }}>
                            {tramos.length > 1 ? tramos.map(p => {
                                const h = (p.n / e.n) * t, y = acum;
                                acum += h;
                                return <rect key={p.key} x={x(i)} y={y} width={fb} height={h} style={{ fill: p.color }} />;
                            }) : (
                                <rect x={x(i)} y={y0} width={fb} height={t} rx={Math.min(10, t / 2)}
                                    style={{ fill: tramos[0]?.color || e.color || color }} />
                            )}
                        </g>
                        <text className="flj-valor" x={cx} y={y0 - 9} textAnchor="middle">
                            <Cifra tag="tspan" valor={fmt.num(e.n)} />
                        </text>
                        {rotulos && (
                            <text className="flj-rotulo" x={cx} y={alto - 8} textAnchor="middle">{e.label.toUpperCase()}</text>
                        )}
                    </g>
                );
            })}
            {bandas && etapas.slice(1).map((e, j) => {
                const i = j + 1, v = conversion(e.n, etapas[i - 1].n);
                const cx = x(i) - fg / 2;
                return (
                    <g key={`p-${e.key}`} className={`${clasePildora(e, v)}${montado ? ' on' : ''}`}
                        style={{ '--c': e.color || color, transitionDelay: `${380 + i * 70}ms` }}>
                        <title>{tituloPildora(e, etapas[i - 1], v)}</title>
                        <rect x={cx - PILDORA.ancho / 2} y={cy - PILDORA.alto / 2} width={PILDORA.ancho}
                            height={PILDORA.alto} rx={PILDORA.alto / 2} />
                        <text x={cx} y={cy + 4} textAnchor="middle">{textoPildora(v)}</text>
                    </g>
                );
            })}
        </svg>
    );
};

/** El mismo embudo girado: una fila por etapa, la barra centrada en su pista. */
const Vertical = ({ etapas, escala, bandas, color, montado }) => {
    const pct = (v) => Math.max(2, escala ? (v / escala) * 100 : 0);
    return (
        <div className="flj-v" role="list">
            {etapas.map((e, i) => {
                const anterior = etapas[i - 1];
                const v = anterior ? conversion(e.n, anterior.n) : null;
                const tramos = e.partes?.filter(p => p.n > 0) || [];
                const a = anterior ? pct(anterior.n) : 0, b = pct(e.n);
                return (
                    <React.Fragment key={e.key}>
                        {anterior && bandas && (
                            <div className="flj-v-entre" aria-hidden="true">
                                <span />
                                <span className="flj-v-banda">
                                    <svg viewBox="0 0 100 10" preserveAspectRatio="none">
                                        <path className={`flj-banda${montado ? ' on' : ''}`} style={{ '--c': e.color || color }}
                                            d={`M${50 - a / 2},0 L${50 + a / 2},0 L${50 + b / 2},10 L${50 - b / 2},10 Z`} />
                                    </svg>
                                    <span className={`${clasePildora(e, v)}${montado ? ' on' : ''}`}
                                        style={{ '--c': e.color || color }} title={tituloPildora(e, anterior, v)}>
                                        {textoPildora(v)}
                                    </span>
                                </span>
                                <span />
                            </div>
                        )}
                        <div className="flj-v-fila" role="listitem" title={e.ayuda || undefined}>
                            {e.ir ? (
                                <button type="button" className="flj-v-rotulo flj-v-rotulo--ir" onClick={e.ir}
                                    aria-label={`Ver la lista: ${e.label}, ${fmt.num(e.n)}`}>{e.label}</button>
                            ) : <span className="flj-v-rotulo">{e.label}</span>}
                            <span className="flj-v-pista">
                                <span className={`flj-v-barra${montado ? ' on' : ''}`}
                                    style={{ width: `${b}%`, transitionDelay: `${i * 50}ms` }}>
                                    {tramos.length > 1 ? tramos.map(p => (
                                        <i key={p.key} style={{ flexGrow: p.n, background: p.color }} />
                                    )) : <i style={{ flexGrow: 1, background: tramos[0]?.color || e.color || color }} />}
                                </span>
                            </span>
                            <Cifra className="flj-v-n num" valor={fmt.num(e.n)} />
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const FlujoEmbudo = ({ etapas, max, color = 'var(--ch-tot)', bandas = true, rotulos = true, apilar = null }) => {
    const [ref, medido] = useAncho();
    const montado = useMontado();
    const ancho = medido || ANCHO_SUPUESTO;
    const escala = max ?? Math.max(1, ...etapas.map(e => e.n || 0));
    const vertical = apilar ?? !geometria(ancho, etapas.length, rotulos).entra;
    return (
        <div ref={ref} className={`flj${vertical ? ' flj--v' : ''}`} style={{ '--c': color }}>
            {vertical
                ? <Vertical etapas={etapas} escala={escala} bandas={bandas} color={color} montado={montado} />
                : <Horizontal etapas={etapas} escala={escala} ancho={ancho} rotulos={rotulos} bandas={bandas}
                    color={color} montado={montado} />}
        </div>
    );
};

export default FlujoEmbudo;
