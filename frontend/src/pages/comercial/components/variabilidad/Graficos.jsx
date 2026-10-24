import React from 'react';
import { fmt } from '../Shared';
import { diaCorto, valorDe } from './formato';

/**
 * Las tres vistas de una serie —barras, curva y mapa— con las capas encima.
 *
 * `ex` es lo que traen las capas, ya calculado por el panel: `ref` (la serie contra la que se
 * compara, alineada día por día), `banda` (media y banda normal), `mm` (media móvil), `marcas`
 * (`{índice: 'pico' | 'caida' | 'cero'}`), `apilar` (las personas de cada barra, en las barras
 * apiladas), `foco` (el día elegido). Sin capas `ex` viene vacío y se dibuja la serie de siempre.
 *
 * Cada vista tiene su escala: `tope` es el máximo COMÚN de la serie y de la referencia, para que la
 * línea de comparación y las barras se lean contra el mismo eje; `max` es el de la serie sola (el
 * pico que se destaca).
 */

const PALETA = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'warning', 'info'];
export const colorDePersona = (p, i) => (p.otros ? 'idle' : PALETA[i % PALETA.length]);

const GLIFO = { pico: '▲', caida: '▼', cero: '○' };
const TEXTO = { pico: 'pico', caida: 'caída', cero: 'sin movimiento' };

/**
 * El eje rotula uno de cada cuatro días. Con un mes entero, rotular todos deja una tira de
 * números ilegible, y rotular solo el primero y el último obliga a contar celdas para ubicarse.
 */
const Eje = ({ dias }) => (
    <div className="serie-eje">
        {dias.map((d, i) => <span key={d}>{i % 4 === 0 ? diaCorto(d) : ''}</span>)}
    </div>
);

/** Una polilínea por tramo: un día que el otro período no tiene corta la línea, no la baja a cero. */
const tramos = (vals, x, y) => {
    const salida = [];
    let actual = [];
    vals.forEach((v, i) => {
        if (v === null || v === undefined) {
            if (actual.length) salida.push(actual);
            actual = [];
        } else {
            actual.push(`${x(i).toFixed(2)},${y(v).toFixed(2)}`);
        }
    });
    if (actual.length) salida.push(actual);
    return salida.map(t => t.join(' '));
};

const acotar = (y) => Math.min(100, Math.max(0, y));

/** Banda normal, media, referencia y media móvil, en las coordenadas 0–100 de la vista. */
const Capas = ({ x, y, ex }) => (
    <>
        {ex.banda && (
            <>
                <rect className="capa-banda" x="0" width="100" y={acotar(y(ex.banda.alto))}
                    height={Math.max(acotar(y(ex.banda.bajo)) - acotar(y(ex.banda.alto)), 0)} />
                <line className="capa-media" x1="0" x2="100" y1={acotar(y(ex.banda.media))}
                    y2={acotar(y(ex.banda.media))} />
            </>
        )}
        {ex.ref && tramos(ex.ref, x, y).map(p => <polyline key={p} className="capa-ref" points={p} />)}
        {ex.mm && tramos(ex.mm, x, y).map(p => <polyline key={p} className="capa-mm" points={p} />)}
    </>
);

const hayCapas = (ex) => !!(ex.banda || ex.ref || ex.mm);

const Barras = ({ serie, activa, dias, tope, max, unico, montado, irDia, ex }) => {
    const n = activa.vals.length;
    // Un día en cero deja una marca mínima en vez de nada: la ausencia también es un dato, y sin la
    // marca no se distingue de un día que no entró en el período.
    const altoDe = (v) => (tope ? Math.max((v / tope) * 100, v === 0 ? 2 : 6) : 2);
    return (
        <>
            <div className="serie-caja">
                <div className="serie">
                    {activa.vals.map((v, i) => {
                        const apilada = ex.apilar && v > 0;
                        const color = unico && v === max && v > 0 && !ex.apilar ? 'brand-secondary'
                            : v === 0 ? 'hueco' : activa.tone;
                        const estilo = {
                            height: montado ? `${altoDe(v)}%` : '2px',
                            background: apilada ? 'transparent' : `var(--${color})`,
                            transitionDelay: `${i * 35}ms`,
                        };
                        const marca = ex.marcas[i];
                        const clases = [
                            marca && `serie-${marca}`, i >= ex.pasados && 'serie-fut',
                            ex.foco === i && 'serie-foco', apilada && 'serie-apilada',
                        ].filter(Boolean).join(' ') || undefined;
                        const rotulo = `${fmt.fecha(dias[i])} · ${valorDe(serie, v)}`
                            + (marca ? ` · ${TEXTO[marca]}` : '');
                        const partes = apilada && ex.apilar.map((p, k) => (
                            <b key={p.nombre} style={{ flexGrow: p.vals[i] || 0,
                                background: `var(--${colorDePersona(p, k)})` }} />
                        ));
                        return irDia
                            ? <i key={dias[i]} className={clases} style={estilo}
                                title={`${rotulo} · ${ex.accion}`} role="button" tabIndex={0}
                                aria-label={`Ver la lista de ${rotulo}`}
                                onClick={() => irDia(dias[i], i)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irDia(dias[i], i); }
                                }}>{partes}</i>
                            : <i key={dias[i]} className={clases} style={estilo} title={rotulo}>{partes}</i>;
                    })}
                </div>
                {hayCapas(ex) && (
                    <svg className="serie-capas" viewBox="0 0 100 100" preserveAspectRatio="none"
                        aria-hidden="true">
                        <Capas ex={ex} x={(i) => ((i + 0.5) / n) * 100} y={(v) => 100 - altoDe(v)} />
                    </svg>
                )}
            </div>
            <Eje dias={dias} />
        </>
    );
};

