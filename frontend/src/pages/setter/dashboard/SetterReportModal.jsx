import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Calendar,
    BarChart3,
    MessageSquare,
    ChevronDown,
    Send,
    AlertCircle,
    CheckCircle2,
    Loader2,
    HelpCircle,
    Coffee
} from 'lucide-react';
import api from '../../../services/api';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import DailyReflectionSection from '../../../components/reports/DailyReflectionSection';

const SetterReportModal = ({ isOpen, onClose, reportDate, existingReport = null, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [stages, setStages] = useState([]);
    const [sections, setSections] = useState({ quant: true, qual: true });
    const [error, setError] = useState(null);

    // Form Stats
    const [formData, setFormData] = useState({
        date: reportDate || new Date().toISOString().split('T')[0]
    });
    const [fixedStats, setFixedStats] = useState({ not_lead: '' });
    const [funnelStats, setFunnelStats] = useState({});
    const [answers, setAnswers] = useState({});

    const handleNonWorkingDay = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await api.post('/setter/daily-report', {
                date: formData.date || reportDate,
                is_non_working_day: true
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error submitting non-working day report:', err);
            setError('Error al registrar el día no laborable');
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            initModal();
        }
    }, [isOpen, existingReport, reportDate]);

    const initModal = async () => {
        setLoading(true);
        setError(null);
        try {
            const [qRes, sRes] = await Promise.all([
                api.get('/setter/questions'),
                api.get('/setter/stages')
            ]);

            setQuestions(qRes.data || []);
            setStages(sRes.data || []);

            const initialFunnel = {};
            (sRes.data || []).forEach(s => initialFunnel[s.id] = '');

            if (existingReport) {
                setFormData({ date: existingReport.date });
                setFixedStats({ not_lead: existingReport.fixed_stats.not_lead || '' });
                const updatedFunnel = { ...initialFunnel };
                Object.entries(existingReport.funnel_stats).forEach(([id, val]) => {
                    updatedFunnel[id] = val || '';
                });
                setFunnelStats(updatedFunnel);
                setAnswers({ ...(existingReport.answers || {}), ...(existingReport.reflections || {}) });
            } else {
                setFormData({ date: reportDate || new Date().toISOString().split('T')[0] });
                setFixedStats({ not_lead: '' });
                setFunnelStats(initialFunnel);
                setAnswers({});
            }
        } catch (err) {
            console.error("Error initializing report modal:", err);
            setError("Error al cargar configuración de reporte");
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (section) => {
        setSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleFunnelChange = (stageId, value) => {
        setFunnelStats(prev => ({ ...prev, [stageId]: value }));
    };

    const handleFixedChange = (field, value) => {
        setFixedStats(prev => ({ ...prev, [field]: value }));
    };

    const handleAnswerChange = (qId, value) => {
        setAnswers(prev => ({ ...prev, [qId]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const funnelMetricsList = Object.entries(funnelStats).map(([stageId, value]) => ({
            stage_id: parseInt(stageId),
            value: value === '' ? 0 : parseInt(value)
        }));

        // Solo preguntas con ID numérico (legacy de BD)
        const answersList = Object.entries(answers)
            .filter(([qId]) => /^\d+$/.test(String(qId)))
            .map(([qId, val]) => ({ question_id: parseInt(qId), answer: val }))
            .filter(a => a.answer && a.answer.trim() !== '');

        // Preguntas de Daily Reflection (claves string)
        const reflectionKeys = ['daily_reflection', 'win_of_day'];
        const reflectionAnswers = {};
        reflectionKeys.forEach(key => {
            if (answers[key]) reflectionAnswers[key] = answers[key];
        });

        try {
            await api.post('/setter/daily-report', {
                date: formData.date,
                ...fixedStats,
                funnel_metrics: funnelMetricsList,
                answers: answersList,
                reflections: reflectionAnswers
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error submitting report:', err);
            setError('Error al enviar el reporte');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 pointer-events-none">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl pointer-events-auto"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="bg-surface border border-base w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden relative flex flex-col pointer-events-auto"
            >
                {/* Header */}
                <div className="p-8 border-b border-base flex justify-between items-center bg-main/30 flex-shrink-0">
                    <div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                            {existingReport ? 'Editar Reporte' : 'Nuevo Reporte'}
                        </h2>
                        <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-2">
                            Métricas y Feedback del {new Date(formData.date + 'T12:00:00').toLocaleDateString()}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-4 bg-main hover:bg-surface-hover border border-base rounded-2xl text-muted hover:text-white transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {loading ? (
                        <div className="h-60 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
                    ) : (
                        <form id="setter-report-form" onSubmit={handleSubmit} className="space-y-8">
                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle size={18} />
                                    <span className="text-xs font-black uppercase tracking-widest">{error}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Quantitative Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <BarChart3 size={18} />
                                        </div>
                                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Cuantitativo</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {stages.map(stage => (
                                            <div key={stage.id} className="space-y-2">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{stage.name}</label>
                                                <input
                                                    type="number"
                                                    required
                                                    className="w-full px-5 py-4 bg-main border border-base rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    placeholder="0"
                                                    value={funnelStats[stage.id] || ''}
                                                    onChange={(e) => handleFunnelChange(stage.id, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">No Lead</label>
                                            <input
                                                type="number"
                                                required
                                                className="w-full px-5 py-4 bg-main border border-base rounded-2xl text-sm font-bold focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                                                placeholder="0"
                                                value={fixedStats.not_lead}
                                                onChange={(e) => handleFixedChange('not_lead', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Qualitative Section */}
                                <DailyReflectionSection
                                        role="setter"
                                        values={answers}
                                        onChange={(key, val) => handleAnswerChange(key, val)}
                                    />
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-base bg-main/30 flex-shrink-0 flex flex-col md:flex-row gap-4 items-center">
                    <Button
                        type="button"
                        onClick={handleNonWorkingDay}
                        disabled={submitting || loading}
                        variant="outline"
                        className="w-full md:w-auto h-16 px-8 rounded-2xl border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-black text-xs uppercase tracking-widest gap-2 shrink-0"
                    >
                        <Coffee size={18} />
                        Día no laborable
                    </Button>
                    <Button
                        form="setter-report-form"
                        type="submit"
                        disabled={submitting || loading}
                        className="w-full md:flex-1 h-16 rounded-2xl shadow-brand-glow flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.3em]"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                <Send size={20} />
                                {existingReport ? 'Guardar Cambios' : 'Enviar Reporte Diario'}
                            </>
                        )}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default SetterReportModal;
