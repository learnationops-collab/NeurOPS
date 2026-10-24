import React from 'react';
import { valorDe } from './formato';

/**
 * El acumulado del período, día por día, con el ritmo: a este paso, cuánto cierra. Va aparte del
 * gráfico diario porque su escala no tiene nada que ver (un acumulado sube hasta el total del
 * período, un día vale una fracción) y a escala común una de las dos se aplastaba.
 *
 * El trazo sólido es lo que pasó, el punteado hacia la derecha es el ritmo proyectado y, si la
 * serie trae `meta`, la línea horizontal es el objetivo. Con un período cerrado no hay proyección.
 */
const Acumulado = ({ serie, tone, acum, refAcum, ritmo, n }) => {
    const todos = [...acum, ...(refAcum || [])].filter(v => v !== null && v !== undefined);
    const tope = Math.max(...todos, ritmo?.proyeccion || 0, ritmo?.meta || 0, 1);
    const x = (i) => (n > 1 ? (i / (n - 1)) * 100 : 50);
    const y = (v) => 100 - (v / tope) * 90 - 5;
    const trazo = (vals) => vals.map((v, i) => (v === null || v === undefined ? null
        : `${x(i).toFixed(2)},${y(v).toFixed(2)}`)).filter(Boolean).join(' ');
    const ultimo = acum.reduce((a, v, i) => (v !== null ? i : a), 0);

    return (
        <div className="acum" role="img"
            aria-label={`Acumulado: ${valorDe(serie, acum[ultimo])}${ritmo
                ? `, al ritmo actual cierra en ${valorDe(serie, ritmo.proyeccion)}` : ''}`}>
            <div className="acum-lienzo">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <line className="curva-grilla" x1="0" x2="100" y1="95" y2="95" />
                    {refAcum && <polyline className="capa-ref" points={trazo(refAcum)} />}
                    {ritmo?.meta && (
                        <line className="capa-meta" x1="0" x2="100" y1={y(ritmo.meta)} y2={y(ritmo.meta)} />
                    )}
                    {ritmo && (
                        <line className="capa-ritmo" x1={x(ultimo)} y1={y(acum[ultimo])} x2="100"
                            y2={y(ritmo.proyeccion)} stroke={`var(--${tone})`} />
                    )}
                    <polyline className="curva-linea" points={trazo(acum)} stroke={`var(--${tone})`} />
                </svg>
                <i className="curva-punto" style={{ left: `${x(ultimo)}%`, top: `${y(acum[ultimo])}%`,
                    background: `var(--${tone})` }} />
            </div>
            <div className="acum-pie t-cap mut40 num">
                <span>acumulado {valorDe(serie, acum[ultimo])}</span>
                {ritmo && <span>al ritmo actual cierra en {valorDe(serie, ritmo.proyeccion)}</span>}
                {ritmo?.avance !== null && ritmo?.meta && (
                    <span>{Math.round(ritmo.avance * 100)}% de la meta de {valorDe(serie, ritmo.meta)}</span>
                )}
            </div>
        </div>
    );
};

export default Acumulado;
