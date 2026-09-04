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
        <div className="modal-overlay">
            <button type="button" className="modal-backdrop" aria-label="Cerrar ventana de metas" onClick={onClose} />
            <form onSubmit={handleSubmit} className="action-modal narrow" role="dialog" aria-modal="true" aria-label="Metas del sistema">
                <header>
                    <div>
                        <p className="eyebrow">Configuración</p>
                        <h2>Metas del sistema</h2>
                        <p>Las 8 tasas del embudo, en porcentaje</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
                </header>

                <div className="modal-body">
                    <div className="goal-list">
                        {STAGE_ORDER.map((s) => (
                            <label key={s.key}>
                                <span>{s.label}</span>
                                <span className="number-input">
                                    <input
                                        type="number" step="0.1" min="0" max="100"
                                        value={form[s.goalKey] ?? 0}
                                        onChange={(e) => setField(s.goalKey, parseFloat(e.target.value) || 0)}
                                    />
                                    <b>%</b>
                                </span>
                            </label>
                        ))}
                    </div>
                    <label className="band-input">
                        <span>Banda "al límite"<br /><small>pp de tolerancia antes de contar como fuga</small></span>
                        <span className="number-input">
                            <input type="number" step="0.5" min="0" value={form.banda_limite ?? 0} onChange={(e) => setField('banda_limite', parseFloat(e.target.value) || 0)} />
                            <b>pp</b>
                        </span>
                    </label>
                    <div className="goal-actions">
                        <button type="button" className="secondary-action" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="secondary-action" disabled={saving} style={{ background: 'var(--pink)', color: 'var(--ink)', border: 0 }}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar metas
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default WorkshopGoalsModal;
