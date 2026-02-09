import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Send,
    CheckCircle2,
    AlertCircle,
    Loader2,
    BarChart3
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import api from '../../../services/api';
import HotkeysTable from '../../../components/dashboard/HotkeysTable';

const SetterDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState(1); // 0: Register (Top), 1: Summary (Bottom)
    const [submitting, setSubmitting] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [fixedStats, setFixedStats] = useState({
        inbound_leads: '',
        openings: '',
        not_lead: '',
        new_offers: '',
        links_sent: '',
        appointments_booked: '',
        follow_ups: ''
    });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [summaryStats, setSummaryStats] = useState(null);

    useEffect(() => {
        // Fetch questions and potentially today's summary
        const init = async () => {
            setLoading(true);
            try {
                const [qRes, sRes] = await Promise.all([
                    api.get('/setter/questions'),
                    api.get('/setter/stats/summary', { params: { start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0] } })
                ]);
                setQuestions(qRes.data);
                setSummaryStats(sRes.data);
            } catch (err) {
                console.error("Error fetching data", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // Listen for section change requests from DOCK
    useEffect(() => {
        const handleRequest = (e) => {
            const { index } = e.detail;
            setActiveSection(index);
        };
        window.addEventListener('request-section-change', handleRequest);
        return () => window.removeEventListener('request-section-change', handleRequest);
    }, []);

    // Send active section to Dock
    useEffect(() => {
        const category = activeSection === 0 ? 'Notificaciones' : 'Reporte';
        const event = new CustomEvent('page-section-changed', {
            detail: { activeSection, category }
        });
        window.dispatchEvent(event);
    }, [activeSection]);

    // Handler for fixed stats input changes
    const handleFixedChange = (field, value) => {
        setFixedStats(prev => ({ ...prev, [field]: value }));
    };

    // Handler for form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            await api.post('/setter/daily-report', {
                fixed_stats: fixedStats,
                answers
            });
            setSuccess('Reporte enviado correctamente');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error submitting report:', err);
            setError('Error al enviar el reporte');
        } finally {
            setSubmitting(false);
        }
    };

    // Handler for qualitative answer changes
    const handleAnswerChange = (qId, value) => {
        setAnswers(prev => ({ ...prev, [qId]: value }));
    };

    // ... (rest of handles)

    if (loading) return <div className="h-screen flex items-center justify-center bg-main"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="h-screen bg-main overflow-hidden relative">
            <motion.div
                className="absolute top-0 left-0 w-full h-[200%]"
                animate={{ y: `-${activeSection * 50}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            >
                {/* SECTION 0: NOTIFICATIONS (Top 50%) */}
                <div
                    className="absolute top-0 left-0 w-full h-[50%] flex flex-col items-center justify-center text-center p-12"
                >
                    <div className="p-6 rounded-full bg-surface border border-white/5 shadow-2xl mb-6">
                        <Send size={48} className="text-muted" />
                    </div>
                    <h2 className="text-2xl font-black text-muted uppercase tracking-widest mb-2">Notificaciones</h2>
                    <p className="text-xs font-bold text-muted/50 uppercase tracking-widest">No tienes nuevas notificaciones</p>

                    <div className="mt-8 w-full max-w-sm">
                        <HotkeysTable />
                    </div>

                    <div className="mt-8">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted/50 animate-bounce cursor-pointer hover:text-primary transition-colors" onClick={() => setActiveSection(1)}>
                            ↓ Ir a Reporte Diario
                        </p>
                    </div>
                </div>

                {/* SECTION 1: REPORT (Bottom 50%) */}
                <div
                    className="absolute top-[50%] left-0 w-full h-[50%] overflow-y-auto custom-scrollbar p-8 md:p-12 pb-32"
                >
                    <div className="max-w-3xl mx-auto space-y-8">
                        <div className="text-center mb-8">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted/50 mb-4 cursor-pointer hover:text-primary transition-colors" onClick={() => setActiveSection(0)}>
                                ↑ Ir a Notificaciones
                            </p>
                            <h2 className="text-3xl font-black text-base italic uppercase tracking-tighter">
                                Reporte Diario
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Card variant="surface" className="p-8 space-y-8 border-base/50 shadow-2xl">

                                {/* Fixed Metrics Section */}
                                <div>
                                    <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
                                        <LayoutDashboard size={14} /> Métricas Base
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {[
                                            { k: 'inbound_leads', l: 'Inbound Leads (Entrantes)' },
                                            { k: 'openings', l: 'Aperturas (Openings)' },
                                            { k: 'appointments_booked', l: 'Agendas (Booked)' },
                                            { k: 'new_offers', l: 'Nuevas Ofertas' },
                                            { k: 'links_sent', l: 'Links Enviados' },
                                            { k: 'follow_ups', l: 'Seguimientos' },
                                            { k: 'not_lead', l: 'No Lead / Descalificados' },
                                        ].map(field => (
                                            <div key={field.k} className="space-y-2">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{field.l}</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-3 bg-main border border-base rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted/20"
                                                    placeholder="0"
                                                    value={fixedStats[field.k]}
                                                    onChange={(e) => handleFixedChange(field.k, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-base w-full" />

                                {/* Qualitative Questions */}
                                <div>
                                    <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-6">Feedback Cualitativo</h3>
                                    <div className="space-y-6">
                                        {questions.map(q => (
                                            <div key={q.id} className="space-y-2">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{q.text}</label>
                                                <textarea
                                                    className="w-full px-4 py-3 bg-main border border-base rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted/20 min-h-[100px] resize-none"
                                                    placeholder="Escribe tu respuesta..."
                                                    value={answers[q.id] || ''}
                                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Feedback Messages */}
                                {error && (
                                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-500">
                                        <AlertCircle size={18} />
                                        <span className="text-xs font-black uppercase tracking-wide">{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-500">
                                        <CheckCircle2 size={18} />
                                        <span className="text-xs font-black uppercase tracking-wide">{success}</span>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    loading={submitting}
                                    className="w-full h-14 text-xs font-black tracking-widest uppercase bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20"
                                >
                                    <Send size={16} className="mr-2" /> Enviar Reporte Diario
                                </Button>
                            </Card>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div >
    );
};

export default SetterDashboard;
