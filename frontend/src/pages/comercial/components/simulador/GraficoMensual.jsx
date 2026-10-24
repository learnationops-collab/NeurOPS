import React, { useState } from 'react';
import { PanelCab, Segmented, fmt, useMontado } from '../Shared';

const METRICAS = [
    { key: 'cash', label: 'Cash', valor: (m) => m.cash, formato: fmt.money },
    { key: 'ventas', label: 'Ventas', valor: (m) => m.ventas, formato: (v) => fmt.num(Math.round(v * 10) / 10) },
    { key: 'comisiones', label: 'Comisiones', valor: (m) => m.comCloser + m.comSetter, formato: fmt.money },
];
const VISTAS = [{ key: 'barras', label: 'Barras' }, { key: 'curva', label: 'Curva' }];

const Barras = ({ meses, metrica, montado, soloBase }) => {
    const max = Math.max(...meses.flatMap(m => [metrica.valor(m.base), metrica.valor(m.esc)]), 1);
    const alto = (v) => `${montado ? Math.max((v / max) * 100, 2) : 2}%`;
    return (
        <div className="sim-barras">
            {meses.map(m => (
                <div className="sim-mes" key={m.clave}>
                    <div className="sim-par">
                        {!soloBase && (
                            <div className="sim-col sim-col--base">
                                <b>{metrica.formato(metrica.valor(m.base))}</b>
                                <i style={{ height: alto(metrica.valor(m.base)) }} />
                            </div>
                        )}
                        <div className="sim-col sim-col--esc">
                            <b>{metrica.formato(metrica.valor(m.esc))}</b>
                            <i style={{ height: alto(metrica.valor(m.esc)) }} />
                        </div>
                    </div>
                    <p className="sim-mes-n">{m.etiqueta.slice(0, 3)}{m.actual ? ' · en curso' : ''}</p>
                </div>
            ))}
        </div>
    );
};

/** Acumulado de mes a mes: dónde se llega al cierre de cada mes, base punteada y escenario lleno. */
const Curva = ({ meses, metrica, soloBase }) => {
    const acumular = (lado) => meses.reduce((a, m) => [...a, (a[a.length - 1] || 0) + metrica.valor(m[lado])], []);
    const base = [0, ...acumular('base')];
    const esc = [0, ...acumular('esc')];
    const max = Math.max(...base, ...esc, 1);
    const ancho = 560;
    const alto = 190;
    const pad = { x: 20, arriba: 22, abajo: 26 };
    const x = (i) => pad.x + (i / (base.length - 1)) * (ancho - pad.x * 2 - 40);
    const y = (v) => alto - pad.abajo - (v / max) * (alto - pad.arriba - pad.abajo);
    const linea = (serie) => serie.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    return (
        <svg className="sim-curva" viewBox={`0 0 ${ancho} ${alto}`} role="img"
            aria-label={`Curva acumulada de ${metrica.label}, base contra escenario`}>
            <line className="eje" x1={pad.x} x2={ancho - pad.x} y1={y(0)} y2={y(0)} />
            {!soloBase && <path className="l-base" d={linea(base)} />}
            <path className="l-esc" d={linea(esc)} />
            {meses.map((m, i) => (
                <text key={m.clave} x={x(i + 1)} y={alto - 6} textAnchor="middle">{m.etiqueta.slice(0, 3)}</text>
            ))}
            <text x={x(base.length - 1) + 8} y={y(esc[esc.length - 1]) + 4}>{metrica.formato(esc[esc.length - 1])}</text>
            {!soloBase && (
                <text x={x(base.length - 1) + 8} y={y(base[base.length - 1]) + 4} style={{ opacity: 0.7 }}>
                    {metrica.formato(base[base.length - 1])}
                </text>
            )}
        </svg>
    );
};

/** Base contra escenario mes a mes. El selector de métrica y el de forma son de este gráfico. */
const GraficoMensual = ({ meses, soloBase = false }) => {
    const [clave, setClave] = useState('cash');
    const [vista, setVista] = useState('barras');
    const montado = useMontado();
    const metrica = METRICAS.find(m => m.key === clave);
    return (
        <section className="panel sim-graf">
            <PanelCab titulo="Mes a mes"
                tip={soloBase ? 'Lo proyectado en cada mes. El mes en curso suma lo ya cobrado.'
                    : 'Base punteada, escenario lleno. El mes en curso suma lo ya cobrado.'}>
                <Segmented chico opciones={METRICAS} valor={clave} onChange={setClave} ariaLabel="Métrica del gráfico" />
                <Segmented chico opciones={VISTAS} valor={vista} onChange={setVista} ariaLabel="Forma del gráfico" />
            </PanelCab>
            {vista === 'barras'
                ? <Barras meses={meses} metrica={metrica} montado={montado} soloBase={soloBase} />
                : <Curva meses={meses} metrica={metrica} soloBase={soloBase} />}
            {!soloBase && (
                <p className="sim-leyenda">
                    <span><i style={{ border: '1px dashed var(--text-muted)' }} />Base</span>
                    <span><i style={{ background: 'var(--brand-secondary)' }} />Escenario</span>
                </p>
            )}
        </section>
    );
};

export default GraficoMensual;
