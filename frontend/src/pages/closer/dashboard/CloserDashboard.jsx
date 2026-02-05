import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import NewSaleModal from '../../../components/NewSaleModal';
import SaleDetailModal from '../../../components/SaleDetailModal';
import api from '../../../services/api';
import AgendaManagerModal from '../../../components/AgendaManagerModal';
import AddAgendaModal from '../../../components/AddAgendaModal';
import Button from '../../../components/ui/Button';
import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import CloserKanbanBoard from '../../../components/CloserKanbanBoard';
import {
    Activity,
    Calendar,
    Users,
    TrendingUp,
    CheckCircle2,
    Clock,
    DollarSign,
    Target,
    BarChart3,
    ClipboardCheck,
    Loader2,
    ArrowUpRight,
    ChevronRight,
    Search,
    MessageSquare,
    PhoneCall,
    Zap,
    Plus,
    Save,
    RefreshCw,
    XCircle
} from 'lucide-react';

const CloserDashboard = () => {
    // Dashboard Stats State
    const [data, setData] = useState({
        kpis: {},
        commission: {},
        rates: {},
        progress: 0,
        agendas_today: [],
        sales_today: [],
        report_questions: [],
        recent_clients: [],
        today_stats: null
    });

    // Kanban State
    const [kanbanData, setKanbanData] = useState({ stages: [], board: {} });
    const [pendingChanges, setPendingChanges] = useState({});
    const [kanbanLoading, setKanbanLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSavedToast, setShowSavedToast] = useState(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [isReportExpanded, setIsReportExpanded] = useState(false);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
    const [isAddAgendaModalOpen, setIsAddAgendaModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
    const [activeSection, setActiveSection] = useState(0); // 0: Welcome, 1: Daily Summary

    const [kanbanSubTab, setKanbanSubTab] = useState('tracking'); // 'tracking' or 'closing'

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

    // Vertical Key Navigation
    useEffect(() => {
        const handleKeys = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

            if (e.key === 'ArrowUp' && activeSection === 0) {
                setActiveSection(1); // Move Up to Secondary
            } else if (e.key === 'ArrowDown' && activeSection === 1) {
                setActiveSection(0); // Move Down to Default
            }
        };

        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [activeSection]);

    // Kanban splitting logic
    const trackingStages = ["Nueva", "Respondido", "Confirmado"];
    const closingStages = ["Asistido", "Contexto", "Decisor", "Presentado"];

    const filteredKanbanStages = kanbanSubTab === 'tracking' ? trackingStages : closingStages;
    const filteredKanbanBoard = useMemo(() => {
        const board = {};
        filteredKanbanStages.forEach(stage => {
            board[stage] = kanbanData.board[stage] || [];
        });
        return board;
    }, [kanbanData.board, kanbanSubTab, filteredKanbanStages]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchDashboard(), fetchKanbanData()]);
        } catch (err) {
            console.error("Error in fetchAll", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchKanbanData = async () => {
        setKanbanLoading(true);
        try {
            const res = await api.get('/closer/kanban');
            setKanbanData(res.data);
            setPendingChanges({});
        } catch (err) {
            console.error("Error fetching kanban", err);
        } finally {
            setKanbanLoading(false);
        }
    };

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/closer/dashboard');
            const safeData = {
                kpis: res.data.kpis || {},
                commission: res.data.commission || {},
                rates: res.data.rates || {},
                progress: res.data.progress || 0,
                agendas_today: res.data.agendas_today || [],
                sales_today: res.data.sales_today || [],
                report_questions: res.data.report_questions || [],
                recent_clients: res.data.recent_clients || [],
                today_stats: res.data.today_stats || null
            };
            setData(safeData);
            if (safeData.today_stats?.answers) {
                setAnswers(safeData.today_stats.answers);
            }
        } catch (err) {
            console.error("Error fetching dashboard", err);
            setError("Error al cargar estadísticas.");
        }
    };

    const handleAnswerChange = (qId, val) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    };

    const handleSubmitReport = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/closer/daily-report', { answers });
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
        <div className="h-screen overflow-hidden relative bg-main">
            {showSavedToast && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-emerald-500 text-black px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl font-black uppercase text-[10px] tracking-widest">
                        <CheckCircle2 size={18} />
                        Reporte guardado
                    </div>
                </div>
            )}

            <motion.div
                className="h-full w-full"
                animate={{ y: `-${(1 - activeSection) * 100}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            >
                {/* SECTION 1: DAILY SUMMARY (Top) */}
                <section className="h-full w-full p-8 flex flex-col items-center justify-start bg-main/50 relative overflow-y-auto">
                    <div className="w-full max-w-6xl space-y-12 py-12">
                        <header className="flex justify-between items-end border-b border-base pb-8">
                            <div className="flex items-end gap-6">
                                <button
                                    onClick={() => setActiveSection(0)}
                                    className="p-3 mb-1 bg-surface border border-base rounded-2xl text-muted hover:text-primary transition-all group"
                                >
                                    <Plus className="rotate-45" size={20} />
                                </button>
                                <div>
                                    <h2 className="text-4xl font-black italic uppercase tracking-tighter text-base">Resumen Diario</h2>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Reporte y KPIs de hoy</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest italic">Cierre Mes</p>
                                    <p className="text-2xl font-black text-primary italic leading-none mt-1">{data.rates.closing_month?.toFixed(1)}%</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest italic">Comisiones</p>
                                    <p className="text-2xl font-black text-secondary italic leading-none mt-1"> ${data.commission.month?.toLocaleString()}</p>
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
                                                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">{q.text}</label>
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
                                        <Button
                                            type="submit"
                                            loading={submitting}
                                            className="w-full h-16 text-xs font-black tracking-widest uppercase shadow-xl shadow-primary/20 bg-primary text-white"
                                        >
                                            Sincronizar Reporte
                                        </Button>
                                    </form>
                                </Card>
                            </div>

                            {/* Side Widgets */}
                            <div className="space-y-6">
                                <Card variant="surface" className="p-8 border-primary/20 bg-primary/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary italic">Progreso Hoy</h3>
                                        <Badge variant="neutral" className="bg-primary text-white font-black italic">{data.progress?.toFixed(0)}%</Badge>
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
                                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b border-base pb-3">Agendas Hoy</h3>
                                    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {data.agendas_today?.length > 0 ? data.agendas_today.map(a => (
                                            <div key={a.id} className="flex items-center justify-between p-4 bg-main/50 rounded-2xl border border-base group hover:border-primary/30 transition-all">
                                                <div className="space-y-1">
                                                    <p className="text-[11px] font-black italic text-main">{a.lead_name}</p>
                                                    <div className="flex items-center gap-2 text-[8px] font-bold text-muted uppercase tracking-tighter">
                                                        <Clock size={10} className="text-primary" />
                                                        {new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 opacity-30 text-[9px] font-black uppercase tracking-widest">No hay agendas hoy</div>
                                        )}
                                    </div>
                                </Card>

                                <Card variant="surface" className="p-8 border-emerald-500/20">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b border-base pb-3 text-emerald-500">Nuevas Ventas</h3>
                                    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {data.sales_today?.length > 0 ? data.sales_today.map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 group hover:border-emerald-500/30 transition-all">
                                                <div className="space-y-1">
                                                    <p className="text-[11px] font-black italic text-main">{s.student_name}</p>
                                                    <div className="flex items-center gap-2 text-[8px] font-bold text-emerald-600/70 uppercase tracking-tighter">
                                                        <DollarSign size={10} />
                                                        {s.program_name}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-emerald-500 italic">${s.amount?.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 opacity-30 text-[9px] font-black uppercase tracking-widest">Esperando primera venta...</div>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 0: WELCOME SCREEN (Bottom) */}
                <section className="h-full w-full flex flex-col items-center justify-center relative overflow-hidden bg-main">
                    <div className="relative z-10 text-center space-y-6 max-w-2xl px-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <h1 className="text-7xl font-black italic uppercase tracking-tight text-base leading-none">
                                Dashboard
                            </h1>
                            <p className="text-sm font-bold text-muted uppercase tracking-[0.3em] mt-4">
                                Bienvenido, {data.today_stats?.closer_name || 'Closer'}
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1, duration: 1 }}
                            className="flex flex-col items-center gap-4 pt-12"
                        >
                            <button
                                onClick={() => setActiveSection(1)}
                                className="group animate-bounce text-muted hover:text-primary transition-colors flex flex-col items-center gap-2 focus:outline-none"
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest">Ver resumen</span>
                                <div className="w-px h-12 bg-gradient-to-b from-muted group-hover:from-primary text-primary transition-all" />
                            </button>
                        </motion.div>
                    </div>

                    {/* Background Decor */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -z-0" />
                </section>
            </motion.div>

            <AddAgendaModal
                isOpen={isAddAgendaModalOpen}
                onClose={() => setIsAddAgendaModalOpen(false)}
                onSuccess={fetchAll}
            />
        </div>
    );
};

export default CloserDashboard;
