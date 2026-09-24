import React, { useMemo, useState } from 'react';
import { Cargando, Humo, PanelCab, Segmented, fmt, useMontado } from './Shared';

/**
 * Analizar → Variabilidad: la serie por día de cada métrica.
 *
 * El dashboard contesta "cuánto dio el período" y esta pestaña contesta "cómo se movió". Con
 * pocas ventas en el mes un día bueno mueve el promedio, y desde el número agregado eso es
 * invisible.
 *
 * Las tres vistas son del mismo dato, no de datos distintos: **barras** para comparar días,
 * **curva** para ver la forma y **mapa** para encontrar el día. El selector es global a la
 * pestaña —no uno por panel— porque la comparación entre paneles solo sirve si todos se están
 * leyendo igual.
 *
 * Cada panel puede traer sub-series (`serie.series`): aislar el cash por tipo de cobro, las
 * ventas por forma de pago, los entrantes por setter. Las categorías las elige el backend a
 * partir de los datos, y cuando hay una sola no manda ninguna — una tira de una sola pestaña no
 * es un filtro.
 */

const VISTAS = [
    { key: 'barras', label: 'Barras' },
    { key: 'curva', label: 'Curva' },
    { key: 'mapa', label: 'Mapa' },
];

/** El valor de una serie con su unidad: $ 1.250, 61.3% o 4. */
const valorDe = (serie, v) => {
    if (serie.unidad === '$') return fmt.money(v);
    if (serie.unidad === '%') return `${Number(v).toFixed(1)}%`;
    return fmt.num(Math.round(v));
};

const diaCorto = (iso) => Number(iso.slice(8, 10));

/**
 * El eje rotula uno de cada cuatro días. Con un mes entero, rotular todos deja una tira de
 * números ilegible, y rotular solo el primero y el último obliga a contar celdas para ubicarse.
 */
const Eje = ({ dias }) => (
    <div className="serie-eje">
        {dias.map((d, i) => <span key={d}>{i % 4 === 0 ? diaCorto(d) : ''}</span>)}
    </div>
);

const Barras = ({ serie, activa, dias, max, unico, montado }) => (
    <>
        <div className="serie">
            {activa.vals.map((v, i) => {
                // Un día en cero deja una marca mínima en vez de nada: la ausencia también es
                // un dato, y sin la marca no se distingue de un día que no entró en el período.
                const alto = max ? Math.max((v / max) * 100, v === 0 ? 2 : 6) : 2;
                const color = unico && v === max && v > 0 ? 'brand-secondary'
                    : v === 0 ? 'hueco' : activa.tone;
                return (
                    <i key={dias[i]}
                        style={{
                            height: montado ? `${alto}%` : '2px',
                            background: `var(--${color})`,
                            transitionDelay: `${i * 35}ms`,
                        }}
                        title={`${fmt.fecha(dias[i])} · ${valorDe(serie, v)}`} />
                );
            })}
        </div>
        <Eje dias={dias} />
    </>
);

/**
 * Curva con área. El `viewBox` es de 0 a 100 en los dos ejes con `preserveAspectRatio="none"`,
 * así que el trazo se deformaría al estirarse: lo salva `vector-effect: non-scaling-stroke` en
 * `.curva-linea` (ver comercial.css).
 */
const Curva = ({ serie, activa, dias, max }) => {
    const n = activa.vals.length;
    const tope = max || 1;
    const x = (i) => (n > 1 ? (i / (n - 1)) * 100 : 50);
    const y = (v) => 100 - (v / tope) * 92 - 4;
    const puntos = activa.vals.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
    const area = `M0,100 L${puntos.join(' L')} L100,100 Z`;
    const iPico = activa.vals.indexOf(max);
    const gradiente = `grad-${serie.key}-${activa.label || 'base'}`;

    return (
        <div className="curva">
            <div className="curva-eje">
                <span>{valorDe(serie, max)}</span>
                <span>{valorDe(serie, max / 2)}</span>
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
            </div>
            <span />
            <Eje dias={dias} />
        </div>
    );
};

const Mapa = ({ serie, activa, dias, max }) => (
    <div className="mapa-dias">
        {activa.vals.map((v, i) => {
            const k = max ? v / max : 0;
            return (
                <span key={dias[i]} className="mapa-dia"
                    style={{
                        background: v === 0 ? 'transparent'
                            : `color-mix(in srgb, var(--${activa.tone}) ${Math.round(14 + k * 76)}%, transparent)`,
                        color: `var(--${k > 0.55 ? 'on-state' : 'text-muted'})`,
                    }}
                    title={`${fmt.fecha(dias[i])} · ${valorDe(serie, v)}`}>
                    {diaCorto(dias[i])}
                </span>
            );
        })}
    </div>
);

