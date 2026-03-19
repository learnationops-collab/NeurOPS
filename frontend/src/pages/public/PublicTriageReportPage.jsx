import React, { useState } from 'react';
import api from '../../services/api';
import { Loader2, Send, ArrowLeft, Target, Phone, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const SectionHeader = ({ title, icon: Icon, color = "indigo" }) => (
    <div className="flex items-center gap-3 mb-6">
        <div className={`p-3 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 text-${color}-500`}>
            <Icon size={20} />
        </div>
        <h3 className="text-lg font-black text-white italic tracking-tight uppercase">{title}</h3>
    </div>
);

// 3 columns: Variable, 1st Call, 2nd Call
const DualColumnRow = ({ label, field1, val1, field2, val2, onChange, color1 = "indigo", color2 = "violet" }) => (
    <div className="grid grid-cols-3 gap-4 items-center border-b border-slate-800/50 py-3 last:border-0 hover:bg-slate-800/20 transition-colors px-2 rounded-lg">
        <div className="text-xs font-black uppercase tracking-widest text-slate-400 pl-2">
            {label}
        </div>
        <div>
            <input type="number" placeholder="0" className={`w-full px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-${color1}-500 transition-all font-bold text-sm text-center ${val1 !== '' ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}`} value={val1} onChange={e => onChange(field1, e.target.value)} />
        </div>
        <div>
            <input type="number" placeholder="0" className={`w-full px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-${color2}-500 transition-all font-bold text-sm text-center ${val2 !== '' ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}`} value={val2} onChange={e => onChange(field2, e.target.value)} />
        </div>
    </div>
);

// 4 columns: Variable, Cold, Warm, Hot
const TripleColumnRow = ({ label, fCold, vCold, fWarm, vWarm, fHot, vHot, onChange }) => (
    <div className="grid grid-cols-4 gap-2 md:gap-4 items-center border-b border-slate-800/50 py-3 last:border-0 hover:bg-slate-800/20 transition-colors px-2 rounded-lg">
        <div className="text-[10px] md:text-xs font-black uppercase tracking-tight md:tracking-widest text-slate-400 pl-2">
            {label}
        </div>
        <div>
            <input type="number" placeholder="0" className={`w-full px-2 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold text-sm text-center ${vCold !== '' ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}`} value={vCold} onChange={e => onChange(fCold, e.target.value)} />
        </div>
        <div>
            <input type="number" placeholder="0" className={`w-full px-2 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold text-sm text-center ${vWarm !== '' ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}`} value={vWarm} onChange={e => onChange(fWarm, e.target.value)} />
        </div>
        <div>
            <input type="number" placeholder="0" className={`w-full px-2 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 transition-all font-bold text-sm text-center ${vHot !== '' ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}`} value={vHot} onChange={e => onChange(fHot, e.target.value)} />
        </div>
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
            <div className="w-full max-w-4xl mx-auto z-10 space-y-8 relative">
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

                    <div className="space-y-8">
                        {/* Starting Process Container */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
                            <SectionHeader title="Starting Process" icon={Phone} color="indigo" />
                            <div className="grid grid-cols-3 gap-4 mb-4 px-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-2">Variable</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 text-center bg-indigo-500/10 py-1.5 rounded-lg">1ra Llamada</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-violet-400 text-center bg-violet-500/10 py-1.5 rounded-lg">2da Llamada</div>
                            </div>
                            <div className="space-y-1">
                                <DualColumnRow label="Agendas" field1="starting_1st_call_agendas" val1={formData.starting_1st_call_agendas} field2="starting_2nd_call_agendas" val2={formData.starting_2nd_call_agendas} onChange={handleFieldChange} />
                                <DualColumnRow label="Confirmando" field1="starting_1st_call_confirmando" val1={formData.starting_1st_call_confirmando} field2="starting_2nd_call_confirmando" val2={formData.starting_2nd_call_confirmando} onChange={handleFieldChange} />
                                <DualColumnRow label="Reprogramando" field1="starting_1st_call_reprogramando" val1={formData.starting_1st_call_reprogramando} field2="starting_2nd_call_reprogramando" val2={formData.starting_2nd_call_reprogramando} onChange={handleFieldChange} />
                                <DualColumnRow label="Confirmadas" field1="starting_1st_call_confirmadas" val1={formData.starting_1st_call_confirmadas} field2="starting_2nd_call_confirmadas" val2={formData.starting_2nd_call_confirmadas} onChange={handleFieldChange} color1="emerald" color2="emerald" />
                                <DualColumnRow label="Canceladas" field1="starting_1st_call_canceladas" val1={formData.starting_1st_call_canceladas} field2="starting_2nd_call_canceladas" val2={formData.starting_2nd_call_canceladas} onChange={handleFieldChange} color1="rose" color2="rose" />
                            </div>
                        </div>

                        {/* All of Them Container */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
                            <SectionHeader title="All of Them" icon={Activity} color="pink" />
                            <div className="grid grid-cols-3 gap-4 mb-4 px-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-2">Variable</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-pink-400 text-center bg-pink-500/10 py-1.5 rounded-lg">1ra Llamada</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-rose-400 text-center bg-rose-500/10 py-1.5 rounded-lg">2da Llamada</div>
                            </div>
                            <div className="space-y-1">
                                <DualColumnRow label="Agendas" field1="all_1st_call_agendas" val1={formData.all_1st_call_agendas} field2="all_2nd_call_agendas" val2={formData.all_2nd_call_agendas} onChange={handleFieldChange} color1="pink" color2="rose" />
                                <DualColumnRow label="Confirmando" field1="all_1st_call_confirmando" val1={formData.all_1st_call_confirmando} field2="all_2nd_call_confirmando" val2={formData.all_2nd_call_confirmando} onChange={handleFieldChange} color1="pink" color2="rose" />
                                <DualColumnRow label="Reprogramando" field1="all_1st_call_reprogramando" val1={formData.all_1st_call_reprogramando} field2="all_2nd_call_reprogramando" val2={formData.all_2nd_call_reprogramando} onChange={handleFieldChange} color1="pink" color2="rose" />
                                <DualColumnRow label="Confirmadas" field1="all_1st_call_confirmadas" val1={formData.all_1st_call_confirmadas} field2="all_2nd_call_confirmadas" val2={formData.all_2nd_call_confirmadas} onChange={handleFieldChange} color1="emerald" color2="emerald" />
                                <DualColumnRow label="Canceladas" field1="all_1st_call_canceladas" val1={formData.all_1st_call_canceladas} field2="all_2nd_call_canceladas" val2={formData.all_2nd_call_canceladas} onChange={handleFieldChange} color1="rose" color2="rose" />
                            </div>
                        </div>

                        {/* Post Confirmation Container */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
                            <SectionHeader title="Post Confirmation Process" icon={Target} color="emerald" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 py-2 px-4 rounded-lg text-center">HOY</div>
                                    <DualColumnRow label="Confirmadas" field1="post_hoy_confirmadas" val1={formData.post_hoy_confirmadas} field2="post_hoy_ppc_completo" val2={formData.post_hoy_ppc_completo} onChange={handleFieldChange} color1="emerald" color2="emerald" />
                                    {/* Using DualColumnRow as a hack for 2 inputs, modifying labels */}
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                       <div className="text-center text-[10px] text-slate-500 uppercase font-black">Confirmadas</div>
                                       <div className="text-center text-[10px] text-slate-500 uppercase font-black">PPC Completo</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-500/10 py-2 px-4 rounded-lg text-center">ALL</div>
                                    <div className="grid grid-cols-2 gap-4 items-center mt-2">
                                        <input type="number" placeholder="0" className={`w-full px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all font-bold text-sm text-center ${formData.post_all_confirmadas !== '' ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}`} value={formData.post_all_confirmadas} onChange={e => handleFieldChange("post_all_confirmadas", e.target.value)} />
                                        <input type="number" placeholder="0" className={`w-full px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all font-bold text-sm text-center ${formData.post_all_ppc_completo !== '' ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}`} value={formData.post_all_ppc_completo} onChange={e => handleFieldChange("post_all_ppc_completo", e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                       <div className="text-center text-[10px] text-slate-500 uppercase font-black">Confirmadas</div>
                                       <div className="text-center text-[10px] text-slate-500 uppercase font-black">PPC Completo</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Follow Up Container */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
                            <SectionHeader title="Follow Up Process" icon={Activity} color="cyan" />
                            <div className="grid grid-cols-4 gap-2 md:gap-4 mb-4 px-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-2">Variable</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400 text-center bg-cyan-500/10 py-1.5 rounded-lg">Cold</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-orange-400 text-center bg-orange-500/10 py-1.5 rounded-lg">Warm</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-rose-400 text-center bg-rose-500/10 py-1.5 rounded-lg">Hot</div>
                            </div>
                            <div className="space-y-1">
                                <TripleColumnRow label="Persona Disp" fCold="fu_cold_personas_disp_fu" vCold={formData.fu_cold_personas_disp_fu} fWarm="fu_warm_personas_disp_fu" vWarm={formData.fu_warm_personas_disp_fu} fHot="fu_hot_personas_disp_fu" vHot={formData.fu_hot_personas_disp_fu} onChange={handleFieldChange} />
                                <TripleColumnRow label="Mjes. Reales" fCold="fu_cold_mjes_realizados" vCold={formData.fu_cold_mjes_realizados} fWarm="fu_warm_mjes_realizados" vWarm={formData.fu_warm_mjes_realizados} fHot="fu_hot_mjes_realizados" vHot={formData.fu_hot_mjes_realizados} onChange={handleFieldChange} />
                                <TripleColumnRow label="Pers. Reales" fCold="fu_cold_personas_realizados" vCold={formData.fu_cold_personas_realizados} fWarm="fu_warm_personas_realizados" vWarm={formData.fu_warm_personas_realizados} fHot="fu_hot_personas_realizados" vHot={formData.fu_hot_personas_realizados} onChange={handleFieldChange} />
                                <TripleColumnRow label="Respondidos" fCold="fu_cold_personas_respondidos" vCold={formData.fu_cold_personas_respondidos} fWarm="fu_warm_personas_respondidos" vWarm={formData.fu_warm_personas_respondidos} fHot="fu_hot_personas_respondidos" vHot={formData.fu_hot_personas_respondidos} onChange={handleFieldChange} />
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={submitting || !formData.triage_name} className="w-full bg-indigo-600 hover:bg-indigo-500 py-6 rounded-[2rem] font-black uppercase text-base tracking-[0.2em] transition-all shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-3 active:scale-[0.98]">
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
