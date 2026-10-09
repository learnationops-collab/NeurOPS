import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Barra, EsqueletoFilas, PanelCab, Tip } from '../Shared';
import { dinero } from './comun';
import * as apiFz from './finanzasApi';
import './procedencia.css';

/**
 * Ingresos por procedencia, en el Resumen de Finanzas (pedido del usuario, 08/10/2026): de dónde
 * entró la plata del período —workshop, setting, VSL, Fulfillment o sin procedencia— con lo que
 * pesa cada uno y su detalle (el vivo y la grabación del workshop, cada setter…).
 *
 * Qué pago va en qué balde lo decide el backend (`procedencia_ingresos_service`), con la misma
 * atribución que la columna Fuente del listado de ventas y la nómina: acá solo se dibuja. Los cinco
 * baldes llegan siempre, también en cero, para que el panel no cambie de forma de un mes a otro, y
 * suman al centavo el ingreso del Resumen.
 *
 * Las barras miden contra el TOTAL, también las del detalle: así las de un balde, puestas una
 * detrás de otra, dan la barra del balde.
 *
 * Recibe `desde`/`hasta` (YYYY-MM-DD) y no el mes: el Resumen hoy se mira por mes (`rangoDelMes`),
 * pero el panel no tiene por qué saberlo.
 */

const v = (tono) => `var(--${tono})`;

const AYUDAS = {
    workshop: 'La clase en vivo y la grabación de la landing. Son el mismo workshop: suman juntas, y abajo se ve cuánto aportó cada una.',
    setting: 'Las agendas que consiguió cada setter. «Sin identificar» es el link de un setter que no dejó su nombre.',
    vsl: 'Las agendas que entraron por el embudo de la VSL.',
    fulfillment: 'Renovaciones y upsells, que los trae Fulfillment y no un embudo, más los pagos de sus agendas.',
    sin_procedencia: 'Pagos sin una agenda que los origine, o con una fuente que no es ninguna de las de arriba.',
};

/** {desde, hasta} (YYYY-MM-DD) del mes 'YYYY-MM'. */
export const rangoDelMes = (mes) => {
    const [anio, m] = mes.split('-').map(Number);
    const ultimo = new Date(anio, m, 0).getDate();
    return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
};

const pct = (n) => (n === null || n === undefined ? '—' : `${n.toFixed(1)}%`);

// La primera columna tiene lugar para «Sin procedencia» con su «i» enteros; por debajo de `--min`
// la tabla scrollea de costado, como la de Medios de pago, en vez de cortar los rótulos.
const COLS = { '--cols': 'minmax(172px,1.1fr) minmax(80px,1.3fr) 56px 118px 56px', '--min': '600px' };

const Procedencia = ({ desde, hasta }) => {
    const [datos, setDatos] = useState(null);
    const [fallo, setFallo] = useState(false);

    useEffect(() => {
        let vigente = true;
        setDatos(null);
        setFallo(false);
        apiFz.getProcedencia(desde, hasta)
            .then((d) => { if (vigente) setDatos(d); })
            .catch(() => {
                if (!vigente) return;
                setFallo(true);
                toast.error('No se pudo cargar la procedencia de los ingresos');
            });
        return () => { vigente = false; };
    }, [desde, hasta]);

    // La barra de cada fila, en % del total. Un reembolso que deja un balde en negativo no dibuja.
    const ancho = (monto) => (datos?.total > 0 ? (monto / datos.total) * 100 : 0);

    // Filas en orden, con su lugar (`--i`) para que las barras entren de a una.
    let i = 0;
    const filas = (datos?.procedencias || []).flatMap((p) => [
        { tipo: 'balde', p, i: i++ },
        ...p.detalle.map(d => ({ tipo: 'detalle', p, d, i: i++ })),
    ]);

    return (
        <section className="panel">
            <PanelCab titulo="Ingresos por procedencia"
                tip="De dónde entró el ingreso del período: el embudo que trajo cada pago, según la agenda que lo originó (la misma que dice la columna Fuente de las ventas y la nómina). Una cuota cuenta para el embudo de su venta. Neto de la comisión de la pasarela: suma lo mismo que «Ingresos»." />
            {fallo && <p className="fz-vacio">No se pudo cargar la procedencia de los ingresos.</p>}
            {!fallo && !datos && <EsqueletoFilas rotulo="Cargando la procedencia…" lineas={6} />}
            {datos && datos.cantidad === 0 && <p className="fz-vacio">No hubo ingresos en este período.</p>}
            {datos && datos.cantidad > 0 && (
                <div className="fz-scroll">
                    <div className="fz-tabla pr-tabla" style={COLS}>
                        <div className="fz-cab">
                            <span>Procedencia</span>
                            <span className="pr-barra" aria-hidden="true" />
                            <span className="fz-der">
                                Pagos <Tip titulo="Pagos" texto="Cuántos cobros entraron: una venta en cuotas suma uno por cada cuota del período." />
                            </span>
                            <span className="fz-der">Neto</span>
                            <span className="fz-der">%</span>
                        </div>
                        {filas.map(({ tipo, p, d, i: lugar }) => (tipo === 'balde' ? (
                            <div key={p.key} className="fz-fila pr-fila" style={{ '--i': lugar }}
                                data-vacio={p.cantidad ? undefined : '1'}>
                                <span className="fila" style={{ gap: 9, minWidth: 0 }}>
                                    <span className="cab-punto" style={{ background: v(p.tone) }} />
                                    <span className="trunc" style={{ fontWeight: 700 }}>{p.label}</span>
                                    <Tip texto={AYUDAS[p.key]} titulo={p.label} />
                                </span>
                                <Barra valor={ancho(p.monto)} color={v(p.tone)} />
                                <span className="tdatos-p">{p.cantidad}</span>
                                <span className="fz-n fz-der">{dinero(p.monto)}</span>
                                <span className="tdatos-p">{pct(p.pct)}</span>
                            </div>
                        ) : (
                            <div key={`${p.key}-${d.key}`} className="fz-fila pr-sub" style={{ '--i': lugar }}>
                                <small className="pr-sub-nom trunc">{d.label}</small>
                                <Barra valor={ancho(d.monto)} color={v(p.tone)} fino />
                                <span className="tdatos-p">{d.cantidad}</span>
                                <small className="pr-sub-n fz-der">{dinero(d.monto)}</small>
                                <span className="tdatos-p">{pct(d.pct)}</span>
                            </div>
                        )))}
                        <div className="fz-fila fz-total">
                            <span className="fz-rot">Total</span>
                            <span className="pr-barra" />
                            <span className="tdatos-p">{datos.cantidad}</span>
                            <span className="fz-n fz-der">{dinero(datos.total)}</span>
                            <span className="tdatos-p">{datos.total > 0 ? '100%' : '—'}</span>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default Procedencia;
