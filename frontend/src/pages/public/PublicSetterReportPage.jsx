import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Send, Calendar, ListChecks, User, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const PublicSetterReportPage = () => {
    const [setters, setSetters] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [stages, setStages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        setter_id: '',
        date: new Date().toISOString().split('T')[0],
        inbound_leads: 0,
        openings: 0,
        not_lead: 0,
        new_offers: 0,
        links_sent: 0,
        appointments_booked: 0,
        follow_ups: 0,
        answers: [],
        funnel_metrics: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Using the endpoints we just created in public.py
            const [settersRes, qRes, stagesRes] = await Promise.all([
                api.get('/public/active-setters'),
                api.get('/public/setter-questions'),
                // The stages endpoint isn't strictly public but doesn't have login_required in opener/setter modules.
                // It's safer to just fetch them via the setter logic. 
                // Wait, if it's protected we might need to expose it. Let's try calling the existing one, 
                // but actually, we should just let them fallback to legacy if stages fail OR create a public stages endpoint.
                // I will add a try-catch specifically for stages just in case.
            ]);

            setSetters(settersRes.data);
            setQuestions(qRes.data);

            try {
                // If this is blocked by @role_required, dynamic stages won't load
                // We'll fallback to the default static fields.
                const sRes = await api.get('/setter/stages');
                setStages(sRes.data);

                setFormData(prev => ({
                    ...prev,
                    answers: qRes.data.map(q => ({ question_id: q.id, answer: '' })),
                    funnel_metrics: sRes.data.map(s => ({ stage_id: s.id, value: 0 }))
                }));
            } catch (e) {
                console.warn("Could not fetch stages, falling back to static", e);
                setFormData(prev => ({
                    ...prev,
                    answers: qRes.data.map(q => ({ question_id: q.id, answer: '' }))
                }));
            }

        } catch (err) {
            console.error("Error fetching data:", err);
            alert("Hubo un error cargando el formulario. Reintenta.");
        } finally {
            setLoading(false);
        }
    };

    const handleStatChange = (field, value) => {
        setFormData({ ...formData, [field]: parseInt(value) || 0 });
    };

    const handleStageMetricChange = (stageId, value) => {
        setFormData(prev => ({
            ...prev,
            funnel_metrics: prev.funnel_metrics.map(m =>
                m.stage_id === stageId ? { ...m, value: parseInt(value) || 0 } : m
            )
        }));
    };

    const handleAnswerChange = (questionId, value) => {
        setFormData(prev => ({
            ...prev,
            answers: prev.answers.map(a =>
                a.question_id === questionId ? { ...a, answer: value } : a
            )
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.setter_id) {
            alert("Por favor, selecciona quién eres.");
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/public/setter-report', formData);
            alert('¡Reporte enviado correctamente! Buen trabajo.');

            // Reset form but keep the setter and date
            setFormData(prev => ({
                ...prev,
                inbound_leads: 0,
                openings: 0,
                not_lead: 0,
                new_offers: 0,
                links_sent: 0,
                appointments_booked: 0,
                follow_ups: 0,
                answers: prev.answers.map(a => ({ ...a, answer: '' })),
                funnel_metrics: prev.funnel_metrics.map(m => ({ ...m, value: 0 }))
            }));

        } catch (err) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Error al enviar el reporte. Verifica tu conexión.');
        } finally {
            setSubmitting(false);
        }
    };

    const useDynamicStages = stages.length > 0;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

            <div className="w-full max-w-2xl z-10 space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <p className="text-indigo-400 font-bold tracking-widest text-xs uppercase">NeurOPS System</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Reporte Diario Setter
                    </h1>
                    <p className="text-slate-500 font-medium max-w-md mx-auto">
                        Completa tus métricas del día. Estos datos se sincronizan automáticamente con tu perfil y el Dashboard Administrativo.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4">
                            <Loader2 className="animate-spin text-indigo-500" size={48} />
                            <p className="text-slate-500 font-medium animate-pulse">Cargando módulos...</p>
                        </div>
                    ) : (
                        <form id="public-setter-form" onSubmit={handleSubmit} className="p-6 md:p-10 space-y-10">

                            {/* Identificación */}
                            <div className="space-y-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50">
                                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                    <User size={14} /> Identificación
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Setter Selector */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">¿Quién eres?</label>
                                        <select
                                            required
                                            className="w-full px-6 py-4 bg-slate-800 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold cursor-pointer"
                                            value={formData.setter_id}
                                            onChange={e => setFormData({ ...formData, setter_id: e.target.value })}
                                        >
                                            <option value="" disabled>Selecciona tu nombre</option>
                                            {setters.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Fecha Selector */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            Fecha del Informe
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full px-6 py-4 bg-slate-800 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Métricas (Dinámicas o Legacy) */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-800/50">
                                    <ListChecks size={14} /> KPIs y Métricas del Día
                                </h3>

                                {useDynamicStages ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                        {/* Injecting NOT LEAD natively alongside dynamic stages since it's a parallel static tracking inside NeurOPS for Setters */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">No Lead (Desc.)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full px-5 py-4 bg-slate-800 border border-slate-700/50 rounded-xl text-white outline-none focus:border-indigo-500 transition-all font-bold text-center text-xl"
                                                value={formData.not_lead}
                                                onChange={e => handleStatChange('not_lead', e.target.value)}
                                            />
                                        </div>

                                        {stages.map(stage => (
                                            <div key={stage.id} className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 truncate" title={stage.name}>
                                                    {stage.name}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-full px-5 py-4 bg-slate-800 border border-slate-700/50 rounded-xl text-white outline-none focus:border-indigo-500 transition-all font-bold text-center text-xl"
                                                    value={formData.funnel_metrics.find(m => m.stage_id === stage.id)?.value || 0}
                                                    onChange={e => handleStageMetricChange(stage.id, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                        {[
                                            { label: 'Entrantes', field: 'inbound_leads' },
                                            { label: 'Aperturas', field: 'openings' },
                                            { label: 'No Lead', field: 'not_lead' },
                                            { label: 'Invitaciones', field: 'new_offers' },
                                            { label: 'Links Env.', field: 'links_sent' },
                                            { label: 'Agendas', field: 'appointments_booked' },
                                            { label: 'Seguimientos', field: 'follow_ups' },
                                        ].map(stat => (
                                            <div key={stat.field} className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{stat.label}</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-full px-5 py-4 bg-slate-800 border border-slate-700/50 rounded-xl text-white outline-none focus:border-indigo-500 transition-all font-bold text-center text-xl"
                                                    value={formData[stat.field]}
                                                    onChange={e => handleStatChange(stat.field, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Preguntas Dinámicas */}
                            {questions.length > 0 && (
                                <div className="space-y-6 pt-6 border-t border-slate-800/50">
                                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        Data Cualitativa
                                    </h3>
                                    <div className="space-y-8">
                                        {questions.map(q => (
                                            <div key={q.id} className="space-y-3">
                                                <label className="text-[11px] font-black text-slate-300 uppercase tracking-widest ml-1">
                                                    {q.text}
                                                </label>
                                                {q.type === 'long_text' ? (
                                                    <textarea
                                                        className="w-full px-6 py-5 bg-slate-800/50 border border-slate-700/80 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium min-h-[120px] resize-y"
                                                        placeholder="Escribe tu respuesta aquí..."
                                                        value={formData.answers.find(a => a.question_id === q.id)?.answer || ''}
                                                        onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                    />
                                                ) : q.type === 'boolean' ? (
                                                    <div className="flex gap-4">
                                                        {['Si', 'No'].map(opt => (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                onClick={() => handleAnswerChange(q.id, opt)}
                                                                className={`flex-1 py-4 rounded-xl font-bold transition-all border ${formData.answers.find(a => a.question_id === q.id)?.answer === opt
                                                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                                                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                                                                    }`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type={q.type === 'number' ? 'number' : 'text'}
                                                        className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/80 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                                        placeholder="Respuesta corta..."
                                                        value={formData.answers.find(a => a.question_id === q.id)?.answer || ''}
                                                        onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </form>
                    )}

                    {/* Footer Submit Area */}
                    {!loading && (
                        <div className="p-6 md:p-10 border-t border-slate-800 bg-slate-900/80">
                            <button
                                type="submit"
                                form="public-setter-form"
                                disabled={submitting || !formData.setter_id}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-2xl font-black uppercase text-sm tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
                            >
                                {submitting ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <Send size={20} />
                                )}
                                {submitting ? 'Procesando Envío...' : 'Enviar Reporte al Sistema'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="text-center pt-8">
                    <Link to="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 font-medium text-sm transition-colors">
                        <ArrowLeft size={16} /> Volver al Inicio de Sesión
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PublicSetterReportPage;
