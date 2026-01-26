import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import NewSaleModal from '../components/NewSaleModal';
import SaleDetailModal from '../components/SaleDetailModal';
import api from '../services/api';
import AgendaManagerModal from '../components/AgendaManagerModal';
import AddAgendaModal from '../components/AddAgendaModal';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
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
    Plus
} from 'lucide-react';

const CloserDashboard = () => {
    // Safe initial state matching API structure
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
    const [isAddAgendaModalOpen, setIsAddAgendaModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/closer/dashboard');
            // Merge with default structure to ensure keys exist
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

            // Initialize answers safely
            if (safeData.today_stats?.answers) {
                setAnswers(safeData.today_stats.answers);
            }
        } catch (err) {
            console.error("Error fetching dashboard", err);
            setError("No se pudo cargar la información. Revisa tu conexión.");
        } finally {
            setLoading(false);
        }
    };

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

    if (error) return (
        <div className="flex flex-col items-center justify-center p-20 min-h-screen space-y-4">
            <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 text-rose-400 font-bold uppercase tracking-widest text-xs">
                {error}
            </div>
            <button
                onClick={fetchDashboard}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all"
            >
                Reintentar
            </button>
        </div>
    );

    if (loading) return (
        <div className="flex items-center justify-center p-20 min-h-screen">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
        </div>
    );

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-base italic tracking-tighter">Resumen Diario</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em] mt-1">Tu rendimiento en tiempo real</p>
                </div>
                <div className="flex items-center gap-4 bg-surface p-2 pl-6 rounded-3xl border border-base backdrop-blur-xl">
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">Hoy es</p>
                        <p className="text-sm font-black text-base uppercase mt-1">
                            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-white">
                        <Calendar size={24} />
                    </div>
                </div>
            </header>

            {/* Main 3-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUMN 1: COMMISSIONS & SALES */}
                <div className="space-y-8">
                    {/* Commission KPI */}
                    <Card variant="surface" className="relative overflow-hidden group">
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Comisión del Mes</p>
                                <h2 className="text-5xl font-black text-secondary tracking-tighter italic">
                                    ${data.commission.month?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                </h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="success">Active</Badge>
                                    <p className="text-[10px] text-muted font-bold uppercase">Meta: $2,500.00</p>
                                </div>
                            </div>
                            <div className="p-4 bg-secondary/10 rounded-2xl text-secondary">
                                <DollarSign size={28} />
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-base flex justify-between items-center">
                            <p className="text-xs font-bold text-muted">Hoy: <span className="text-base">${data.commission.today?.toLocaleString()}</span></p>
                            <ArrowUpRight size={16} className="text-secondary" />
                        </div>
                        <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <DollarSign size={180} />
                        </div>
                    </Card>

                    {/* Sales of the Day */}
                    <Card variant="surface" padding="p-0 overflow-hidden">
                        <CardHeader className="px-8 py-6 border-b border-base bg-surface-hover flex justify-between items-center mb-0">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xs font-black text-base uppercase tracking-widest flex items-center gap-2">
                                    <BarChart3 size={14} className="text-secondary" />
                                    Ventas del Día
                                </h3>
                                <button
                                    onClick={() => setIsSaleModalOpen(true)}
                                    className="w-6 h-6 bg-secondary/10 hover:bg-secondary text-secondary hover:text-white rounded-lg flex items-center justify-center transition-all group/plus"
                                    title="Declarar Venta"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <Badge variant="neutral">{data.sales_today.length} Ventas</Badge>
                        </CardHeader>
                        <div className="divide-y divide-base max-h-[400px] overflow-y-auto custom-scrollbar">
                            {data.sales_today?.length > 0 ? data.sales_today.map(sale => (
                                <div
                                    key={sale.id}
                                    onClick={() => { setSelectedEnrollmentId(sale.id); setIsDetailModalOpen(true); }}
                                    className="px-8 py-6 hover:bg-surface-hover transition-all group cursor-pointer"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-base font-black">{sale.student_name}</p>
                                            <p className="text-[10px] text-muted font-bold uppercase mt-0.5">{sale.program_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {sale.debt > 0 && (
                                                    <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-lg">
                                                        -${sale.debt?.toLocaleString()}
                                                    </span>
                                                )}
                                                <p className="text-secondary font-black">${sale.amount?.toLocaleString()}</p>
                                            </div>
                                            <p className="text-[9px] text-muted font-bold uppercase mt-0.5">{new Date(sale.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center text-muted">Aún no hay ventas hoy</div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* COLUMN 2: CLOSING RATE & AGENDAS */}
                <div className="space-y-8">
                    {/* Closing % KPI */}
                    <Card variant="surface" className="relative overflow-hidden group">
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Porcentaje de Cierres</p>
                                <h2 className="text-5xl font-black text-primary tracking-tighter italic">
                                    {data.rates.closing_month?.toFixed(1)}%
                                </h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="primary">Ranking #2</Badge>
                                    <p className="text-[10px] text-muted font-bold uppercase mt-1">Global Mes</p>
                                </div>
                            </div>
                            <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                                <Target size={28} />
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-base flex justify-between items-center">
                            <p className="text-xs font-bold text-muted">Hoy: <span className="text-base">{data.rates.closing_today?.toFixed(1)}%</span></p>
                            <TrendingUp size={16} className="text-primary" />
                        </div>
                        <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <Target size={180} />
                        </div>
                    </Card>

                    {/* Agendas of the Day */}
                    <Card variant="surface" padding="p-0 overflow-hidden">
                        <CardHeader className="px-8 py-6 border-b border-base bg-surface-hover flex justify-between items-center mb-0">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xs font-black text-base uppercase tracking-widest flex items-center gap-2">
                                    <Calendar size={14} className="text-primary" />
                                    Agendas de Hoy
                                </h3>
                                <button
                                    onClick={() => setIsAddAgendaModalOpen(true)}
                                    className="w-6 h-6 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg flex items-center justify-center transition-all group/plus"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <Badge variant="neutral">{data.agendas_today.length} Agendas</Badge>
                        </CardHeader>
                        <div className="divide-y divide-base max-h-[400px] overflow-y-auto custom-scrollbar">
                            {data.agendas_today?.length > 0 ? data.agendas_today.map(appt => (
                                <div
                                    key={appt.id}
                                    onClick={() => { setSelectedAgenda(appt); setIsAgendaModalOpen(true); }}
                                    className="px-8 py-6 hover:bg-surface-hover transition-all flex items-center justify-between group cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-base text-[11px] font-black text-base group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all">
                                            {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div>
                                            <p className="text-base font-black">{appt.lead_name}</p>
                                            <p className="text-[10px] text-muted font-bold uppercase">{appt.type}</p>
                                        </div>
                                    </div>
                                    <div className="p-2 text-muted group-hover:text-primary transition-all">
                                        <ArrowUpRight size={18} />
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center text-muted">Sin agendas pendientes hoy</div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* COLUMN 3: PROGRESS & FORM */}
                <div className="space-y-8">
                    {/* Progress KPI */}
                    <div className="bg-primary p-8 rounded-[2.5rem] shadow-xl shadow-primary/20 relative overflow-hidden group text-white">
                        <div className="relative z-10 space-y-6">
                            <div className="flex justify-between items-start">
                                <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em]">Progreso del Día</p>
                                <Badge variant="neutral" className="bg-white/20 border-transparent text-white">Real Time</Badge>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-6xl font-black italic tracking-tighter">{data.progress?.toFixed(0)}%</h3>
                                <p className="text-white/60 font-bold text-xs mb-2 uppercase tracking-widest">Completado</p>
                            </div>
                            <div className="space-y-2">
                                <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden backdrop-blur-md">
                                    <div
                                        className="bg-white h-full transition-all duration-1000 shadow-[0_0_15px_white]"
                                        style={{ width: `${data.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Questionnaire Form */}
                    <Card variant="surface" padding="p-0 overflow-hidden">
                        <CardHeader className="px-8 py-6 border-b border-base bg-surface-hover mb-0">
                            <h3 className="text-xs font-black text-base uppercase tracking-widest flex items-center gap-2">
                                <ClipboardCheck size={14} className="text-primary" />
                                Reporte de Cierre
                            </h3>
                            <p className="text-[10px] text-muted font-bold uppercase mt-1">Completa al finalizar tu jornada</p>
                        </CardHeader>
                        <form onSubmit={handleSubmitReport} className="p-8 space-y-6">
                            {data.report_questions?.map(q => (
                                <div key={q.id} className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{q.text}</label>
                                    {q.type === 'number' ? (
                                        <input
                                            type="number"
                                            className="w-full px-5 py-4 bg-main border border-base rounded-2xl text-base outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                            placeholder="0"
                                            value={answers[q.id] || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        />
                                    ) : q.type === 'boolean' ? (
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleAnswerChange(q.id, 'true')}
                                                className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest border transition-all ${answers[q.id] === 'true' ? 'bg-primary border-primary text-white' : 'bg-main border-base text-muted'}`}
                                            >Sí</button>
                                            <button
                                                type="button"
                                                onClick={() => handleAnswerChange(q.id, 'false')}
                                                className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest border transition-all ${answers[q.id] === 'false' ? 'bg-primary border-primary text-white' : 'bg-main border-base text-muted'}`}
                                            >No</button>
                                        </div>
                                    ) : (
                                        <textarea
                                            rows="2"
                                            className="w-full px-5 py-4 bg-main border border-base rounded-2xl text-base outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold resize-none"
                                            placeholder="Escribe aquí..."
                                            value={answers[q.id] || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        ></textarea>
                                    )}
                                </div>
                            ))}

                            <Button
                                type="submit"
                                loading={submitting}
                                variant="primary"
                                className="w-full h-16"
                                icon={CheckCircle2}
                            >
                                Enviar Reporte
                            </Button>
                        </form>
                    </Card>
                </div>
            </div>

            {/* Quick Access / Leads Column removed to fit 3-col per user request,
                or could be placed below in a full-width section */}

            <section className="pt-10">
                <Card variant="surface">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xs font-black text-base uppercase tracking-widest flex items-center gap-2">
                            <Users size={16} className="text-primary" />
                            Contactos Recientes
                        </h3>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                            <input
                                type="text"
                                placeholder="Filtrar..."
                                className="w-full pl-10 pr-4 py-2 bg-main border border-base rounded-xl text-xs text-base focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {data.recent_clients?.map(client => (
                            <div key={client.id} className="group bg-main hover:bg-primary/10 p-5 rounded-2xl border border-base hover:border-primary/30 transition-all cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black group-hover:bg-primary group-hover:text-white transition-all shadow-lg">
                                        {client.username[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-base truncate">{client.username}</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2 pt-4 border-t border-base">
                                    <button className="flex-1 p-2 bg-surface hover:bg-secondary/20 text-muted hover:text-secondary rounded-lg transition-all flex justify-center">
                                        <PhoneCall size={14} />
                                    </button>
                                    <button className="flex-1 p-2 bg-surface hover:bg-primary/20 text-muted hover:text-primary rounded-lg transition-all flex justify-center">
                                        <MessageSquare size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </section>

            <NewSaleModal
                isOpen={isSaleModalOpen}
                onClose={() => setIsSaleModalOpen(false)}
                onSuccess={fetchDashboard}
            />
            <AgendaManagerModal
                isOpen={isAgendaModalOpen}
                appointment={selectedAgenda}
                onClose={() => { setIsAgendaModalOpen(false); setSelectedAgenda(null); }}
                onSuccess={fetchDashboard}
            />
            <AddAgendaModal
                isOpen={isAddAgendaModalOpen}
                onClose={() => setIsAddAgendaModalOpen(false)}
                onSuccess={fetchDashboard}
            />
            <SaleDetailModal
                isOpen={isDetailModalOpen}
                enrollmentId={selectedEnrollmentId}
                onClose={() => { setIsDetailModalOpen(false); setSelectedEnrollmentId(null); }}
                onSuccess={fetchDashboard}
            />
        </div>
    );
};

export default CloserDashboard;
