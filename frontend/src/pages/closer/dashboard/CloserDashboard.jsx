import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import NewSaleModal from '../../../components/modals/NewSaleModal';
import SaleDetailModal from '../../../components/modals/SaleDetailModal';
import api from '../../../services/api';
import AgendaManagerModal from '../../../components/modals/AgendaManagerModal';
import AddAgendaModal from '../../../components/modals/AddAgendaModal';
import Button from '../../../components/ui/Button';
import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import HotkeysTable from '../../../components/dashboard/HotkeysTable';
import BookingLinkModal from '../../../components/dashboard/BookingLinkModal';
import QuickSaleModal from '../../../components/modals/QuickSaleModal';
import QuickAppointmentModal from '../../../components/modals/QuickAppointmentModal';
import DailyReflectionSection from '../../../components/reports/DailyReflectionSection';
import {

    Loader2,
    Activity,
    Calendar,
    Users,
    TrendingUp,
    CheckCircle2,
    Clock,
    DollarSign,
    Target,
    ChevronRight,
    ArrowUpRight,
    Search,
    MessageSquare,
    PhoneCall,
    Zap,
    Plus,
    RefreshCw,
    XCircle,
    Send,
    Link as LinkIcon
} from 'lucide-react';

const CloserDashboard = () => {
    const navigate = useNavigate();
    // Dashboard Stats State
    const [data, setData] = useState({
        kpis: {},
        commission: {},
        rates: {},
        progress: 0,
        agendas_today: [],
        sales_today: [],
        today_stats: null,
        report_questions: [],
        recent_clients: [],
        booking_links: []
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [answers, setAnswers] = useState({});
    const [reflections, setReflections] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [isReportExpanded, setIsReportExpanded] = useState(false);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
    const [isAddAgendaModalOpen, setIsAddAgendaModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
    const [activeSection, setActiveSection] = useState(0); // 0: Dashboard, 1: Daily Summary
    const [copying, setCopying] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);
    const [isQuickApptOpen, setIsQuickApptOpen] = useState(false);
    const [showSavedToast, setShowSavedToast] = useState(false);

    useEffect(() => {
        fetchAll();
    }, []);


    // Dispatch activeSection to Dock
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('page-section-changed', {
            detail: { activeSection, category: 'Board' }
        }));
    }, [activeSection]);

    // Listen for section change requests from DOCK
    useEffect(() => {
        const handleRequest = (e) => {
            const { index } = e.detail;
            setActiveSection(index);
        };
        window.addEventListener('request-section-change', handleRequest);
        return () => window.removeEventListener('request-section-change', handleRequest);
    }, []);

    useEffect(() => {
        const handleKeys = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.key.toLowerCase() === 'l') {
                setIsLinkModalOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchDashboard(),
                fetchBookingLink()
            ]);
        } catch (err) {
            console.error("Error in fetchAll", err);
        } finally {
            setLoading(false);
        }
    };



    const fetchBookingLink = async () => {
        try {
            const res = await api.get('/closer/booking-link');
            setData(prev => ({ ...prev, booking_links: res.data || [] }));
        } catch (err) {
            console.error("Error fetching booking link", err);
        }
    };

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/closer/dashboard');
            setData(prev => ({
                ...prev,
                kpis: res.data.kpis || {},
                commission: res.data.commission || {},
                rates: res.data.rates || {},
                progress: res.data.progress || 0,
                agendas_today: res.data.agendas_today || [],
                sales_today: res.data.sales_today || [],
                report_questions: res.data.report_questions || [],
                recent_clients: res.data.recent_clients || [],
                today_stats: res.data.today_stats || null
            }));

            if (res.data.today_stats?.answers) {
                setAnswers(res.data.today_stats.answers);
            }
            if (res.data.today_stats?.reflections) {
                setReflections(res.data.today_stats.reflections);
            }
        } catch (err) {
            console.error("Error fetching dashboard", err);
            setError("Error al cargar estadísticas.");
        }
    };

    const handleAnswerChange = (qId, val) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    };



    const handleAgendaClick = (appt) => {
        // Here appt is already available from dashboard data
        setSelectedAgenda(appt);
        setIsAgendaModalOpen(true);
    };

    const handleCopyLink = (link) => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopying(true);
        setTimeout(() => setCopying(false), 2000);
    };

    const handleSubmitReport = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/closer/daily-report', { answers, reflections });
            setShowSavedToast(true);
            setTimeout(() => setShowSavedToast(false), 3000);
            fetchDashboard();
        } catch (err) {
            console.error("Error saving report", err);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-20 min-h-screen">
            <Loader2 className="animate-spin text-primary" size={48} />
        </div>
    );

    return (
        <div className="h-screen overflow-hidden relative">
            <AnimatePresence>
                {showSavedToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="fixed top-8 left-1/2 z-50"
                    >
                        <div className="glass-panel text-text-main px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl font-black text-[10px] tracking-widest border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-md">
                            <CheckCircle2 size={18} className="text-emerald-500" />
                            Reporte guardado
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                className="absolute top-0 left-0 w-full h-[200%]"
                animate={{ y: `-${activeSection * 50}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            >

                {/* SECTION 0: DASHBOARD (Top 50%) */}
                <div
                    className="absolute top-0 left-0 w-full h-[50%] flex flex-col items-center justify-start p-12 overflow-y-auto custom-scrollbar"
                >
                    <div className="w-full max-w-6xl space-y-12 py-12">
                        <header className="flex justify-between items-center border-b border-base pb-8 mb-4">
                            <div className="space-y-1 text-left">
                                <h1 className="text-5xl font-black text-base tracking-tighter leading-none">Dashboard</h1>
                                <p className="text-muted font-medium text-[10px] tracking-[0.2em]">Acceso rápido y notificaciones</p>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={() => setIsLinkModalOpen(true)}
                                    variant="ghost"
                                    className="h-12 px-6 rounded-xl bg-surface hover:bg-surface-hover border border-base text-primary font-black tracking-widest text-[10px] gap-2"
                                    icon={LinkIcon}
                                >
                                    Links de agendas
                                </Button>
                                <Button
                                    onClick={() => setIsQuickApptOpen(true)}
                                    variant="ghost"
                                    className="h-12 px-6 rounded-xl bg-surface hover:bg-surface-hover border border-base text-muted font-black tracking-widest text-[10px] gap-2"
                                    icon={Calendar}
                                >
                                    Nueva agenda
                                </Button>
                                <Button
                                    onClick={() => setIsQuickSaleOpen(true)}
                                    variant="primary"
                                    className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 text-[10px] font-black tracking-widest gap-2"
                                    icon={DollarSign}
                                >
                                    Nueva venta
                                </Button>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 gap-12">
                            {/* Hotkeys Table */}
                            <div className="space-y-6">
                                <div className="h-full">
                                    <HotkeysTable />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center pt-12">
                            <button
                                onClick={() => setActiveSection(1)}
                                className="group flex flex-col items-center gap-2 text-muted hover:text-primary transition-all animate-bounce focus:outline-none"
                            >
                                <span className="text-[8px] font-black tracking-widest">Ir a reporte diario</span>
                                <div className="w-px h-8 bg-gradient-to-b from-muted group-hover:from-primary text-primary" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* SECTION 1: DAILY SUMMARY (Bottom 50%) */}
                <div
                    className="absolute top-[50%] left-0 w-full h-[50%] p-8 flex flex-col items-center justify-start overflow-y-auto custom-scrollbar"
                >
                    <div className="w-full max-w-6xl space-y-12 py-12">
                        <header className="flex justify-between items-end border-b border-base pb-8">
                            <div className="flex items-end gap-6">
                                <button
                                    onClick={() => setActiveSection(0)} // Up to Dashboard
                                    className="p-3 mb-1 bg-surface border border-base rounded-2xl text-muted hover:text-primary transition-all group"
                                >
                                    <ArrowUpRight className="-rotate-90" size={20} />
                                </button>
                                <div>
                                    <h2 className="text-4xl font-black tracking-tighter text-base">Resumen diario</h2>
                                    <p className="text-[10px] font-bold text-muted tracking-widest mt-1">Reporte y KPIs de hoy</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-muted tracking-widest">Cierre mes</p>
                                    <p className="text-2xl font-black text-primary leading-none mt-1">{data.rates.closing_month?.toFixed(1)}%</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-muted tracking-widest">Comisiones</p>
                                    <p className="text-2xl font-black text-secondary leading-none mt-1"> ${data.commission.month?.toLocaleString()}</p>
                                </div>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                            {/* Report Form */}
                            <div className="lg:col-span-2">
                                <Card variant="surface" className="p-8 space-y-8 bg-surface/50 backdrop-blur-sm">
                                    <form onSubmit={handleSubmitReport} className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {data.report_questions?.map(q => (
                                                <div key={q.id} className="space-y-3">
                                                    <label className="text-[9px] font-black text-muted tracking-widest ml-1">{q.text}</label>
                                                    <input
                                                        type={q.type === 'number' ? 'number' : 'text'}
                                                        className="w-full px-6 py-5 bg-main border border-base rounded-2xl text-base outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:text-muted/20"
                                                        placeholder="Ingresa valor..."
                                                        value={answers[q.id] || ''}
                                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <DailyReflectionSection
                                            role="closer"
                                            values={reflections}
                                            onChange={(key, val) => setReflections(prev => ({ ...prev, [key]: val }))}
                                        />
                                        <Button
                                            type="submit"
                                            loading={submitting}
                                            className="w-full h-16 text-xs font-black tracking-widest shadow-xl shadow-primary/20 bg-primary text-white"
                                        >
                                            Sincronizar reporte
                                        </Button>

                                    </form>
                                </Card>
                            </div>

                            {/* Side Widgets */}
                            <div className="space-y-6">
                                <Card variant="surface" className="p-8 border-primary/20 bg-primary/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[10px] font-black tracking-widest text-primary">Progreso hoy</h3>
                                        <Badge variant="neutral" className="bg-primary text-white font-black">{data.progress?.toFixed(0)}%</Badge>
                                    </div>
                                    <div className="h-3 w-full bg-main rounded-full overflow-hidden border border-base shadow-inner">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${data.progress}%` }}
                                            transition={{ duration: 1.5, ease: 'easeOut' }}
                                            className="h-full bg-primary"
                                        />
                                    </div>
                                </Card>

                                <Card variant="surface" className="p-8">
                                    <h3 className="text-[10px] font-black tracking-widest mb-6 border-b border-base pb-3">Agendas hoy</h3>
                                    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {data.agendas_today?.length > 0 ? data.agendas_today.map(a => (
                                            <div
                                                key={a.id}
                                                onClick={() => handleAgendaClick(a)}
                                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${a.has_sale ? 'bg-emerald-500/[0.03] border-emerald-500/10 hover:border-emerald-500/30' : 'bg-main/50 border-base hover:border-primary/30'}`}
                                            >
                                                <div className="space-y-1 min-w-0">
                                                    <p className="text-[11px] font-black text-main flex items-center gap-1.5 flex-wrap">
                                                        {a.lead_name}
                                                        {a.has_sale && (
                                                            <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] py-0.5 px-1.5 rounded-full font-bold">
                                                                ✓ {a.sales_count}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[8px] font-bold text-muted tracking-tighter">
                                                        <Clock size={10} className="text-primary" />
                                                        {new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[8px] font-black uppercase text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                                                        Confirmer: {a.result || 'Pendiente'}
                                                    </span>
                                                    {a.is_rescheduled && (
                                                        <span className="text-[8px] font-black uppercase text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md">
                                                            Reagenda
                                                        </span>
                                                    )}
                                                    <span className={`text-[9px] font-black px-2 py-1 rounded-xl uppercase tracking-wider ${
                                                        a.closer_result === 'Show up' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                                                        a.closer_result === 'No Show' ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20' :
                                                        a.closer_result === 'Cancelado' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                                                        a.closer_result === 'Reagendado' ? 'bg-violet-500/10 text-violet-450 border border-violet-500/20' :
                                                        a.closer_result === '2da call' ? 'bg-blue-500/10 text-blue-450 border border-blue-500/20' :
                                                        'bg-slate-500/10 text-slate-450 border border-slate-500/20'
                                                    }`}>
                                                        {a.closer_result || 'Pendiente'}
                                                    </span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 opacity-30 text-[9px] font-black tracking-widest">No hay agendas hoy</div>
                                        )}
                                    </div>
                                </Card>

                                <Card variant="surface" className="p-8 border-emerald-500/20">
                                    <h3 className="text-[10px] font-black tracking-widest mb-6 border-b border-base pb-3 text-emerald-500">Nuevas ventas</h3>
                                    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {data.sales_today?.length > 0 ? data.sales_today.map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 group hover:border-emerald-500/30 transition-all">
                                                <div className="space-y-1">
                                                    <p className="text-[11px] font-black text-main">{s.student_name}</p>
                                                    <div className="flex items-center gap-2 text-[8px] font-bold text-emerald-600/70 tracking-tighter">
                                                        <DollarSign size={10} />
                                                        {s.program_name}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-emerald-500">${s.amount?.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 opacity-30 text-[9px] font-black tracking-widest">Esperando primera venta...</div>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </div>

                    </div>
                </div>
            </motion.div>

            <AgendaManagerModal
                isOpen={isAgendaModalOpen}
                appointment={selectedAgenda}
                onClose={() => setIsAgendaModalOpen(false)}
                onSuccess={fetchAll}
                mode="closer"
            />

            <AddAgendaModal
                isOpen={isAddAgendaModalOpen}
                onClose={() => setIsAddAgendaModalOpen(false)}
                onSuccess={fetchAll}
            />

            <BookingLinkModal
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
                data={data.booking_links}
            />

            <QuickSaleModal
                isOpen={isQuickSaleOpen}
                onClose={() => setIsQuickSaleOpen(false)}
                onSuccess={() => {
                    fetchAll();
                    // Optionally show success toast
                }}
            />

            <QuickAppointmentModal
                isOpen={isQuickApptOpen}
                onClose={() => setIsQuickApptOpen(false)}
                onSuccess={() => {
                    fetchAll();
                    // Optionally show success toast
                }}
            />
        </div>
    );
};

export default CloserDashboard;
