import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import NewSaleModal from '../components/NewSaleModal';
import api from '../services/api';
import AgendaManagerModal from '../components/AgendaManagerModal';
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
    const [selectedAgenda, setSelectedAgenda] = useState(null);

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
            <Loader2 className="animate-spin text-indigo-500" size={48} />
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
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">Resumen Diario</h1>
                    <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em] mt-1">Tu rendimiento en tiempo real</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-900/50 p-2 pl-6 rounded-3xl border border-slate-800/50 backdrop-blur-xl">
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Hoy es</p>
                        <p className="text-sm font-black text-white uppercase mt-1">
                            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                        <Calendar size={24} className="text-white" />
                    </div>
                </div>
            </header>

            {/* Main 3-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUMN 1: COMMISSIONS & SALES */}
                <div className="space-y-8">
                    {/* Commission KPI */}
                    <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Comisión del Mes</p>
                                <h2 className="text-5xl font-black text-emerald-400 tracking-tighter italic">
                                    ${data.commission.month?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                </h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        Active
                                    </span>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Meta: $2,500.00</p>
                                </div>
                            </div>
                            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500">
                                <DollarSign size={28} />
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-800/50 flex justify-between items-center">
                            <p className="text-xs font-bold text-slate-400">Hoy: <span className="text-white">${data.commission.today?.toLocaleString()}</span></p>
                            <ArrowUpRight size={16} className="text-emerald-500" />
                        </div>
                        <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <DollarSign size={180} className="text-white" />
                        </div>
                    </div>

                    {/* Sales of the Day */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                        <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <BarChart3 size={14} className="text-emerald-500" />
                                    Ventas del Día
                                </h3>
                                <button
                                    onClick={() => setIsSaleModalOpen(true)}
                                    className="w-6 h-6 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg flex items-center justify-center transition-all group/plus"
                                    title="Declarar Venta"
                                >
                                    <Plus size={14} className="group-hover/plus:scale-110 transition-transform" />
                                </button>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full">
                                {data.sales_today.length} Ventas
                            </span>
                        </div>
                        <div className="divide-y divide-slate-800/50 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {data.sales_today?.length > 0 ? data.sales_today.map(sale => (
                                <div key={sale.id} className="px-8 py-6 hover:bg-slate-800/30 transition-all group">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-white font-black">{sale.student_name}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{sale.program_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-emerald-400 font-black">${sale.amount?.toLocaleString()}</p>
                                            <p className="text-[9px] text-slate-600 font-bold uppercase">{new Date(sale.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aún no hay ventas hoy</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: CLOSING RATE & AGENDAS */}
                <div className="space-y-8">
                    {/* Closing % KPI */}
                    <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Porcentaje de Cierres</p>
                                <h2 className="text-5xl font-black text-indigo-400 tracking-tighter italic">
                                    {data.rates.closing_month?.toFixed(1)}%
                                </h2>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        Ranking #2
                                    </span>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Global Mes</p>
                                </div>
                            </div>
                            <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400">
                                <Target size={28} />
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-800/50 flex justify-between items-center">
                            <p className="text-xs font-bold text-slate-400">Hoy: <span className="text-white">{data.rates.closing_today?.toFixed(1)}%</span></p>
                            <TrendingUp size={16} className="text-indigo-400" />
                        </div>
                        <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <Target size={180} className="text-white" />
                        </div>
                    </div>

                    {/* Agendas of the Day */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                        <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Calendar size={14} className="text-indigo-400" />
                                    Agendas de Hoy
                                </h3>
                                <Link
                                    to="/closer/leads"
                                    className="w-6 h-6 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white rounded-lg flex items-center justify-center transition-all group/plus"
                                    title="Nueva Agenda"
                                >
                                    <Plus size={14} className="group-hover/plus:scale-110 transition-transform" />
                                </Link>
                            </div>
                            <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:bg-indigo-500/10 px-3 py-1 rounded-full transition-all flex items-center gap-1">
                                Ver todas <ChevronRight size={12} />
                            </button>
                        </div>
                        <div className="divide-y divide-slate-800/50 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {data.agendas_today?.length > 0 ? data.agendas_today.map(appt => (
                                <div
                                    onClick={() => { setSelectedAgenda(appt); setIsAgendaModalOpen(true); }}
                                    className="px-8 py-6 hover:bg-slate-800/30 transition-all flex items-center justify-between group cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 text-xs font-black text-white group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-all">
                                            {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div>
                                            <p className="text-white font-black">{appt.lead_name}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">{appt.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="p-2 text-slate-500 group-hover:text-indigo-400 transition-all">
                                            <ArrowUpRight size={18} />
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sin agendas pendientes hoy</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMN 3: PROGRESS & FORM */}
                <div className="space-y-8">
                    {/* Progress KPI */}
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
                        <div className="relative z-10 space-y-6">
                            <div className="flex justify-between items-start">
                                <p className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.2em]">Progreso del Día</p>
                                <span className="bg-white/20 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                                    Real Time
                                </span>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-6xl font-black text-white italic tracking-tighter">{data.progress?.toFixed(0)}%</h3>
                                <p className="text-indigo-200 font-bold text-xs mb-2 uppercase tracking-widest">Completado</p>
                            </div>
                            <div className="space-y-2">
                                <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden backdrop-blur-md">
                                    <div
                                        className="bg-white h-full transition-all duration-1000 shadow-[0_0_15px_white]"
                                        style={{ width: `${data.progress}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[10px] font-black text-indigo-100 uppercase tracking-widest">
                                    <span>Morning</span>
                                    <span>Closing Shop</span>
                                </div>
                            </div>
                        </div>
                        <TrendingUp className="absolute -right-8 -bottom-8 text-white/10" size={180} />
                    </div>



                    {/* Questionnaire Form */}
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                        <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/20">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <ClipboardCheck size={14} className="text-indigo-400" />
                                Reporte de Cierre
                            </h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Completa al finalizar tu jornada</p>
                        </div>
                        <form onSubmit={handleSubmitReport} className="p-8 space-y-6">
                            {data.report_questions?.map(q => (
                                <div key={q.id} className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">{q.text}</label>
                                    {q.type === 'number' ? (
                                        <input
                                            type="number"
                                            className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                            placeholder="0"
                                            value={answers[q.id] || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        />
                                    ) : q.type === 'boolean' ? (
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleAnswerChange(q.id, 'true')}
                                                className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest border transition-all ${answers[q.id] === 'true' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-500'}`}
                                            >Sí</button>
                                            <button
                                                type="button"
                                                onClick={() => handleAnswerChange(q.id, 'false')}
                                                className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest border transition-all ${answers[q.id] === 'false' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-500'}`}
                                            >No</button>
                                        </div>
                                    ) : (
                                        <textarea
                                            rows="2"
                                            className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold resize-none"
                                            placeholder="Escribe aquí..."
                                            value={answers[q.id] || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        ></textarea>
                                    )}
                                </div>
                            ))}

                            {feedback && (
                                <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border ${feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                    {feedback.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl shadow-xl hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        <CheckCircle2 size={18} />
                                        Enviar Reporte
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Quick Access / Leads Column removed to fit 3-col per user request, 
                or could be placed below in a full-width section */}

            <section className="pt-10">
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Users size={16} className="text-indigo-400" />
                            Contactos Recientes
                        </h3>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input
                                type="text"
                                placeholder="Filtrar..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {data.recent_clients?.map(client => (
                            <div key={client.id} className="group bg-slate-800/30 hover:bg-indigo-600/10 p-5 rounded-2xl border border-slate-700/50 hover:border-indigo-500/30 transition-all cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg">
                                        {client.username[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-white truncate">{client.username}</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2 pt-4 border-t border-slate-800/50 group-hover:border-indigo-500/10">
                                    <button className="flex-1 p-2 bg-slate-800/50 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 rounded-lg transition-all flex justify-center">
                                        <PhoneCall size={14} />
                                    </button>
                                    <button className="flex-1 p-2 bg-slate-800/50 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-all flex justify-center">
                                        <MessageSquare size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
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
        </div>
    );
};

export default CloserDashboard;
