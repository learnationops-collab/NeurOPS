import React, { useMemo, useState } from 'react';
import { Plus, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { STAGE_ORDER, aggregateTotals, stageRates, computeFuga, computeClarityScore, projectSales, money } from '../funnelMath';

const SCORE_FIELDS = [
    { key: 'value_score', label: 'Valor' },
    { key: 'speed_score', label: 'Velocidad' },
    { key: 'simplicity_score', label: 'Simplicidad' },
    { key: 'urgency_score', label: 'Urgencia' },
];

const emptyForm = { stage_key: '', title: '', note: '', value_score: 3, speed_score: 3, simplicity_score: 3, urgency_score: 3, target_delta_pp: 5 };

// Estima el impacto en ventas/cash de una acción: aplica `target_delta_pp`
// como mejora SOLO sobre la etapa elegida, con las demás en su tasa real
// actual — mismo modelo lineal que el Simulador (`projectSales`).
const estimateImpact = (action, totals, rates, ticketPromedio) => {
    if (!action.stage_key) return { ventas: 0, cash: 0 };
    const leadsBase = totals.leads || 0;
    const ventasActuales = projectSales(leadsBase, rates);
    const ratesConMejora = { ...rates, [action.stage_key]: Math.min(0.95, (rates[action.stage_key] || 0) + (action.target_delta_pp || 0) / 100) };
    const ventasConMejora = projectSales(leadsBase, ratesConMejora);
    const deltaVentas = Math.max(0, ventasConMejora - ventasActuales);
    return { ventas: deltaVentas, cash: deltaVentas * ticketPromedio };
};

const WorkshopAccionesView = ({ events, goals, actions, onActionsChanged, formatCurrency }) => {
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const totals = useMemo(() => aggregateTotals(events), [events]);
    const rates = useMemo(() => stageRates(totals), [totals]);
    const fugas = useMemo(() => computeFuga(totals, rates, goals), [totals, rates, goals]);
    const clarity = useMemo(() => computeClarityScore(goals, actions, fugas), [goals, actions, fugas]);
    const ticketPromedio = totals.sales > 0 ? totals.cash_collected / totals.sales : 0;
    const fmt = formatCurrency || money;

    const stageLabel = (key) => STAGE_ORDER.find((s) => s.key === key)?.label;

    const totalImpact = useMemo(() => {
        return (actions || []).filter((a) => a.status === 'pending').reduce((acc, a) => {
            const imp = estimateImpact(a, totals, rates, ticketPromedio);
            return { ventas: acc.ventas + imp.ventas, cash: acc.cash + imp.cash };
        }, { ventas: 0, cash: 0 });
    }, [actions, totals, rates, ticketPromedio]);

    const resetForm = () => { setForm(emptyForm); setShowForm(false); };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            await api.post('workshop/actions', { ...form, stage_key: form.stage_key || null });
            toast.success('Acción creada');
            resetForm();
            onActionsChanged();
        } catch (err) {
            console.error('Error creando acción:', err);
            toast.error('No se pudo crear la acción');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (action) => {
        try {
            await api.put(`workshop/actions/${action.id}`, { status: action.status === 'done' ? 'pending' : 'done' });
            onActionsChanged();
        } catch (err) {
            console.error('Error actualizando acción:', err);
            toast.error('No se pudo actualizar la acción');
        }
    };

    const handleDelete = async (action) => {
        if (!window.confirm(`¿Eliminar la acción "${action.title}"?`)) return;
        try {
            await api.delete(`workshop/actions/${action.id}`);
            toast.success('Acción eliminada');
            onActionsChanged();
        } catch (err) {
            console.error('Error eliminando acción:', err);
            toast.error('No se pudo eliminar la acción');
        }
    };

    const sorted = [...(actions || [])].sort((a, b) => (a.status === b.status ? b.score - a.score : a.status === 'done' ? 1 : -1));

    return (
        <section className="actions-grid">
            <div className="action-groups">
                <article className="panel action-group">
                    <div className="action-group-head">
                        <div>
                            <p className="eyebrow">{(actions || []).length} acciones en el plan</p>
                            <h2>Del hallazgo a la ejecución</h2>
                        </div>
                        <button type="button" className="secondary-action" onClick={() => setShowForm((v) => !v)}>
                            <Plus size={15} /> Nueva acción
                        </button>
                    </div>

                    {showForm && (
                        <form onSubmit={handleCreate} className="inline-form" style={{ marginTop: 22 }}>
                            <div className="form-grid">
                                <label className="form-field wide">
                                    <span>Título</span>
                                    <span className="field-control">
                                        <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                            placeholder="Ej: Mejorar el botón de WhatsApp en LP" required />
                                    </span>
                                </label>
                                <label className="form-field">
                                    <span>Etapa que ataca</span>
                                    <span className="field-control">
                                        <select value={form.stage_key} onChange={(e) => setForm((p) => ({ ...p, stage_key: e.target.value }))} style={{ width: '100%', height: '100%', background: 'transparent', padding: '0 14px' }}>
                                            <option value="">General (ninguna etapa)</option>
                                            {STAGE_ORDER.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                        </select>
                                    </span>
                                </label>
                                <label className="form-field">
                                    <span>Impacto esperado (pp)</span>
                                    <span className="field-control">
                                        <input type="number" step="0.5" value={form.target_delta_pp}
                                            onChange={(e) => setForm((p) => ({ ...p, target_delta_pp: parseFloat(e.target.value) || 0 }))} />
                                    </span>
                                </label>
                            </div>
                            <div className="custom-ratings" style={{ marginTop: 16 }}>
                                {SCORE_FIELDS.map((f) => (
                                    <label key={f.key}>
                                        <span>{f.label}</span>
                                        <select value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: parseInt(e.target.value) }))}>
                                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </label>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                                <button type="button" className="secondary-action" onClick={resetForm}>Cancelar</button>
                                <button type="submit" className="primary-action" disabled={saving}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear acción
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="plan-list" style={{ marginTop: 20 }}>
                        {sorted.length === 0 ? (
                            <p className="all-target" style={{ textAlign: 'center', padding: '24px 0' }}>Todavía no hay acciones cargadas.</p>
                        ) : sorted.map((a) => {
                            const impact = estimateImpact(a, totals, rates, ticketPromedio);
                            const done = a.status === 'done';
                            return (
                                <article className={`plan-item ${done ? 'done' : ''}`} key={a.id}>
                                    <button type="button" className="done-toggle" aria-pressed={done} title={done ? 'Marcar pendiente' : 'Marcar hecha'} onClick={() => toggleStatus(a)}>
                                        {done ? <CheckCircle2 size={20} /> : <span />}
                                    </button>
                                    <div>
                                        <h3>{a.title}</h3>
                                        <div className="rating-chips">
                                            {a.stage_key && <span>{stageLabel(a.stage_key)}</span>}
                                            <span>Score {a.score}</span>
                                            {a.target_delta_pp > 0 && <span>+{a.target_delta_pp}pp · +{impact.ventas.toFixed(1)} ventas · {fmt(impact.cash)}</span>}
                                            {a.created_by && <span>por {a.created_by}</span>}
                                        </div>
                                    </div>
                                    <button type="button" className="remove-action" title="Eliminar acción" onClick={() => handleDelete(a)}>
                                        <Trash2 size={16} />
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                </article>
            </div>

            <aside className="action-summary">
                <article className="projection-card">
                    <p className="eyebrow">Si ejecutás el plan</p>
                    <h2>Impacto total estimado</h2>
                    <div className="projection-kpis" style={{ gridTemplateColumns: '1fr' }}>
                        <div>
                            <span>Ventas</span>
                            <strong>+{totalImpact.ventas.toFixed(1)}</strong>
                            <small className="positive">+{fmt(totalImpact.cash)} cash</small>
                        </div>
                    </div>
                    <p className="model-note">Suma el impacto de las acciones pendientes que atacan una etapa específica. Sirve para priorizar; no es una predicción.</p>
                </article>

                <article className="clarity-card">
                    <div>
                        <p className="eyebrow">Clarity Score</p>
                        <h2>{clarity.score}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/100</span></h2>
                        <div className="clarity-parts">
                            <span>Diagnóstico {clarity.diagnostico}%</span>
                            <span>Plan {clarity.plan}%</span>
                            <span>Ejecución {clarity.ejecucion}%</span>
                        </div>
                    </div>
                </article>
            </aside>
        </section>
    );
};

export default WorkshopAccionesView;
