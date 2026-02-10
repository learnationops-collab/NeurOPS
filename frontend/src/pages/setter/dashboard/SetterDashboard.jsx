import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Send,
    CheckCircle2,
    AlertCircle,
    Loader2,
    BarChart3,
    Copy,
    Link,
    X,
    ExternalLink,
    MessageSquare,
    ArrowUpRight
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import api from '../../../services/api';
import HotkeysTable from '../../../components/dashboard/HotkeysTable';
import NotificationWidget from '../../../components/dashboard/NotificationWidget';

const SetterDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState(0); // 0: Dashboard (Top), 1: Daily Report (Bottom)
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
    const [notifications, setNotifications] = useState([]);

    // Links Modal State
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [availableLinks, setAvailableLinks] = useState({ events: [], closers: [] });

    // Initial Fetch
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchQuestionsAndStats(),
                    fetchNotifications()
                ]);
            } catch (err) {
                console.error("Error fetching data", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const fetchQuestionsAndStats = async () => {
        try {
            const [qRes, sRes] = await Promise.all([
                api.get('/setter/questions'),
                api.get('/setter/stats/summary', { params: { start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0] } })
            ]);
            setQuestions(qRes.data);
            setSummaryStats(sRes.data);
        } catch (err) {
            console.error("Error fetching stats", err);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/setter/notifications');
            setNotifications(res.data || []);
        } catch (err) {
            console.error("Error fetching notifications", err);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await api.post(`/setter/notifications/${id}/read`);
            fetchNotifications();
        } catch (err) {
            console.error("Error marking as read", err);
        }
    };

    const fetchLinks = async () => {
        try {
            const res = await api.get('/setter/links');
            setAvailableLinks(res.data);
            setIsLinkModalOpen(true);
        } catch (err) {
            console.error("Error fetching links", err);
        }
    };

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
        const category = activeSection === 0 ? 'Dashboard' : 'Reporte';
        const event = new CustomEvent('page-section-changed', {
            detail: { activeSection, category }
        });
        window.dispatchEvent(event);
    }, [activeSection]);

    // Handle "L" key for links
    useEffect(() => {
        const handleKeys = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.key.toLowerCase() === 'l') {
                if (!isLinkModalOpen) fetchLinks();
                else setIsLinkModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [isLinkModalOpen]);

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
            fetchQuestionsAndStats(); // Refresh stats
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

    if (loading) return <div className="h-screen flex items-center justify-center bg-main"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="h-screen bg-main overflow-hidden relative">
            <motion.div
                className="absolute top-0 left-0 w-full h-[200%]"
                animate={{ y: `-${activeSection * 50}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            >
                {/* SECTION 0: DASHBOARD (Top 50%) */}
                <div
                    className="absolute top-0 left-0 w-full h-[50%] flex flex-col items-center justify-start p-12 bg-main overflow-y-auto custom-scrollbar"
                >
                    <div className="w-full max-w-6xl space-y-12 py-12">
                        <header className="flex justify-between items-center border-b border-base pb-8 mb-4">
                            <div className="space-y-1 text-left">
                                <h1 className="text-5xl font-black text-base italic tracking-tighter uppercase leading-none">Dashboard</h1>
                                <p className="text-muted font-medium uppercase text-[10px] tracking-[0.2em]">Resumen y Notificaciones</p>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={fetchLinks}
                                    variant="primary"
                                    className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 text-[10px] font-black uppercase tracking-widest gap-2"
                                    icon={Link}
                                >
                                    Links de Agendamiento
                                </Button>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            {/* Hotkeys Table */}
                            <div className="space-y-6">
                                <div className="h-full">
                                    <HotkeysTable />
                                </div>
                            </div>

                            {/* Notifications Widget */}
                            <div className="space-y-6">
                                <NotificationWidget
                                    notifications={notifications}
                                    onMarkAsRead={handleMarkAsRead}
                                />
                            </div>
                        </div>

                        <div className="flex justify-center pt-12">
                            <button
                                onClick={() => setActiveSection(1)}
                                className="group flex flex-col items-center gap-2 text-muted hover:text-primary transition-all animate-bounce focus:outline-none"
                            >
                                <span className="text-[8px] font-black uppercase tracking-widest">Ir a Reporte Diario</span>
                                <div className="w-px h-8 bg-gradient-to-b from-muted group-hover:from-primary text-primary" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* SECTION 1: REPORT (Bottom 50%) */}
                <div
                    className="absolute top-[50%] left-0 w-full h-[50%] overflow-y-auto custom-scrollbar p-8 md:p-12 pb-32 bg-main/50"
                >
                    <div className="max-w-7xl mx-auto space-y-8">
                        <div className="flex justify-between items-end border-b border-base pb-8 mb-8">
                            <div className="flex items-end gap-6">
                                <button
                                    onClick={() => setActiveSection(0)} // Up to Dashboard
                                    className="p-3 mb-1 bg-surface border border-base rounded-2xl text-muted hover:text-primary transition-all group"
                                >
                                    <ArrowUpRight className="-rotate-90" size={20} />
                                </button>
                                <div>
                                    <h2 className="text-4xl font-black italic uppercase tracking-tighter text-base">Reporte Diario</h2>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Métricas y Feedback</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                            {/* LEFT COLUMN: Pending Agendas (Span 5) */}
                            <div className="lg:col-span-5 space-y-6">
                                <Card variant="surface" className="p-6 space-y-6 border-base/50 shadow-xl h-full">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                            <BarChart3 size={14} /> Agendas Pendientes
                                        </h3>
                                        <Badge variant="neutral" className="px-2 py-0.5 text-[9px]">{summaryStats?.pending_agendas?.length || 0}</Badge>
                                    </div>

                                    <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                                        {summaryStats?.pending_agendas?.length > 0 ? (summaryStats.pending_agendas.map(agenda => (
                                            <div key={agenda.id} className="flex flex-col gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10 group hover:border-primary/30 transition-all">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-black text-base italic">{agenda.lead_name}</p>
                                                        <p className="text-[10px] text-muted font-bold uppercase tracking-wide">
                                                            {agenda.origin}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                                                            {new Date(agenda.start_time).toLocaleDateString()}
                                                        </p>
                                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                                                            {new Date(agenda.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="h-px bg-primary/10 w-full" />
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="text-muted/70 font-bold uppercase">Closer Asignado</span>
                                                    <span className="font-black text-primary/80 uppercase">{agenda.closer_name}</span>
                                                </div>
                                            </div>
                                        ))) : (
                                            <div className="text-center py-20 opacity-30 space-y-4">
                                                <CheckCircle2 size={32} className="mx-auto text-muted" />
                                                <div className="text-[9px] font-black uppercase tracking-widest">No hay agendas pendientes</div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </div>

                            {/* RIGHT COLUMN: Report Form (Span 7) */}
                            <div className="lg:col-span-7">
                                <form onSubmit={handleSubmit} className="space-y-6 h-full">
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
                    </div>
                </div>
            </motion.div>

            {/* Links Modal */}
            <AnimatePresence>
                {isLinkModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-main border border-base rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden"
                        >
                            <button
                                onClick={() => setIsLinkModalOpen(false)}
                                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-muted"
                            >
                                <X size={20} />
                            </button>

                            <h3 className="text-2xl font-black text-base italic uppercase tracking-tighter mb-8 flex items-center gap-3">
                                <Link size={24} className="text-primary" /> Links de Agendamiento
                            </h3>

                            <div className="space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                                {availableLinks.events.map(event => (
                                    <div key={event.id} className="space-y-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Badge variant="primary" className="text-[9px]">{event.name}</Badge>
                                            <div className="h-px bg-base flex-1" />
                                        </div>

                                        {/* General Link */}
                                        <div className="bg-surface p-4 rounded-xl border border-white/5 space-y-2 group hover:border-primary/20 transition-all">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Link General (Equipo)</p>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 bg-main p-3 rounded-lg border border-base text-xs font-mono text-muted/70 truncate">
                                                    {window.location.origin}/book/{event.slug}
                                                </div>
                                                <Button
                                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/book/${event.slug}`)}
                                                    variant="ghost"
                                                    className="h-10 w-10 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                                                >
                                                    <Copy size={16} />
                                                </Button>
                                                <a
                                                    href={`/book/${event.slug}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-primary/10 hover:text-primary text-muted transition-colors opacity-50 hover:opacity-100"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            </div>
                                        </div>

                                        {/* Personal Links */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {availableLinks.closers.map(closer => (
                                                <div key={closer.id} className="bg-surface/50 p-3 rounded-xl border border-white/5 flex items-center justify-between group hover:border-primary/10 transition-all">
                                                    <div className="min-w-0">
                                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1 truncate">@{closer.username}</p>
                                                        <p className="text-[10px] text-muted/30 truncate hidden group-hover:block transition-all hover:text-primary cursor-pointer" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/book/${event.slug}-${closer.username}`)}>
                                                            Copiar Link
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/book/${event.slug}-${closer.username}`)}
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Copy size={14} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div >
    );
};

export default SetterDashboard;
