import React, { useMemo } from 'react';
import { formatoValor, puntosDelPar, recta } from './correlaciones';

const W = 560;
const H = 340;
const M = { izq: 64, der: 20, arriba: 16, abajo: 48 };
const TICKS = 4;

// Escala lineal con un 8% de aire; si todos los valores son iguales abre un rango para que se dibuje.
function escala(valores, desde, hasta) {
    let min = Math.min(...valores);
    let max = Math.max(...valores);
    if (min === max) { min -= 1; max += 1; }
    const aire = (max - min) * 0.08;
    min -= aire; max += aire;
    return { min, max, px: (v) => desde + ((v - min) / (max - min)) * (hasta - desde) };
}

const corto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Dispersión de un par de métricas: un punto por taller, con la recta de tendencia. Es lo que hay
 * que mirar antes de creerle a un número: un solo taller raro puede armar o romper toda la correlación.
 */
const Dispersion = ({ talleres, a, b }) => {
    const puntos = useMemo(() => puntosDelPar(talleres, a.key, b.key), [talleres, a.key, b.key]);
    const sx = useMemo(() => (puntos.length ? escala(puntos.map((p) => p.x), M.izq, W - M.der) : null), [puntos]);
    const sy = useMemo(() => (puntos.length ? escala(puntos.map((p) => p.y), H - M.abajo, M.arriba) : null), [puntos]);
    const tendencia = useMemo(() => recta(puntos), [puntos]);

    if (!puntos.length) return <p className="t-sm mut wc-sin-puntos">Ningún taller tiene las dos métricas.</p>;

    const ticks = (s) => Array.from({ length: TICKS + 1 }, (_, i) => s.min + ((s.max - s.min) * i) / TICKS);
    const linea = tendencia && [sx.min, sx.max].map((x) => [sx.px(x), sy.px(tendencia.ordenada + tendencia.pendiente * x)]);

    return (
        <svg className="wc-disp" viewBox={`0 0 ${W} ${H}`} role="img"
            aria-label={`Dispersión de ${a.label} contra ${b.label} en ${puntos.length} talleres`}>
            {ticks(sy).map((v) => (
                <g key={`y${v}`}>
                    <line className="wc-disp-rej" x1={M.izq} x2={W - M.der} y1={sy.px(v)} y2={sy.px(v)} />
                    <text className="wc-disp-eje" x={M.izq - 8} y={sy.px(v) + 4} textAnchor="end">{formatoValor(v, b.formato)}</text>
                </g>
            ))}
            {ticks(sx).map((v) => (
                <text key={`x${v}`} className="wc-disp-eje" x={sx.px(v)} y={H - M.abajo + 16} textAnchor="middle">
                    {formatoValor(v, a.formato)}
                </text>
            ))}
            <text className="wc-disp-titulo" x={(M.izq + W - M.der) / 2} y={H - 8} textAnchor="middle">{a.label}</text>
            <text className="wc-disp-titulo" transform={`translate(14 ${(M.arriba + H - M.abajo) / 2}) rotate(-90)`} textAnchor="middle">
                {b.label}
            </text>
            {linea && (
                <line className="wc-disp-recta" x1={linea[0][0]} y1={linea[0][1]} x2={linea[1][0]} y2={linea[1][1]} />
            )}
            {puntos.map((p) => (
                <g key={p.id} className="wc-disp-punto">
                    <circle cx={sx.px(p.x)} cy={sy.px(p.y)} r="6">
                        <title>{`${p.nombre} (${corto(p.fecha)}): ${a.label} ${formatoValor(p.x, a.formato)} · ${b.label} ${formatoValor(p.y, b.formato)}`}</title>
                    </circle>
                    <text x={sx.px(p.x) + 9} y={sy.px(p.y) - 8}>{corto(p.fecha)}</text>
                </g>
            ))}
        </svg>
    );
};

export default Dispersion;
