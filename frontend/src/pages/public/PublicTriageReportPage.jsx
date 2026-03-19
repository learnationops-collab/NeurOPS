import React, { useState } from 'react';
import api from '../../services/api';
import { Loader2, Send, ArrowLeft, Target, Phone, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false }) => {
    const isFilled = value > 0 || value !== '';
    return (
        <div className="space-y-1.5 min-w-[60px]">
            <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-slate-400 block whitespace-nowrap overflow-hidden text-ellipsis">{label}</label>
            <input
                type="number"
                readOnly={readOnly}
                placeholder="0"
                className={`w-full px-2 py-2 rounded-xl outline-none focus:ring-2 focus:ring-${color}-500 transition-all font-bold text-sm text-center
                    ${isFilled && !readOnly ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}`}
                value={value}
                onChange={e => onChange(field, e.target.value)}
            />
        </div>
    );
};

const SectionHeader = ({ title, icon: Icon, color = "indigo" }) => (
    <div className="flex items-center gap-3 mb-6">
        <div className={`p-3 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-500`}>
            <Icon size={20} />
        </div>
        <h3 className="text-lg font-black text-white italic tracking-tight uppercase">{title}</h3>
    </div>
);

const PublicTriageReportPage = () => {
    const [submitting, setSubmitting] = useState(false);

    const initialFormData = {
        triage_name: 'Kerwin',
        date: new Date().toISOString().split('T')[0],
        starting_1st_call_agendas: '', starting_1st_call_confirmando: '', starting_1st_call_reprogramando: '', starting_1st_call_confirmadas: '', starting_1st_call_canceladas: '',
        starting_2nd_call_agendas: '', starting_2nd_call_confirmando: '', starting_2nd_call_reprogramando: '', starting_2nd_call_confirmadas: '', starting_2nd_call_canceladas: '',
        all_1st_call_agendas: '', all_1st_call_confirmando: '', all_1st_call_reprogramando: '', all_1st_call_confirmadas: '', all_1st_call_canceladas: '',
        all_2nd_call_agendas: '', all_2nd_call_confirmando: '', all_2nd_call_reprogramando: '', all_2nd_call_confirmadas: '', all_2nd_call_canceladas: '',
        post_hoy_confirmadas: '', post_hoy_ppc_completo: '', post_all_confirmadas: '', post_all_ppc_completo: '',
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
            await api.post('/api/triage/tracker', formData);
            alert('¡Tracker enviado correctamente!');
            setFormData(prev => ({ ...initialFormData, triage_name: prev.triage_name, date: prev.date }));
        } catch (err) {
            alert(err.response?.data?.error || 'Error al enviar tracker.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 py-12 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />
            <div className="w-full max-w-6xl mx-auto z-10 space-y-8 relative">
                <div className="text-center space-y-4 mb-2">
                    <p className="text-indigo-400 font-bold tracking-widest text-xs uppercase">NeurOPS Triage System</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Reporte Diario Triage (Tracker)
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Identification */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">¿Quién eres?</label>
                            <input readOnly className="w-full px-5 py-3.5 bg-slate-800/50 border border-slate-700/80 rounded-2xl text-slate-400 font-bold outline-none" value={formData.triage_name} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
                            <input type="date" required className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-indigo-500 font-bold" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Starting Process 1st Call */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
                            <SectionHeader title="Starting Process (1st Call)" icon={Phone} color="indigo" />
                            <div className="grid grid-cols-5 gap-2">
                                <MetricInput label="Agendas" field="starting_1st_call_agendas" value={formData.starting_1st_call_agendas} onChange={handleFieldChange} color="indigo" />
                                <MetricInput label="Confirmando" field="starting_1st_call_confirmando" value={formData.starting_1st_call_confirmando} onChange={handleFieldChange} color="indigo" />
                                <MetricInput label="Repro" field="starting_1st_call_reprogramando" value={formData.starting_1st_call_reprogramando} onChange={handleFieldChange} color="indigo" />
                                <MetricInput label="Confirmadas" field="starting_1st_call_confirmadas" value={formData.starting_1st_call_confirmadas} onChange={handleFieldChange} color="emerald" />
                                <MetricInput label="Canceladas" field="starting_1st_call_canceladas" value={formData.starting_1st_call_canceladas} onChange={handleFieldChange} color="rose" />
                            </div>
                        </div>

                        {/* Starting Process 2nd Call */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
                            <SectionHeader title="Starting Process (2nd Call)" icon={Phone} color="violet" />
                            <div className="grid grid-cols-5 gap-2">
                                <MetricInput label="Agendas" field="starting_2nd_call_agendas" value={formData.starting_2nd_call_agendas} onChange={handleFieldChange} color="violet" />
                                <MetricInput label="Confirmando" field="starting_2nd_call_confirmando" value={formData.starting_2nd_call_confirmando} onChange={handleFieldChange} color="violet" />
                                <MetricInput label="Repro" field="starting_2nd_call_reprogramando" value={formData.starting_2nd_call_reprogramando} onChange={handleFieldChange} color="violet" />
                                <MetricInput label="Confirmadas" field="starting_2nd_call_confirmadas" value={formData.starting_2nd_call_confirmadas} onChange={handleFieldChange} color="emerald" />
                                <MetricInput label="Canceladas" field="starting_2nd_call_canceladas" value={formData.starting_2nd_call_canceladas} onChange={handleFieldChange} color="rose" />
                            </div>
                        </div>

                        {/* All of Them 1st Call */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
                            <SectionHeader title="All of Them (1st Call)" icon={Activity} color="pink" />
                            <div className="grid grid-cols-5 gap-2">
                                <MetricInput label="Agendas" field="all_1st_call_agendas" value={formData.all_1st_call_agendas} onChange={handleFieldChange} color="pink" />
                                <MetricInput label="Confirmando" field="all_1st_call_confirmando" value={formData.all_1st_call_confirmando} onChange={handleFieldChange} color="pink" />
                                <MetricInput label="Repro" field="all_1st_call_reprogramando" value={formData.all_1st_call_reprogramando} onChange={handleFieldChange} color="pink" />
                                <MetricInput label="Confirmadas" field="all_1st_call_confirmadas" value={formData.all_1st_call_confirmadas} onChange={handleFieldChange} color="emerald" />
                                <MetricInput label="Canceladas" field="all_1st_call_canceladas" value={formData.all_1st_call_canceladas} onChange={handleFieldChange} color="rose" />
                            </div>
                        </div>

                        {/* All of Them 2nd Call */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
                            <SectionHeader title="All of Them (2nd Call)" icon={Activity} color="rose" />
                            <div className="grid grid-cols-5 gap-2">
                                <MetricInput label="Agendas" field="all_2nd_call_agendas" value={formData.all_2nd_call_agendas} onChange={handleFieldChange} color="rose" />
                                <MetricInput label="Confirmando" field="all_2nd_call_confirmando" value={formData.all_2nd_call_confirmando} onChange={handleFieldChange} color="rose" />
                                <MetricInput label="Repro" field="all_2nd_call_reprogramando" value={formData.all_2nd_call_reprogramando} onChange={handleFieldChange} color="rose" />
                                <MetricInput label="Confirmadas" field="all_2nd_call_confirmadas" value={formData.all_2nd_call_confirmadas} onChange={handleFieldChange} color="emerald" />
                                <MetricInput label="Canceladas" field="all_2nd_call_canceladas" value={formData.all_2nd_call_canceladas} onChange={handleFieldChange} color="rose" />
                            </div>
                        </div>

                        {/* Post Confirmation Process */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
                            <SectionHeader title="Post Confirmation Process" icon={Target} color="emerald" />
                            <div className="grid grid-cols-2 gap-4">
                                <MetricInput label="Hoy: Confirmadas" field="post_hoy_confirmadas" value={formData.post_hoy_confirmadas} onChange={handleFieldChange} color="emerald" />
                                <MetricInput label="Hoy: PPC Completo" field="post_hoy_ppc_completo" value={formData.post_hoy_ppc_completo} onChange={handleFieldChange} color="emerald" />
                                <MetricInput label="All: Confirmadas" field="post_all_confirmadas" value={formData.post_all_confirmadas} onChange={handleFieldChange} color="emerald" />
                                <MetricInput label="All: PPC Completo" field="post_all_ppc_completo" value={formData.post_all_ppc_completo} onChange={handleFieldChange} color="emerald" />
                            </div>
                        </div>

                        {/* Follow Up Process */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
                            <SectionHeader title="Follow Up Process" icon={Activity} color="cyan" />
                            <div className="space-y-4">
                                {/* Cold */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest bg-slate-800/50 p-2 rounded-lg text-center">Cold</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <MetricInput label="Disp" field="fu_cold_personas_disp_fu" value={formData.fu_cold_personas_disp_fu} onChange={handleFieldChange} color="cyan" />
                                        <MetricInput label="Mensajes Reales" field="fu_cold_mjes_realizados" value={formData.fu_cold_mjes_realizados} onChange={handleFieldChange} color="cyan" />
                                        <MetricInput label="Pers. Reales" field="fu_cold_personas_realizados" value={formData.fu_cold_personas_realizados} onChange={handleFieldChange} color="cyan" />
                                        <MetricInput label="Respondidos" field="fu_cold_personas_respondidos" value={formData.fu_cold_personas_respondidos} onChange={handleFieldChange} color="emerald" />
                                    </div>
                                </div>
                                {/* Warm */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest bg-slate-800/50 p-2 rounded-lg text-center">Warm</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <MetricInput label="Disp" field="fu_warm_personas_disp_fu" value={formData.fu_warm_personas_disp_fu} onChange={handleFieldChange} color="orange" />
                                        <MetricInput label="Mensajes Reales" field="fu_warm_mjes_realizados" value={formData.fu_warm_mjes_realizados} onChange={handleFieldChange} color="orange" />
                                        <MetricInput label="Pers. Reales" field="fu_warm_personas_realizados" value={formData.fu_warm_personas_realizados} onChange={handleFieldChange} color="orange" />
                                        <MetricInput label="Respondidos" field="fu_warm_personas_respondidos" value={formData.fu_warm_personas_respondidos} onChange={handleFieldChange} color="emerald" />
                                    </div>
                                </div>
                                {/* Hot */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest bg-slate-800/50 p-2 rounded-lg text-center">Hot</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <MetricInput label="Disp" field="fu_hot_personas_disp_fu" value={formData.fu_hot_personas_disp_fu} onChange={handleFieldChange} color="rose" />
                                        <MetricInput label="Mensajes Reales" field="fu_hot_mjes_realizados" value={formData.fu_hot_mjes_realizados} onChange={handleFieldChange} color="rose" />
                                        <MetricInput label="Pers. Reales" field="fu_hot_personas_realizados" value={formData.fu_hot_personas_realizados} onChange={handleFieldChange} color="rose" />
                                        <MetricInput label="Respondidos" field="fu_hot_personas_respondidos" value={formData.fu_hot_personas_respondidos} onChange={handleFieldChange} color="emerald" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={submitting || !formData.triage_name} className="w-full bg-indigo-600 hover:bg-indigo-500 py-5 rounded-3xl font-black uppercase text-base tracking-[0.2em] transition-all shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-3 active:scale-[0.98]">
                        {submitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                        {submitting ? 'Enviando Tracker...' : 'ENVIAR REPORTE AL TRACKER'}
                    </button>
                    <div className="flex justify-center mt-4">
                       <Link to="/estadisticas-triage" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 font-medium text-sm transition-colors group">
                           Ver Estadísticas <ArrowLeft size={16} className="group-hover:translate-x-1 transition-transform rotate-180" />
                       </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PublicTriageReportPage;
