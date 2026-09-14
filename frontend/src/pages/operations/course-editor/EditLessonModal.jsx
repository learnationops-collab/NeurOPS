import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import ContentTab from './ContentTab';
import VisibilityTab from './VisibilityTab';
import QuestionsTab from './QuestionsTab';

const TABS = ['content', 'visibility', 'questions'];

const buildInitialForm = (lesson, defaultModuleId) => ({
    module_id: lesson?.module_id ?? defaultModuleId,
    title: lesson?.title || '',
    description: lesson?.description || '',
    loom_link: lesson?.loom_link || '',
    duration_minutes: lesson?.duration_minutes ?? '',
    transcript: lesson?.transcript || '',
    target_roles: lesson?.target_roles || [],
    is_active: lesson?.is_active ?? true,
    questions: lesson?.questions?.length ? lesson.questions.map((q) => ({
        question_text: q.question_text, question_type: q.question_type, explanation: q.explanation || '',
        options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
    })) : [],
});

const validate = (form) => {
    if (!form.title.trim()) return 'El título es obligatorio';
    if (!form.loom_link.trim()) return 'El link de Loom es obligatorio';
    for (const q of form.questions) {
        if (!q.question_text.trim()) return 'Todas las preguntas necesitan un enunciado';
        const filled = q.options.filter((o) => o.option_text.trim());
        if (filled.length < 2) return `La pregunta "${q.question_text}" necesita al menos 2 opciones`;
        if (!filled.some((o) => o.is_correct)) return `Marcá al menos una opción correcta en "${q.question_text}"`;
        if (q.question_type === 'single' && filled.filter((o) => o.is_correct).length > 1) return `"${q.question_text}" es de selección única: marcá solo una correcta`;
    }
    return null;
};

const EditLessonModal = ({ lesson, defaultModuleId, flatModules, onClose, onSaved }) => {
    const isEditing = !!lesson;
    const [tab, setTab] = useState('content');
    const [form, setForm] = useState(() => buildInitialForm(lesson, defaultModuleId));
    const [saving, setSaving] = useState(false);

    const currentModule = flatModules.find((m) => m.moduleId === form.module_id);

    const handleSave = async () => {
        const error = validate(form);
        if (error) { toast.error(error); return; }
        setSaving(true);
        const payload = {
            module_id: form.module_id,
            title: form.title.trim(),
            description: form.description.trim(),
            loom_link: form.loom_link.trim(),
            duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : null,
            transcript: form.transcript.trim(),
            target_roles: form.target_roles,
            is_active: form.is_active,
            questions: form.questions
                .filter((q) => q.question_text.trim() && q.options.filter((o) => o.option_text.trim()).length >= 2)
                .map((q) => ({
                    question_text: q.question_text.trim(),
                    question_type: q.question_type,
                    explanation: q.explanation.trim(),
                    options: q.options.filter((o) => o.option_text.trim()).map((o) => ({ option_text: o.option_text.trim(), is_correct: o.is_correct })),
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

    return (
        <div className="ce-modal-overlay" onClick={onClose}>
            <div className="ce-modal is-wide" onClick={(e) => e.stopPropagation()}>
                <div className="ce-modal__header">
                    <div style={{ minWidth: 0 }}>
                        <p className="ce-modal__breadcrumb">{currentModule ? `${currentModule.areaName} · ${currentModule.moduleName}` : ''}</p>
                        <h3 className="ce-modal__title">{isEditing ? (form.title || 'Editar lección') : 'Nueva lección'}</h3>
                    </div>
                    <button type="button" className="ce-modal__close" onClick={onClose} aria-label="Cerrar sin guardar"><X size={16} /></button>
                </div>

                <div className="ce-modal__tabs">
                    <button type="button" className={`ce-modal__tab${tab === 'content' ? ' is-active' : ''}`} onClick={() => setTab('content')}>
                        <span className="ce-dot" /> Contenido
                    </button>
                    <button type="button" className={`ce-modal__tab${tab === 'visibility' ? ' is-active' : ''}`} onClick={() => setTab('visibility')}>
                        <span className="ce-dot" /> Visibilidad
                    </button>
                    <button type="button" className={`ce-modal__tab${tab === 'questions' ? ' is-active' : ''}`} onClick={() => setTab('questions')}>
                        <span className="ce-dot" /> Preguntas · {form.questions.length}
                    </button>
                </div>

                <div className="ce-modal__body">
                    {tab === 'content' && <ContentTab form={form} setForm={setForm} flatModules={flatModules} />}
                    {tab === 'visibility' && <VisibilityTab form={form} setForm={setForm} />}
                    {tab === 'questions' && <QuestionsTab form={form} setForm={setForm} />}
                </div>

                <div className="ce-modal__footer">
                    <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                    <button type="button" className="btn-primary-pill" disabled={saving} onClick={handleSave}>
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {isEditing ? 'Guardar cambios' : 'Crear lección'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditLessonModal;
