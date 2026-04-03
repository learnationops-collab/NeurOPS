import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Send, Calendar, ListChecks, User, ArrowLeft, Inbox, MessageSquare, Filter, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import FunnelChart from '../../components/charts/FunnelChart';
const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false, isLightMode = false }) => {
    const isFilled = value > 0 || value !== '';
    return (
        <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
            <input
                type="number"
                required
                readOnly={readOnly}
                className={`w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-${color}-500 transition-all font-bold 
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

const SectionHeader = ({ icon: Icon, title, colorClass, isLightMode = false }) => (
    <div className="flex items-center gap-3 mb-6 border-b border-slate-800/50 pb-4">
        <div className={`p-3 ${isLightMode ? 'bg-slate-100 text-slate-700' : 'bg-slate-800/50'} rounded-2xl`}>
            <Icon className={colorClass} size={24} />
        </div>
        <h2 className={`text-xl font-black italic tracking-tighter uppercase ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{title}</h2>
    </div>
);

const PublicSetterReportPage = () => {
    const [setters, setSetters] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        setter_id: '',
        date: new Date().toISOString().split('T')[0],

        // INBOX
        inbox_entrantes: '',
        not_lead: '',
        inbox_inabribles: '',
        inbox_leads: '',

        qualification_fu: '',
        pain_fu: '',
        offer_fu: '',
        link_fu: '',
        agenda_fu: '',
        qualification_fur: '',
        pain_fur: '',
        offer_fur: '',
        link_fur: '',
        agenda_fur: '',

        qualification_opening_submitted: '',
        qualification_opening_responded: '',
        pain_opening_submitted: '',
        pain_opening_responded: '',

        answers: []
    });

    // Auto-calculate Leads
    useEffect(() => {
        const entrantesNum = parseInt(formData.inbox_entrantes) || 0;
        const noLeadNum = parseInt(formData.not_lead) || 0;
        const calculatedLeads = Math.max(0, entrantesNum - noLeadNum);
        if (formData.inbox_leads !== calculatedLeads && (formData.inbox_entrantes !== '' || formData.not_lead !== '')) {
            setFormData(prev => ({ ...prev, inbox_leads: calculatedLeads }));
        }
    }, [formData.inbox_entrantes, formData.not_lead]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settersRes, qRes] = await Promise.all([
                api.get('/public/active-setters'),
                api.get('/public/setter-questions')
            ]);

            setSetters(settersRes.data);
            setQuestions(qRes.data);

            setFormData(prev => ({
                ...prev,
                answers: qRes.data.map(q => ({ question_id: q.id, answer: '' }))
            }));

        } catch (err) {
            console.error("Error fetching data:", err);
            alert("Hubo un error cargando el formulario. Reintenta.");
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (field, value) => {
        setFormData({ ...formData, [field]: value === '' ? '' : (parseInt(value) || 0) });
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

            // Reset scores but keep setter and date
            setFormData(prev => ({
                ...prev,
                inbox_entrantes: '',
                not_lead: '',
                inbox_inabribles: '',
                inbox_leads: '',
                qualification_fu: '',
                pain_fu: '',
                offer_fu: '',
                link_fu: '',
                agenda_fu: '',
                qualification_fur: '',
                pain_fur: '',
                offer_fur: '',
                link_fur: '',
                agenda_fur: '',
                qualification_opening_submitted: '',
                qualification_opening_responded: '',
                pain_opening_submitted: '',
                pain_opening_responded: '',
                answers: prev.answers.map(a => ({ ...a, answer: '' }))
            }));

        } catch (err) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Error al enviar el reporte.');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate completion progress
    const calculateProgress = () => {
        const fieldsToCheck = [
            'setter_id', 'date', 'inbox_entrantes', 'not_lead', 'inbox_inabribles',
            'qualification_fu', 'pain_fu', 'offer_fu', 'link_fu', 'agenda_fu',
            'qualification_fur', 'pain_fur', 'offer_fur', 'link_fur', 'agenda_fur',
            'qualification_opening_submitted', 'qualification_opening_responded',
            'pain_opening_submitted', 'pain_opening_responded'
        ];

        let filledFields = 0;
        fieldsToCheck.forEach(field => {
            if (formData[field] !== '' && formData[field] !== null && formData[field] !== undefined && formData[field].toString().trim() !== '') {
                filledFields++;
            }
        });

        // Add qualitative questions to progress
        const totalFields = fieldsToCheck.length + questions.length;

        questions.forEach(q => {
            const answerObj = formData.answers.find(a => a.question_id === q.id);
            if (answerObj && answerObj.answer.trim() !== '') {
                filledFields++;
            }
        });

        let completionPercentage = Math.round((filledFields / totalFields) * 100);
        return Math.min(completionPercentage, 100);
    };

    const isSectionComplete = (fields, isQualitative = false) => {
        if (isQualitative) {
            return fields.every(qId => {
                const answerObj = formData.answers.find(a => a.question_id === parseInt(qId));
                return answerObj && answerObj.answer.trim() !== '';
            });
        }
        return fields.every(f => {
            const val = formData[f];
            return val !== '' && val !== null && val !== undefined && val.toString().trim() !== '';
        });
    };

    const liveMetrics = useMemo(() => {
        const ie = parseInt(formData.inbox_entrantes) || 0;
        const nl = parseInt(formData.not_lead) || 0;
        const ina = parseInt(formData.inbox_inabribles) || 0;

        const noLeadPct = ie > 0 ? (nl / ie) * 100 : 0;
        const inabriblesPct = ie > 0 ? (ina / ie) * 100 : 0;

        const fq = parseInt(formData.funnel_qualification) || 0;
        const fp = parseInt(formData.funnel_pain) || 0;
        const fo = parseInt(formData.funnel_offer) || 0;
        const fl = parseInt(formData.funnel_link) || 0;
        const fa = parseInt(formData.funnel_agenda) || 0;

        const qfu = parseInt(formData.qualification_fu) || 0;
        const qfur = parseInt(formData.qualification_fur) || 0;
        const pfu = parseInt(formData.pain_fu) || 0;
        const pfur = parseInt(formData.pain_fur) || 0;
        const ofu = parseInt(formData.offer_fu) || 0;
        const ofur = parseInt(formData.offer_fur) || 0;
        const lfu = parseInt(formData.link_fu) || 0;
        const lfur = parseInt(formData.link_fur) || 0;
        const afu = parseInt(formData.agenda_fu) || 0;
        const afur = parseInt(formData.agenda_fur) || 0;

        const totalFU = qfu + pfu + ofu + lfu + afu;
        const totalFUR = qfur + pfur + ofur + lfur + afur;

        const qualToPain = fq > 0 ? (fp / fq) * 100 : 0;
        const painToOffer = fp > 0 ? (fo / fp) * 100 : 0;
        const offerToLink = fo > 0 ? (fl / fo) * 100 : 0;
        const linkToAgenda = fl > 0 ? (fa / fl) * 100 : 0;

        const openingResp = (parseInt(formData.qualification_opening_submitted) || 0) + (parseInt(formData.pain_opening_submitted) || 0) > 0 
            ? ((parseInt(formData.qualification_opening_responded) || 0) + (parseInt(formData.pain_opening_responded) || 0)) / 
              ((parseInt(formData.qualification_opening_submitted) || 0) + (parseInt(formData.pain_opening_submitted) || 0)) * 100 
            : 0;
            
        const followUpResp = totalFU > 0 ? (totalFUR / totalFU) * 100 : 0;

        const funnelData = [
            { name: 'Qualification', value: fq, fill: '#6366f1' },
            { name: 'Pain', value: fp, fill: '#8b5cf6' },
            { name: 'Offer', value: fo, fill: '#ec4899' },
            { name: 'Link', value: fl, fill: '#f43f5e' },
            { name: 'Agenda', value: fa, fill: '#10b981' }
        ];

        return {
            noLeadPct: noLeadPct.toFixed(1),
            inabriblesPct: inabriblesPct.toFixed(1),
            openingResponse: openingResp.toFixed(1),
            followUpResponse: followUpResp.toFixed(1),
            qualToPain: qualToPain.toFixed(1),
            painToOffer: painToOffer.toFixed(1),
            offerToLink: offerToLink.toFixed(1),
            linkToAgenda: linkToAgenda.toFixed(1),
            funnelData
        };
    }, [formData]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />

            <div className="w-full max-w-4xl z-10 space-y-8">
                {/* Header */}
                <div className="text-center space-y-4 mb-2">
                    <p className="text-indigo-400 font-bold tracking-widest text-xs uppercase">NeurOPS High Performance</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Reporte Diario Setter
                    </h1>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                        <p className="text-slate-500 font-medium animate-pulse">Cargando módulos de reporte...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* PROGRESS BAR */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 sticky top-4 z-50">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Progreso del Reporte</span>
                                <span className="text-sm font-black text-indigo-400">{calculateProgress()}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${calculateProgress()}%` }}></div>
                            </div>
                        </div>


                        {/* 1. IDENTIFICACIÓN */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">¿Quién eres?</label>
                                <select
                                    required
                                    className="w-full px-6 py-4 bg-slate-800 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all font-bold cursor-pointer"
                                    value={formData.setter_id}
                                    onChange={e => setFormData({ ...formData, setter_id: e.target.value })}
                                >
                                    <option value="" disabled>Selecciona tu nombre</option>
                                    {setters.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha del Informe</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-6 py-4 bg-slate-800 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* 4 GRID BLOCKS */}
                        <div className="space-y-8">

                            {/* BLOCK 1: INBOX */}
                            <div className={`${isSectionComplete(['inbox_entrantes', 'not_lead', 'inbox_inabribles']) ? 'bg-slate-200 border-slate-300 shadow-md' : 'bg-slate-900 border-slate-800 shadow-xl'} border rounded-3xl p-6 border-t-4 border-t-pink-600 transition-colors duration-500`}>
                                <SectionHeader icon={Inbox} title="INBOX" colorClass="text-pink-500" isLightMode={isSectionComplete(['inbox_entrantes', 'not_lead', 'inbox_inabribles'])} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="grid grid-cols-2 gap-4">
                                        <MetricInput label="Entrantes" field="inbox_entrantes" color="pink" value={formData.inbox_entrantes} onChange={handleFieldChange} isLightMode={isSectionComplete(['inbox_entrantes', 'not_lead', 'inbox_inabribles'])} />
                                        <MetricInput label="No Lead" field="not_lead" color="pink" value={formData.not_lead} onChange={handleFieldChange} isLightMode={isSectionComplete(['inbox_entrantes', 'not_lead', 'inbox_inabribles'])} />
                                        <MetricInput label="In-abribles" field="inbox_inabribles" color="pink" value={formData.inbox_inabribles} onChange={handleFieldChange} isLightMode={isSectionComplete(['inbox_entrantes', 'not_lead', 'inbox_inabribles'])} />
                                    </div>
                                    <div className={`${isSectionComplete(['inbox_entrantes', 'not_lead', 'inbox_inabribles']) ? 'bg-white/60 text-slate-800' : 'bg-slate-800/30 text-white'} rounded-2xl p-6 flex flex-col justify-center transition-colors duration-500`}>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Leads (Auto)</p>
                                                <p className="text-3xl font-black text-pink-500">{formData.inbox_leads}</p>
                                            </div>
                                            <div className="text-center border-l border-slate-700/50 pl-4">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">% No Lead</p>
                                                <p className="text-3xl font-black">{liveMetrics.noLeadPct}%</p>
                                            </div>
                                            <div className="text-center border-l border-slate-700/50 pl-4">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">% Inabribles</p>
                                                <p className="text-3xl font-black">{liveMetrics.inabriblesPct}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* UNIFIED FUNNEL CONTAINER */}
                            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-10 shadow-2xl space-y-10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-500">
                                            <Filter size={32} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Embudo Unificado</h2>
                                            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest text-indigo-400">Leads • Seguimientos • Aperturas</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="px-6 py-3 bg-slate-950/50 rounded-2xl border border-slate-800 text-center flex-1 md:flex-none">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tasa Apertura</p>
                                            <p className="text-xl font-black text-fuchsia-500 italic">{liveMetrics.openingResponse}%</p>
                                        </div>
                                        <div className="px-6 py-3 bg-slate-950/50 rounded-2xl border border-slate-800 text-center flex-1 md:flex-none">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tasa Resp. FU</p>
                                            <p className="text-xl font-black text-rose-500 italic">{liveMetrics.followUpResponse}%</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto -mx-6 md:mx-0">
                                    <table className="w-full border-separate border-spacing-y-4 px-6 md:px-0">
                                        <thead>
                                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                                <th className="text-left pb-2 pl-4">Etapa</th>
                                                <th className="text-center pb-2">Leads Reales</th>
                                                <th className="text-center pb-2">Seguimientos (I / R)</th>
                                                <th className="text-center pb-2">Aperturas (I / R)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { label: 'Cualificación', id: 'qualification', hasOpening: true },
                                                { label: 'Dolor', id: 'pain', hasOpening: true },
                                                { label: 'Oferta', id: 'offer', hasOpening: false },
                                                { label: 'Link', id: 'link', hasOpening: false },
                                                { label: 'Agenda', id: 'agenda', hasOpening: false }
                                            ].map((stage) => (
                                                <tr key={stage.id} className="group">
                                                    {/* ETAPA */}
                                                    <td className="bg-slate-950/40 border border-slate-800/80 rounded-l-[1.5rem] p-5">
                                                        <span className="text-xs font-black text-white uppercase italic group-hover:text-indigo-400 transition-colors">{stage.label}</span>
                                                    </td>

                                                    {/* LEADS */}
                                                    <td className="bg-slate-950/40 border-y border-slate-800/80 p-5 px-6">
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-center font-black text-indigo-400 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-800"
                                                            value={formData[`funnel_${stage.id}`]}
                                                            onChange={e => handleFieldChange(`funnel_${stage.id}`, e.target.value)}
                                                        />
                                                    </td>

                                                    {/* SEGUIMIENTOS */}
                                                    <td className="bg-slate-950/40 border-y border-slate-800/80 p-5 px-6">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                placeholder="I"
                                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-center font-black text-rose-400 focus:border-rose-500 outline-none transition-all placeholder:text-slate-800"
                                                                value={formData[`${stage.id}_fu`]}
                                                                onChange={e => handleFieldChange(`${stage.id}_fu`, e.target.value)}
                                                            />
                                                            <span className="text-slate-700 font-bold">/</span>
                                                            <input
                                                                type="number"
                                                                placeholder="R"
                                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-center font-black text-rose-500 focus:border-rose-500 outline-none transition-all placeholder:text-slate-800"
                                                                value={formData[`${stage.id}_fur`]}
                                                                onChange={e => handleFieldChange(`${stage.id}_fur`, e.target.value)}
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* APERTURAS */}
                                                    <td className={`bg-slate-950/40 border border-l-0 border-slate-800/80 rounded-r-[1.5rem] p-5 px-6 ${!stage.hasOpening && 'bg-slate-950/10'}`}>
                                                        {stage.hasOpening ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    placeholder="I"
                                                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-center font-black text-fuchsia-400 focus:border-fuchsia-500 outline-none transition-all placeholder:text-slate-800"
                                                                    value={formData[`${stage.id}_opening_submitted`]}
                                                                    onChange={e => handleFieldChange(`${stage.id}_opening_submitted`, e.target.value)}
                                                                />
                                                                <span className="text-slate-700 font-bold">/</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="R"
                                                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-center font-black text-fuchsia-500 focus:border-fuchsia-500 outline-none transition-all placeholder:text-slate-800"
                                                                    value={formData[`${stage.id}_opening_responded`]}
                                                                    onChange={e => handleFieldChange(`${stage.id}_opening_responded`, e.target.value)}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="h-10 flex items-center justify-center">
                                                                <div className="w-8 h-[2px] bg-slate-800 rounded-full" />
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-6">
                                    <div className="bg-slate-950/30 rounded-3xl border border-slate-800 p-8 flex flex-col justify-center">
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 text-center bg-slate-900/50 py-2 rounded-lg">Crecimiento del Embudo</h3>
                                        <div className="grid grid-cols-4 gap-4 text-center">
                                            {[
                                                { label: 'Qual → Pain', val: liveMetrics.qualToPain },
                                                { label: 'Pain → Off', val: liveMetrics.painToOffer },
                                                { label: 'Off → Link', val: liveMetrics.offerToLink },
                                                { label: 'Link → Agnd', val: liveMetrics.linkToAgenda }
                                            ].map(m => (
                                                <div key={m.label} className="space-y-1">
                                                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-tighter truncate">{m.label}</p>
                                                    <p className="text-base font-black text-indigo-400 italic">{m.val}%</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-slate-950/30 rounded-3xl border border-slate-800 p-8 flex items-center justify-center min-h-[300px]">
                                        <FunnelChart data={liveMetrics.funnelData} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* QUALITATIVE DATA */}
                        <div className={`${isSectionComplete(questions.map(q => q.id.toString()), true) ? 'bg-slate-200 border-slate-300 shadow-md' : 'bg-slate-900 border-slate-800 shadow-xl'} border rounded-3xl p-6 md:p-8 border-t-4 border-t-teal-600 transition-colors duration-500`}>
                            <SectionHeader icon={ListChecks} title="Victorias y Feedback del Día" colorClass="text-teal-400" isLightMode={isSectionComplete(questions.map(q => q.id.toString()), true)} />
                            <div className="space-y-6">
                                {questions.map(q => {
                                    const ansVal = formData.answers.find(a => a.question_id === q.id)?.answer || '';
                                    const isFilled = ansVal.trim() !== '';
                                    const isLightMode = isSectionComplete(questions.map(qa => qa.id.toString()), true);
                                    return (
                                        <div key={q.id} className="space-y-2">
                                            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{q.text}</label>
                                            {q.type === 'long_text' ? (
                                                <textarea
                                                    className={`w-full px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium min-h-[100px] border
                                                        ${isLightMode
                                                            ? (isFilled ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-inner')
                                                            : (isFilled ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-800/50 border-slate-700/50 text-white')
                                                        }`}
                                                    value={ansVal}
                                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    className={`w-full px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all font-bold border
                                                        ${isLightMode
                                                            ? (isFilled ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-inner')
                                                            : (isFilled ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-800/50 border-slate-700/50 text-white')
                                                        }`}
                                                    value={ansVal}
                                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>


                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={submitting || !formData.setter_id}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-6 rounded-3xl font-black uppercase text-base tracking-[0.2em] transition-all shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                                {submitting ? 'Procesando Envío...' : 'ENVIAR REPORTE AL SISTEMA'}
                            </button>
                        </div>
                    </form>
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

export default PublicSetterReportPage;
