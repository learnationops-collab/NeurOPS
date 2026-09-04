import React from 'react';
import { Edit2, Trash2, ArrowRight, Check } from 'lucide-react';

const roasTone = (roas) => (roas >= 3 ? 'success' : roas >= 1.5 ? 'success' : roas >= 1 ? 'warning' : 'error');
const roasLabel = (roas) => (roas >= 3 ? 'Sobresaliente' : roas >= 1.5 ? 'Rentable' : roas >= 1 ? 'En equilibrio' : 'A pérdida');

const WorkshopCardsView = ({ events, onSelectFunnel, onEdit, onDelete, formatDate, formatCurrency, selectedIds, onToggleSelect }) => {
    return (
        <section className="event-grid" aria-label="Talleres registrados">
            {events.map((e) => {
                const profit = e.cash_collected - e.inversion;
                const isSelected = selectedIds?.includes(e.id);
                const tone = roasTone(e.roas);

                return (
                    <article className={`event-card ${isSelected ? 'selected' : ''}`} key={e.id}>
                        <div className="card-icon-actions">
                            <button type="button" onClick={() => onEdit(e)} title="Editar evento" aria-label="Editar evento">
                                <Edit2 size={13} />
                            </button>
                            <button type="button" onClick={() => onDelete(e.id)} title="Eliminar evento" aria-label="Eliminar evento">
                                <Trash2 size={13} />
                            </button>
                        </div>

                        <div className="event-card-head">
                            {onToggleSelect ? (
                                <label className="compare-control">
                                    <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect(e.id)} />
                                    <span><Check size={13} /> Comparar</span>
                                </label>
                            ) : <span />}
                        </div>

                        <p className="event-date">{formatDate(e.date)}</p>
                        <h2>{e.name}</h2>

                        <div className="event-economy">
                            <div><span>ROAS</span><strong>{e.roas.toFixed(2)}x</strong></div>
                            <span className={`status ${tone}`}>{roasLabel(e.roas)}</span>
                        </div>

                        <dl className="event-stats">
                            <div><dt>Inversión</dt><dd>{formatCurrency(e.inversion)}</dd></div>
                            <div><dt>Recaudado</dt><dd>{formatCurrency(e.cash_collected)}</dd></div>
                            <div><dt>Ganancia</dt><dd className={profit < 0 ? 'negative' : ''}>{formatCurrency(profit)}</dd></div>
                        </dl>

                        <dl className="event-stats">
                            <div><dt>Leads (WA)</dt><dd>{e.leads} <small>({e.whatsapp_leads})</small></dd></div>
                            <div><dt>Show up</dt><dd>{e.show_up} <small>{e.show_up_rate}%</small></dd></div>
                            <div><dt>Agendas</dt><dd>{e.agendas_exitosas}</dd></div>
                            <div><dt>Conv. leads</dt><dd>{e.conversion_leads}%</dd></div>
                            <div><dt>Costo agenda</dt><dd>{formatCurrency(e.costo_por_agenda)}</dd></div>
                            <div><dt>Ventas</dt><dd>{e.sales} <small>{e.pct_close_rate}%</small></dd></div>
                        </dl>

                        <button type="button" className="card-action" onClick={() => onSelectFunnel(e)}>
                            Ver embudo detallado <ArrowRight size={16} />
                        </button>
                    </article>
                );
            })}
        </section>
    );
};

export default WorkshopCardsView;
