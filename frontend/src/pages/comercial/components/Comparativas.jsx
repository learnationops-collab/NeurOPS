import React, { useMemo, useState } from 'react';
import { Cargando, Delta, fmt, Segmented, useMontado } from './Shared';

/**
 * Analizar → Comparativas: un solo panel con el ranking arriba y el mapa del equipo abajo.
 *
 * El ranking ordena por la métrica elegida; el mapa muestra todas a la vez y resalta la columna
 * rankeada. Clickear una celda o el encabezado de una columna rankeable cambia la métrica, que es
 * lo que conecta las dos mitades.
 */

const Ranking = ({ datos, metrica, filas, yo, irAPersona }) => {
    const montado = useMontado();
    const valores = filas.map(f => f[metrica.key]).filter(v => v !== null && v !== undefined);
    const maximo = Math.max(...valores, 0);
    const tope = maximo * 1.08 || 1;

    // El valor del equipo y la referencia con la que se compara a cada persona NO son lo mismo
    // en las métricas que se suman: el equipo junta $7,033 de cash, pero la vara de cada closer
    // es el promedio por persona ($1,758). Compararlo contra el total marcaba a todos por debajo
    // y decía "lidera Fulano · $5,183 sobre el promedio" cuando en realidad estaba por debajo.
    // En las tasas, el valor del equipo ya ES la referencia.
    const valorEquipo = datos.equipo[metrica.key];
    const promedio = metrica.suma && filas.length && valorEquipo !== null && valorEquipo !== undefined
        ? valorEquipo / filas.length
        : valorEquipo;

    const bajada = (fila) => {
        if (metrica.key === 'show_up') return `${fila.agendas ?? fila.generadas ?? 0} agendas`;
        if (metrica.key === 'close_rate' || metrica.key === 'ticket') return `${fila.ventas ?? 0} ventas`;
        if (metrica.key === 'comision') return `10% de ${fmt.money(fila.cash)}`;
        if (metrica.key === 'senas_conversion') return fila.senas_detalle;
        if (metrica.key === 'respuesta') return `${fila.leads ?? 0} leads`;
        if (metrica.key === 'cualificacion') return `${fila.leads ?? 0} leads`;
        return '';
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <div className="dc-eyebrow">Ranking · {metrica.label}</div>
                    <p className="ln-t-body-sm ln-muted" style={{ marginTop: 6 }}>{metrica.desc}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="dc-total-label">Equipo</div>
                    <div className="dc-num" style={{ fontSize: 24, fontWeight: 700 }}>
                        {fmt.porFormato(valorEquipo, metrica.formato)}
                    </div>
                    <div className="dc-total-hint">
                        {metrica.suma && filas.length
                            ? `total · ${fmt.porFormato(promedio, metrica.formato)} por persona`
                            : 'promedio del equipo'}
                    </div>
                </div>
            </div>

            <div style={{ margin: '16px 0' }}>
                <Segmented ariaLabel="Métrica del ranking" valor={metrica.key}
                    opciones={datos.metricas.map(m => ({ key: m.key, label: m.label }))}
                    onChange={(k) => datos.onMetrica(k)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filas.map((fila, i) => {
                    const valor = fila[metrica.key];
                    const sobrePromedio = valor !== null && promedio !== null && valor >= promedio;
                    const largo = valor && tope ? (valor / tope) * 100 : 0;
                    return (
                        <button key={fila.id} type="button" className="dc-rank-row"
                            onClick={() => irAPersona(fila.id)}>
                            <span className={`dc-rank-pos${i === 0 ? ' dc-rank-pos--first' : ''}`}>{i + 1}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <span className={`dc-avatar${datos.rol === 'setters' ? ' dc-avatar--info' : ''}`}>
                                    {fmt.iniciales(fila.nombre)}
                                </span>
                                <span style={{ minWidth: 0 }}>
                                    <span className="dc-cell-main" style={{ display: 'block' }}>
                                        {fila.nombre}{fila.id === yo ? ' · vos' : ''}
                                    </span>
                                    <span className="dc-cell-sub dc-num">{bajada(fila)}</span>
                                </span>
                            </span>
                            <span className="dc-rank-track">
                                <span className="dc-rank-fill" style={{
                                    width: montado ? `${largo}%` : 0,
                                    background: sobrePromedio ? 'var(--success)' : 'var(--warning)',
                                }} />
                                {promedio !== null && promedio !== undefined && tope > 0 && (
                                    <span className="dc-rank-avg"
                                        style={{ left: montado ? `${Math.min(100, (promedio / tope) * 100)}%` : 0 }} />
                                )}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                                <span className="dc-num" style={{ fontSize: 16, fontWeight: 700 }}>
                                    {fmt.porFormato(valor, metrica.formato)}
                                </span>
                                <Delta delta={fila.deltas?.[metrica.key]} />
                            </span>
                        </button>
                    );
                })}
            </div>

            {filas.length > 1 && (
                <div className="dc-legend" style={{ justifyContent: 'space-between' }}>
                    <span className="ln-t-caption ln-muted">
                        Lidera {filas[0].nombre}
                        {promedio ? ` · +${fmt.porFormato((filas[0][metrica.key] || 0) - promedio, metrica.formato)}`
                            + `${metrica.formato === 'pct' ? ' pts' : ''} sobre el promedio` : ''}
                    </span>
                    <span className="ln-t-caption ln-muted-40 dc-num">
                        Brecha 1º a último: {fmt.porFormato(
                            (filas[0][metrica.key] || 0) - (filas[filas.length - 1][metrica.key] || 0),
                            metrica.formato)}
                    </span>
                </div>
            )}
        </>
    );
};

