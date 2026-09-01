import React, { useMemo, useState } from 'react';
import { Plus, Check, Trash2, Loader2, Sparkles } from 'lucide-react';
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">{(actions || []).length} acciones en el plan</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Del hallazgo a la ejecución</p>
                    </div>
                    <button
                        onClick={() => setShowForm((v) => !v)}
                        className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                    >
                        <Plus size={14} /> Nueva acción
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleCreate} className="bg-slate-900/40 border border-indigo-500/20 rounded-[2rem] p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 sm:col-span-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Título</label>
                                <input
                                    type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                    placeholder="Ej: Mejorar el botón de WhatsApp en LP" required
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Etapa que ataca</label>
                                <select
                                    value={form.stage_key} onChange={(e) => setForm((p) => ({ ...p, stage_key: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                >
                                    <option value="">General (ninguna etapa)</option>
                                    {STAGE_ORDER.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Impacto esperado (pp)</label>
                                <input
                                    type="number" step="0.5" value={form.target_delta_pp}
                                    onChange={(e) => setForm((p) => ({ ...p, target_delta_pp: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {SCORE_FIELDS.map((f) => (
                                <div key={f.key} className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{f.label}</label>
                                    <select
                                        value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: parseInt(e.target.value) }))}
                                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    >
                                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={resetForm} className="px-5 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all cursor-pointer">Cancelar</button>
                            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all cursor-pointer">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Crear acción
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-3">
                    {sorted.length === 0 ? (
                        <div className="py-16 text-center bg-slate-900/20 rounded-[2rem] border border-dashed border-slate-800">
                            <p className="text-slate-500 font-bold text-sm uppercase">Todavía no hay acciones cargadas</p>
                        </div>
                    ) : sorted.map((a) => {
                        const impact = estimateImpact(a, totals, rates, ticketPromedio);
                        const done = a.status === 'done';
                        return (
                            <div key={a.id} className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${done ? 'bg-slate-900/20 border-slate-900 opacity-60' : 'bg-slate-900/40 border-slate-800'}`}>
                                <button
                                    onClick={() => toggleStatus(a)}
                                    title={done ? 'Marcar pendiente' : 'Marcar hecha'}
                                    className={`shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${done ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-600'}`}
                                >
                                    <Check size={14} />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-black text-white ${done ? 'line-through' : ''}`}>{a.title}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                        {a.stage_key && (
                                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                {stageLabel(a.stage_key)}
                                            </span>
                                        )}
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-800">
                                            score {a.score}
                                        </span>
                                        {a.target_delta_pp > 0 && (
                                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                +{a.target_delta_pp}pp · +{impact.ventas.toFixed(1)} ventas · {fmt(impact.cash)}
                                            </span>
                                        )}
                                        {a.created_by && (
                                            <span className="text-[9px] text-slate-600 font-bold uppercase">por {a.created_by}</span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(a)} className="shrink-0 p-2 text-slate-600 hover:text-rose-400 transition-all cursor-pointer">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-gradient-to-br from-emerald-950/30 to-slate-900/40 border border-emerald-500/20 rounded-[2.5rem] p-6 space-y-2">
                    <h3 className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Si ejecutás el plan</h3>
                    <p className="text-2xl font-black text-white italic">+{totalImpact.ventas.toFixed(1)} <span className="text-sm text-slate-500">ventas</span></p>
                    <p className="text-sm font-bold text-emerald-400">+{fmt(totalImpact.cash)} cash</p>
                    <p className="text-[9px] text-slate-600 font-semibold leading-relaxed pt-1">Suma el impacto de las acciones pendientes que atacan una etapa específica. Sirve para priorizar; no es una predicción.</p>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-[2.5rem] p-6 space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles size={12} /> Clarity Score
                    </h3>
                    <span className="text-2xl font-black text-white italic block">{clarity.score}<span className="text-xs text-slate-600">/100</span></span>
                    <div className="space-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <div className="flex justify-between"><span>Diagnóstico</span><span className="text-slate-300">{clarity.diagnostico}%</span></div>
                        <div className="flex justify-between"><span>Plan</span><span className="text-slate-300">{clarity.plan}%</span></div>
                        <div className="flex justify-between"><span>Ejecución</span><span className="text-slate-300">{clarity.ejecucion}%</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkshopAccionesView;
