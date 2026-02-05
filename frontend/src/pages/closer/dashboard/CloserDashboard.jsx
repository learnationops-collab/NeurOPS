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
    RefreshCw
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

    const [kanbanSubTab, setKanbanSubTab] = useState('tracking'); // 'tracking' or 'closing'

    useEffect(() => {
        fetchAll();
    }, []);

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
        await Promise.all([fetchDashboard(), fetchKanbanData()]);
        setLoading(false);
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

    const handleMove = useCallback((id, fromStage, toStage) => {
        if (fromStage === toStage) return;

        setKanbanData(prev => {
            const newBoard = { ...prev.board };
            const fromItems = [...(newBoard[fromStage] || [])];
            const toItems = [...(newBoard[toStage] || [])];
            const itemIndex = fromItems.findIndex(i => i.id === id);
            if (itemIndex === -1) return prev;

            const [movedItem] = fromItems.splice(itemIndex, 1);
            const updatedItem = { ...movedItem, last_stage: toStage };
            toItems.push(updatedItem);

            newBoard[fromStage] = fromItems;
            newBoard[toStage] = toItems;
            return { ...prev, board: newBoard };
        });

        setPendingChanges(prev => ({ ...prev, [id]: toStage }));
    }, []);

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            for (const [id, stage] of Object.entries(pendingChanges)) {
                await api.patch(`/closer/appointments/${id}/stage`, { stage });
            }
            setPendingChanges({});
            setShowSavedToast(true);
            setTimeout(() => setShowSavedToast(false), 3000);
            fetchDashboard(); // Refresh stats in case progress changed
        } catch (err) {
            console.error("Error saving changes", err);
        } finally {
            setSaving(false);
        }
    };

    const handleCardClick = useCallback((item) => {
        setSelectedAgenda(item);
        setIsAgendaModalOpen(true);
    }, []);

    const handleAnswerChange = (qId, val) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    };

    const handleSubmitReport = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setFeedback(null);
        try {
            await api.post('/closer/daily-report', { answers });
            setFeedback({ type: 'success', text: 'Reporte diario guardado' });
            setIsReportExpanded(false);
            fetchDashboard();
        } catch (err) {
            setFeedback({ type: 'error', text: 'Error al guardar el reporte' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-20 min-h-screen">
            <Loader2 className="animate-spin text-primary" size={48} />
        </div>
    );

    const hasChanges = Object.keys(pendingChanges).length > 0;

    return (
        <div className="p-8 max-w-[1800px] mx-auto space-y-8 animate-in fade-in duration-700">
            {showSavedToast && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-emerald-500 text-black px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl font-black uppercase text-[10px] tracking-widest">
                        <CheckCircle2 size={18} />
                        Embudo sincronizado
                    </div>
                </div>
            )}


            {/* Main Hybrid Layout: 75/25 Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

                {/* SIDEBAR KPI COLUMN (1/4) */}
                <div className="xl:col-span-1 space-y-6 order-2 xl:order-1">

                    {/* NEW: COLLAPSIBLE DAILY SUMMARY */}
                    <div className={`
                        transition-all duration-500 rounded-[2.5rem] overflow-hidden shadow-sm
                        ${data.progress === 100
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-surface border-base'}
                    `}>
                        <button
                            onClick={() => setIsReportExpanded(!isReportExpanded)}
                            className="w-full text-left p-6 md:p-8 flex items-center justify-between group transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`
                                    p-3 rounded-2xl transition-all 
                                    ${data.progress === 100
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                        : (isReportExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary')}
                                `}>
                                    {data.progress === 100 ? <CheckCircle2 size={20} /> : <ClipboardCheck size={20} />}
                                </div>
                                <div className="space-y-1">
                                    <h3 className={`
                                        text-sm font-black uppercase tracking-tight italic
                                        ${data.progress === 100 ? 'text-emerald-500' : 'text-main'}
                                    `}>Resumen Diario</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="w-20 h-1.5 bg-main rounded-full overflow-hidden">
                                            <div className={`
                                                h-full transition-all duration-1000
                                                ${data.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}
                                            `} style={{ width: `${data.progress}%` }} />
                                        </div>
                                        <span className={`text-[10px] font-bold ${data.progress === 100 ? 'text-emerald-500' : 'text-muted'}`}>
                                            {data.progress?.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className={`
                                p-2 rounded-xl transition-all 
                                ${data.progress === 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-main/50 text-muted'}
                                ${isReportExpanded ? 'rotate-180' : ''}
                            `}>
                                <ChevronRight size={16} />
                            </div>
                        </button>

                        <AnimatePresence>
                            {isReportExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                >
                                    <div className="px-8 pb-8 border-t border-base bg-main/5">
                                        <form onSubmit={handleSubmitReport} className="pt-6 space-y-6">
                                            {data.report_questions?.map(q => (
                                                <div key={q.id} className="space-y-3">
                                                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">{q.text}</label>
                                                    <input
                                                        type={q.type === 'number' ? 'number' : 'text'}
                                                        className="w-full px-5 py-4 bg-surface border border-base rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:text-muted/20"
                                                        placeholder="Ingresa valor..."
                                                        value={answers[q.id] || ''}
                                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                    />
                                                </div>
                                            ))}

                                            {/* Saving button shows only when some progress or values exist, or just always for closer's convenience */}
                                            <Button
                                                type="submit"
                                                loading={submitting}
                                                variant="primary"
                                                className="w-full h-14 text-[10px] font-black tracking-widest uppercase shadow-lg shadow-primary/20"
                                            >
                                                Guardar Reporte
                                            </Button>
                                        </form>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 2 & 3. CLOSING % & COMMISSION KPI - SIDE BY SIDE */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card variant="surface" className="relative overflow-hidden group border-primary/20 p-5">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-muted tracking-widest">Cierre Mes</p>
                                <h2 className="text-2xl font-black text-primary tracking-tighter italic mt-1">
                                    {data.rates.closing_month?.toFixed(1)}%
                                </h2>
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
                                <Target size={80} />
                            </div>
                        </Card>

                        <Card variant="surface" className="relative overflow-hidden group border-secondary/20 p-5">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-muted tracking-widest">Comisiones</p>
                                <h2 className="text-2xl font-black text-secondary tracking-tighter italic mt-1">
                                    ${data.commission.month?.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                                </h2>
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
                                <DollarSign size={80} />
                            </div>
                        </Card>
                    </div>


                </div>

                {/* KANBAN SECTION (3/4) */}
                <div className="xl:col-span-3 space-y-6 order-1 xl:order-2">
                    <Card variant="surface" padding="p-8" className="min-h-[700px] flex flex-col bg-surface/50 backdrop-blur-sm border-base/50">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                            <div className="flex bg-main p-1 rounded-full border border-base shadow-inner">
                                <button
                                    onClick={() => setKanbanSubTab('tracking')}
                                    className={`px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${kanbanSubTab === 'tracking' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-base'}`}
                                >
                                    Seguimiento
                                </button>
                                <button
                                    onClick={() => setKanbanSubTab('closing')}
                                    className={`px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${kanbanSubTab === 'closing' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-base'}`}
                                >
                                    Cierre
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                {hasChanges && (
                                    <Button
                                        onClick={handleSaveChanges}
                                        loading={saving}
                                        className="bg-primary text-emerald-100 h-10 px-6 gap-2 animate-in zoom-in"
                                    >
                                        <Save size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Sincronizar ({Object.keys(pendingChanges).length})</span>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {kanbanLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50">
                                <Loader2 className="animate-spin text-primary" size={32} />
                                <p className="text-[9px] font-black tracking-widest">Actualizando tablero...</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-x-auto custom-scrollbar pb-6">
                                <CloserKanbanBoard
                                    stages={filteredKanbanStages}
                                    board={filteredKanbanBoard}
                                    onMove={handleMove}
                                    onCardClick={handleCardClick}
                                />
                            </div>
                        )}
                    </Card>
                </div>

            </div>

            <NewSaleModal
                isOpen={isSaleModalOpen}
                onClose={() => setIsSaleModalOpen(false)}
                onSuccess={fetchAll}
            />
            <AgendaManagerModal
                isOpen={isAgendaModalOpen}
                appointment={selectedAgenda}
                onClose={() => { setIsAgendaModalOpen(false); setSelectedAgenda(null); }}
                onSuccess={fetchAll}
            />
            <AddAgendaModal
                isOpen={isAddAgendaModalOpen}
                onClose={() => setIsAddAgendaModalOpen(false)}
                onSuccess={fetchAll}
            />
            <SaleDetailModal
                isOpen={isDetailModalOpen}
                enrollmentId={selectedEnrollmentId}
                onClose={() => { setIsDetailModalOpen(false); setSelectedEnrollmentId(null); }}
                onSuccess={fetchAll}
            />
        </div>
    );
};
export default CloserDashboard;
