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
    { value: 'director_comercial', label: 'Dir. Comercial' },
    { value: 'director_marketing', label: 'Dir. Marketing' },
];

const QUESTION_TYPE_OPTIONS = [
    { value: 'single', label: 'Selección única' },
    { value: 'multiple', label: 'Selección múltiple' },
    { value: 'true_false', label: 'Verdadero/falso' },
];

const emptyQuestion = () => ({
    question_text: '', question_type: 'single',
    options: [{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }],
});

const trueFalseOptions = (correctIsTrue) => ([
    { option_text: 'Verdadero', is_correct: correctIsTrue },
    { option_text: 'Falso', is_correct: !correctIsTrue },
]);

const PlaybookLessonFormModal = ({ lesson, defaultModuleId, onClose, onSaved }) => {
    const isEditing = !!lesson;
    const [title, setTitle] = useState(lesson?.title || '');
    const [description, setDescription] = useState(lesson?.description || '');
    const [loomLink, setLoomLink] = useState(lesson?.loom_link || '');
    const [durationMinutes, setDurationMinutes] = useState(lesson?.duration_minutes || '');
    const [transcript, setTranscript] = useState(lesson?.transcript || '');
    const [targetRoles, setTargetRoles] = useState(lesson?.target_roles || []);
    const [isActive, setIsActive] = useState(lesson?.is_active ?? true);
    const [questions, setQuestions] = useState(
        lesson?.questions?.length ? lesson.questions.map(q => ({
            question_text: q.question_text, question_type: q.question_type,
            options: q.options.map(o => ({ option_text: o.option_text, is_correct: o.is_correct })),
        })) : [emptyQuestion()]
    );
    const [saving, setSaving] = useState(false);

    const toggleRole = (role) => setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

    const updateQuestion = (qi, patch) => setQuestions(prev => prev.map((q, i) => i === qi ? { ...q, ...patch } : q));

    const changeQuestionType = (qi, type) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qi) return q;
            if (type === 'true_false') return { ...q, question_type: type, options: trueFalseOptions(true) };
            if (q.question_type === 'true_false') return { ...q, question_type: type, options: [{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }] };
            return { ...q, question_type: type };
        }));
    };

    const updateOptionText = (qi, oi, text) => setQuestions(prev => prev.map((q, i) => i === qi
        ? { ...q, options: q.options.map((o, j) => j === oi ? { ...o, option_text: text } : o) } : q));

    const toggleCorrect = (qi, oi) => setQuestions(prev => prev.map((q, i) => {
        if (i !== qi) return q;
        if (q.question_type === 'single' || q.question_type === 'true_false') {
            return { ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === oi })) };
        }
        return { ...q, options: q.options.map((o, j) => j === oi ? { ...o, is_correct: !o.is_correct } : o) };
    }));

    const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion()]);
    const removeQuestion = (qi) => setQuestions(prev => prev.filter((_, i) => i !== qi));
    const addOption = (qi) => setQuestions(prev => prev.map((q, i) => i === qi ? { ...q, options: [...q.options, { option_text: '', is_correct: false }] } : q));
    const removeOption = (qi, oi) => setQuestions(prev => prev.map((q, i) => i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q));

    const validate = () => {
        if (!title.trim()) return 'El título es obligatorio';
        if (!loomLink.trim()) return 'El link de Loom es obligatorio';
        for (const q of questions) {
            if (!q.question_text.trim()) return 'Todas las preguntas necesitan un enunciado';
            const filled = q.options.filter(o => o.option_text.trim());
            if (filled.length < 2) return `La pregunta "${q.question_text}" necesita al menos 2 opciones`;
            if (!filled.some(o => o.is_correct)) return `Marcá al menos una opción correcta en "${q.question_text}"`;
            if (q.question_type === 'single' && filled.filter(o => o.is_correct).length > 1) return `"${q.question_text}" es de selección única: marcá solo una correcta`;
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const error = validate();
        if (error) { toast.error(error); return; }
        setSaving(true);
        const payload = {
            module_id: defaultModuleId || lesson?.module_id,
            title: title.trim(),
            description: description.trim(),
            loom_link: loomLink.trim(),
            duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
            transcript: transcript.trim(),
            target_roles: targetRoles,
            is_active: isActive,
            questions: questions
                .filter(q => q.question_text.trim() && q.options.filter(o => o.option_text.trim()).length >= 2)
                .map(q => ({
                    question_text: q.question_text.trim(),
                    question_type: q.question_type,
                    options: q.options.filter(o => o.option_text.trim()).map(o => ({ option_text: o.option_text.trim(), is_correct: o.is_correct })),
                })),
        };
        try {
            if (isEditing) {
                await api.put(`/playbook/lessons/${lesson.id}`, payload);
                toast.success('Lección actualizada');
            } else {
                await api.post('/playbook/lessons', payload);
                toast.success('Lección creada');
            }
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo guardar la lección');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 overflow-y-auto" onClick={onClose}>
            <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-surface border border-base rounded-3xl shadow-2xl my-auto">
                <div className="flex items-center justify-between p-6 border-b border-base">
                    <h3 className="text-lg font-black italic tracking-tight uppercase flex items-center gap-2">
                        <GraduationCap size={20} className="text-primary" />
                        {isEditing ? 'Editar lección' : 'Nueva lección'}
                    </h3>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-muted hover:text-white"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Título</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-main border border-base rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ej: La objeción de precio casi nunca es el precio" />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Descripción breve (opcional)</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-main border border-base rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Link de Loom</label>
                            <input value={loomLink} onChange={(e) => setLoomLink(e.target.value)} className="w-full bg-main border border-base rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" placeholder="https://www.loom.com/share/..." />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Duración (min)</label>
                            <input type="number" min="0" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="w-full bg-main border border-base rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Transcripción (opcional — para el buscador Learnito, próximamente)</label>
                        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={3} className="w-full bg-main border border-base rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 resize-none" placeholder="Pegá acá la transcripción del video, si la tenés." />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">¿A quién se le muestra?</label>
                        <div className="flex flex-wrap gap-2">
                            {ROLE_OPTIONS.map(r => (
                                <button key={r.value} type="button" onClick={() => toggleRole(r.value)}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${targetRoles.includes(r.value) ? 'bg-primary text-white border-primary' : 'bg-main border-base text-muted hover:text-white'}`}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted font-medium">Si no seleccionás ninguno, se muestra a todo el equipo.</p>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-primary w-4 h-4" />
                        <span className="text-xs font-bold">Publicada (visible para los usuarios)</span>
                    </label>

                    <div className="border-t border-base pt-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Preguntas de comprobación (opcional)</label>
                            <button type="button" onClick={addQuestion} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary"><Plus size={14} /> Pregunta</button>
                        </div>
                        <p className="text-[10px] text-muted -mt-2">Sin preguntas, la lección se completa apenas se ve el video.</p>

                        {questions.map((q, qi) => (
                            <div key={qi} className="bg-main border border-base rounded-2xl p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <input value={q.question_text} onChange={(e) => updateQuestion(qi, { question_text: e.target.value })} placeholder={`Pregunta ${qi + 1}`}
                                        className="flex-1 bg-surface border border-base rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                                    {questions.length > 1 && (
                                        <button type="button" onClick={() => removeQuestion(qi)} className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shrink-0"><Trash2 size={14} /></button>
                                    )}
                                </div>
                                <div className="flex gap-1.5">
                                    {QUESTION_TYPE_OPTIONS.map(t => (
                                        <button key={t.value} type="button" onClick={() => changeQuestionType(qi, t.value)}
                                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${q.question_type === t.value ? 'bg-primary/20 border-primary text-primary' : 'border-base text-muted'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="space-y-1.5 pl-2">
                                    {q.options.map((o, oi) => (
                                        <div key={oi} className="flex items-center gap-2">
                                            <button type="button" onClick={() => toggleCorrect(qi, oi)} title="Marcar como correcta"
                                                className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all ${o.is_correct ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-base text-transparent hover:border-emerald-500/50'}`}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                            {q.question_type === 'true_false' ? (
                                                <span className="flex-1 text-xs font-bold px-1">{o.option_text}</span>
                                            ) : (
                                                <input value={o.option_text} onChange={(e) => updateOptionText(qi, oi, e.target.value)} placeholder={`Opción ${oi + 1}`}
                                                    className="flex-1 bg-surface border border-base rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20" />
                                            )}
                                            {q.question_type !== 'true_false' && q.options.length > 2 && (
                                                <button type="button" onClick={() => removeOption(qi, oi)} className="p-2 text-muted hover:text-rose-500 shrink-0"><X size={14} /></button>
                                            )}
                                        </div>
                                    ))}
                                    {q.question_type !== 'true_false' && (
                                        <button type="button" onClick={() => addOption(qi)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted hover:text-primary pt-1"><Plus size={12} /> Opción</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-base">
                    <button type="button" onClick={onClose} className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-muted hover:text-white">Cancelar</button>
                    <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50">
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {isEditing ? 'Guardar cambios' : 'Crear lección'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
};

export default PlaybookLessonFormModal;
