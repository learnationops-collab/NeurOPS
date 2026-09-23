import React, { useMemo, useState } from 'react';
import { Cargando, Delta, fmt, Segmented, useMontado } from './Shared';

/**
 * Analizar → Comparativas: un solo panel con el ranking arriba y el mapa del equipo abajo.
 *
 * El ranking ordena por la métrica elegida; el mapa muestra todas a la vez y resalta la columna
 * rankeada. Clickear una celda o el encabezado de una columna rankeable cambia la métrica, que es
 * lo que conecta las dos mitades.
 *
 * El marcado usa las clases de la referencia visual (`.rk-*`, `.mapa-*`, `.panel`, `.t-*`), no las
 * `.dc-*` de la primera versión: esas dejaron de existir cuando el CSS del tablero se rehízo
 * sobre la referencia.
 */

/** Avatar con las iniciales. Los setters van en el tono info para distinguirlos de un vistazo. */
const Avatar = ({ nombre, rol, chico }) => (
    <span className="avatar" style={{
        ...(rol === 'setters' ? {
            background: 'var(--info-surface)',
            borderColor: 'var(--info-border)',
            color: 'var(--info)',
        } : null),
        ...(chico ? { width: 26, height: 26, borderRadius: 9, fontSize: 10 } : null),
    }}>
        {fmt.iniciales(nombre)}
    </span>
);

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
        if (metrica.key === 'respuesta' || metrica.key === 'cualificacion') return `${fila.leads ?? 0} leads`;
        return '';
    };

    return (
        <>
            <div className="panel-cab">
                <div style={{ minWidth: 0 }}>
                    <p className="t-eyebrow">Ranking · {metrica.label}</p>
                    <p className="t-sm mut" style={{ marginTop: 6 }}>{metrica.desc}</p>
                </div>
                <div className="panel-cab-der" style={{ display: 'block', textAlign: 'right' }}>
                    <p className="t-rotulo">Equipo</p>
                    <p className="num" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-.025em' }}>
                        {fmt.porFormato(valorEquipo, metrica.formato)}
                    </p>
                    <p className="t-cap mut40 num">
                        {metrica.suma && filas.length
                            ? `total · ${fmt.porFormato(promedio, metrica.formato)} por persona`
                            : 'promedio del equipo'}
                    </p>
                </div>
            </div>

            <div style={{ marginBottom: 'var(--s4)' }}>
                <Segmented ariaLabel="Métrica del ranking" valor={metrica.key}
                    opciones={datos.metricas.map(m => ({ key: m.key, label: m.label }))}
                    onChange={(k) => datos.onMetrica(k)} />
            </div>

            <div className="rk">
                {filas.map((fila, i) => {
                    const valor = fila[metrica.key];
                    const sobrePromedio = valor !== null && promedio !== null && valor >= promedio;
                    const largo = valor && tope ? (valor / tope) * 100 : 0;
                    return (
                        <button key={fila.id} type="button" className="rk-fila"
                            onClick={() => irAPersona(fila.id)}>
                            <span className="rk-pos">{i + 1}</span>
                            <span className="rk-quien">
                                <Avatar nombre={fila.nombre} rol={datos.rol} />
                                <span style={{ minWidth: 0 }}>
                                    <span className="celda">
                                        {fila.nombre}{fila.id === yo ? ' · vos' : ''}
                                    </span>
                                    <span className="celda-sub num">{bajada(fila)}</span>
                                </span>
                            </span>
                            <span className="rk-riel">
                                <i style={{
                                    width: montado ? `${largo}%` : 0,
                                    background: sobrePromedio ? 'var(--success)' : 'var(--warning)',
                                }} />
                                {promedio !== null && promedio !== undefined && tope > 0 && (
                                    <span className="rk-prom"
                                        style={{ left: montado ? `${Math.min(100, (promedio / tope) * 100)}%` : 0 }} />
                                )}
                            </span>
                            <span className="rk-val">
                                <span className="rk-cifra">{fmt.porFormato(valor, metrica.formato)}</span>
                                <span className="rk-delta"><Delta delta={fila.deltas?.[metrica.key]} /></span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {filas.length > 1 && (
                <div className="fila" style={{ justifyContent: 'space-between', marginTop: 'var(--s3)' }}>
                    <span className="t-cap mut">
                        Lidera {filas[0].nombre}
                        {promedio ? ` · +${fmt.porFormato((filas[0][metrica.key] || 0) - promedio, metrica.formato)}`
                            + `${metrica.formato === 'pct' ? ' pts' : ''} sobre el promedio` : ''}
                    </span>
                    <span className="t-cap mut40 num">
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

    return (
        <div className="mapa">
            <div className="panel-cab">
                <div style={{ minWidth: 0 }}>
                    <p className="t-eyebrow">Mapa del equipo</p>
                    <p className="t-cap mut" style={{ marginTop: 6 }}>
                        Tocá una celda para rankear por esa métrica.
                    </p>
                </div>
                <div className="panel-cab-der mapa-leyenda">
                    <span><i style={{ background: 'var(--success)' }} />Mejor</span>
                    <span><i style={{ background: 'var(--error)' }} />Más bajo</span>
                </div>
            </div>

            <div className="mapa-scroll">
                {/* `--n` es la cantidad de columnas: de ahí salen el ancho mínimo de la tabla y el
                    reparto de la grilla, así los encabezados de dos líneas nunca se pisan. */}
                <div className="mapa-grid" style={{ '--n': columnas.length }}>
                    <div className="mapa-fila mapa-cab">
                        <span className="mapa-quien" />
                        {columnas.map(c => (
                            c.rankeable ? (
                                <button key={c.key} type="button" title={c.desc}
                                    className={c.key === metrica.key ? 'activa marcada' : undefined}
                                    onClick={() => onMetrica(c.key)}>
                                    {c.label}
                                </button>
                            ) : (
                                <span key={c.key} title={c.desc} className="info">{c.label}</span>
                            )
                        ))}
                    </div>

                    {[...filas, { id: 'equipo', nombre: 'Equipo', ...datos.equipo }].map(fila => {
                        const esEquipo = fila.id === 'equipo';
                        return (
                            <div key={fila.id} className={`mapa-fila${esEquipo ? ' mapa-equipo' : ''}`}>
                                <span className="mapa-quien">
                                    {!esEquipo && <Avatar nombre={fila.nombre} rol={datos.rol} chico />}
                                    <span className="celda">{fila.nombre}</span>
                                </span>
                                {columnas.map(c => {
                                    const valor = fila[c.key];
                                    const ext = extremos[c.key];
                                    const mejor = !esEquipo && ext && valor === ext.max && ext.max !== ext.min;
                                    const peor = !esEquipo && ext && valor === ext.min && ext.max !== ext.min;
                                    const clases = ['mapa-celda'];
                                    if (mejor) clases.push('alta');
                                    if (peor) clases.push('baja');
                                    if (c.key === metrica.key) clases.push('marcada');
                                    if (!c.rankeable) clases.push('info');
                                    const texto = fmt.porFormato(valor, c.formato);
                                    return c.rankeable ? (
                                        <button key={c.key} type="button" title={c.desc}
                                            className={clases.join(' ')} onClick={() => onMetrica(c.key)}>
                                            {texto}
                                        </button>
                                    ) : (
                                        <span key={c.key} title={c.desc} className={clases.join(' ')}>
                                            {texto}
                                        </span>
                                    );
                                })}
                            </div>
                        );
                    })}
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
        <section className="panel">
            <Ranking datos={conHandler} metrica={metrica} filas={filas} yo={datos.yo} irAPersona={irAPersona} />
            <MapaEquipo datos={datos} metrica={metrica} filas={filas} onMetrica={setMetricaKey} />
        </section>
    );
};

export default Comparativas;
