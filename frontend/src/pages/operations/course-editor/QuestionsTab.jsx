import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, X, Plus, GraduationCap } from 'lucide-react';
import { QUESTION_TYPE_OPTIONS } from './constants';

const emptyQuestion = () => ({
    question_text: '', question_type: 'single', explanation: '',
    options: [{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }],
});

const trueFalseOptions = (correctIsTrue) => ([
    { option_text: 'Verdadero', is_correct: correctIsTrue },
    { option_text: 'Falso', is_correct: !correctIsTrue },
]);

const QuestionsTab = ({ form, setForm }) => {
    const [expanded, setExpanded] = useState(() => new Set(form.questions.length ? [] : [0]));
    const questions = form.questions;

    const setQuestions = (updater) => setForm((f) => ({ ...f, questions: updater(f.questions) }));

    const toggleExpanded = (i) => setExpanded((prev) => {
        const next = new Set(prev);
        next.has(i) ? next.delete(i) : next.add(i);
        return next;
    });

    const updateQuestion = (qi, patch) => setQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, ...patch } : q));

    const changeQuestionType = (qi, type) => setQuestions((prev) => prev.map((q, i) => {
        if (i !== qi) return q;
        if (type === 'true_false') return { ...q, question_type: type, options: trueFalseOptions(true) };
        if (q.question_type === 'true_false') return { ...q, question_type: type, options: [{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }] };
        return { ...q, question_type: type };
    }));

    const updateOptionText = (qi, oi, text) => setQuestions((prev) => prev.map((q, i) => i === qi
        ? { ...q, options: q.options.map((o, j) => j === oi ? { ...o, option_text: text } : o) } : q));

    const toggleCorrect = (qi, oi) => setQuestions((prev) => prev.map((q, i) => {
        if (i !== qi) return q;
        if (q.question_type === 'single' || q.question_type === 'true_false') {
            return { ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === oi })) };
        }
        return { ...q, options: q.options.map((o, j) => j === oi ? { ...o, is_correct: !o.is_correct } : o) };
    }));

    const addQuestion = () => {
        setQuestions((prev) => [emptyQuestion(), ...prev]);
        setExpanded((prev) => new Set([0, ...Array.from(prev).map((i) => i + 1)]));
    };
    const removeQuestion = (qi) => {
        setQuestions((prev) => prev.filter((_, i) => i !== qi));
        setExpanded((prev) => new Set(Array.from(prev).filter((i) => i !== qi).map((i) => i > qi ? i - 1 : i)));
    };
    const addOption = (qi) => setQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, options: [...q.options, { option_text: '', is_correct: false }] } : q));
    const removeOption = (qi, oi) => setQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q));

    return (
        <div className="question-list">
            <button type="button" className="add-question-btn" onClick={addQuestion}>
                <Plus size={16} />
                <strong>+ Nueva pregunta</strong>
                <span>Se agrega arriba de todo, abierta y lista para escribir</span>
            </button>

            {questions.length === 0 && <p className="empty-hint">Sin preguntas: la lección se completa apenas se ve el video.</p>}

            {questions.map((q, qi) => {
                const isOpen = expanded.has(qi);
                const summary = q.question_text.trim() || `Pregunta ${qi + 1}`;
                const hasExplanation = !!q.explanation?.trim();
                return (
                    <div key={qi} className="question-card">
                        <div className="question-card__head">
                            <span className="question-card__num">{String(qi + 1).padStart(2, '0')}</span>
                            <button type="button" className="question-card__summary" style={{ background: 'none', border: 0, textAlign: 'left' }} onClick={() => toggleExpanded(qi)}>
                                {isOpen ? summary : null}
                            </button>
                            {!isOpen && (
                                <span className="question-card__summary" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span className="question-chip">{QUESTION_TYPE_OPTIONS.find((t) => t.value === q.question_type)?.label}</span>
                                    {!hasExplanation && <span className="question-chip is-warning">Sin explicación</span>}
                                </span>
                            )}
                            <button type="button" className="icon-btn" onClick={() => toggleExpanded(qi)} aria-label={isOpen ? 'Contraer pregunta' : 'Expandir pregunta'}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <button type="button" className="icon-btn danger" onClick={() => removeQuestion(qi)} aria-label="Eliminar pregunta"><Trash2 size={14} /></button>
                        </div>

                        {isOpen && (
                            <div className="question-card__body">
                                <div className="question-type-pills">
                                    {QUESTION_TYPE_OPTIONS.map((t) => (
                                        <button key={t.value} type="button" className={`question-type-pill${q.question_type === t.value ? ' is-selected' : ''}`} onClick={() => changeQuestionType(qi, t.value)}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                <textarea className="form-textarea" rows={2} value={q.question_text} onChange={(e) => updateQuestion(qi, { question_text: e.target.value })} placeholder={`Enunciado de la pregunta ${qi + 1}`} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {q.options.map((o, oi) => (
                                        <div key={oi} className="option-row">
                                            <button type="button" className={`option-marker${o.is_correct ? ' is-correct' : ''}`} title="Marcar como correcta" onClick={() => toggleCorrect(qi, oi)}>✓</button>
                                            {q.question_type === 'true_false' ? (
                                                <span className="option-row__text">{o.option_text}</span>
                                            ) : (
                                                <input className="form-input option-row__text" value={o.option_text} onChange={(e) => updateOptionText(qi, oi, e.target.value)} placeholder={`Opción ${oi + 1}`} />
                                            )}
                                            {q.question_type !== 'true_false' && q.options.length > 2 && (
                                                <button type="button" className="option-row__remove" onClick={() => removeOption(qi, oi)} aria-label="Quitar opción"><X size={14} /></button>
                                            )}
                                        </div>
                                    ))}
                                    {q.question_type !== 'true_false' && (
                                        <button type="button" className="add-option-btn" onClick={() => addOption(qi)}><Plus size={12} /> Opción</button>
                                    )}
                                </div>

                                <div className="form-field">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <GraduationCap size={12} /> Explicación de la respuesta correcta (opcional)
                                    </label>
                                    <textarea className="form-textarea" rows={2} value={q.explanation} onChange={(e) => updateQuestion(qi, { explanation: e.target.value })} placeholder="Por qué esta es la respuesta correcta -- la ve el equipo, no el alumno todavía." />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default QuestionsTab;
