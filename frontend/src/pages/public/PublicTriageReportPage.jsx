import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Send, Calendar, ListChecks, Phone, Activity, Target, ArrowLeft, RefreshCw, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false }) => {
    const isFilled = value > 0 || value !== '';
    const colorClasses = {
        indigo: "text-indigo-600 focus:ring-indigo-500",
        pink: "text-rose-500 focus:ring-rose-500",
        fuchsia: "text-fuchsia-600 focus:ring-fuchsia-500",
        teal: "text-teal-600 focus:ring-teal-500",
        cyan: "text-cyan-600 focus:ring-cyan-500",
        orange: "text-orange-600 focus:ring-orange-500"
    };

    return (
        <div className="space-y-1.5 flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-500/80">{label}</label>
            <input
                type="number"
                required
                readOnly={readOnly}
                className={`w-full px-4 py-3.5 rounded-[1.25rem] outline-none border transition-all font-black text-lg
                    ${readOnly ? 'bg-slate-100/50 border-slate-200 text-slate-400' : 
                      isFilled ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-50/50 border-slate-200/60 text-slate-900 shadow-inner'}
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
    <div className="flex items-center gap-4 mb-8">
        <div className={`p-3.5 bg-white shadow-sm border border-slate-100 rounded-2xl`}>
            <Icon className={colorClass} size={22} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-800 uppercase italic leading-none">{title}</h2>
    </div>
);

const PublicTriageReportPage = () => {
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);

    const initialFormData = {
        triage_name: 'Kerwin', // Default or from context if available
        date: new Date().toISOString().split('T')[0],
        
        // Starting Process
        starting_1st_call_agendas: '', starting_1st_call_confirmando: '', starting_1st_call_reprogramando: '', starting_1st_call_confirmadas: '', starting_1st_call_canceladas: '',
        starting_2nd_call_agendas: '', starting_2nd_call_confirmando: '', starting_2nd_call_reprogramando: '', starting_2nd_call_confirmadas: '', starting_2nd_call_canceladas: '',
        
        // All of Them
        all_1st_call_agendas: '', all_1st_call_confirmando: '', all_1st_call_reprogramando: '', all_1st_call_confirmadas: '', all_1st_call_canceladas: '',
        all_2nd_call_agendas: '', all_2nd_call_confirmando: '', all_2nd_call_reprogramando: '', all_2nd_call_confirmadas: '', all_2nd_call_canceladas: '',
        
        // Post Confirmation
        post_hoy_confirmadas: '', post_hoy_ppc_completo: '', post_all_confirmadas: '', post_all_ppc_completo: '',
        
        // Follow Up
        fu_cold_personas_disp_fu: '', fu_cold_mjes_realizados: '', fu_cold_personas_realizados: '', fu_cold_personas_respondidos: '',
        fu_warm_personas_disp_fu: '', fu_warm_mjes_realizados: '', fu_warm_personas_realizados: '', fu_warm_personas_respondidos: '',
        fu_hot_personas_disp_fu: '', fu_hot_mjes_realizados: '', fu_hot_personas_realizados: '', fu_hot_personas_respondidos: ''
    };

    const [formData, setFormData] = useState(initialFormData);

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value === '' ? '' : (parseInt(value) || 0) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/triage/tracker', formData);
            alert('¡Reporte enviado correctamente! Excelente trabajo.');
            setFormData(prev => ({ ...initialFormData, triage_name: prev.triage_name, date: prev.date }));
        } catch (err) {
            alert(err.response?.data?.error || 'Error al enviar reporte.');
        } finally {
            setSubmitting(false);
        }
    };

    const calculateProgress = () => {
        const allFields = Object.keys(initialFormData).filter(k => k !== 'triage_name' && k !== 'date');
        let filled = 0;
        allFields.forEach(field => {
            if (formData[field] !== '' && formData[field] !== null && formData[field] !== undefined) {
                filled++;
            }
        });
        const total = allFields.length;
        return Math.min(Math.round((filled / total) * 100), 100);
    };

    const liveMetrics = useMemo(() => {
        const stAgendas = (parseInt(formData.starting_1st_call_agendas) || 0) + (parseInt(formData.starting_2nd_call_agendas) || 0);
        const stConfirmadas = (parseInt(formData.starting_1st_call_confirmadas) || 0) + (parseInt(formData.starting_2nd_call_confirmadas) || 0);
        
        const fuCont = (parseInt(formData.fu_cold_personas_realizados) || 0) + (parseInt(formData.fu_warm_personas_realizados) || 0) + (parseInt(formData.fu_hot_personas_realizados) || 0);
        const fuResp = (parseInt(formData.fu_cold_personas_respondidos) || 0) + (parseInt(formData.fu_warm_personas_respondidos) || 0) + (parseInt(formData.fu_hot_personas_respondidos) || 0);
        
        const confirmRate = stAgendas > 0 ? (stConfirmadas / stAgendas * 100).toFixed(1) : 0;
        const responseRate = fuCont > 0 ? (fuResp / fuCont * 100).toFixed(1) : 0;

        return {
            stAgendas,
            stConfirmadas,
            confirmRate,
            responseRate
        };
    }, [formData]);

    const progress = calculateProgress();

    return (
        <div className="min-h-screen bg-[#f0f4f8] text-slate-900 flex flex-col p-4 md:p-8 lg:p-12 relative overflow-hidden font-sans">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-200/30 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-teal-100/40 blur-[100px] rounded-full" />

            <div className="w-full max-w-6xl mx-auto z-10 space-y-10">
                {/* Dashboard Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <p className="text-cyan-600 font-black tracking-[0.2em] text-[10px] uppercase ml-1">NeurOPS Call Confirmer System</p>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Call Confirmer Dashboard <span className="text-slate-300 font-light">/</span> <span className="text-indigo-600 italic">Report</span>
                        </h1>
                        <p className="text-slate-500 font-medium text-lg">Daily Tracker for <span className="text-slate-800 font-bold">{formData.triage_name}</span> 🎯</p>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md border border-white/40 p-4 rounded-[2rem] shadow-sm">
                        <div className="flex items-center gap-3 px-4 border-r border-slate-200">
                            <Calendar className="text-indigo-500" size={20} />
                            <input
                                type="date"
                                className="bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="px-4 pr-6">
                            <span className="font-bold text-slate-400 text-sm uppercase tracking-widest mr-2">Call Confirmer:</span>
                            <span className="font-black text-indigo-600 italic">{formData.triage_name}</span>
                        </div>
                    </div>
                </header>

                <form onSubmit={handleSubmit} className="space-y-10">
                    {/* HIGH LEVEL METRICS ROW */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Agendas St.', value: liveMetrics.stAgendas, icon: Phone, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                            { label: 'Confirmadas St.', value: liveMetrics.stConfirmadas, icon: Target, color: 'text-teal-600', bg: 'bg-teal-50' },
                            { label: 'Tasa Confirm. St.', value: `${liveMetrics.confirmRate}%`, icon: Activity, color: 'text-cyan-600', bg: 'bg-cyan-50' },
                            { label: 'Resp. FU', value: `${liveMetrics.responseRate}%`, icon: RefreshCw, color: 'text-rose-600', bg: 'bg-rose-50' }
                        ].map((card, i) => (
                            <div key={i} className="bg-white/80 backdrop-blur-lg border border-white/60 p-6 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-2.5 ${card.bg} rounded-2xl group-hover:scale-110 transition-transform`}>
                                        <card.icon className={card.color} size={20} strokeWidth={2.5} />
                                    </div>
                                </div>
                                <p className="text-3xl font-black text-slate-900 tracking-tight">{card.value}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{card.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* MAIN CONTENT GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        
                        {/* LEFT COLUMN: Starting & All Process */}
                        <div className="lg:col-span-8 space-y-10">
                            
                            {/* starting Process Cards */}
                            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 shadow-sm">
                                <SectionHeader icon={Phone} title="DÍA DE HOY" colorClass="text-indigo-600" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    {/* 1st Call */}
                                    <div className="space-y-6">
                                        <div className="bg-indigo-50/50 py-2 px-4 rounded-xl text-center">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">1ra Llamada</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <MetricInput label="Agendas" field="starting_1st_call_agendas" color="indigo" value={formData.starting_1st_call_agendas} onChange={handleFieldChange} />
                                            <MetricInput label="Confirmando" field="starting_1st_call_confirmando" color="indigo" value={formData.starting_1st_call_confirmando} onChange={handleFieldChange} />
                                            <MetricInput label="Reprog." field="starting_1st_call_reprogramando" color="fuchsia" value={formData.starting_1st_call_reprogramando} onChange={handleFieldChange} />
                                            <MetricInput label="Confirmadas" field="starting_1st_call_confirmadas" color="teal" value={formData.starting_1st_call_confirmadas} onChange={handleFieldChange} />
                                            <div className="col-span-2">
                                                <MetricInput label="Canceladas" field="starting_1st_call_canceladas" color="pink" value={formData.starting_1st_call_canceladas} onChange={handleFieldChange} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2nd Call */}
                                    <div className="space-y-6">
                                        <div className="bg-fuchsia-50/50 py-2 px-4 rounded-xl text-center">
                                            <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest">2da Llamada</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <MetricInput label="Agendas" field="starting_2nd_call_agendas" color="fuchsia" value={formData.starting_2nd_call_agendas} onChange={handleFieldChange} />
                                            <MetricInput label="Confirmando" field="starting_2nd_call_confirmando" color="fuchsia" value={formData.starting_2nd_call_confirmando} onChange={handleFieldChange} />
                                            <MetricInput label="Reprog." field="starting_2nd_call_reprogramando" color="indigo" value={formData.starting_2nd_call_reprogramando} onChange={handleFieldChange} />
                                            <MetricInput label="Confirmadas" field="starting_2nd_call_confirmadas" color="teal" value={formData.starting_2nd_call_confirmadas} onChange={handleFieldChange} />
                                            <div className="col-span-2">
                                                <MetricInput label="Canceladas" field="starting_2nd_call_canceladas" color="pink" value={formData.starting_2nd_call_canceladas} onChange={handleFieldChange} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* All Of Them Cards */}
                            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 shadow-sm">
                                <SectionHeader icon={Layers} title="RESTANTES" colorClass="text-fuchsia-600" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    {/* 1st Call Hist. */}
                                    <div className="space-y-6">
                                        <div className="bg-fuchsia-50/50 py-2 px-4 rounded-xl text-center">
                                            <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest">Histórico 1ra</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <MetricInput label="Agendas" field="all_1st_call_agendas" color="fuchsia" value={formData.all_1st_call_agendas} onChange={handleFieldChange} />
                                            <MetricInput label="Confirmando" field="all_1st_call_confirmando" color="fuchsia" value={formData.all_1st_call_confirmando} onChange={handleFieldChange} />
                                            <MetricInput label="Reprog." field="all_1st_call_reprogramando" color="indigo" value={formData.all_1st_call_reprogramando} onChange={handleFieldChange} />
                                            <MetricInput label="Confirmadas" field="all_1st_call_confirmadas" color="teal" value={formData.all_1st_call_confirmadas} onChange={handleFieldChange} />
                                            <div className="col-span-2">
                                                <MetricInput label="Canceladas" field="all_1st_call_canceladas" color="pink" value={formData.all_1st_call_canceladas} onChange={handleFieldChange} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2nd Call Hist. */}
                                    <div className="space-y-6">
                                        <div className="bg-indigo-50/50 py-2 px-4 rounded-xl text-center">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Histórico 2da</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <MetricInput label="Agendas" field="all_2nd_call_agendas" color="indigo" value={formData.all_2nd_call_agendas} onChange={handleFieldChange} />
                                            <MetricInput label="Confirmando" field="all_2nd_call_confirmando" color="indigo" value={formData.all_2nd_call_confirmando} onChange={handleFieldChange} />
                                            <MetricInput label="Reprog." field="all_2nd_call_reprogramando" color="fuchsia" value={formData.all_2nd_call_reprogramando} onChange={handleFieldChange} />
                                            <MetricInput label="Confirmadas" field="all_2nd_call_confirmadas" color="teal" value={formData.all_2nd_call_confirmadas} onChange={handleFieldChange} />
                                            <div className="col-span-2">
                                                <MetricInput label="Canceladas" field="all_2nd_call_canceladas" color="pink" value={formData.all_2nd_call_canceladas} onChange={handleFieldChange} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Follow Up & Submission */}
                        <div className="lg:col-span-4 space-y-10">
                            
                            {/* Follow Up Card */}
                            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 shadow-sm">
                                <SectionHeader icon={RefreshCw} title="Follow Up" colorClass="text-cyan-600" />
                                
                                <div className="space-y-8">
                                    {[
                                        { label: 'Cold Leads', color: 'cyan', fields: ['fu_cold_personas_disp_fu', 'fu_cold_mjes_realizados', 'fu_cold_personas_realizados', 'fu_cold_personas_respondidos'] },
                                        { label: 'Warm Leads', color: 'orange', fields: ['fu_warm_personas_disp_fu', 'fu_warm_mjes_realizados', 'fu_warm_personas_realizados', 'fu_warm_personas_respondidos'] },
                                        { label: 'Hot Leads', color: 'pink', fields: ['fu_hot_personas_disp_fu', 'fu_hot_mjes_realizados', 'fu_hot_personas_realizados', 'fu_hot_personas_respondidos'] }
                                    ].map((sec, idx) => (
                                        <div key={idx} className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-6 rounded-full bg-${sec.color}-500`} />
                                                <h4 className="text-xs font-black uppercase text-slate-800 tracking-widest">{sec.label}</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <MetricInput label="Disponibles" field={sec.fields[0]} color={sec.color} value={formData[sec.fields[0]]} onChange={handleFieldChange} />
                                                <MetricInput label="Msjs. Env." field={sec.fields[1]} color={sec.color} value={formData[sec.fields[1]]} onChange={handleFieldChange} />
                                                <MetricInput label="Contac." field={sec.fields[2]} color={sec.color} value={formData[sec.fields[2]]} onChange={handleFieldChange} />
                                                <MetricInput label="Resp." field={sec.fields[3]} color={sec.color} value={formData[sec.fields[3]]} onChange={handleFieldChange} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit Progress Card */}
                            <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-sm">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1 italic">Submit Status</p>
                                        <p className="text-4xl font-black text-slate-900">{progress}%</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                        <Send className="text-indigo-600" size={20} strokeWidth={2.5} />
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-8">
                                    <div className="h-full bg-indigo-600 transition-all duration-700 shadow-[0_0_12px_rgba(79,70,229,0.4)]" style={{ width: `${progress}%` }} />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting || progress < 1}
                                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                                    {submitting ? 'Sending Data...' : 'Submit Call Confirmer Report'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM SECTION: Post Confirmation Process */}
                    <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 md:p-12 shadow-sm border-t-8 border-t-teal-600">
                        <SectionHeader icon={Target} title="RECORDATORIOS" colorClass="text-teal-600" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* HOY Column */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                                        <Target className="text-teal-600" size={18} />
                                    </div>
                                    <h4 className="text-lg font-black uppercase italic text-slate-800">Cierre de Hoy</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <MetricInput label="Confirmadas Hoy" field="post_hoy_confirmadas" color="teal" value={formData.post_hoy_confirmadas} onChange={handleFieldChange} />
                                    <MetricInput label="PPC Completo Hoy" field="post_hoy_ppc_completo" color="cyan" value={formData.post_hoy_ppc_completo} onChange={handleFieldChange} />
                                </div>
                            </div>

                            {/* ALL Column */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <Target className="text-indigo-600" size={18} />
                                    </div>
                                    <h4 className="text-lg font-black uppercase italic text-slate-800">Histórico Total</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <MetricInput label="Confirmadas All" field="post_all_confirmadas" color="indigo" value={formData.post_all_confirmadas} onChange={handleFieldChange} />
                                    <MetricInput label="PPC Completo All" field="post_all_ppc_completo" color="cyan" value={formData.post_all_ppc_completo} onChange={handleFieldChange} />
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <footer className="flex flex-col md:flex-row justify-between items-center py-10 text-slate-400 font-medium text-xs gap-4 border-t border-slate-200/60">
                    <div className="flex items-center gap-6">
                        <Link to="/estadisticas-triage" className="hover:text-indigo-600 transition-colors uppercase tracking-[0.1em] font-black">View Stats</Link>
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
