import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Send, Calendar, ListChecks, User, ArrowLeft, Inbox, MessageSquare, Filter, RefreshCw, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import FunnelChart from '../../components/charts/FunnelChart';
const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false }) => {
    const isFilled = value > 0 || value !== '';
    const colorClasses = {
        indigo: "text-indigo-600 focus:ring-indigo-500",
        pink: "text-rose-500 focus:ring-rose-500",
        fuchsia: "text-fuchsia-600 focus:ring-fuchsia-500",
        teal: "text-teal-600 focus:ring-teal-500"
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
        q1_useful: '',
        q1_unuseful: '',
        q2_useful: '',
        q2_unuseful: '',
        answers: [],
        frequent_questions: [{ number: '', is_good: false }]
    });

    // Auto-calculate Leads
    useEffect(() => {
        const cualificadosNum = parseInt(formData.funnel_qualification) || 0;
        const noLeadNum = parseInt(formData.not_lead) || 0;
        const calculatedLeads = Math.max(0, cualificadosNum - noLeadNum);
        if (formData.inbox_leads !== calculatedLeads && (formData.funnel_qualification !== '' || formData.not_lead !== '')) {
            setFormData(prev => ({ ...prev, inbox_leads: calculatedLeads }));
        }
    }, [formData.funnel_qualification, formData.not_lead]);

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
                q1_useful: '',
                q1_unuseful: '',
                q2_useful: '',
                q2_unuseful: '',
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
            'pain_opening_submitted', 'pain_opening_responded',
            'q1_useful', 'q1_unuseful', 'q2_useful', 'q2_unuseful'
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

    const activeSetterName = setters.find(s => s.id.toString() === formData.setter_id.toString())?.name || 'Setter';

    return (
        <div className="min-h-screen bg-[#f0f4f8] text-slate-900 flex flex-col p-4 md:p-8 lg:p-12 relative overflow-hidden font-sans">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-200/30 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-teal-100/40 blur-[100px] rounded-full" />

            <div className="w-full max-w-6xl mx-auto z-10 space-y-10">
                {/* Dashboard Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-6 flex flex-col">
                        <Link to="/setter/statistics" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-500 transition-colors bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full border border-indigo-100 w-max self-start shadow-sm">
                            <ArrowLeft size={16} />
                            <span className="font-black uppercase tracking-widest text-[10px]">Volver a Mis Estadísticas</span>
                        </Link>
                        <div className="space-y-1">
                            <p className="text-teal-600 font-black tracking-[0.2em] text-[10px] uppercase ml-1">NeurOPS High Performance</p>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                Setter Dashboard <span className="text-slate-300 font-light">/</span> <span className="text-indigo-600 italic">Report</span>
                            </h1>
                            <p className="text-slate-500 font-medium text-lg">Welcome back, <span className="text-slate-800 font-bold">{activeSetterName}</span> 👋</p>
                        </div>
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
                        <div className="px-4">
                            <select
                                className="bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer appearance-none"
                                value={formData.setter_id}
                                onChange={e => setFormData({ ...formData, setter_id: e.target.value })}
                            >
                                <option value="" disabled>Seleccionar Perfil</option>
                                {setters.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 className="animate-spin text-indigo-600" size={56} strokeWidth={1.5} />
                        <p className="text-slate-400 font-bold tracking-widest uppercase text-xs animate-pulse">Initializing Interface...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-10">
                        {/* HIGH LEVEL METRICS ROW */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Entrantes', value: formData.inbox_entrantes || '0', icon: Inbox, color: 'text-rose-500', bg: 'bg-rose-50' },
                                { label: 'Agendas', value: formData.funnel_agenda || '0', icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-50' },
                                { label: 'Tasa Apertura', value: `${liveMetrics.openingResponse}%`, icon: MessageSquare, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
                                { label: 'Tasa Respuesta FU', value: `${liveMetrics.followUpResponse}%`, icon: RefreshCw, color: 'text-indigo-600', bg: 'bg-indigo-50' }
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

                        {/* MAIN DASHBOARD CONTENT GRID */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            
                            {/* LEFT COLUMN: UNIFIED FUNNEL (The "Standings" equivalent) */}
                            <div className="lg:col-span-8 space-y-10">
                                {/* INBOX REFINEMENT */}
                                <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 shadow-sm">
                                    <SectionHeader icon={Inbox} title="Inbox Analysis" colorClass="text-rose-500" />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                        <MetricInput label="Entrantes" field="inbox_entrantes" color="pink" value={formData.inbox_entrantes} onChange={handleFieldChange} />
                                        <MetricInput label="No Lead" field="not_lead" color="pink" value={formData.not_lead} onChange={handleFieldChange} />
                                        <MetricInput label="In-abribles" field="inbox_inabribles" color="pink" value={formData.inbox_inabribles} onChange={handleFieldChange} />
                                    </div>
                                    
                                    <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex gap-8">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Leads Netos</p>
                                                <p className="text-2xl font-black text-rose-500 italic">{formData.inbox_leads}</p>
                                            </div>
                                            <div className="border-l border-slate-200 pl-8">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">% Lead Ratio</p>
                                                <p className="text-2xl font-black text-slate-800 italic">{100 - liveMetrics.noLeadPct}%</p>
                                            </div>
                                        </div>
                                        <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500" style={{ width: `${100 - liveMetrics.noLeadPct}%` }} />
                                        </div>
                                    </div>
                                </div>

                                {/* UNIFIED FUNNEL TABLE */}
                                <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 shadow-sm overflow-hidden">
                                    <SectionHeader icon={Filter} title="Unified Funnel Standings" colorClass="text-indigo-600" />
                                    
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-separate border-spacing-y-2">
                                            <thead>
                                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                                                    <th className="text-left pb-4 pl-4 w-[25%]">Stage</th>
                                                    <th className="text-center pb-4">Leads</th>
                                                    <th className="text-center pb-4">FU (I/R)</th>
                                                    <th className="text-center pb-4">Open (I/R)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { label: 'Cualificación', id: 'qualification', hasOpening: true },
                                                    { label: 'Dolor', id: 'pain', hasOpening: true },
                                                    { label: 'Oferta', id: 'offer', hasOpening: false },
                                                    { label: 'Link', id: 'link', hasOpening: false },
                                                    { label: 'Agenda', id: 'agenda', hasOpening: false }
                                                ].map((stage, idx) => (
                                                    <tr key={stage.id} className="group hover:bg-white/50 transition-colors rounded-2xl">
                                                        <td className="p-4 bg-slate-50/50 rounded-l-2xl border-y border-l border-slate-100">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black font-mono">{idx + 1}</span>
                                                                <span className="text-sm font-black text-slate-800 uppercase italic">{stage.label}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 border-y border-slate-100 text-center">
                                                            <input
                                                                type="number"
                                                                className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                                                value={formData[`funnel_${stage.id}`]}
                                                                onChange={e => handleFieldChange(`funnel_${stage.id}`, e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="p-4 border-y border-slate-100 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    className="w-14 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center font-black text-rose-500 outline-none shadow-sm"
                                                                    value={formData[`${stage.id}_fu`]}
                                                                    onChange={e => handleFieldChange(`${stage.id}_fu`, e.target.value)}
                                                                    placeholder="I"
                                                                />
                                                                <span className="text-slate-300">/</span>
                                                                <input
                                                                    type="number"
                                                                    className="w-14 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center font-black text-rose-600 outline-none shadow-sm"
                                                                    value={formData[`${stage.id}_fur`]}
                                                                    onChange={e => handleFieldChange(`${stage.id}_fur`, e.target.value)}
                                                                    placeholder="R"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-4 border-y border-r border-slate-100 rounded-r-2xl text-center">
                                                            {stage.hasOpening ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <input
                                                                        type="number"
                                                                        className="w-14 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center font-black text-fuchsia-500 outline-none shadow-sm"
                                                                        value={formData[`${stage.id}_opening_submitted`]}
                                                                        onChange={e => handleFieldChange(`${stage.id}_opening_submitted`, e.target.value)}
                                                                        placeholder="I"
                                                                    />
                                                                    <span className="text-slate-300">/</span>
                                                                    <input
                                                                        type="number"
                                                                        className="w-14 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center font-black text-fuchsia-600 outline-none shadow-sm"
                                                                        value={formData[`${stage.id}_opening_responded`]}
                                                                        onChange={e => handleFieldChange(`${stage.id}_opening_responded`, e.target.value)}
                                                                        placeholder="R"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-200 font-black">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: VISUALS & QUALITATIVE */}
                            <div className="lg:col-span-4 space-y-10">
                                {/* FUNNEL CHART PREVIEW */}
                                <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 shadow-sm flex flex-col items-center justify-center">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2 w-full text-center">Conversion Graphics</h3>
                                    <div className="w-full aspect-square max-h-[300px]">
                                        <FunnelChart data={liveMetrics.funnelData} />
                                    </div>
                                    <div className="mt-6 grid grid-cols-2 gap-4 w-full">
                                        <div className="bg-slate-50/80 p-4 rounded-3xl text-center border border-slate-100">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Qual to Pain</p>
                                            <p className="text-xl font-black text-indigo-600">{liveMetrics.qualToPain}%</p>
                                        </div>
                                        <div className="bg-slate-50/80 p-4 rounded-3xl text-center border border-slate-100">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Link to Agnd</p>
                                            <p className="text-xl font-black text-teal-600">{liveMetrics.linkToAgenda}%</p>
                                        </div>
                                    </div>
                                </div>

                                {/* DON'T FORGET PANEL */}
                                <div className="bg-teal-600 text-white rounded-[2.5rem] p-8 shadow-lg shadow-teal-600/20 relative overflow-hidden group">
                                    <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-700" />
                                    <h4 className="text-2xl font-black italic uppercase leading-tight mb-2">Setup report<br />for next day</h4>
                                    <p className="text-teal-100 text-xs font-medium mb-6">Completing your data helps us scale your results faster.</p>
                                    <div className="bg-white/20 backdrop-blur-md rounded-full py-3 px-6 text-center font-black text-[10px] uppercase tracking-widest border border-white/20">
                                        Performance Focused
                                    </div>
                                </div>

                                {/* SUBMIT PROGRESS CARD */}
                                <div className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 shadow-sm">
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1 italic">Submit Status</p>
                                            <p className="text-4xl font-black text-slate-900">{calculateProgress()}%</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                            <Send className="text-indigo-600" size={20} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-8">
                                        <div className="h-full bg-indigo-600 transition-all duration-700 shadow-[0_0_12px_rgba(79,70,229,0.4)]" style={{ width: `${calculateProgress()}%` }} />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting || !formData.setter_id}
                                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                    >
                                        {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                                        {submitting ? 'Sending Data...' : 'Submit Report'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* EFICACIA DE PREGUNTAS (REESTRUCTURADO) */}
                        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 md:p-12 shadow-sm border-t-8 border-t-amber-500">
                            <SectionHeader icon={HelpCircle} title="Eficacia de Preguntas" colorClass="text-amber-500" />
                            <div className="overflow-x-auto">
                                <table className="w-full border-separate border-spacing-y-4">
                                    <thead>
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                                            <th className="text-left pl-6 pb-2">Pregunta</th>
                                            <th className="text-center pb-2">Respuestas Servibles</th>
                                            <th className="text-center pb-2">Respuestas Inservibles</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { label: 'Pregunta 1', keyU: 'q1_useful', keyI: 'q1_unuseful' },
                                            { label: 'Pregunta 2', keyU: 'q2_useful', keyI: 'q2_unuseful' }
                                        ].map((q) => (
                                            <tr key={q.label} className="bg-amber-50/50 rounded-3xl overflow-hidden">
                                                <td className="p-6 rounded-l-3xl border-y border-l border-amber-100">
                                                    <span className="text-sm font-black text-slate-800 uppercase italic">{q.label}</span>
                                                </td>
                                                <td className="p-6 border-y border-amber-100 text-center">
                                                    <input
                                                        type="number"
                                                        className="w-24 bg-white border border-amber-200 rounded-xl px-4 py-3 text-center font-black text-amber-600 outline-none focus:ring-4 focus:ring-amber-500/10 shadow-sm text-lg"
                                                        value={formData[q.keyU]}
                                                        onChange={e => handleFieldChange(q.keyU, e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="p-6 border-y border-r border-amber-100 rounded-r-3xl text-center">
                                                    <input
                                                        type="number"
                                                        className="w-24 bg-white border border-amber-200 rounded-xl px-4 py-3 text-center font-black text-slate-500 outline-none focus:ring-4 focus:ring-amber-500/10 shadow-sm text-lg"
                                                        value={formData[q.keyI]}
                                                        onChange={e => handleFieldChange(q.keyI, e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* BOTTOM SECTION: QUALITATIVE FEEDBACK */}
                        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 md:p-12 shadow-sm border-t-8 border-t-teal-600">
                            <SectionHeader icon={ListChecks} title="Victorias y Feedback del Día" colorClass="text-teal-600" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {questions.map(q => {
                                    const ansVal = formData.answers.find(a => a.question_id === q.id)?.answer || '';
                                    const isFilled = ansVal.trim() !== '';
                                    return (
                                        <div key={q.id} className="space-y-3 group">
                                            <label className={`text-[11px] font-black uppercase tracking-widest ml-1 transition-colors ${isFilled ? 'text-teal-600' : 'text-slate-400'}`}>
                                                {q.text}
                                            </label>
                                            {q.type === 'long_text' ? (
                                                <textarea
                                                    className={`w-full px-6 py-5 rounded-[1.75rem] outline-none transition-all font-medium min-h-[140px] border leading-relaxed
                                                        ${isFilled ? 'bg-white border-teal-100 text-slate-800 shadow-sm' : 'bg-slate-50/50 border-slate-200/60 text-slate-500 shadow-inner'}
                                                        focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5
                                                    `}
                                                    value={ansVal}
                                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                    placeholder="Escribe aquí tu respuesta..."
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    className={`w-full px-6 py-5 rounded-[1.75rem] outline-none transition-all font-bold border
                                                        ${isFilled ? 'bg-white border-teal-100 text-slate-800 shadow-sm' : 'bg-slate-50/50 border-slate-200/60 text-slate-500 shadow-inner'}
                                                        focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5
                                                    `}
                                                    value={ansVal}
                                                    onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                    placeholder="Respuesta corta..."
                                                />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </form>
                )}

                <footer className="flex flex-col md:flex-row justify-between items-center py-10 text-slate-400 font-medium text-xs gap-4 border-t border-slate-200/60">
                    <div className="flex items-center gap-6">
                        <Link to="/login" className="hover:text-indigo-600 transition-colors uppercase tracking-[0.1em] font-black">Admin Access</Link>
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

export default PublicSetterReportPage;
