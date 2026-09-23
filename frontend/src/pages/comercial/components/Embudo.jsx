import React from 'react';
import { CardHead, Tip, useMontado } from './Shared';

/**
 * Embudo del doc 03: barras centradas con cuello trapezoidal entre una y la siguiente, color en
 * degradado de info a magenta, y el paso de menor conversión marcado en error.
 *
 * Vive en su propio archivo porque lo usan el dashboard de closers y el de setters, y cada vista
 * le arma los pasos distinto. El contrato es por fila, no global:
 *
 *   <Embudo pasos={[{ paso, n, ayuda, ir }]} sinCuello={false} />
 *
 * - `paso` es el nombre y `n` el conteo; el array va en orden, de arriba hacia abajo.
 * - `ayuda` es el texto del tooltip de esa fila. Opcional: sin él la fila no muestra el ícono.
 * - `ir` es el drill-down de esa fila. Opcional: sin él el nombre no es clicable. Es por fila y no
 *   un callback genérico porque cada paso lleva a un filtro distinto de Revisar, y quién decide
 *   ese destino es la vista que arma los pasos, no el embudo.
 * - `sinCuello` apaga el cuello de botella para los embudos donde la etiqueta no aporta.
 */
const Embudo = ({ pasos, sinCuello = false }) => {
    const montado = useMontado();
    const primero = pasos[0]?.n || 0;
    const ancho = (n) => Math.max(14, primero ? (n / primero) * 100 : 14);

    // Cuello de botella: el salto de menor conversión a partir del SEGUNDO (i >= 2). El primer
    // salto queda fuera a propósito: "de agendas a confirmadas" es casi siempre el más flojo
    // —confirmar depende de que el lead conteste, no de cómo se llevó la llamada— y si compite
    // se lleva la etiqueta todas las veces, tapando el cuello real del embudo.
    let cuello = null;
    if (!sinCuello) {
        let peor = Infinity;
        pasos.forEach((p, i) => {
            if (i < 2) return;
            const previo = pasos[i - 1].n;
            if (!previo) return;
            const tasa = (p.n / previo) * 100;
            if (tasa < peor) { peor = tasa; cuello = i; }
        });
    }

    const color = (i) => {
        if (i === cuello) return 'var(--error)';
        const mezcla = pasos.length > 1 ? Math.round((i / (pasos.length - 1)) * 100) : 100;
        return `color-mix(in oklch, var(--brand-secondary) ${mezcla}%, var(--info))`;
    };
    const final = primero ? ((pasos[pasos.length - 1].n / primero) * 100).toFixed(1) : '0.0';
    const irFinal = pasos[0]?.ir;

    return (
        <div className="ln-panel ln-panel--sm">
            <CardHead titulo="Embudo"
                tip="De agendas a ventas, paso por paso. El porcentaje de cada fila es contra el paso anterior.">
                {cuello !== null && (
                    <span className="dc-bottleneck">Cuello de botella · {pasos[cuello].paso}</span>
                )}
            </CardHead>
            {pasos.map((p, i) => {
                const pct = i === 0 ? null : pasos[i - 1].n ? ((p.n / pasos[i - 1].n) * 100).toFixed(1) : null;
                const anchoAqui = montado ? ancho(p.n) : 14;
                const anchoSig = i < pasos.length - 1 ? (montado ? ancho(pasos[i + 1].n) : 14) : null;
                const estiloCuello = i === cuello ? { color: 'var(--error)' } : undefined;
                return (
                    <div key={p.paso}>
                        <div className="dc-funnel-row">
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                {p.ir ? (
                                    <button type="button" className="dc-funnel-label" style={{
                                        background: 'none', border: 0, padding: 0, cursor: 'pointer',
                                        textAlign: 'left', ...estiloCuello,
                                    }} onClick={p.ir}>
                                        {p.paso}
                                    </button>
                                ) : (
                                    <span className="dc-funnel-label" style={estiloCuello}>{p.paso}</span>
                                )}
                                {p.ayuda && <Tip texto={p.ayuda} />}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div className="dc-funnel-bar"
                                    style={{ width: `${anchoAqui}%`, background: color(i), transitionDelay: `${120 + i * 90}ms` }}>
                                    {p.n}
                                </div>
                            </div>
                            <span className="dc-funnel-pct" style={estiloCuello}>
                                {pct === null ? '' : `${pct}%`}
                            </span>
                        </div>
                        {anchoSig !== null && (
                            <div className="dc-funnel-row">
                                <span />
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div className="dc-funnel-neck" style={{
                                        width: '100%', background: color(i),
                                        transitionDelay: `${120 + i * 90}ms`,
                                        clipPath: `polygon(${(100 - anchoAqui) / 2}% 0, ${100 - (100 - anchoAqui) / 2}% 0, `
                                            + `${100 - (100 - anchoSig) / 2}% 100%, ${(100 - anchoSig) / 2}% 100%)`,
                                    }} />
                                </div>
                                <span />
                            </div>
                        )}
                    </div>
                );
            })}
            <div className="dc-legend" style={{ justifyContent: 'space-between' }}>
                <span className="ln-t-caption ln-muted dc-num">
                    de {primero} {pasos[0]?.paso.toLowerCase()} a {pasos[pasos.length - 1]?.n} {pasos[pasos.length - 1]?.paso.toLowerCase()}
                </span>
                {irFinal ? (
                    <button type="button" className="ln-t-caption ln-accent dc-num"
                        style={{ background: 'none', border: 0, cursor: 'pointer' }}
                        onClick={irFinal}>
                        {final}% final
                    </button>
                ) : (
                    <span className="ln-t-caption ln-accent dc-num">{final}% final</span>
                )}
            </div>
        </div>
    );
};

export default Embudo;
