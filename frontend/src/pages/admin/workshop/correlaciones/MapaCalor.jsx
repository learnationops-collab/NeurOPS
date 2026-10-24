import React from 'react';
import { TIP_LIGADA, colorCelda, etiquetaConfianza, formatoR, valorDe } from './correlaciones';

/**
 * Mapa de calor: cada celda es la correlación entre dos métricas a través de los talleres (verde =
 * suben juntas, rojo = una sube y la otra baja). Una celda es un botón: elige el par para ver la
 * dispersión. El punto ● marca las que, además de n suficiente, no se explican fácil por azar.
 */
const MapaCalor = ({ metricas, matriz, metodo, par, onElegir, ligadas }) => (
    <div className="wc-mapa-scroll">
        <table className="wc-mapa" aria-label="Mapa de correlaciones entre métricas">
            <thead>
                <tr>
                    <th scope="col" className="wc-esq"><span className="wc-oculto">Métrica</span></th>
                    {metricas.map((m) => (
                        <th key={m.key} scope="col" className="wc-col" data-grupo={m.grupo}>
                            <span>{m.label}</span>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {metricas.map((fila) => (
                    <tr key={fila.key}>
                        <th scope="row" className="wc-fila" data-grupo={fila.grupo}>{fila.label}</th>
                        {metricas.map((col) => {
                            if (fila.key === col.key) return <td key={col.key} className="wc-diag" aria-hidden="true" />;
                            const celda = matriz[fila.key]?.[col.key];
                            const r = valorDe(celda, metodo);
                            const elegida = par && ((par.a === fila.key && par.b === col.key)
                                || (par.a === col.key && par.b === fila.key));
                            const firme = celda?.confianza === 'media' || celda?.confianza === 'alta';
                            return (
                                <td key={col.key}>
                                    <button
                                        type="button"
                                        className={`wc-celda${elegida ? ' wc-celda--on' : ''}${r == null ? ' wc-celda--vacia' : ''}${ligadas?.has(`${fila.key}|${col.key}`) ? ' wc-celda--ligada' : ''}`}
                                        style={{ '--wc-fondo': colorCelda(r) }}
                                        aria-pressed={!!elegida}
                                        aria-label={`${fila.label} contra ${col.label}: ${formatoR(r)}, ${celda?.n ?? 0} talleres`}
                                        data-tip={`${fila.label} · ${col.label}|${formatoR(r)} con ${celda?.n ?? 0} talleres. ${etiquetaConfianza(celda?.confianza)}.${ligadas?.has(`${fila.key}|${col.key}`) ? ` ${TIP_LIGADA}` : ''}`}
                                        onClick={() => onElegir(fila.key, col.key)}
                                    >
                                        {firme && <i aria-hidden="true" className="wc-firme" />}
                                    </button>
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default MapaCalor;
