import React from 'react';
import { dinero } from './comun';

/**
 * El detalle de ventas de cada persona, solo para el PDF de Payroll (08/10/2026). En pantalla las
 * ventas se ven al tocar el tile (`VentasDePersona`); en el papel no hay clic, así que va acá,
 * después del resumen y en hoja nueva.
 *
 * Son las personas que se están viendo (grupos prendidos y, si hay, las elegidas en el
 * desplegable), en el mismo orden que los tiles. Cada una con todas sus ventas del período: las
 * que se sacaron de la nómina van tachadas y no suman, así que el total cierra con el del tile. Su
 * sueldo base del período, si tiene, va en el encabezado: la tabla es solo de comisiones.
 */

const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
export const FUENTES = { renovacion: 'Renovación', upsell: 'Upsell', conversion: 'Conversión', cuota: 'Cuota' };
// Las ventas de Marlon (08/10/2026): las suyas le pagan como closer y las de los otros, como director.
export const CONCEPTOS = { propia: 'Propia', director: 'Director' };

const TablaPersona = ({ persona, datos }) => {
    const ventas = [...(datos.sales || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
    // Una columna más cuando el % depende de algo de la venta: la fuente en Fulfillment, el
    // concepto en las dos partidas de Marlon.
    const extra = persona.rol === 'Fulfillment' ? { titulo: 'Fuente', de: v => FUENTES[v.fuente] || v.fuente }
        : datos.desglose ? { titulo: 'Concepto', de: v => CONCEPTOS[v.concepto] || v.concepto } : null;
    const neto = ventas.filter(v => !v.is_excluded_from_payroll).reduce((t, v) => t + (v.monto_neto || 0), 0);
    const excluidas = ventas.filter(v => v.is_excluded_from_payroll).length;
    const pct = datos.desglose
        ? Object.entries(CONCEPTOS).filter(([k]) => datos.desglose[k])
            .map(([k, rotulo]) => `${rotulo.toLowerCase()} ${datos.desglose[k].porcentaje ?? '—'}%`).join(' · ')
        : datos.porcentaje_comision == null ? null : `${datos.porcentaje_comision}%`;

    return (
        <section className="fz-detalle-persona" aria-label={`Ventas de ${persona.nombre}`}>
            <h3 className="fz-detalle-nom">
                {persona.nombre}
                <span>
                    {persona.rol}{pct ? ` · ${pct}` : ''}
                    {datos.sueldo_base > 0 ? ` · sueldo base ${dinero(datos.sueldo_base)}` : ''}
                </span>
            </h3>
            {ventas.length === 0 ? (
                <p className="fz-detalle-vacio">Sin ventas que le paguen comisión en el período.</p>
            ) : (
                <table className="fz-detalle-tabla">
                    <thead>
                        <tr>
                            <th className="c-fecha">Fecha</th>
                            <th>Cliente</th>
                            <th className="c-tipo">Tipo de pago</th>
                            <th className="c-metodo">Método</th>
                            {extra && <th className="c-fuente">{extra.titulo}</th>}
                            <th className="fz-der c-pct">%</th>
                            <th className="fz-der c-monto">Neto</th>
                            <th className="fz-der c-monto">Comisión</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ventas.map(venta => {
                            const excluida = venta.is_excluded_from_payroll;
                            return (
                                <tr key={venta.id} className={excluida ? 'fz-excluida' : undefined}>
                                    <td className="num">{fecha(venta.date)}</td>
                                    <td className="fz-tachable">{venta.nombre_cliente}</td>
                                    <td>{venta.tipo_pago}</td>
                                    <td>{venta.metodo_pago}</td>
                                    {extra && <td>{extra.de(venta)}</td>}
                                    <td className="fz-der num">{venta.porcentaje != null ? `${venta.porcentaje}%` : '—'}</td>
                                    <td className="fz-der num">{dinero(venta.monto_neto)}</td>
                                    <td className="fz-der num fz-tachable">{excluida ? 'Excluida' : dinero(venta.comision)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={extra ? 6 : 5}>
                                {datos.total_ventas} {datos.total_ventas === 1 ? 'venta suma' : 'ventas suman'}
                                {excluidas ? ` · ${excluidas} ${excluidas === 1 ? 'excluida' : 'excluidas'}` : ''}
                            </td>
                            <td className="fz-der num">{dinero(neto)}</td>
                            <td className="fz-der num">{dinero(datos.comision_total)}</td>
                        </tr>
                    </tfoot>
                </table>
            )}
        </section>
    );
};

const DetalleNomina = ({ personas, datos }) => (
    <div className="fz-detalle">
        <p className="t-eyebrow">Detalle de ventas por persona</p>
        {personas.filter(p => datos[p.id]).map(p => <TablaPersona key={p.id} persona={p} datos={datos[p.id]} />)}
    </div>
);

export default DetalleNomina;
