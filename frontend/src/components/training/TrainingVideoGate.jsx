import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Convierte un link de Loom (share o embed) en su URL embebible. Mismo helper que
// BugReportsPanel.jsx (LoomModal) — no se extrajo a un util compartido porque en este
// proyecto ese tipo de helper chico se duplica por archivo en vez de forzar un import cruzado.
const getLoomEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
    return match ? `https://www.loom.com/embed/${match[1]}` : null;
};

// Gate global de videos de documentación con quiz de comprensión. Se monta a nivel de App
// (no dentro de MainLayout) por el mismo motivo que BugReportWidget: CloserWorkflowPage
// ("/closer/deck") corre standalone y no usa MainLayout, y los closers son justamente uno de
// los públicos objetivo de este feature. Se autogatea con useAuth().
const TrainingVideoGate = () => {
    const { user } = useAuth();
    const [pending, setPending] = useState([]);
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState({}); // { questionId: [optionId, ...] }
    const [results, setResults] = useState(null); // { questionId: bool } tras un intento fallido
    const [submitting, setSubmitting] = useState(false);
    const [watched, setWatched] = useState(false);

    useEffect(() => {
        if (!user) {
            setPending([]);
            return;
        }
        api.get('/training-videos/pending', { skipBugReport: true })
            .then(res => setPending(res.data))
            .catch(() => { });
    }, [user]);

    const current = pending[index];

    useEffect(() => {
        setSelected({});
        setResults(null);
        setWatched(false);
    }, [current?.id]);

    if (!user || !current) return null;

    const embedUrl = getLoomEmbedUrl(current.loom_link);

    const toggleOption = (questionId, optionId) => {
        setSelected(prev => {
            const currentIds = prev[questionId] || [];
            const next = currentIds.includes(optionId)
                ? currentIds.filter(id => id !== optionId)
                : [...currentIds, optionId];
            return { ...prev, [questionId]: next };
        });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await api.post(`/training-videos/${current.id}/submit`, { answers: selected }, { skipBugReport: true });
            if (res.data.all_correct) {
                toast.success('¡Completado! Ya viste y entendiste este video.');
                const next = pending.filter((_, i) => i !== index);
                setPending(next);
                setIndex(0);
            } else {
                setResults(res.data.results);
                toast.error('Alguna respuesta no es correcta. Puedes volver a ver el video antes de reintentar.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo enviar tus respuestas.');
        } finally {
            setSubmitting(false);
        }
    };

    const allAnswered = current.questions.every(q => (selected[q.id] || []).length > 0);

    return createPortal(
        <AnimatePresence>
            <motion.div
                key={current.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 md:p-8 overflow-y-auto"
            >
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="w-full max-w-3xl bg-surface border border-base rounded-3xl shadow-2xl overflow-hidden my-auto"
                >
                    <div className="p-6 md:p-8 space-y-6">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                <GraduationCap size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                                    Video de documentación {pending.length > 1 && `(${index + 1}/${pending.length})`}
                                </p>
                                <h2 className="text-lg font-black tracking-tight">{current.title}</h2>
                                {current.description && (
                                    <p className="text-xs text-muted font-medium mt-1">{current.description}</p>
                                )}
                            </div>
                        </div>

                        {embedUrl ? (
                            <div className="relative w-full rounded-2xl overflow-hidden shadow-xl" style={{ paddingTop: '56.25%' }}>
                                <iframe
                                    src={embedUrl}
                                    title={current.title}
                                    frameBorder="0"
                                    allow="fullscreen"
                                    allowFullScreen
                                    onLoad={() => setWatched(true)}
                                    className="absolute inset-0 w-full h-full"
                                />
                            </div>
                        ) : (
                            <a
                                href={current.loom_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setWatched(true)}
                                className="block text-center text-sm font-bold text-primary hover:underline py-6 bg-main rounded-2xl"
                            >
                                Abrir el video en Loom →
                            </a>
                        )}

                        <div className="space-y-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                                Responde para confirmar que viste el video completo
                            </p>
                            {current.questions.map((q, qi) => {
                                const questionResult = results ? results[q.id] : null;
                                return (
                                    <div key={q.id} className="space-y-2.5">
                                        <p className="text-sm font-bold flex items-start gap-2">
                                            <span className="text-muted">{qi + 1}.</span>
                                            <span>{q.question_text}</span>
                                            {questionResult === true && <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />}
                                            {questionResult === false && <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />}
                                        </p>
                                        <div className="space-y-1.5 pl-5">
                                            {q.options.map(o => {
                                                const isSelected = (selected[q.id] || []).includes(o.id);
                                                return (
                                                    <button
                                                        key={o.id}
                                                        type="button"
                                                        onClick={() => toggleOption(q.id, o.id)}
                                                        className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border text-xs font-bold transition-all ${isSelected
                                                                ? 'bg-primary/10 border-primary text-primary'
                                                                : 'bg-main border-base text-muted hover:text-white hover:border-white/20'
                                                            }`}
                                                    >
                                                        <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-base'}`}>
                                                            {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                                        </span>
                                                        {o.option_text}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!allAnswered || submitting}
                            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            Confirmar respuestas
                        </button>
                        <p className="text-[10px] text-muted text-center font-medium">
                            Si alguna respuesta es incorrecta podrás volver a intentarlo. Este video seguirá apareciendo hasta que respondas todo bien.
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default TrainingVideoGate;
