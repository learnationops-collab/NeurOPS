import React from 'react';
import { Edit2, Trash2, ArrowRight, Check } from 'lucide-react';

const roasTone = (roas) => (roas >= 3 ? 'success' : roas >= 1.5 ? 'success' : roas >= 1 ? 'warning' : 'error');

const WorkshopTableView = ({ events, onSelectFunnel, onEdit, onDelete, formatDate, formatCurrency, selectedIds, onToggleSelect }) => {
    return (
        <section className="panel comparison-panel" aria-label="Tabla comparativa de talleres">
            <div className="comparison-scroll">
                <table>
                    <thead>
                        <tr>
                            {onToggleSelect && <th scope="col" style={{ textAlign: 'left', width: 40 }} />}
                            <th scope="col" style={{ textAlign: 'left' }}>Fecha</th>
                            <th scope="col" style={{ textAlign: 'left' }}>Workshop</th>
                            <th scope="col">Inversión</th>
                            <th scope="col">Recaudado</th>
                            <th scope="col">Profit neto</th>
                            <th scope="col">Leads</th>
                            <th scope="col">CPL</th>
                            <th scope="col">Show up %</th>
                            <th scope="col">Agendas</th>
                            <th scope="col">CPA</th>
                            <th scope="col">Ventas</th>
                            <th scope="col">ROAS</th>
                            <th scope="col" style={{ textAlign: 'center' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((e) => {
                            const profit = e.cash_collected - e.inversion;
                            const isSelected = selectedIds?.includes(e.id);
                            return (
                                <tr key={e.id}>
                                    {onToggleSelect && (
                                        <td style={{ textAlign: 'left' }}>
                                            <label className="compare-control">
                                                <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect(e.id)} />
                                                <span><Check size={12} /></span>
                                            </label>
                                        </td>
                                    )}
                                    <th scope="row" style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{formatDate(e.date)}</th>
                                    <td style={{ textAlign: 'left', color: '#fff', fontWeight: 800 }}>{e.name}</td>
                                    <td>{formatCurrency(e.inversion)}</td>
                                    <td className="positive">{formatCurrency(e.cash_collected)}</td>
                                    <td className={profit < 0 ? 'negative' : ''}>{formatCurrency(profit)}</td>
                                    <td>{e.leads.toLocaleString()}</td>
                                    <td>{formatCurrency(e.cpl)}</td>
                                    <td>{e.show_up_rate}%</td>
                                    <td>{e.agendas_exitosas}</td>
                                    <td>{formatCurrency(e.costo_por_agenda)}</td>
                                    <td>{e.sales}</td>
                                    <td><span className={`table-rate ${roasTone(e.roas)}`}>{e.roas.toFixed(2)}x</span></td>
                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                                            <button type="button" className="icon-button" onClick={() => onSelectFunnel(e)} title="Ver embudo" aria-label="Ver embudo">
                                                <ArrowRight size={14} />
                                            </button>
                                            <button type="button" className="icon-button" onClick={() => onEdit(e)} title="Editar datos" aria-label="Editar datos">
                                                <Edit2 size={14} />
                                            </button>
                                            <button type="button" className="icon-button" onClick={() => onDelete(e.id)} title="Eliminar evento" aria-label="Eliminar evento">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default WorkshopTableView;
