import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Hoja from '../talleres/Hoja';
import { cac, dinero, numero, porcentaje, roasTono, veces } from '../talleres/formato';

/**
 * Comparar hasta cuatro talleres lado a lado. El mejor valor de cada fila se marca en verde (en
 * CPL, costo por agenda y CAC gana el menor). La inversión no tiene ganador: gastar más o menos no
 * es bueno ni malo por sí solo.
 */

const FILAS = [
    { key: 'inversion', label: 'Inversión', fmt: dinero, sinGanador: true },
    { key: 'leads', label: 'Leads', fmt: numero },
    { key: 'cpl', label: 'CPL', fmt: (v) => (v == null ? '—' : `$${Number(v).toFixed(2)}`), menor: true },
    { key: 'whatsapp_leads', label: 'En WhatsApp', fmt: numero },
    { key: 'show_up', label: 'Show up', fmt: numero },
    { key: 'show_up_rate', label: 'Show up %', fmt: porcentaje },
    { key: 'agendas_exitosas', label: 'Agendas', fmt: numero },
    { key: 'costo_por_agenda', label: 'Costo por agenda', fmt: dinero, menor: true },
    { key: 'show_up_sales_call', label: 'Asistieron a la llamada', fmt: numero },
    { key: 'sales', label: 'Ventas', fmt: numero },
    { key: 'pct_close_rate', label: 'Close rate', fmt: porcentaje },
    { key: 'cash_collected', label: 'Cash cobrado', fmt: dinero },
    { key: 'ticket_promedio', label: 'Ticket promedio', fmt: dinero },
    { key: 'cac', label: 'CAC', fmt: dinero, menor: true, de: cac },
    { key: 'roas', label: 'ROAS', fmt: veces },
];

const valorDe = (fila, e) => (fila.de ? fila.de(e) : e[fila.key]);

const ganadorDe = (fila, eventos) => {
    if (fila.sinGanador) return null;
    let mejor = null;
    eventos.forEach((e) => {
        const v = valorDe(fila, e);
        if (v == null) return;
        if (!mejor || (fila.menor ? v < mejor.v : v > mejor.v)) mejor = { id: e.id, v };
    });
    return mejor?.id ?? null;
};

const WorkshopCompareModal = ({ events, onClose, formatDate }) => {
    const quieto = useReducedMotion();
    return (
        <Hoja titulo="Comparar talleres" onCerrar={onClose}
            cabeza={<><p className="t-eyebrow">Lado a lado</p><h2 className="t-h2">Comparar talleres</h2></>}>
            <div className="cmp-scroll wt-cmp-caja">
                <table className="wt-cmp" style={{ '--n': events.length }}>
                    <thead>
                        <tr>
                            <th scope="col"><span className="t-rotulo">Métrica</span></th>
                            {events.map((e) => (
                                <th key={e.id} scope="col">
                                    <small className="num">{formatDate(e.date)}</small>
                                    <span className="wt-cmp-nom" title={e.name}>{e.name}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {FILAS.map((fila, i) => {
                            const ganador = ganadorDe(fila, events);
                            return (
                                <motion.tr key={fila.key}
                                    initial={quieto ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                    transition={quieto ? { duration: 0 } : { duration: 0.24, delay: i * 0.02 }}>
                                    <th scope="row">{fila.label}</th>
                                    {events.map((e) => {
                                        const v = valorDe(fila, e);
                                        const color = fila.key === 'roas' ? `var(--${roasTono(v)})` : undefined;
                                        return (
                                            <td key={e.id} className={`num${e.id === ganador ? ' wt-cmp-gana' : ''}`} style={color ? { color } : undefined}>
                                                {fila.fmt(v)}
                                            </td>
                                        );
                                    })}
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Hoja>
    );
};

export default WorkshopCompareModal;
