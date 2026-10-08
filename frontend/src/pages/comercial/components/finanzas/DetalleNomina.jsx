import React from 'react';
import { dinero } from './comun';

/**
 * El detalle de ventas de cada persona, solo para el PDF de Payroll (08/10/2026). En pantalla las
 * ventas se ven en Revisar (el clic en el tile); en el papel no hay clic, así que va acá, después
 * del resumen y en hoja nueva.
 *
 * Son las personas que se están viendo (grupos prendidos y, si hay, las elegidas en el
 * desplegable), en el mismo orden que los tiles. Cada una con todas sus ventas del período: las
 * que se sacaron de la nómina van tachadas y no suman, así que el total cierra con el del tile.
 */

const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const FUENTES = { renovacion: 'Renovación', upsell: 'Upsell', conversion: 'Conversión', cuota: 'Cuota' };

const TablaPersona = ({ persona, datos }) => {
    const ventas = [...(datos.sales || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
    const fulfillment = persona.rol === 'Fulfillment';
    const neto = ventas.filter(v => !v.is_excluded_from_payroll).reduce((t, v) => t + (v.monto_neto || 0), 0);
    const excluidas = ventas.filter(v => v.is_excluded_from_payroll).length;
    const pct = datos.porcentaje_comision == null ? null : `${datos.porcentaje_comision}%`;

    return (
        <section className="fz-detalle-persona" aria-label={`Ventas de ${persona.nombre}`}>
            <h3 className="fz-detalle-nom">
                {persona.nombre}
                <span>{persona.rol}{pct ? ` · ${pct}` : ''}</span>
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
                            {fulfillment && <th className="c-fuente">Fuente</th>}
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
                                    {fulfillment && <td>{FUENTES[venta.fuente] || venta.fuente}</td>}
                                    <td className="fz-der num">{venta.porcentaje != null ? `${venta.porcentaje}%` : '—'}</td>
                                    <td className="fz-der num">{dinero(venta.monto_neto)}</td>
                                    <td className="fz-der num fz-tachable">{excluida ? 'Excluida' : dinero(venta.comision)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={fulfillment ? 6 : 5}>
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
