import React, { useState } from 'react';
import { FalloCarga, Segmented, fmt } from './Shared';
import { Skeleton, SkeletonChart } from '../../../components/standard';
import PanelSerie from './variabilidad/PanelSerie';
import { CAPAS, REFERENCIAS, useCapas } from './variabilidad/capas';
import './variabilidad/variabilidad.css';

/**
 * Analizar → Variabilidad: la serie por día de cada métrica, y qué la movió.
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
 * Lo mismo vale para las **capas** (24/10/2026), que se prenden y se apagan desde una sola barra para
 * que la pestaña no sature: *Comparar* (el período anterior o la semana anterior, día contra día),
 * *Picos y caídas* (media, banda normal y los días que salen), *Tendencia* (media móvil, acumulado y
 * ritmo) y *Personas* (quién explica cada día). Todas apagadas es la serie de siempre. Las cuentas
 * viven en `variabilidad/estadisticos.js`; lo que llega del backend es la serie, la misma serie del
 * otro período y lo que puso cada persona (ver `comercial_variabilidad`).
 *
 * Cada panel puede traer sub-series (`serie.series`): aislar el cash por tipo de cobro, las
 * ventas por forma de pago, los entrantes por setter. Las categorías las elige el backend a
 * partir de los datos, y cuando hay una sola no manda ninguna — una tira de una sola pestaña no
 * es un filtro.
 *
 * **Cada día es cliqueable y abre la lista de ESE día**, con la sub-serie activa como corte. No se
 * recorta el rango de fechas del backend: el día pedido ya está dentro de las filas que se
 * cargaron para el período, así que se filtra con la faceta `dia` (ver `tablasDef.js`) y todo —los
 * contadores, el "mostrando X de Y" y la tira de totales— sigue cerrando sobre el mismo conjunto.
 */

const VISTAS = [
    { key: 'barras', label: 'Barras' },
    { key: 'curva', label: 'Curva' },
    { key: 'mapa', label: 'Mapa' },
];

// El alto del gráfico del esqueleto: el panel de una serie mide eso más su cabecera (a 1330 px). Son
// 238 de la serie sola más 66 de la leyenda y los avisos de las capas que arrancan prendidas.
const SERIE_ALTO = 304;

/** Los paneles de las series mientras llegan: seis los de closers, cinco los de setters. */
const EsqueletoSeries = ({ rol }) => (
    <Skeleton label="Cargando las series del período…">
        <div className="grid-2 grid-2--series">
            {Array.from({ length: rol === 'setters' ? 5 : 6 }, (_, i) => (
                <SkeletonChart key={i} className="panel caja" height={SERIE_ALTO} bars={16} step={i} />
            ))}
        </div>
    </Skeleton>
);

/** Contra qué se compara: la que se pidió si existe; si no, la que haya. */
const referenciaEfectiva = (datos, pedida) => {
    const hay = datos?.referencias || {};
    if (hay[pedida]) return pedida;
    return hay.previo ? 'previo' : hay.semana ? 'semana' : null;
};

/** «Período anterior» solo si el comparado termina el día antes de empezar el actual. */
const nombreDe = (clave, datos) => {
    if (clave === 'semana') return 'Semana anterior';
    const r = datos?.referencias?.previo;
    const inicio = datos?.dias?.[0];
    if (r && inicio) {
        const antes = new Date(`${inicio}T12:00:00`);
        antes.setDate(antes.getDate() - 1);
        if (r.end === antes.toISOString().slice(0, 10)) return 'Período anterior';
    }
    return 'Período comparado';
};

const BarraCapas = ({ capas, alternar, poner, datos, listo }) => {
    const hay = listo ? datos.referencias || {} : {};
    const opciones = REFERENCIAS.filter(r => hay[r.key])
        .map(r => ({ key: r.key, label: nombreDe(r.key, datos) }));
    return (
        <>
            <span className="t-rotulo capas-rotulo">Capas</span>
            <div className="tabs tabs--wrap" role="group" aria-label="Capas de lectura">
                {CAPAS.map(c => (
                    <button key={c.key} type="button" className="tab tab--sm" title={c.tip}
                        aria-pressed={!!capas[c.key]} onClick={() => alternar(c.key)}>
                        {c.label}
                    </button>
                ))}
            </div>
            {capas.comparar && opciones.length > 1 && (
                <Segmented chico opciones={opciones} valor={referenciaEfectiva(datos, capas.referencia)}
                    onChange={(referencia) => poner({ referencia })} ariaLabel="Contra qué comparar" />
            )}
        </>
    );
};

const Variabilidad = ({ datos, rol, irA, fallo = false, onReintentar = null }) => {
    const [vista, setVista] = useState('barras');
    const { capas, alternar, poner } = useCapas();

    // Las series de otro rol (las de closers recién cambiado a setters) no se dibujan.
    const listo = !!datos && (!datos.rol || datos.rol === rol);
    if (!listo && fallo) return <FalloCarga texto="No se pudieron cargar las series" onReintentar={onReintentar} />;

    const { dias, series } = listo ? datos : {};
    if (listo && (!series?.length || !dias?.length)) {
        return (
            <section className="panel">
                <div className="vacio">
                    <p className="t-h3">Sin datos en el período</p>
                    <p className="t-cap mut">Elegí un período con actividad para ver cómo se movió.</p>
                </div>
            </section>
        );
    }

    const refKey = listo ? referenciaEfectiva(datos, capas.referencia) : null;

    return (
        <>
            <div className="fila barra-tabla">
                <span className="t-rotulo">Vista</span>
                <Segmented chico opciones={VISTAS} valor={vista} onChange={setVista}
                    ariaLabel="Tipo de vista" />
                <BarraCapas capas={capas} alternar={alternar} poner={poner} datos={datos} listo={listo} />
                {listo && (
                    <span className="t-cap mut40" style={{ marginLeft: 'auto' }}>
                        {fmt.fechaLarga(dias[0])} al {fmt.fechaLarga(dias[dias.length - 1])}
                    </span>
                )}
            </div>
            {/* `grid-2--series`: con un número impar de series (las cinco del setter) la última
                ocupa la fila entera en vez de quedar sola debajo de una columna. */}
            {!listo ? <EsqueletoSeries rol={rol} /> : <div className="grid-2 grid-2--series">
                {series.map(serie => (
                    <PanelSerie key={serie.key} serie={serie} dias={dias} hoy={datos.hoy} vista={vista}
                        rol={rol} irA={irA} capas={capas} refKey={refKey}
                        refNombre={refKey ? nombreDe(refKey, datos) : ''}
                        refRango={refKey ? datos.referencias[refKey] : null} />
                ))}
            </div>}
        </>
    );
};

export default Variabilidad;
