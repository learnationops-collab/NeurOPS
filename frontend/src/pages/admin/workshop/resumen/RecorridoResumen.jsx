import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import FlujoEmbudo from '../../../comercial/components/FlujoEmbudo';
import { PanelCab } from '../../../comercial/components/Shared';
import { Bars, Skeleton, SkeletonBlock } from '../../../../components/standard';
import { aggregateTotals } from '../funnelMath';
import { LISTA_DE_PASO } from '../registros/cuentaDeTaller';
import { TITULOS } from '../registros/cuentas';
import { dinero, numero, ORIGEN, origenDePaso, pasosEmbudo, veces } from '../talleres/formato';

/**
 * «Del anuncio al cobro» (Kerwin, 29/10/2026): el recorrido de las personas de los talleres elegidos en un
 * solo dibujo, para ver de dónde sale cada número sin leer nada.
 *
 *  - Arriba, el embudo con los MISMOS nueve pasos y la misma base de cada porcentaje que la Salud del
 *    embudo y el detalle de un taller (`pasosEmbudo`): lo que dice una píldora es lo que dice la tabla.
 *    Cada barra abre la lista que la suma (`onVer`, de `useRegistrosWorkshop`).
 *  - Abajo a la izquierda, qué pasó con las agendas: asistieron, no asistieron, sin reporte, el resto.
 *  - Abajo a la derecha, la plata: lo invertido contra New Cash y Cash total, con su ROAS.
 *
 * El color dice el origen del número: Meta, lo que carga o sincroniza el taller, y las personas del libro
 * de agendas. Mismos tonos que las agendas de un taller (success / error / warning).
 */

/** Las agendas partidas por lo que pasó con cada una; el resto son las que se cayeron o todavía no ocurren. */
export const partesDeAgendas = (t) => {
    const asistieron = t.show_up_sales_call || 0;
    const noShow = Math.max(0, (t.citas_reportadas || 0) - asistieron);
    const sinReporte = t.citas_sin_reportar || 0;
    const resto = Math.max(0, (t.agendas_exitosas || 0) - asistieron - noShow - sinReporte);
    return [
        { key: 'asistieron', label: 'Asistieron', n: asistieron, color: 'var(--success)', lista: 'show_up', tip: 'Se presentaron a su llamada' },
        { key: 'no_show', label: 'No asistieron', n: noShow, color: 'var(--error)', lista: 'reportadas', tip: 'Con resultado «no show»: están en Citas con resultado' },
        { key: 'sin_reporte', label: 'Sin reporte', n: sinReporte, color: 'var(--warning)', lista: 'agendas', tip: 'Nadie reportó su llamada todavía' },
        { key: 'resto', label: 'Otras', n: resto, color: 'var(--text-muted-40)', lista: 'agendas', tip: 'Canceladas, reagendadas o con la llamada por venir' },
    ];
};

const Agendas = ({ totales, onVer }) => {
    const partes = partesDeAgendas(totales).filter((p) => p.n > 0);
    const total = totales.agendas_exitosas || 0;
    return (
        <section className="wr-subpanel" aria-label="Qué pasó con las agendas">
            <p className="t-eyebrow">Agendas</p>
            {total === 0 ? <p className="t-cap mut40">Ninguna todavía.</p> : (
                <>
                    <div className="wr-apilada" role="img" aria-label={partes.map((p) => `${p.label} ${p.n}`).join(', ')}>
                        {partes.map((p) => (
                            <button key={p.key} type="button" style={{ flexGrow: p.n, '--c': p.color }} data-tip={`${p.label}|${p.tip}`}
                                onClick={() => onVer?.(p.lista, TITULOS[p.lista])} aria-label={`${p.label}: ${p.n}. Ver la lista`} />
                        ))}
                    </div>
                    <dl className={`wr-agendas${partes.length === 4 ? ' wr-agendas--4' : ''}`}>
                        {partes.map((p) => (
                            <div key={p.key} style={{ '--c': p.color }}>
                                <dt>{p.label}</dt>
                                <dd className="num">{numero(p.n)}<small>{Math.round((p.n / total) * 100)}%</small></dd>
                            </div>
                        ))}
                    </dl>
                </>
            )}
        </section>
    );
};

const Cobros = ({ totales, onVer }) => {
    const filas = [
        { key: 't_inversion', label: 'Invertido', value: totales.inversion, color: ORIGEN.meta.color, detail: '' },
        { key: 'new_cash', label: 'New Cash', value: totales.cash_ventas, color: 'var(--success)', detail: veces(totales.roas_nc) },
        { key: 'cash_total', label: 'Cash total', value: totales.cash, color: 'var(--success)', detail: veces(totales.roas) },
    ];
    return (
        <section className="wr-subpanel wr-cobros" aria-label="Lo invertido contra lo cobrado">
            <p className="t-eyebrow">Invertido y cobrado</p>
            <Bars variant="rows" label="Lo invertido contra lo cobrado" onSelect={(key) => onVer?.(key, TITULOS[key])}
                items={filas.map((f) => ({ ...f, display: dinero(f.value), tip: f.detail ? `ROAS ${f.detail}` : undefined }))} />
        </section>
    );
};

/** Mismas medidas que el panel real (≈ 330 px a 1440): al llegar el dato, nada de abajo se mueve. */
export const EsqueletoRecorrido = () => (
    <Skeleton label="Cargando el recorrido…" className="panel wr-recorrido">
        <SkeletonBlock height={26} width={220} radius={8} />
        <SkeletonBlock height={150} radius={14} step={1} style={{ marginTop: 14 }} />
        <div className="wr-recorrido-pie">
            <SkeletonBlock height={74} radius={12} step={2} />
            <SkeletonBlock height={74} radius={12} step={3} />
        </div>
    </Skeleton>
);

/** `plata`: los totales de `totalesResumen` (inversión, New Cash, Cash total y sus ROAS), los mismos de las tarjetas. */
const RecorridoResumen = ({ talleres, plata, onVer = null }) => {
    const reducir = useReducedMotion();
    const totales = useMemo(() => aggregateTotals(talleres), [talleres]);
    const etapas = useMemo(() => pasosEmbudo(totales).map((p) => {
        const origen = origenDePaso(p.key);
        const lista = LISTA_DE_PASO[p.key];
        return {
            key: p.key, label: p.label, n: p.n, ayuda: p.ayuda, base: p.base, color: origen.color,
            ir: onVer && lista ? () => onVer(lista, TITULOS[lista] || p.label) : undefined,
        };
    }), [totales, onVer]);

    return (
        <motion.section className="panel wr-recorrido" aria-label="Del anuncio al cobro"
            initial={reducir ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 0.7, 0.2, 1] }}>
            <PanelCab titulo="Del anuncio al cobro" tip="Cada barra abre las filas que la suman.">
                <div className="leyenda wr-leyenda-origen" aria-label="Origen de cada número">
                    {Object.values(ORIGEN).map((o) => <span key={o.label}><i style={{ background: o.color }} />{o.label}</span>)}
                </div>
            </PanelCab>
            <FlujoEmbudo etapas={etapas} color="var(--brand-secondary)" />
            <div className="wr-recorrido-pie">
                <Agendas totales={totales} onVer={onVer} />
                <Cobros totales={plata} onVer={onVer} />
            </div>
        </motion.section>
    );
};

export default RecorridoResumen;
