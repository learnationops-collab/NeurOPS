import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Send, Calendar, ClipboardList, Phone, Activity, Target, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false }) => {
    const isFilled = value > 0 || value !== '';
    const colorClasses = {
        indigo: "text-indigo-400 focus:border-indigo-500",
        pink: "text-rose-400 focus:border-rose-500",
        fuchsia: "text-fuchsia-400 focus:border-fuchsia-500",
        teal: "text-teal-400 focus:border-teal-500",
        cyan: "text-cyan-400 focus:border-cyan-500",
        orange: "text-orange-400 focus:border-orange-500"
    };

    return (
        <div className="space-y-1.5 flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400/80">{label}</label>
            <input
                type="number"
                required
                readOnly={readOnly}
                className={`w-full px-4 py-3 bg-slate-950/50 border rounded-xl transition-all font-black text-base outline-none
                    ${readOnly ? 'border-slate-800/80 text-slate-500 bg-slate-900/10 cursor-not-allowed' : 
                      isFilled ? 'border-slate-700 text-white shadow-sm bg-slate-900/40' : 'border-slate-850 text-white bg-slate-950/60 shadow-inner'}
                    ${colorClasses[color] || colorClasses.indigo}
                `}
                value={value}
                onChange={e => onChange(field, e.target.value)}
                placeholder="0"
            />
        </div>
    );
};

const SectionHeader = ({ icon: Icon, title, colorClass }) => (
    <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-3">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <Icon className={colorClass} size={18} />
        </div>
        <h2 className="text-sm font-black tracking-widest text-slate-300 uppercase">{title}</h2>
    </div>
);