/**
 * Curva con área. El `viewBox` es de 0 a 100 en los dos ejes con `preserveAspectRatio="none"`,
 * así que el trazo se deformaría al estirarse: lo salva `vector-effect: non-scaling-stroke` en
 * `.curva-linea` (ver comercial.css).
 */
const Curva = ({ serie, activa, dias, tope, max, ex }) => {
    const n = activa.vals.length;
    const escala = tope || 1;
    const x = (i) => (n > 1 ? (i / (n - 1)) * 100 : 50);
    const y = (v) => 100 - (v / escala) * 92 - 4;
    const puntos = activa.vals.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
    const area = `M0,100 L${puntos.join(' L')} L100,100 Z`;
    const iPico = activa.vals.indexOf(max);
    const gradiente = `grad-${serie.key}-${activa.label || 'base'}`;
    const marcados = Object.entries(ex.marcas).slice(0, 8);

    return (
        <div className="curva">
            <div className="curva-eje">
                <span>{valorDe(serie, tope)}</span>
                <span>{valorDe(serie, tope / 2)}</span>
                <span>0</span>
            </div>
            <div className="curva-lienzo">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={`var(--${activa.tone})`} stopOpacity=".45" />
                            <stop offset="100%" stopColor={`var(--${activa.tone})`} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {[4, 50, 96].map(y_ => (
                        <line key={y_} className="curva-grilla" x1="0" y1={y_} x2="100" y2={y_} />
                    ))}
                    <path d={area} fill={`url(#${gradiente})`} />
                    <g className="capa-g"><Capas ex={ex} x={x} y={y} /></g>
                    <polyline className="curva-linea" points={puntos.join(' ')}
                        stroke={`var(--${activa.tone})`} />
                </svg>
                {max > 0 && (
                    <>
                        <i className="curva-punto"
                            style={{ left: `${x(iPico)}%`, top: `${y(max)}%`,
                                background: `var(--${activa.tone})` }} />
                        <span className="curva-pico"
                            style={{ left: `${x(iPico)}%`, top: `${y(max)}%`,
                                color: `var(--${activa.tone})` }}>
                            {valorDe(serie, max)}
                        </span>
                    </>
                )}
                {marcados.map(([i, marca]) => (
                    <i key={i} className={`curva-marca curva-marca--${marca}`} title={TEXTO[marca]}
                        style={{ left: `${x(Number(i))}%`, top: `${marca === 'cero' ? 96 : y(activa.vals[i])}%` }} />
                ))}
            </div>
            <span />
            <Eje dias={dias} />
        </div>
    );
};

const Mapa = ({ serie, activa, dias, max, irDia, ex }) => (
    <div className="mapa-dias">
        {activa.vals.map((v, i) => {
            const k = max ? v / max : 0;
            const marca = ex.marcas[i];
            const estilo = {
                background: v === 0 ? 'transparent'
                    : `color-mix(in srgb, var(--${activa.tone}) ${Math.round(14 + k * 76)}%, transparent)`,
                color: `var(--${k > 0.55 ? 'on-state' : 'text-muted'})`,
            };
            const clase = ['mapa-dia', marca && `mapa-dia--${marca}`, i >= ex.pasados && 'serie-fut',
                ex.foco === i && 'serie-foco'].filter(Boolean).join(' ');
            const rotulo = `${fmt.fecha(dias[i])} · ${valorDe(serie, v)}${marca ? ` · ${TEXTO[marca]}` : ''}`;
            const glifo = marca && <small aria-hidden="true">{GLIFO[marca]}</small>;
            return irDia
                ? <button key={dias[i]} type="button" className={clase} style={estilo}
                    title={`${rotulo} · ${ex.accion}`}
                    aria-label={`Ver la lista de ${rotulo}`} onClick={() => irDia(dias[i], i)}>
                    {diaCorto(dias[i])}{glifo}
                </button>
                : <span key={dias[i]} className={clase} style={estilo} title={rotulo}>
                    {diaCorto(dias[i])}{glifo}
                </span>;
        })}
    </div>
);

export const VISTAS_GRAFICO = { barras: Barras, curva: Curva, mapa: Mapa };
