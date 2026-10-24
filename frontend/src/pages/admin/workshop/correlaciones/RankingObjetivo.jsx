import React, { useMemo } from 'react';
import { Select } from '../../../../components/standard';
import { TIP_LIGADA, etiquetaConfianza, formatoR, intensidadDe, rankingContra } from './correlaciones';

/**
 * «Qué se mueve parecido a…»: las demás métricas ordenadas por qué tan fuerte es su relación con la
 * elegida (por defecto Cash collected). La barra sale del centro: a la derecha suben juntas, a la
 * izquierda una sube y la otra baja.
 */
const RankingObjetivo = ({ metricas, matriz, metodo, objetivo, onObjetivo, par, onElegir, ligadas }) => {
    const etiqueta = useMemo(() => Object.fromEntries(metricas.map((m) => [m.key, m.label])), [metricas]);
    const filas = useMemo(() => rankingContra(matriz, objetivo, metodo), [matriz, objetivo, metodo]);
    const opciones = useMemo(() => metricas.map((m) => ({ value: m.key, label: m.label })), [metricas]);

    return (
        <div className="wc-ranking">
            <div className="wc-ranking-cab">
                <span className="t-eyebrow">Se mueve parecido a</span>
                <Select value={objetivo} options={opciones} onChange={onObjetivo} size="sm" label="Métrica objetivo" />
            </div>
            <ol className="wc-ranking-lista" aria-label={`Métricas ordenadas por relación con ${etiqueta[objetivo]}`}>
                {filas.map(({ key, celda, r }) => {
                    const activa = par && ((par.a === objetivo && par.b === key) || (par.a === key && par.b === objetivo));
                    return (
                        <li key={key}>
                            <button
                                type="button"
                                className={`wc-rk${activa ? ' wc-rk--on' : ''}${ligadas?.has(`${objetivo}|${key}`) ? ' wc-rk--ligada' : ''}`}
                                aria-pressed={!!activa}
                                onClick={() => onElegir(key, objetivo)}
                                data-tip={`${etiqueta[key]}|${intensidadDe(r) || 'sin cálculo'} · ${celda.n} talleres · ${etiquetaConfianza(celda.confianza)}${ligadas?.has(`${objetivo}|${key}`) ? `. ${TIP_LIGADA}` : ''}`}
                            >
                                <span className="wc-rk-nombre">{etiqueta[key]}</span>
                                <span className="wc-rk-pista" aria-hidden="true">
                                    <i className={r != null && r < 0 ? 'wc-rk-neg' : 'wc-rk-pos'}
                                        style={{ width: `${Math.round(Math.abs(r ?? 0) * 50)}%` }} />
                                </span>
                                <span className="wc-rk-r num">{formatoR(r)}</span>
                                <span className="wc-rk-n">n={celda.n}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

export default RankingObjetivo;
