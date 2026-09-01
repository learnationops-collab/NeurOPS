import React, { useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import { STAGE_ORDER } from '../funnelMath';

// Formulario de "Metas del sistema" — las 9 claves de WorkshopGoals (las 8
// tasas del embudo + la banda "al límite"). Fila única compartida por todo
// el dashboard (Diagnóstico, Simulador, Acciones).
const WorkshopGoalsModal = ({ goals, onClose, onSaved }) => {
    const [form, setForm] = useState(() => ({ ...goals }));
    const [saving, setSaving] = useState(false);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.put('workshop/goals', form);
            toast.success('Metas actualizadas');
            onSaved(res.data);
        } catch (err) {
            console.error('Error guardando metas:', err);
            toast.error('No se pudieron guardar las metas');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
            <form
                onSubmit={handleSubmit}
                className="bg-slate-950 border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl border-indigo-500/20"
            >
                <div className="px-8 py-6 bg-slate-900/40 border-b border-slate-900 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Metas del sistema</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Las 8 tasas del embudo, en porcentaje</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-900 text-slate-500 hover:text-white transition-all cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-8 py-6 space-y-3 max-h-[60vh] overflow-y-auto">
                    {STAGE_ORDER.map((s) => (
                        <div key={s.key} className="flex items-center justify-between gap-4">
                            <label className="text-xs font-bold text-slate-300">{s.label}</label>
                            <div className="relative w-24">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={form[s.goalKey] ?? 0}
                                    onChange={(e) => setField(s.goalKey, parseFloat(e.target.value) || 0)}
                                    className="w-full pl-3 pr-6 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/30 text-right"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">%</span>
                            </div>
                        </div>
                    ))}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-900">
                        <label className="text-xs font-bold text-slate-300">
                            Banda "al límite"
                            <span className="block text-[10px] text-slate-600 font-semibold normal-case">pp de tolerancia antes de contar como fuga</span>
                        </label>
                        <div className="relative w-24">
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={form.banda_limite ?? 0}
                                onChange={(e) => setField('banda_limite', parseFloat(e.target.value) || 0)}
                                className="w-full pl-3 pr-6 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/30 text-right"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">pp</span>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-5 bg-slate-900/40 border-t border-slate-900 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-3 bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all cursor-pointer">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Guardar metas
                    </button>
                </div>
            </form>
        </div>
    );
};

export default WorkshopGoalsModal;
