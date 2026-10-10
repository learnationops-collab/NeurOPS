import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { contar, reducido } from './movimiento';

/**
 * El embudo horizontal del reporte: una barra por etapa, unidas por la banda de la conversión y
 * con la píldora del porcentaje en el medio. Es el `flujo()` del diseño.
 *
 * `etapas`: `{ n, ref?, split? }`. `ref` es la barra gris de referencia (los entrantes contra los
 * que se mide la apertura); `split: true` parte la barra en claro/oscuro del mismo color y
 * `split: 'canales'` la parte en anuncios/inbound. `valores` lleva un número por etapa, o `[a, b]`
 * si está partida. `max` es la escala: se comparte entre canales para que se puedan comparar.
 *
 * Las barras crecen hasta su valor cuadro a cuadro escribiendo en el SVG, no por estado: mientras
 * se arrastra una celda cambian decenas de veces por segundo. Al montarse arrancan desde cero, así
 * el embudo se ve armarse cada vez que se entra al paso. Con movimiento reducido van directo.
 */
const FH = 156;
const FCY = 78;
const FMAX = 92;

const Flujo = ({ etapas, color, valores, max, convs = [], bandas = true, fb = 60, fg = 96, tot = false }) => {
    const svgRef = useRef(null);
    const actual = useRef(etapas.map(() => [0, 0]));
    const raf = useRef(0);
    const idGrad = `rd-g${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const n = etapas.length;
    const W = n * fb + (n - 1) * fg;
    const pw = Math.min(60, fg - 6);

    const destino = valores.map(v => (Array.isArray(v) ? v : [v, 0]).map(x => (max ? (x / max) * FMAX : 0)));
    const clave = JSON.stringify(destino);

    const dibujar = () => {
        const svg = svgRef.current;
        if (!svg) return;
        const altos = [];
        actual.current.forEach(([ha, hb], i) => {
            const t = Math.max(2, ha + hb);
            const y0 = FCY - t / 2;
            const g = svg.querySelector(`[data-e="${i}"]`);
            const ra = g.querySelector('[data-r="a"]');
            const rb = g.querySelector('[data-r="b"]');
            ra.setAttribute('y', y0);
            ra.setAttribute('height', rb ? Math.max(0, ha) : t);
            ra.setAttribute('rx', Math.min(10, t / 2));
            if (rb) {
                rb.setAttribute('y', y0 + ha);
                rb.setAttribute('height', Math.max(0, hb));
                rb.setAttribute('rx', Math.min(10, t / 2));
            }
            g.querySelector('.rd-fv-val').setAttribute('y', y0 - 10);
            altos.push(t);
        });
        if (!bandas) return;
        for (let i = 0; i < n - 1; i++) {
            const x1 = i * (fb + fg) + fb;
            const x2 = x1 + fg;
            const xm = (x1 + x2) / 2;
            const a = altos[i] / 2;
            const b = altos[i + 1] / 2;
            svg.querySelector(`[data-b="${i}"]`).setAttribute('d',
                `M${x1},${FCY - a} C${xm},${FCY - a} ${xm},${FCY - b} ${x2},${FCY - b} `
                + `L${x2},${FCY + b} C${xm},${FCY + b} ${xm},${FCY + a} ${x1},${FCY + a} Z`);
        }
    };

    // El primer dibujo antes de pintar: sin esto el SVG asoma un cuadro sin alturas.
    useLayoutEffect(() => { dibujar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const svg = svgRef.current;
        valores.forEach((v, i) => contar(svg?.querySelector(`[data-e="${i}"] .rd-fv-val`),
            Array.isArray(v) ? v[0] + v[1] : v));
        if (reducido()) {
            actual.current = destino.map(x => [...x]);
            dibujar();
            return undefined;
        }
        const paso = () => {
            let mueve = false;
            actual.current = actual.current.map((c, i) => c.map((v, j) => {
                const d = destino[i][j] - v;
                if (Math.abs(d) > 0.2) {
                    mueve = true;
                    return v + d * 0.14;
                }
                return destino[i][j];
            }));
            dibujar();
            raf.current = mueve ? requestAnimationFrame(paso) : 0;
        };
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(raf.current);
    }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <svg ref={svgRef} className="rd-flujo-svg" viewBox={`-28 0 ${W + 56} ${FH}`}
            preserveAspectRatio="xMidYMid meet" style={{ '--c': color }} aria-hidden="true">
            {tot && (
                <defs>
                    <linearGradient id={idGrad} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="var(--ch-ads)" />
                        <stop offset="1" stopColor="var(--ch-inb)" />
                    </linearGradient>
                </defs>
            )}
            {bandas && etapas.slice(1).map((_, i) => <path key={`b${i}`} className="rd-fv-band" data-b={i} />)}
            {etapas.map((e, i) => {
                const x = i * (fb + fg);
                const cx = x + fb / 2;
                const relleno = tot && !e.ref && !e.split ? { fill: `url(#${idGrad})` } : undefined;
                const ca = e.split === 'canales' ? ' ads' : e.split ? ' claro' : '';
                const cb = e.split === 'canales' ? ' inb' : '';
                return (
                    <g key={e.n} data-e={i} className={e.ref ? 'ref' : undefined}>
                        <rect className={`rd-fv-bar${e.ref ? ' ref' : ''}${ca}`} data-r="a" x={x} width={fb} style={relleno} />
                        {e.split && <rect className={`rd-fv-bar${cb}`} data-r="b" x={x} width={fb} />}
                        <text className="rd-fv-val" x={cx} textAnchor="middle">0</text>
                        <text className="rd-fv-et" x={cx} y={FH - 6} textAnchor="middle">{e.n.toUpperCase()}</text>
                    </g>
                );
            })}
            {bandas && etapas.slice(1).map((_, i) => {
                const cx = i * (fb + fg) + fb + fg / 2;
                const cv = convs[i];
                const alto = cv !== null && cv !== undefined && cv > 100;
                return (
                    <g key={`p${i}`} className={`rd-fv-pill${alto ? ' alto' : ''}`} data-p={i}>
                        <rect x={cx - pw / 2} y={FCY - 14} width={pw} height={28} rx={14} />
                        <text x={cx} y={FCY + 5} textAnchor="middle">
                            {cv === null || cv === undefined ? '—' : `${Math.round(cv)}%`}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

export default Flujo;