const PublicTriageReportPage = () => {
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [triages, setTriages] = useState([]);

    const initialFormData = {
        triage_name: '',
        date: '',
        
        // Confirmaciones del día
        today_agendas: '',
        today_contacted: '',
        today_confirmed: '',
        today_canceled: '',
        today_rescheduled: '',
        
        // Confirmaciones futuras
        future_agendas: '',
        future_contacted: '',
        future_confirmed: '',
        future_canceled: '',
        future_rescheduled: '',
        
        // Recuperaciones
        recoveries_contacted: '',
        recoveries_replied: '',
        recoveries_scheduled: ''
    };

    const [formData, setFormData] = useState(initialFormData);

    // Cargar lista de triadores activos
    useEffect(() => {
        const fetchTriages = async () => {
            try {
                const response = await api.get('/public/active-triage');
                setTriages(response.data || []);
                
                // Auto-seleccionar si el rol es triage
                if (user?.role === 'triage') {
                    setFormData(prev => ({ ...prev, triage_name: user.username }));
                }
            } catch (err) {
                console.error("Error cargando triadores activos:", err);
            }
        };
        fetchTriages();
    }, [user]);

    // Autollenar datos al cambiar fecha o triador
    useEffect(() => {
        if (!formData.date || !formData.triage_name) return;

        const loadPrefillData = async () => {
            setLoading(true);
            try {
                const response = await api.get(`/public/triage-report/prefill?triage_name=${formData.triage_name}&date=${formData.date}`);
                const data = response.data || {};
                
                setFormData(prev => ({
                    ...prev,
                    today_agendas: data.today_agendas ?? 0,
                    today_contacted: data.today_contacted ?? 0,
                    today_confirmed: data.today_confirmed ?? 0,
                    today_canceled: data.today_canceled ?? 0,
                    today_rescheduled: data.today_rescheduled ?? 0,
                    
                    future_agendas: data.future_agendas ?? 0,
                    future_contacted: data.future_contacted ?? 0,
                    future_confirmed: data.future_confirmed ?? 0,
                    future_canceled: data.future_canceled ?? 0,
                    future_rescheduled: data.future_rescheduled ?? 0,
                    
                    recoveries_contacted: prev.recoveries_contacted || '',
                    recoveries_replied: prev.recoveries_replied || '',
                    recoveries_scheduled: prev.recoveries_scheduled || ''
                }));
                toast.success("Métricas de agendas precargadas correctamente.");
            } catch (err) {
                console.error("Error al precargar reporte:", err);
                toast.error("Error al precargar agendas automáticas.");
            } finally {
                setLoading(false);
            }
        };

        loadPrefillData();
    }, [formData.date, formData.triage_name]);

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value === '' ? '' : (parseInt(value) || 0) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.date) {
            toast.error("Por favor, selecciona la fecha del informe.");
            return;
        }

        if (!formData.triage_name) {
            toast.error("Por favor, selecciona tu nombre.");
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/public/triage-report', formData);
            toast.success('¡Reporte diario guardado exitosamente! Buen trabajo.');
            
            // Reset manteniendo nombre y fecha
            setFormData(prev => ({
                ...initialFormData,
                triage_name: prev.triage_name,
                date: prev.date
            }));
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Error al enviar reporte.');
        } finally {
            setSubmitting(false);
        }
    };

    // Estadísticas del sidebar en tiempo real
    const liveMetrics = useMemo(() => {
        const todayTot = parseInt(formData.today_agendas) || 0;
        const todayConf = parseInt(formData.today_confirmed) || 0;
        const futureTot = parseInt(formData.future_agendas) || 0;
        const futureConf = parseInt(formData.future_confirmed) || 0;
        
        const recCont = parseInt(formData.recoveries_contacted) || 0;
        const recSched = parseInt(formData.recoveries_scheduled) || 0;

        const rate = (num, den) => den > 0 ? ((num / den) * 100).toFixed(1) : '0.0';

        return {
            todayRate: rate(todayConf, todayTot),
            futureRate: rate(futureConf, futureTot),
            recRate: rate(recSched, recCont)
        };
    }, [formData]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 py-12 relative overflow-hidden font-sans">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />

            <div className="w-full max-w-6xl mx-auto z-10 space-y-8">
                {/* Cabecera */}
                <div className="text-center space-y-3 mb-2 relative">
                    <p className="text-indigo-400 font-bold tracking-widest text-xs uppercase">NeurOPS Triage System</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Reporte Diario Triaje
                    </h1>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                        <p className="text-slate-500 font-medium">Sincronizando agendas del día...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* ═══ COLUMNA 1: FORMULARIO ═══ */}
                        <div className="lg:col-span-2">
                            <form onSubmit={handleSubmit} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8 backdrop-blur-sm">
                                {/* Triador y Fecha */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400/80 ml-1">Call Confirmer / Triaje</label>
                                        <select
                                            disabled={user?.role === 'triage'}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                            value={formData.triage_name}
                                            onChange={e => setFormData(prev => ({ ...prev, triage_name: e.target.value }))}
                                        >
                                            <option value="">Selecciona quién eres</option>
                                            {triages.map(t => (
                                                <option key={t.id} value={t.name}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400/80 ml-1">Fecha de Gestión</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-3.5 text-slate-500 w-4 h-4" />
                                            <input
                                                type="date"
                                                required
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-indigo-500"
                                                value={formData.date}
                                                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Confirmaciones del Día */}
                                <div className="space-y-6">
                                    <SectionHeader icon={Phone} title="Confirmaciones del Día" colorClass="text-indigo-400" />
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <MetricInput label="Agendas" field="today_agendas" value={formData.today_agendas} onChange={handleFieldChange} color="indigo" />
                                        <MetricInput label="Contactadas" field="today_contacted" value={formData.today_contacted} onChange={handleFieldChange} color="teal" />
                                        <MetricInput label="Confirmadas" field="today_confirmed" value={formData.today_confirmed} onChange={handleFieldChange} color="teal" />
                                        <MetricInput label="Canceladas" field="today_canceled" value={formData.today_canceled} onChange={handleFieldChange} color="pink" />
                                        <MetricInput label="Reagendadas" field="today_rescheduled" value={formData.today_rescheduled} onChange={handleFieldChange} color="orange" />
                                    </div>
                                </div>

                                {/* Confirmaciones Futuras */}
                                <div className="space-y-6">
                                    <SectionHeader icon={Target} title="Confirmaciones Futuras" colorClass="text-fuchsia-400" />
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <MetricInput label="Próximas Agendas" field="future_agendas" value={formData.future_agendas} onChange={handleFieldChange} color="fuchsia" />
                                        <MetricInput label="Contactadas" field="future_contacted" value={formData.future_contacted} onChange={handleFieldChange} color="cyan" />
                                        <MetricInput label="Confirmadas" field="future_confirmed" value={formData.future_confirmed} onChange={handleFieldChange} color="cyan" />
                                        <MetricInput label="Canceladas" field="future_canceled" value={formData.future_canceled} onChange={handleFieldChange} color="pink" />
                                        <MetricInput label="Reagendadas" field="future_rescheduled" value={formData.future_rescheduled} onChange={handleFieldChange} color="orange" />
                                    </div>
                                </div>

                                {/* Recuperaciones */}
                                <div className="space-y-6">
                                    <SectionHeader icon={RefreshCw} title="Recuperaciones (Manual)" colorClass="text-rose-400" />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <MetricInput label="Contactados" field="recoveries_contacted" value={formData.recoveries_contacted} onChange={handleFieldChange} color="pink" />
                                        <MetricInput label="Respuestas" field="recoveries_replied" value={formData.recoveries_replied} onChange={handleFieldChange} color="pink" />
                                        <MetricInput label="Agendas" field="recoveries_scheduled" value={formData.recoveries_scheduled} onChange={handleFieldChange} color="teal" />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black uppercase text-xs tracking-widest py-4 rounded-2xl shadow-lg shadow-indigo-950/20 hover:shadow-indigo-500/10 hover:shadow-2xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {submitting ? 'Enviando Reporte...' : 'Enviar Reporte Diario'}
                                </button>
                            </form>
                        </div>

                        {/* ═══ COLUMNA 2: SIDEBAR DE TASAS ═══ */}
                        <div className="space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-3">Resumen de Tasas</h3>
                                
                                <div className="space-y-4">
                                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa Confirm. Hoy</p>
                                            <p className="text-2xl font-black text-white italic mt-1">{liveMetrics.todayRate}%</p>
                                        </div>
                                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                                            <Activity size={18} />
                                        </div>
                                    </div>

                                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa Confirm. Futuro</p>
                                            <p className="text-2xl font-black text-white italic mt-1">{liveMetrics.futureRate}%</p>
                                        </div>
                                        <div className="p-3 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl">
                                            <Target size={18} />
                                        </div>
                                    </div>

                                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conversión Recuperac.</p>
                                            <p className="text-2xl font-black text-white italic mt-1">{liveMetrics.recRate}%</p>
                                        </div>
                                        <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                                            <RefreshCw size={18} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <footer className="flex flex-col md:flex-row justify-between items-center py-10 text-slate-400 font-medium text-xs gap-4 border-t border-slate-200/60">
                    <div className="flex items-center gap-6">
                        <span className="text-slate-500">NeurOPS SYSTEM</span>
                        <span className="text-slate-200">|</span>
                        <p>© 2026 NeurOPS PERFORMANCE SYSTEM</p>
                    </div>
                    <div className="flex items-center gap-2 italic uppercase font-black text-slate-300">
                        Design Focused • Scalable Results
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PublicTriageReportPage;
