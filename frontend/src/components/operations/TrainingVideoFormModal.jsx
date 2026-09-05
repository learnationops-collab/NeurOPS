import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, CheckCircle2, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export const ROLE_OPTIONS = [
    { value: 'admin', label: 'Admin' },
    { value: 'operator', label: 'Operador' },
    { value: 'closer', label: 'Closer' },
    { value: 'setter', label: 'Setter' },
    { value: 'triage', label: 'Call Confirmer' },
    { value: 'director_comercial', label: 'Director Comercial' },
    { value: 'director_marketing', label: 'Director de Marketing' },
];

const emptyQuestion = () => ({ question_text: '', options: [{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }] });

// Crea/edita un video de documentación con su quiz. Portal a document.body por el mismo motivo
// que el resto de modales del proyecto que necesitan quedar fijos sobre cualquier página
// (ver LoomModal en BugReportsPanel.jsx) — este panel además puede abrirse desde adentro de
// OperationsSettingsPage, que no tiene ningún contenedor con transform, pero se mantiene el
// mismo patrón por consistencia y por si el modal se reutiliza en otro lado más adelante.
const TrainingVideoFormModal = ({ video, onClose, onSaved }) => {
    const isEditing = !!video;
    const [title, setTitle] = useState(video?.title || '');
    const [description, setDescription] = useState(video?.description || '');
    const [loomLink, setLoomLink] = useState(video?.loom_link || '');
    const [targetRoles, setTargetRoles] = useState(video?.target_roles || []);
    const [isActive, setIsActive] = useState(video?.is_active ?? true);
    const [questions, setQuestions] = useState(
        video?.questions?.length ? video.questions.map(q => ({
            question_text: q.question_text,
            options: q.options.map(o => ({ option_text: o.option_text, is_correct: o.is_correct })),
        })) : [emptyQuestion()]
    );
    const [saving, setSaving] = useState(false);

    const toggleRole = (role) => {
        setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    };

    const updateQuestionText = (qi, text) => {
        setQuestions(prev => prev.map((q, i) => i === qi ? { ...q, question_text: text } : q));
    };

    const updateOptionText = (qi, oi, text) => {
        setQuestions(prev => prev.map((q, i) => i === qi
            ? { ...q, options: q.options.map((o, j) => j === oi ? { ...o, option_text: text } : o) }
            : q));
    };

    const toggleCorrect = (qi, oi) => {
        setQuestions(prev => prev.map((q, i) => i === qi
            ? { ...q, options: q.options.map((o, j) => j === oi ? { ...o, is_correct: !o.is_correct } : o) }
            : q));
    };

    const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion()]);
    const removeQuestion = (qi) => setQuestions(prev => prev.filter((_, i) => i !== qi));
    const addOption = (qi) => setQuestions(prev => prev.map((q, i) => i === qi
        ? { ...q, options: [...q.options, { option_text: '', is_correct: false }] }
        : q));
    const removeOption = (qi, oi) => setQuestions(prev => prev.map((q, i) => i === qi
        ? { ...q, options: q.options.filter((_, j) => j !== oi) }
        : q));

    const validate = () => {
        if (!title.trim()) return 'El título es obligatorio';
        if (!loomLink.trim()) return 'El link de Loom es obligatorio';
        if (questions.length === 0) return 'Agrega al menos una pregunta';
        for (const q of questions) {
            if (!q.question_text.trim()) return 'Todas las preguntas necesitan un enunciado';
            const filledOptions = q.options.filter(o => o.option_text.trim());
            if (filledOptions.length < 2) return `La pregunta "${q.question_text}" necesita al menos 2 opciones`;
            if (!filledOptions.some(o => o.is_correct)) return `Marca al menos una opción correcta en "${q.question_text}"`;
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const error = validate();
        if (error) {
            toast.error(error);
            return;
        }
        setSaving(true);
        const payload = {
            title: title.trim(),
            description: description.trim(),
            loom_link: loomLink.trim(),
            target_roles: targetRoles,
            is_active: isActive,
            questions: questions.map(q => ({
                question_text: q.question_text.trim(),
                options: q.options.filter(o => o.option_text.trim()).map(o => ({
                    option_text: o.option_text.trim(),
                    is_correct: o.is_correct,
                })),
            })),
        };
        try {
            if (isEditing) {
                await api.put(`/training-videos/${video.id}`, payload);
                toast.success('Video actualizado');
            } else {
                await api.post('/training-videos', payload);
                toast.success('Video creado');
            }
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo guardar el video');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 overflow-y-auto" onClick={onClose}>
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-surface border border-base rounded-3xl shadow-2xl my-auto"
            >
                <div className="flex items-center justify-between p-6 border-b border-base">
                    <h3 className="text-lg font-black italic tracking-tight uppercase flex items-center gap-2">
                        <GraduationCap size={20} className="text-primary" />
                        {isEditing ? 'Editar video' : 'Nuevo video de documentación'}
                    </h3>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-muted hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Título</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-main border border-base rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Ej: Cómo declarar una venta con Cuota"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Descripción (opcional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full bg-main border border-base rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Link de Loom</label>
                        <input
                            value={loomLink}
                            onChange={(e) => setLoomLink(e.target.value)}
                            className="w-full bg-main border border-base rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="https://www.loom.com/share/..."
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">¿A quién se le muestra?</label>
                        <div className="flex flex-wrap gap-2">
                            {ROLE_OPTIONS.map(r => (
                                <button
                                    key={r.value}
                                    type="button"
                                    onClick={() => toggleRole(r.value)}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${targetRoles.includes(r.value)
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-main border-base text-muted hover:text-white'
                                        }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted font-medium">Si no seleccionas ninguno, se muestra a todos los roles.</p>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-primary w-4 h-4" />
                        <span className="text-xs font-bold">Activo (visible para los usuarios)</span>
                    </label>

                    <div className="border-t border-base pt-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Preguntas de comprensión</label>
                            <button type="button" onClick={addQuestion} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-hover">
                                <Plus size={14} /> Pregunta
                            </button>
                        </div>

                        {questions.map((q, qi) => (
                            <div key={qi} className="bg-main border border-base rounded-2xl p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <input
                                        value={q.question_text}
                                        onChange={(e) => updateQuestionText(qi, e.target.value)}
                                        placeholder={`Pregunta ${qi + 1}`}
                                        className="flex-1 bg-surface border border-base rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    {questions.length > 1 && (
                                        <button type="button" onClick={() => removeQuestion(qi)} className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shrink-0">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-1.5 pl-2">
                                    {q.options.map((o, oi) => (
                                        <div key={oi} className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleCorrect(qi, oi)}
                                                title="Marcar como correcta"
                                                className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all ${o.is_correct ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-base text-transparent hover:border-emerald-500/50'}`}
                                            >
                                                <CheckCircle2 size={14} />
                                            </button>
                                            <input
                                                value={o.option_text}
                                                onChange={(e) => updateOptionText(qi, oi, e.target.value)}
                                                placeholder={`Opción ${oi + 1}`}
                                                className="flex-1 bg-surface border border-base rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                            {q.options.length > 2 && (
                                                <button type="button" onClick={() => removeOption(qi, oi)} className="p-2 text-muted hover:text-rose-500 shrink-0">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => addOption(qi)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted hover:text-primary pt-1">
                                        <Plus size={12} /> Opción
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-base">
                    <button type="button" onClick={onClose} className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-muted hover:text-white">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {isEditing ? 'Guardar cambios' : 'Crear video'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
};

export default TrainingVideoFormModal;
