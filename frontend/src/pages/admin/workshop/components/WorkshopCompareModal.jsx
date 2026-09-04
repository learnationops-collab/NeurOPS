import React from 'react';
import { X } from 'lucide-react';

const ROWS = [
    { key: 'inversion', label: 'Inversión', fmt: 'currency' },
    { key: 'leads', label: 'Leads', fmt: 'number' },
    { key: 'whatsapp_leads', label: 'Leads en WhatsApp', fmt: 'number' },
    { key: 'show_up', label: 'Show up webinar', fmt: 'number' },
    { key: 'agendas_exitosas', label: 'Agendas exitosas', fmt: 'number' },
    { key: 'show_up_sales_call', label: 'Show up cita', fmt: 'number' },
    { key: 'sales', label: 'Ventas', fmt: 'number' },
    { key: 'cash_collected', label: 'Cash cobrado', fmt: 'currency' },
    { key: 'cpl', label: 'CPL', fmt: 'currency' },
    { key: 'costo_por_agenda', label: 'Costo por agenda', fmt: 'currency' },
    { key: 'ticket_promedio', label: 'Ticket promedio', fmt: 'currency' },
    { key: 'roas', label: 'ROAS', fmt: 'roas' },
];

const WorkshopCompareModal = ({ events, onClose, formatDate, formatCurrency }) => {
    const fmtVal = (val, fmt) => {
        if (fmt === 'currency') return formatCurrency(val || 0);
        if (fmt === 'roas') return `${(val || 0).toFixed(2)}x`;
        return (val || 0).toLocaleString('en-US');
    };

    // Mejor valor de cada fila resaltado en verde — a simple vista, cuál
    // taller gana en cada métrica (costo por agenda/CPL: menor es mejor).
    // "Inversión" queda sin ganador: gastar más o menos no es en sí mismo
    // bueno ni malo, depende de lo que devolvió — no confundir marcando un
    // monto más alto como "mejor".
    const bestId = (row) => {
        if (row.key === 'inversion') return null;
        const lowerIsBetter = row.key === 'cpl' || row.key === 'costo_por_agenda';
        return events.reduce((best, e) => {
            const v = e[row.key] || 0;
            const bv = best ? best[row.key] || 0 : null;
            if (bv === null) return e;
            return lowerIsBetter ? (v < bv ? e : best) : (v > bv ? e : best);
        }, null)?.id;
    };

    return (
        <div className="modal-overlay">
            <button type="button" className="modal-backdrop" aria-label="Cerrar ventana de comparación" onClick={onClose} />
            <div className="action-modal wide" role="dialog" aria-modal="true" aria-label="Comparar talleres">
                <header>
                    <div>
                        <p className="eyebrow">Lectura lado a lado</p>
                        <h2>Comparar talleres</h2>
                        <p>{events.length} seleccionados</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
                </header>
                <div className="modal-body">
                    <div className="comparison-panel" style={{ padding: 0, border: 0, background: 'transparent', boxShadow: 'none' }}>
                    <div className="comparison-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th scope="col" style={{ textAlign: 'left' }}>Métrica</th>
                                    {events.map((e) => (
                                        <th key={e.id} scope="col">
                                            <span>{formatDate(e.date)}</span>
                                            {e.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ROWS.map((row) => {
                                    const winnerId = bestId(row);
                                    return (
                                        <tr key={row.key}>
                                            <th scope="row" style={{ textAlign: 'left' }}>{row.label}</th>
                                            {events.map((e) => (
                                                <td key={e.id} className={e.id === winnerId ? 'positive' : ''} data-workshop={`${formatDate(e.date)} · ${e.name}`}>
                                                    {fmtVal(e[row.key], row.fmt)}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkshopCompareModal;
