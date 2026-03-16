import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Send, Phone, ArrowLeft, BarChart3, Target, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

// Reusable component for numerical inputs
const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false, isLightMode = false, type = "number", placeholder }) => {
    const isFilled = value > 0 || value !== '';
    return (
        <div className="space-y-1.5">
            {label && <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>}
            <input
                type={type}
                required={false}
                readOnly={readOnly}
                placeholder={placeholder}
                className={`w-full px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-${color}-500 transition-all font-bold text-sm text-center
                    ${isLightMode
                        ? (isFilled && !readOnly ? 'bg-white border-slate-200 text-slate-900 border shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-900 border shadow-inner')
                        : (isFilled && !readOnly ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white')
                    }`}
                value={value}
                onChange={e => onChange(field, e.target.value)}
            />
        </div>
    );
};

const PublicTriageReportPage = () => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const initialFormData = {
        triage_name: 'Kerwin',
        date: new Date().toISOString().split('T')[0],
        agendas_nuevas: '',
        agendas_confirmadas: '',
        no_contestan: '',
        cancelaciones: '',
        reprogramandos: '',
        seguimientos_iniciados: '',
        seguimientos_contestados: '',
    };

    const [formData, setFormData] = useState(initialFormData);

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value === '' ? '' : (parseInt(value) || 0) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setSubmitting(true);
        try {
            await api.post('/public/triage-report', formData);
            alert('¡Reporte enviado correctamente! Buen trabajo.');

            // Reset but keep triage and date
            setFormData(prev => ({
                ...initialFormData,
                triage_name: prev.triage_name,
                date: prev.date,
            }));
        } catch (err) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Error al enviar el reporte.');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate fill progress
    const calculateProgress = () => {
        const allFields = Object.keys(initialFormData).filter(k => k !== 'triage_name' && k !== 'date');
        let filled = 0;
        allFields.forEach(field => {
            if (formData[field] !== '' && formData[field] !== null && formData[field] !== undefined) {
                filled++;
            }
        });
        const total = allFields.length + 2;
        if (formData.triage_name) filled++;
        if (formData.date) filled++;
        return Math.min(Math.round((filled / total) * 100), 100);
    };


    const liveMetrics = useMemo(() => {
        const confirmRate = formData.agendas_nuevas > 0 ? ((formData.agendas_confirmadas / formData.agendas_nuevas) * 100).toFixed(1) : '0.0';
        const followUpRate = formData.seguimientos_iniciados > 0 ? ((formData.seguimientos_contestados / formData.seguimientos_iniciados) * 100).toFixed(1) : '0.0';
        
        return {
            confirmRate,
            followUpRate
        };
    }, [formData]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 py-12 relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />

            <div className="w-full max-w-5xl mx-auto z-10 space-y-8">
                {/* Header */}
                <div className="text-center space-y-4 mb-2">
                    <p className="text-indigo-400 font-bold tracking-widest text-xs uppercase">NeurOPS Triage System</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Reporte Diario Triage
                    </h1>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                        <p className="text-slate-500 font-medium animate-pulse">Cargando módulos de reporte...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* ═══ COLUMNA 1: FORMULARIO ═══ */}
                        <div className="lg:col-span-2">
                            <form onSubmit={handleSubmit} className="space-y-6">

                                {/* Progress Bar */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 sticky top-4 z-50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Progreso del Reporte</span>
                                        <span className="text-sm font-black text-indigo-400">{calculateProgress()}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                        <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${calculateProgress()}%` }}></div>
                                    </div>
                                </div>

                                {/* Identification */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">¿Quién eres?</label>
                                        <input
                                            readOnly
                                            className="w-full px-5 py-3.5 bg-slate-800/50 border border-slate-700/80 rounded-2xl text-slate-400 outline-none transition-all font-bold cursor-not-allowed"
                                            value={formData.triage_name}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        />
                                    </div>
                                </div>


                                {/* Metrics Section */}
                                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-xl space-y-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                                            <Activity size={20} />
                                        </div>
                                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Métricas del Día</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <MetricInput
                                            label="Agendas Nuevas"
                                            field="agendas_nuevas"
                                            color="indigo"
                                            value={formData.agendas_nuevas}
                                            onChange={handleFieldChange}
                                            placeholder="0"
                                        />
                                        <MetricInput
                                            label="Agendas Confirmadas"
                                            field="agendas_confirmadas"
                                            color="emerald"
                                            value={formData.agendas_confirmadas}
                                            onChange={handleFieldChange}
                                            placeholder="0"
                                        />
                                        <MetricInput
                                            label="No Contestan"
                                            field="no_contestan"
                                            color="rose"
                                            value={formData.no_contestan}
                                            onChange={handleFieldChange}
                                            placeholder="0"
                                        />
                                        <MetricInput
                                            label="Cancelaciones"
                                            field="cancelaciones"
                                            color="amber"
                                            value={formData.cancelaciones}
                                            onChange={handleFieldChange}
                                            placeholder="0"
                                        />
                                        <MetricInput
                                            label="Reprogramandos"
                                            field="reprogramandos"
                                            color="violet"
                                            value={formData.reprogramandos}
                                            onChange={handleFieldChange}
                                            placeholder="0"
                                        />
                                        <MetricInput
                                            label="Seguimientos (Iniciados)"
                                            field="seguimientos_iniciados"
                                            color="sky"
                                            value={formData.seguimientos_iniciados}
                                            onChange={handleFieldChange}
                                            placeholder="0"
                                        />
                                        <MetricInput
                                            label="Seguimientos (Contestados)"
                                            field="seguimientos_contestados"
                                            color="emerald"
                                            value={formData.seguimientos_contestados}
                                            onChange={handleFieldChange}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitting || !formData.triage_id}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-3xl font-black uppercase text-base tracking-[0.2em] transition-all shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                                    {submitting ? 'Procesando...' : 'ENVIAR REPORTE'}
                                </button>
                            </form>
                        </div>

                        {/* ═══ COLUMNA 2: SIDEBAR DE STATS EN VIVO ═══ */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-28 space-y-6">
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                                            <BarChart3 size={16} />
                                        </div>
                                        <h3 className="text-sm font-black text-white italic tracking-tight uppercase">Conversiones</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                <span>Confirmación</span>
                                                <span className="text-indigo-400">{liveMetrics.confirmRate}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${Math.min(parseFloat(liveMetrics.confirmRate), 100)}%` }} />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                <span>Seguimientos (Respuestas)</span>
                                                <span className="text-emerald-400">{liveMetrics.followUpRate}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(parseFloat(liveMetrics.followUpRate), 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Link to="/estadisticas-triage" className="flex items-center justify-between p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl group hover:border-indigo-500/50 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors">
                                            <Target size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ver Resultados</p>
                                            <p className="text-sm font-black text-white uppercase tracking-tight">Estadísticas Triage</p>
                                        </div>
                                    </div>
                                    <ArrowLeft size={20} className="text-slate-600 group-hover:text-indigo-500 rotate-180 transition-all" />
                                </Link>
                            </div>
                        </div>

                    </div>
                )}

                <div className="text-center pt-8">
                    <Link to="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 font-medium text-sm transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inicio de Sesión
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PublicTriageReportPage;
