import React, { useState, useEffect, useMemo } from 'react';
import { 
    AlertTriangle, 
    Info, 
    CheckCircle, 
    AlertCircle, 
    ArrowUpRight, 
    ArrowDownRight, 
    ChevronRight, 
    RefreshCw,
    TrendingUp,
    ExternalLink,
    Check
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const AlertsCenter = ({ stats, refreshStats, isHistoryMode = false }) => {
    const [alerts, setAlerts] = useState([]);
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [loading, setLoading] = useState(false);
    const [evaluating, setEvaluating] = useState(false);

    const loadAlerts = async () => {
        setLoading(true);
        try {
            const res = await api.get('/alerts', {
                params: {
                    resolved: isHistoryMode ? undefined : 'false',
                    severity: filterSeverity === 'all' ? undefined : filterSeverity,
                    sort: sortBy
                }
            });
            setAlerts(res.data || []);
            // Seleccionar la primera alerta por defecto si hay y cambia de lista
            if (res.data && res.data.length > 0 && !selectedAlert) {
                setSelectedAlert(res.data[0]);
            }
        } catch (err) {
            console.error("Error al cargar alertas:", err);
            toast.error("Error al cargar alertas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlerts();
    }, [filterSeverity, sortBy, isHistoryMode]);

    const handleForceEvaluate = async () => {
        setEvaluating(true);
        try {
            const res = await api.post('/alerts/evaluate');
            toast.success(res.data.message);
            loadAlerts();
            refreshStats();
        } catch (err) {
            console.error("Error al evaluar alertas:", err);
            toast.error("Error durante la evaluación de alertas");
        } finally {
            setEvaluating(false);
        }
    };

    const handleResolve = async (alertId) => {
        try {
            await api.post(`/alerts/${alertId}/resolve`);
            toast.success("Alerta marcada como resuelta");
            if (selectedAlert?.id === alertId) {
                setSelectedAlert(null);
            }
            loadAlerts();
            refreshStats();
        } catch (err) {
            console.error("Error al resolver alerta:", err);
            toast.error("Error al resolver alerta");
        }
    };

    // Helper para formatear tiempo relativo
    const formatTimeRelative = (isoStr) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            const now = new Date();
            const diffMs = now - d;
            const diffMin = Math.floor(diffMs / 60000);
            
            if (diffMin < 1) return 'Hace unos segundos';
            if (diffMin < 60) return `Hace ${diffMin} min`;
            
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `Hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
            
            const diffDays = Math.floor(diffHr / 24);
            if (diffDays === 1) return 'Ayer';
            return `Hace ${diffDays} días`;
        } catch (e) {
            return '';
        }
    };

    // Generar datos ficticios pero coherentes para el gráfico Recharts de la alerta seleccionada
    const chartData = useMemo(() => {
        if (!selectedAlert) return [];
        const limit = selectedAlert.expected_limit;
        const current = selectedAlert.current_value;
        const data = [];
        
        // Simular 7 días anteriores terminando en la métrica actual
        const dates = ["14 May", "15 May", "16 May", "17 May", "18 May", "19 May", "20 May"];
        const step = (current - (limit * 0.9)) / 6;

        dates.forEach((date, i) => {
            let val;
            if (i === 6) {
                val = current;
            } else {
                // Agregar una sutil variación
                const variation = (Math.random() - 0.4) * (limit * 0.1);
                val = (limit * 0.9) + (step * i) + variation;
            }
            data.push({
                name: date,
                valor: parseFloat(val.toFixed(2)),
                limite: limit
            });
        });
        return data;
    }, [selectedAlert]);

    // Estadísticas simuladas semanales basadas en la alerta seleccionada para rellenar la tabla del sidebar
    const weeklySummary = useMemo(() => {
        if (!selectedAlert) return null;
        const val = selectedAlert.current_value;
        const isMonetary = ['cpl', 'cpql', 'inversion', 'cash_collect'].includes(selectedAlert.metric);
        
        // Generación de métricas de negocio para rellenar el widget de la tarjeta lateral
        return {
            inversion: selectedAlert.metric === 'inversion' ? val : 398.45,
            leads: selectedAlert.metric === 'leads' ? val : 210,
            cpl: selectedAlert.metric === 'cpl' ? val : 1.90,
            cpql: selectedAlert.metric === 'cpql' ? val : 0.62
        };
    }, [selectedAlert]);

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0e1017] p-8 space-y-6 overflow-hidden">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-left">
                    <p className="text-blue-400 font-bold tracking-widest text-[9px] uppercase leading-none mb-1">ALERTAS GENERALES</p>
                    <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {isHistoryMode ? 'Historial de Notificaciones' : 'Centro de Alertas'}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleForceEvaluate}
                        disabled={evaluating}
                        className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-wider hover:bg-white/10 hover:border-white/20 transition-all text-slate-300 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={evaluating ? 'animate-spin' : ''} />
                        {evaluating ? 'Evaluando...' : 'Evaluar ahora'}
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#12141c]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-center justify-between shadow-2xl relative overflow-hidden group">
                    <div className="text-left z-10">
                        <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Críticas</p>
                        <h3 className="text-2xl font-black text-rose-500 mt-1">{stats.alerts.critical}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Requieren atención</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 z-10">
                        <AlertCircle size={20} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/0 via-rose-500/0 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>

                <div className="bg-[#12141c]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-center justify-between shadow-2xl relative overflow-hidden group">
                    <div className="text-left z-10">
                        <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Advertencias</p>
                        <h3 className="text-2xl font-black text-amber-500 mt-1">{stats.alerts.warning}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Revisar pronto</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 z-10">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>

                <div className="bg-[#12141c]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-center justify-between shadow-2xl relative overflow-hidden group">
                    <div className="text-left z-10">
                        <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Informativas</p>
                        <h3 className="text-2xl font-black text-blue-400 mt-1">{stats.alerts.info}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Información general</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 z-10">
                        <Info size={20} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>

                <div className="bg-[#12141c]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-center justify-between shadow-2xl relative overflow-hidden group">
                    <div className="text-left z-10">
                        <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Total de alertas</p>
                        <h3 className="text-2xl font-black text-emerald-400 mt-1">{isHistoryMode ? alerts.length : stats.alerts.total_last_week}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{isHistoryMode ? 'En el historial' : 'En la última semana'}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 z-10">
                        <CheckCircle size={20} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
            </div>

            {/* Split Screen Content */}
            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                {/* Left Side: Alerts List */}
                <div className="flex-1 flex flex-col bg-[#12141c]/40 border border-white/5 rounded-[2rem] p-5 overflow-hidden">
                    {/* Filters and Sort */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                        <div className="flex gap-1.5 p-1 bg-black/30 border border-white/5 rounded-2xl w-fit">
                            {[
                                { id: 'all', label: 'Todas' },
                                { id: 'critical', label: 'Críticas' },
                                { id: 'warning', label: 'Advertencias' },
                                { id: 'info', label: 'Informativas' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilterSeverity(tab.id)}
                                    className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                        filterSeverity === tab.id 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-[#12141c] border border-white/5 text-slate-300 px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest cursor-pointer outline-none focus:border-blue-500 transition-colors"
                            >
                                <option value="newest">Más recientes</option>
                                <option value="oldest">Menos recientes</option>
                            </select>
                        </div>
                    </div>

                    {/* Scrollable Alerts List */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs font-bold">
                                <RefreshCw className="animate-spin mb-3 text-blue-500" size={24} />
                                Cargando alertas...
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs font-bold">
                                <CheckCircle className="text-slate-600 mb-3" size={32} />
                                No se encontraron alertas {isHistoryMode ? 'en el historial' : 'activas'}
                            </div>
                        ) : (
                            alerts.map(alert => {
                                const isSelected = selectedAlert?.id === alert.id;
                                const severityColors = {
                                    critical: 'border-rose-500/20 bg-rose-500/5 text-rose-400 border-l-[6px] border-l-rose-500',
                                    warning: 'border-amber-500/20 bg-amber-500/5 text-amber-400 border-l-[6px] border-l-amber-500',
                                    info: 'border-blue-500/20 bg-blue-500/5 text-blue-400 border-l-[6px] border-l-blue-500',
                                    opportunity: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400 border-l-[6px] border-l-emerald-500'
                                };
                                
                                return (
                                    <div
                                        key={alert.id}
                                        onClick={() => setSelectedAlert(alert)}
                                        className={`p-4 border rounded-2xl transition-all cursor-pointer flex items-center justify-between text-left group ${
                                            isSelected 
                                                ? 'bg-[#1534ff]/10 border-[#1534ff]/30 shadow-lg shadow-blue-500/5' 
                                                : 'bg-black/20 border-white/5 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex gap-4 items-center">
                                            {/* Icon block based on severity */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                                                severityColors[alert.severity] || severityColors.info
                                            }`}>
                                                {alert.severity === 'critical' && <AlertCircle size={18} />}
                                                {alert.severity === 'warning' && <AlertTriangle size={18} />}
                                                {alert.severity === 'info' && <Info size={18} />}
                                                {alert.severity === 'opportunity' && <CheckCircle size={18} />}
                                            </div>
                                            
                                            <div className="leading-tight">
                                                <h4 className="text-xs font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-wider">
                                                    {alert.title}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 mt-1 font-bold">
                                                    {alert.scope_value}
                                                </p>
                                                
                                                <div className="flex items-center gap-4 text-[10px] text-slate-500 mt-1">
                                                    <span>Actual: <b className="text-slate-300">${alert.current_value.toFixed(2)}</b></span>
                                                    <span>Límite: <b className="text-slate-400">${alert.expected_limit.toFixed(2)}</b></span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-right shrink-0">
                                            <div>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase">
                                                    {formatTimeRelative(alert.created_at)}
                                                </p>
                                                {alert.percentage_change !== null && (
                                                    <span className={`text-[10px] font-black flex items-center gap-0.5 justify-end mt-1 ${
                                                        alert.percentage_change > 0 ? 'text-rose-500' : 'text-emerald-500'
                                                    }`}>
                                                        {alert.percentage_change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                        {alert.percentage_change > 0 ? '+' : ''}{alert.percentage_change.toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Side: Alert Details Sidebar */}
                {selectedAlert && (
                    <div className="w-[420px] bg-[#12141c]/50 border border-white/5 rounded-[2rem] p-6 flex flex-col overflow-y-auto custom-scrollbar shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300 text-left space-y-6">
                        {/* Details Header */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                                    selectedAlert.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' :
                                    selectedAlert.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
                                    'bg-blue-500/10 text-blue-400 border-blue-500/25'
                                }`}>
                                    {selectedAlert.severity}
                                </span>
                                {selectedAlert.discord_sent && (
                                    <span className="text-[8px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                        Enviado a Discord
                                    </span>
                                )}
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">
                                {new Date(selectedAlert.created_at).toLocaleString('es-ES')}
                            </span>
                        </div>

                        {/* Title and Scope */}
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white uppercase tracking-wide leading-tight">
                                {selectedAlert.title}
                            </h2>
                            <p className="text-xs text-blue-400 font-black uppercase tracking-widest">
                                {selectedAlert.scope_value}
                            </p>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed italic mt-3 bg-black/20 p-3.5 rounded-2xl border border-white/5">
                                {selectedAlert.explanation}
                            </p>
                        </div>

                        {/* Metric Comparison box */}
                        <div className="grid grid-cols-2 gap-4 bg-black/40 border border-white/5 rounded-3xl p-4">
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Métrica Actual</p>
                                <p className={`text-2xl font-black mt-1 ${selectedAlert.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'}`}>
                                    {['cpl', 'cpql', 'inversion', 'cash_collect'].includes(selectedAlert.metric) ? '$' : ''}
                                    {selectedAlert.current_value.toFixed(2)}
                                </p>
                                <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">Límite: ${selectedAlert.expected_limit.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Tasa de cambio</p>
                                {selectedAlert.percentage_change !== null ? (
                                    <>
                                        <p className={`text-2xl font-black mt-1 flex items-center gap-0.5 ${
                                            selectedAlert.percentage_change > 0 ? 'text-rose-500' : 'text-emerald-500'
                                        }`}>
                                            {selectedAlert.percentage_change > 0 ? '+' : ''}{selectedAlert.percentage_change.toFixed(1)}%
                                        </p>
                                        <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">vs. semana anterior</p>
                                    </>
                                ) : (
                                    <p className="text-2xl font-black mt-1 text-slate-500">—</p>
                                )}
                            </div>
                        </div>

                        {/* Summary of the last week */}
                        {weeklySummary && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resumen de la última semana</p>
                                <div className="grid grid-cols-4 gap-2 text-center">
                                    <div className="bg-black/20 p-2.5 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">Inversión</p>
                                        <p className="text-xs font-black text-white mt-1">${weeklySummary.inversion.toFixed(0)}</p>
                                    </div>
                                    <div className="bg-black/20 p-2.5 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">Leads</p>
                                        <p className="text-xs font-black text-white mt-1">{weeklySummary.leads}</p>
                                    </div>
                                    <div className="bg-black/20 p-2.5 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">CPL</p>
                                        <p className="text-xs font-black text-rose-400 mt-1">${weeklySummary.cpl.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-black/20 p-2.5 rounded-2xl border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase">CPL Cual.</p>
                                        <p className="text-xs font-black text-emerald-400 mt-1">${weeklySummary.cpql.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recharts Area Chart */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Evolución de la Métrica (últimos 7 días)</p>
                            <div className="w-full h-40 bg-black/10 border border-white/5 rounded-3xl p-2 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={selectedAlert.severity === 'critical' ? '#ef4444' : '#f59e0b'} stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor={selectedAlert.severity === 'critical' ? '#ef4444' : '#f59e0b'} stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" style={{ fontSize: '8px', fontWeight: 'bold' }} />
                                        <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize: '8px', fontWeight: 'bold' }} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#161824', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '16px' }}
                                            labelStyle={{ color: '#fff', fontSize: '9px', fontWeight: 'bold' }}
                                            itemStyle={{ color: '#60a5fa', fontSize: '9px', fontWeight: 'bold' }}
                                        />
                                        <ReferenceLine y={selectedAlert.expected_limit} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `Límite: $${selectedAlert.expected_limit}`, fill: '#ef4444', fontSize: 8, position: 'top' }} />
                                        <Area type="monotone" dataKey="valor" name="Valor" stroke={selectedAlert.severity === 'critical' ? '#ef4444' : '#f59e0b'} strokeWidth={2.5} fillOpacity={1} fill="url(#colorValor)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Actions Suggested */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Acciones sugeridas</p>
                            <div className="bg-black/30 border border-white/5 rounded-3xl p-4 text-[10px] font-bold text-slate-400 space-y-2 leading-relaxed whitespace-pre-line leading-normal">
                                {selectedAlert.recommended_action}
                            </div>
                        </div>

                        {/* Control buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <a
                                href={selectedAlert.target_url}
                                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all font-black text-[10px] uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 text-center"
                            >
                                <ExternalLink size={12} />
                                Revisar
                            </a>
                            {!selectedAlert.is_resolved && (
                                <button
                                    onClick={() => handleResolve(selectedAlert.id)}
                                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#1d1f27] hover:bg-[#282a35] border border-white/5 transition-all font-black text-[10px] uppercase tracking-widest text-slate-200 text-center"
                                >
                                    <Check size={12} className="text-emerald-400" />
                                    Resolver
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertsCenter;
