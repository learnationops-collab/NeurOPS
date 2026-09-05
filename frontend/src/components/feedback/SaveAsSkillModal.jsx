import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { ROLE_OPTIONS } from '../operations/PlaybookLessonFormModal';

// Atajo para que un manager deje un Loom del chat de un reporte de bug como skill del
// Playbook, sin pasar por el formulario completo de gestión (ese sigue existiendo para
// armar lecciones con quiz). Si no se elige un módulo puntual, el backend lo cae en un
// Roadmap/Módulo por defecto ("Soporte y Resolución de Bugs") que se crea solo la
// primera vez que hace falta.
const SaveAsSkillModal = ({ loomLink, defaultTitle, defaultRoles, onClose, onSaved }) => {
    const [title, setTitle] = useState(defaultTitle || '');
    const [description, setDescription] = useState('');
    const [roles, setRoles] = useState(defaultRoles || []);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [modules, setModules] = useState([]);
    const [moduleId, setModuleId] = useState('');
    const [loadingModules, setLoadingModules] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!showAdvanced || modules.length > 0) return;
        setLoadingModules(true);
        api.get('/playbook/admin/overview', { skipBugReport: true })
            .then(res => {
                const flat = [];
                (res.data.roadmaps || []).forEach(r => {
                    (r.modules || []).forEach(m => {
                        flat.push({ id: m.id, label: `${r.name} › ${m.name}` });
                    });
                });
                setModules(flat);
            })
            .catch(() => toast.error('No se pudieron cargar los módulos del Playbook.'))
            .finally(() => setLoadingModules(false));
    }, [showAdvanced, modules.length]);

    const toggleRole = (value) => {
        setRoles((prev) => prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('Ponele un título a la skill.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: title.trim(),
                description: description.trim() || undefined,
                loom_link: loomLink,
                target_roles: roles,
            };
            if (showAdvanced && moduleId) payload.module_id = Number(moduleId);
            const res = await api.post('/playbook/quick-lesson', payload, { skipBugReport: true });
            toast.success('Guardado como skill en el Playbook.');
            onSaved?.(res.data);
            onClose();
        } catch (err) {
            console.error('Error al guardar skill en el Playbook:', err);
            toast.error(err.response?.data?.message || 'No se pudo guardar la skill.');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[310] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={onClose}>
            <div
                data-bug-report-ignore="true"
                className="w-full max-w-md bg-surface border border-white/10 rounded-[2rem] p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                        <GraduationCap size={18} className="text-emerald-400" /> Guardar como skill
                    </h3>
                    <button onClick={onClose} className="p-2 -mr-2 hover:bg-white/10 rounded-xl text-muted hover:text-base transition-all active:scale-95">
                        <X size={16} />
                    </button>
                </div>
                <p className="text-[11px] text-muted leading-snug">
                    Este Loom queda disponible en el Playbook para que el equipo lo revise cuando quiera, sin tener que buscarlo en este chat.
                </p>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Título</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Descripción (opcional)</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">¿Quién lo ve?</label>
                    <div className="flex flex-wrap gap-1.5">
                        {ROLE_OPTIONS.map((r) => (
                            <button
                                key={r.value}
                                type="button"
                                onClick={() => toggleRole(r.value)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${roles.includes(r.value) ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-muted'}`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    {roles.length === 0 && <p className="text-[10px] text-muted">Sin selección = visible para todo el equipo.</p>}
                </div>

                <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300">
                    {showAdvanced ? 'Usar el módulo por defecto' : 'Elegir en qué módulo del Playbook va'}
                </button>
                {showAdvanced && (
                    <div className="space-y-1">
                        {loadingModules ? (
                            <div className="flex items-center gap-2 text-[11px] text-muted"><Loader2 size={12} className="animate-spin" /> Cargando módulos...</div>
                        ) : (
                            <select
                                value={moduleId}
                                onChange={(e) => setModuleId(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                            >
                                <option value="">Por defecto (Soporte y Resolución de Bugs)</option>
                                {modules.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                        )}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
                    Guardar en el Playbook
                </button>
            </div>
        </div>,
        document.body
    );
};

export default SaveAsSkillModal;
