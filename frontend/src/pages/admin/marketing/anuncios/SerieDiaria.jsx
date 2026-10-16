import { useState } from 'react';
import { useMontado } from '../../../comercial/components/Shared';
import { dinero } from './metricas';

/**
 * Columnas por día, apiladas (de abajo hacia arriba en el orden de `capas`). Sin ejes dobles: el
 * gasto y los leads son dos gráficos distintos (ver `SerieDiaria`). El valor exacto de cada día va en
 * el tooltip al pasar por la columna, que es más ancha que la barra para que se pueda apuntar.
 */
const diaCorto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export const Columnas = ({ dias, capas, formato, etiqueta, vacio }) => {
    const montado = useMontado();
    const [encima, setEncima] = useState(null);
    const totales = dias.map((d) => capas.reduce((s, c) => s + (d[c.key] || 0), 0));
    const max = Math.max(0, ...totales);
    // Uno de cada N días rotulado: con un mes entero, rotularlos todos es una tira ilegible.
    const cada = dias.length > 45 ? 7 : dias.length > 14 ? 4 : 1;
    const dia = encima !== null ? dias[encima] : null;

    return (
        <div className="mk-serie" role="img" aria-label={etiqueta}>
            <div className="mk-serie-tope num" aria-hidden="true">{max ? formato(max) : ''}</div>
            <div className="mk-serie-lienzo" onMouseLeave={() => setEncima(null)}>
                <i className="mk-serie-guia" style={{ bottom: '50%' }} aria-hidden="true" />
                {!max && vacio && <p className="mk-serie-vacio">{vacio}</p>}
                {dias.map((d, i) => (
                    <div key={d.dia} className={`mk-serie-col${encima === i ? ' mk-serie-col--on' : ''}`}
                        onMouseEnter={() => setEncima(i)}>
                        {capas.map((c) => {
                            const v = d[c.key] || 0;
                            if (!v) return null;
                            const alto = max ? (v / max) * 100 : 0;
                            return (
                                <i key={c.key} style={{
                                    height: montado ? `${alto}%` : 0,
                                    background: c.color,
                                    transitionDelay: `${Math.min(i, 40) * 12}ms`,
                                }} />
                            );
                        })}
                        {!totales[i] && <i className="mk-serie-cero" />}
                    </div>
                ))}
                {dia && (
                    <div className="mk-serie-tip" role="tooltip"
                        style={{ left: `${((encima + 0.5) / dias.length) * 100}%` }}>
                        <b>{diaCorto(dia.dia)}</b>
                        {capas.map((c) => (
                            <span key={c.key} className="mk-serie-tip-fila">
                                {capas.length > 1 && <i style={{ background: c.color }} />}
                                {c.label}<strong className="num">{formato(dia[c.key] || 0)}</strong>
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div className="mk-serie-eje num" aria-hidden="true">
                {dias.map((d, i) => <span key={d.dia}>{i % cada === 0 ? Number(d.dia.slice(8, 10)) : ''}</span>)}
            </div>
        </div>
    );
};

/** De abajo hacia arriba: los resueltos (calificados y descalificados) y los pendientes. Los cuatro se
 *  ven siempre, aunque alguno dé 0 en el período (Kerwin, 16/10/2026: «ya no veo los descalificados»). */
const ENTRANTES = [
    { key: 'calificados', label: 'Calificados', color: 'var(--cat-2)' },
    { key: 'descalificados', label: 'Descalificados', color: 'var(--cat-3)' },
    { key: 'en_conversacion', label: 'En conversación', color: 'var(--cat-6)' },
    { key: 'sin_respuesta', label: 'Sin respuesta', color: 'var(--mk-resto)' },
];

/** Los dos gráficos del período: leads por día (por estado) y gasto por día. */
const SerieDiaria = ({ serie, moneda, alcance, metaConectado }) => {
    const dias = serie;
    const entero = (v) => Number(v).toLocaleString('en-US');
    return (
        <div className="grid-2 mk-series">
            <section className="panel mk-panel-serie">
                <div className="panel-cab">
                    <div className="mk-cab-txt">
                        <p className="t-eyebrow">Leads entrantes por día</p>
                        <p className="t-cap mut40">{alcance}</p>
                    </div>
                    <div className="panel-cab-der mk-leyenda" aria-label="Leyenda">
                        {ENTRANTES.map((c) => (
                            <span key={c.key}><i style={{ background: c.color }} />{c.label}</span>
                        ))}
                    </div>
                </div>
                <Columnas dias={dias} capas={ENTRANTES} formato={entero}
                    etiqueta={`Leads entrantes por día, ${alcance}`} vacio="No entraron leads en el período." />
            </section>
            <section className="panel mk-panel-serie">
                <div className="panel-cab">
                    <div className="mk-cab-txt">
                        <p className="t-eyebrow">Importe gastado por día</p>
                        <p className="t-cap mut40">{alcance}</p>
                    </div>
                </div>
                <Columnas dias={dias} capas={[{ key: 'gasto', label: 'Gastado', color: 'var(--brand-secondary)' }]}
                    formato={(v) => dinero(v, moneda)} etiqueta={`Importe gastado por día, ${alcance}`}
                    vacio={metaConectado
                        ? 'Meta no registró gasto en estos días para estas palabras clave.'
                        : 'Sin gasto: cuando Meta Ads esté conectado, el gasto de cada día llega solo.'} />
            </section>
        </div>
    );
};

export default SerieDiaria;