const PanelSerie = ({ serie, dias, vista }) => {
    const montado = useMontado();
    const [iSub, setISub] = useState(0);

    const subs = serie.series || null;
    const activa = subs
        ? { ...subs[Math.min(iSub, subs.length - 1)] }
        : { vals: serie.vals, tone: serie.tone, label: null };

    const { max, unico, activos, cabecera } = useMemo(() => {
        const conMovimiento = activa.vals.filter(v => v > 0);
        const tope = activa.vals.length ? Math.max(...activa.vals) : 0;
        return {
            max: tope,
            unico: activa.vals.filter(v => v === tope).length === 1,
            activos: conMovimiento.length,
            // Una tasa promedia SOLO los días con movimiento: con los ceros adentro, el show up
            // de un equipo que no trabaja el domingo caería sin que nadie haya faltado a una
            // llamada. Lo que se suma (cash, agendas) sí va entero, que es su total del período.
            cabecera: serie.tipo === 'tasa'
                ? conMovimiento.reduce((a, b) => a + b, 0) / (conMovimiento.length || 1)
                : activa.vals.reduce((a, b) => a + b, 0),
        };
    }, [activa.vals, serie.tipo]);

    const Vista = vista === 'curva' ? Curva : vista === 'mapa' ? Mapa : Barras;

    return (
        <section className="panel caja">
            <Humo colores={[`var(--${activa.tone})`, 'var(--brand-primary)',
                `var(--${activa.tone})`, 'var(--brand-navy)']} tarjeta />
            <PanelCab titulo={`${serie.label} por día`} tip={serie.help}>
                <span style={{ display: 'grid', gap: 2, textAlign: 'right' }}>
                    <span className="num" style={{
                        fontSize: 20, lineHeight: 1, fontWeight: 900, letterSpacing: '-.025em',
                    }}>
                        {valorDe(serie, cabecera)}
                    </span>
                    {/* "promedio diario" y no "promedio" a secas: el promedio de las tasas
                        diarias NO es la tasa del período (medido: 68.0% contra el 61.3% del
                        tile de Show up, porque cada día pesa igual sin importar cuántas
                        llamadas tuvo). Son dos estadísticos distintos y el rótulo es lo que
                        evita que parezca que uno de los dos está mal. */}
                    <span className="t-cap mut40">
                        {serie.tipo === 'tasa' ? 'promedio diario' : 'total del período'}
                    </span>
                </span>
            </PanelCab>

            {subs && subs.length > 1 && (
                <div className="tabs tabs--wrap" role="tablist"
                    aria-label={`Filtro de ${serie.label}`} style={{ marginBottom: 'var(--s3)' }}>
                    {subs.map((sub, i) => (
                        <button key={sub.label} type="button" role="tab" className="tab tab--sm"
                            aria-selected={iSub === i} onClick={() => setISub(i)}>
                            {sub.label}
                        </button>
                    ))}
                </div>
            )}

            <Vista serie={serie} activa={activa} dias={dias} max={max} unico={unico}
                montado={montado} />

            <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s4)', marginTop: 'var(--s3)' }}>
                <span className="t-cap mut40 num">
                    {max === 0 ? 'sin movimiento' : unico
                        ? `pico ${valorDe(serie, max)} · el ${fmt.fecha(dias[activa.vals.indexOf(max)])}`
                        : `tope diario ${valorDe(serie, max)}`}
                </span>
                <span className="t-cap mut40 num" style={{ marginLeft: 'auto' }}>
                    {activos} de {dias.length} días con movimiento
                </span>
            </div>
        </section>
    );
};

const Variabilidad = ({ datos }) => {
    const [vista, setVista] = useState('barras');

    if (!datos) return <Cargando texto="Cargando las series del período…" />;

    const { dias, series } = datos;
    if (!series?.length || !dias?.length) {
        return (
            <section className="panel">
                <div className="vacio">
                    <p className="t-h3">Sin datos en el período</p>
                    <p className="t-cap mut">Elegí un período con actividad para ver cómo se movió.</p>
                </div>
            </section>
        );
    }

    return (
        <>
            <div className="fila barra-tabla">
                <span className="t-rotulo">Vista</span>
                <Segmented chico opciones={VISTAS} valor={vista} onChange={setVista}
                    ariaLabel="Tipo de vista" />
                <span className="t-cap mut40" style={{ marginLeft: 'auto' }}>
                    {fmt.fechaLarga(dias[0])} al {fmt.fechaLarga(dias[dias.length - 1])}
                </span>
            </div>
            <div className="grid-2">
                {series.map(serie => (
                    <PanelSerie key={serie.key} serie={serie} dias={dias} vista={vista} />
                ))}
            </div>
        </>
    );
};

export default Variabilidad;
