import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ArrowRight, Loader2, ChevronLeft, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

// Mismo helper que BugReportsPanel.jsx/PlaybookOverlay.jsx -- duplicado a propósito, ver nota
// en ese archivo sobre por qué este proyecto no lo centraliza en un util compartido.
const getLoomEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
    return match ? `https://www.loom.com/embed/${match[1]}` : null;
};

const STATE_LABEL = {
    completado: { label: 'Completado', className: 'text-emerald-400' },
    en_progreso: { label: 'En progreso', className: 'text-amber-400' },
    nuevo: { label: 'Nuevo', className: 'text-primary' },
    pendiente: { label: 'Pendiente', className: 'text-muted' },
};

// Vista de reproducción: video + playlist del módulo a la derecha, con el quiz debajo (no en
// un modal aparte, a diferencia del mockup, para no sumar una capa más de overlay sobre el
// overlay del Playbook mismo).
const PlaybookLessonView = ({ lessonId, onBack, onNavigateLesson, onCompleted, onModuleResolved }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [watched, setWatched] = useState(false);
    const [stage, setStage] = useState('video'); // video | questions
    const [answers, setAnswers] = useState({}); // { questionId: [optionId,...] }
    const [results, setResults] = useState({}); // { questionId: true|false }
    const [checking, setChecking] = useState(false);
    const [completing, setCompleting] = useState(false);

    const fetchLesson = () => {
        setLoading(true);
        api.get(`/playbook/lessons/${lessonId}`)
            .then(res => {
                setData(res.data);
                setWatched(res.data.lesson.state !== 'nuevo');
                setStage('video');
                setAnswers({});
                setResults({});
                onModuleResolved?.(res.data.module.id, res.data.module.roadmap_id);
            })
            .catch(() => toast.error('No se pudo cargar la lección'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchLesson(); }, [lessonId]);

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-primary" size={28} />
            </div>
        );
    }

    const { lesson, module, playlist } = data;
    const embedUrl = getLoomEmbedUrl(lesson.loom_link);
    const hasQuestions = lesson.questions.length > 0;

    const markWatched = () => {
        if (watched) return;
        setWatched(true);
        api.post(`/playbook/lessons/${lessonId}/watched`).catch(() => { });
    };

    const toggleOption = (question, optionId) => {
        if (results[question.id] === true) return; // ya la contestó bien, queda fija
        setAnswers(prev => {
            const current = prev[question.id] || [];
            const isMultiple = question.question_type === 'multiple';
            let next;
            if (isMultiple) {
                next = current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId];
            } else {
                next = [optionId];
            }
            return { ...prev, [question.id]: next };
        });
        setResults(prev => ({ ...prev, [question.id]: undefined }));
    };

    const checkAnswer = async (question) => {
        const selected = answers[question.id] || [];
        if (selected.length === 0) return;
        setChecking(true);
        try {
            const res = await api.post(`/playbook/lessons/${lessonId}/answer`, {
                question_id: question.id, selected_option_ids: selected,
            });
            setResults(prev => ({ ...prev, [question.id]: res.data.correct }));
        } catch {
            toast.error('No se pudo comprobar la respuesta');
        } finally {
            setChecking(false);
        }
    };

    const answeredCount = lesson.questions.filter(q => results[q.id] === true).length;
    const allCorrect = hasQuestions && answeredCount === lesson.questions.length;

    const handleComplete = async () => {
        setCompleting(true);
        try {
            const res = await api.post(`/playbook/lessons/${lessonId}/complete`, { answers });
            toast.success('¡Lección aprobada!');
            onCompleted?.();
            if (res.data.next_lesson_id) {
                onNavigateLesson(res.data.next_lesson_id);
            } else {
                onBack();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo aprobar la lección');
        } finally {
            setCompleting(false);
        }
    };

    const handleNoQuestionsDone = async () => {
        setCompleting(true);
        try {
            const res = await api.post(`/playbook/lessons/${lessonId}/complete`, { answers: {} });
            toast.success('¡Lección completada!');
            onCompleted?.();
            if (res.data.next_lesson_id) onNavigateLesson(res.data.next_lesson_id);
            else onBack();
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo completar la lección');
        } finally {
            setCompleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted hover:text-white">
                <ChevronLeft size={14} /> Módulo · {module.roadmap_name} · {module.name}
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-4">
                    {embedUrl ? (
                        <div className="relative w-full rounded-2xl overflow-hidden shadow-xl bg-black" style={{ paddingTop: '56.25%' }}>
                            <iframe
                                src={embedUrl}
                                title={lesson.title}
                                frameBorder="0"
                                allow="fullscreen"
                                allowFullScreen
                                onLoad={markWatched}
                                className="absolute inset-0 w-full h-full"
                            />
                        </div>
                    ) : (
                        <a href={lesson.loom_link} target="_blank" rel="noopener noreferrer" onClick={markWatched}
                            className="flex items-center justify-center gap-2 py-16 bg-main rounded-2xl text-sm font-bold text-primary hover:underline">
                            <PlayCircle size={18} /> Abrir el video en Loom
                        </a>
                    )}

                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black">{lesson.title}</h3>
                            {watched && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">Video visto</span>}
                        </div>
                        {lesson.description && <p className="text-xs text-muted mt-1">{lesson.description}</p>}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="bg-surface border border-base rounded-2xl p-3 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted px-1 pb-1">{module.name}</p>
                        {playlist.map(item => {
                            const meta = STATE_LABEL[item.state] || STATE_LABEL.pendiente;
                            const isCurrent = item.id === lesson.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigateLesson(item.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${isCurrent ? 'bg-primary/10 border border-primary/30' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    {item.state === 'completado' ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <PlayCircle size={14} className="text-muted shrink-0" />}
                                    <span className="flex-1 min-w-0 text-xs font-bold truncate">{item.title}</span>
                                    <span className="text-[9px] text-muted shrink-0">{item.duration_minutes ? `${item.duration_minutes} min` : ''}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="bg-surface border border-base rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            <span className={watched ? 'text-emerald-400' : 'text-primary'}>1 Video</span>
                            {hasQuestions && <span className={allCorrect ? 'text-emerald-400' : watched ? 'text-primary' : 'text-muted'}>2 Preguntas</span>}
                            <span className="text-muted">{hasQuestions ? '3' : '2'} Listo</span>
                        </div>
                        {!hasQuestions ? (
                            <button
                                onClick={handleNoQuestionsDone}
                                disabled={!watched || completing}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl disabled:opacity-40 transition-all active:scale-95"
                            >
                                {completing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                                Marcar como visto
                            </button>
                        ) : stage === 'video' ? (
                            <button
                                onClick={() => setStage('questions')}
                                disabled={!watched}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl disabled:opacity-40 transition-all active:scale-95"
                            >
                                <ArrowRight size={14} /> Ir a las preguntas
                            </button>
                        ) : (
                            <span className="block text-center text-[10px] text-muted font-bold uppercase tracking-widest">{answeredCount} de {lesson.questions.length} contestadas</span>
                        )}
                    </div>
                </div>
            </div>

            {stage === 'questions' && hasQuestions && (
                <div className="bg-surface border border-base rounded-2xl p-5 space-y-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Comprobación</p>
                    {lesson.questions.map((q, qi) => {
                        const result = results[q.id];
                        const selected = answers[q.id] || [];
                        return (
                            <div key={q.id} className="space-y-2">
                                <p className="text-sm font-bold flex items-center gap-2">
                                    <span className="text-muted">P{qi + 1}.</span> {q.question_text}
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted">
                                        {q.question_type === 'multiple' ? 'Selección múltiple' : q.question_type === 'true_false' ? 'Verdadero/falso' : 'Selección única'}
                                    </span>
                                </p>
                                <div className="space-y-1.5">
                                    {q.options.map(o => {
                                        const isSelected = selected.includes(o.id);
                                        const showState = result !== undefined;
                                        return (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onClick={() => toggleOption(q, o.id)}
                                                disabled={result === true}
                                                className={`w-full flex items-center gap-2.5 text-left px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${showState && isSelected
                                                        ? (result ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-rose-500/10 border-rose-500 text-rose-400')
                                                        : isSelected ? 'bg-primary/10 border-primary text-primary' : 'bg-main border-base text-muted hover:text-white'
                                                    }`}
                                            >
                                                {showState && isSelected ? (result ? <CheckCircle2 size={14} /> : <XCircle size={14} />) : (
                                                    <span className={`w-3.5 h-3.5 border shrink-0 ${q.question_type === 'multiple' ? 'rounded-sm' : 'rounded-full'} ${isSelected ? 'bg-primary border-primary' : 'border-base'}`} />
                                                )}
                                                {o.option_text}
                                            </button>
                                        );
                                    })}
                                </div>
                                {result !== true && (
                                    <button
                                        onClick={() => checkAnswer(q)}
                                        disabled={checking || selected.length === 0}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-hover disabled:opacity-40"
                                    >
                                        Comprobar
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    <button
                        onClick={handleComplete}
                        disabled={!allCorrect || completing}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-white text-xs font-black uppercase tracking-widest py-3.5 rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-40 transition-all active:scale-95"
                    >
                        {completing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Aprobar {playlist.some(p => p.id !== lesson.id && p.state !== 'completado') ? 'y siguiente video' : ''}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PlaybookLessonView;