const MapaEquipo = ({ datos, metrica, filas, onMetrica }) => {
    const columnas = [
        ...datos.metricas.map(m => ({ ...m, rankeable: true })),
        ...datos.columnas_info.map(c => ({ ...c, rankeable: false })),
    ];

    // Mejor y peor valor de cada columna, para pintar los extremos.
    const extremos = useMemo(() => {
        const salida = {};
        columnas.forEach(c => {
            const valores = filas.map(f => f[c.key]).filter(v => v !== null && v !== undefined);
            salida[c.key] = valores.length
                ? { max: Math.max(...valores), min: Math.min(...valores) }
                : null;
        });
        return salida;
    }, [filas, datos.metricas, datos.columnas_info]);

    if (filas.length < 2) return null;

    const grid = `minmax(140px, 1.4fr) repeat(${columnas.length}, minmax(70px, 1fr))`;

    return (
        <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border-main)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                    <div className="dc-eyebrow">Mapa del equipo</div>
                    <p className="ln-t-caption ln-muted" style={{ marginTop: 6 }}>
                        Tocá una celda para rankear por esa métrica.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span className="ln-chip ln-chip--sm ln-chip--success">Mejor</span>
                    <span className="ln-chip ln-chip--sm ln-chip--error">Más bajo</span>
                </div>
            </div>

            <div className="dc-map" style={{ marginTop: 14 }}>
                <div className="dc-map-grid">
                    <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 6 }}>
                        <span />
                        {columnas.map(c => (
                            <button key={c.key} type="button" title={c.desc}
                                className={`dc-map-head${c.key === metrica.key ? ' dc-map-head--ranked' : ''}`
                                    + `${c.rankeable ? '' : ' dc-map-head--info'}`}
                                style={{ background: 'none', border: 0 }}
                                onClick={c.rankeable ? () => onMetrica(c.key) : undefined}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                    {[...filas, { id: 'equipo', nombre: 'Equipo', ...datos.equipo }].map(fila => (
                        <div key={fila.id} style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, marginBottom: 6 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                {fila.id !== 'equipo' && (
                                    <span className={`dc-avatar${datos.rol === 'setters' ? ' dc-avatar--info' : ''}`}
                                        style={{ width: 26, height: 26, fontSize: 10, borderRadius: 9 }}>
                                        {fmt.iniciales(fila.nombre)}
                                    </span>
                                )}
                                <span className="dc-cell-main">{fila.nombre}</span>
                            </span>
                            {columnas.map(c => {
                                const valor = fila[c.key];
                                const ext = extremos[c.key];
                                const esEquipo = fila.id === 'equipo';
                                const mejor = !esEquipo && ext && valor === ext.max && ext.max !== ext.min;
                                const peor = !esEquipo && ext && valor === ext.min && ext.max !== ext.min;
                                return (
                                    <button key={c.key} type="button" title={c.desc}
                                        className={`dc-map-cell${mejor ? ' dc-map-cell--best' : ''}`
                                            + `${peor ? ' dc-map-cell--worst' : ''}`
                                            + `${c.key === metrica.key ? ' dc-map-cell--ranked' : ''}`}
                                        style={c.rankeable ? undefined : { cursor: 'help' }}
                                        onClick={c.rankeable ? () => onMetrica(c.key) : undefined}>
                                        {fmt.porFormato(valor, c.formato)}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Comparativas = ({ datos, irAPersona }) => {
    const [metricaKey, setMetricaKey] = useState(null);

    if (!datos) return <Cargando />;

    const metrica = datos.metricas.find(m => m.key === metricaKey) || datos.metricas[0];
    const filas = [...datos.filas].sort((a, b) => {
        const va = a[metrica.key], vb = b[metrica.key];
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        return vb - va;
    });

    const conHandler = { ...datos, onMetrica: setMetricaKey };

    return (
        <div className="ln-panel">
            <Ranking datos={conHandler} metrica={metrica} filas={filas} yo={datos.yo} irAPersona={irAPersona} />
            <MapaEquipo datos={datos} metrica={metrica} filas={filas} onMetrica={setMetricaKey} />
        </div>
    );
};

export default Comparativas;
