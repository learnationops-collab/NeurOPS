import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Send, Calendar, ListChecks, User, ArrowLeft, Inbox, MessageSquare, Filter, RefreshCw, HelpCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import FunnelChart from '../../components/charts/FunnelChart';
import DailyReflectionSection from '../../components/reports/DailyReflectionSection';
const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false }) => {
    const isFilled = value > 0 || value !== '';
    const colorClasses = {
        indigo: "text-indigo-400 focus:ring-indigo-500",
        pink: "text-rose-400 focus:ring-rose-500",
        fuchsia: "text-fuchsia-400 focus:ring-fuchsia-500",
        teal: "text-teal-400 focus:ring-teal-500"
    };

    return (
        <div className="space-y-1.5 flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">{label}</label>
            <input
                type="number"
                required
                readOnly={readOnly}
                className={`w-full px-4 py-3.5 rounded-[1.25rem] outline-none border transition-all font-black text-lg
                    ${readOnly ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 
                      isFilled ? 'bg-slate-800 border-slate-700 text-white shadow-sm' : 'bg-slate-900/50 border-slate-800 text-white shadow-inner'}
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
        <div className={`p-3.5 bg-slate-900 shadow-xl border border-slate-800 rounded-2xl`}>
            <Icon className={colorClass} size={22} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white uppercase italic leading-none">{title}</h2>
    </div>
);

const PublicSetterReportPage = () => {
    const [setters, setSetters] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [loadingPrefill, setLoadingPrefill] = useState(false);
    const [prefilledMessage, setPrefilledMessage] = useState('');

    const [formData, setFormData] = useState({
        setter_id: '',
        date: '',

        // INBOX
        inbox_entrantes: '',
        not_lead: '',
        inbox_inabribles: '',
        inbox_leads: '',

        // FUNNEL
        funnel_qualification: '',
        funnel_pain: '',
        funnel_offer: '',
        funnel_link: '',
        funnel_agenda: '',

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
        offer_opening_submitted: '',
        offer_opening_responded: '',
        link_opening_submitted: '',
        link_opening_responded: '',
        answers: [],
        reflections: {},
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

    // Auto-prefill data when setter and date are chosen
    useEffect(() => {
        const prefillData = async () => {
            if (!formData.setter_id || !formData.date) return;
            
            setLoadingPrefill(true);
            setPrefilledMessage('');
            try {
                const res = await api.get(`/public/setter-report/prefill?setter_id=${formData.setter_id}&date=${formData.date}`);
                
                setFormData(prev => ({
                    ...prev,
                    inbox_entrantes: res.data.inbox_entrantes !== undefined ? res.data.inbox_entrantes : '',
                    not_lead: res.data.not_lead !== undefined ? res.data.not_lead : '',
                    funnel_qualification: res.data.funnel_qualification !== undefined ? res.data.funnel_qualification : '',
                    funnel_agenda: res.data.funnel_agenda !== undefined ? res.data.funnel_agenda : ''
                }));
                setPrefilledMessage('Métricas del día autocompletadas correctamente desde el sistema.');
            } catch (err) {
                console.error("Error al prefill de reporte de setter:", err);
            } finally {
                setLoadingPrefill(false);
            }
        };
        
        prefillData();
    }, [formData.setter_id, formData.date]);

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

        if (!formData.date) {
            alert("Por favor, selecciona la fecha del informe.");
            return;
        }

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
                funnel_qualification: '',
                funnel_pain: '',
                funnel_offer: '',
                funnel_link: '',
                funnel_agenda: '',
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
                offer_opening_submitted: '',
                offer_opening_responded: '',
                link_opening_submitted: '',
                link_opening_responded: '',
                answers: [],
                reflections: {}
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
            'offer_opening_submitted', 'offer_opening_responded',
            'link_opening_submitted', 'link_opening_responded'
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

        const qualRate = ie > 0 ? ((fq - nl) / ie) * 100 : 0;

        return {
            noLeadPct: noLeadPct.toFixed(1),
            inabriblesPct: inabriblesPct.toFixed(1),
            openingResponse: openingResp.toFixed(1),
            qualRate: qualRate.toFixed(1),
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
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col p-4 md:p-8 lg:p-12 relative overflow-hidden font-sans">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-900/20 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-teal-900/10 blur-[100px] rounded-full" />

            <div className="w-full max-w-[98%] mx-auto z-10 space-y-10">
                {/* Dashboard Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-6 flex flex-col">
                        <Link to="/setter/statistics" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-full border border-slate-800 w-max self-start shadow-xl">
                            <ArrowLeft size={16} />
                            <span className="font-black uppercase tracking-widest text-[10px]">Volver a Mis Estadísticas</span>
                        </Link>
                        <div className="space-y-1">
                            <p className="text-teal-400 font-black tracking-[0.2em] text-[10px] uppercase ml-1">NeurOPS High Performance</p>
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight flex items-center gap-3">
                                Setter Dashboard <span className="text-slate-700 font-light">/</span> <span className="text-indigo-500 italic">Report</span>
                            </h1>
                            <p className="text-slate-400 font-medium text-lg">Welcome back, <span className="text-slate-200 font-bold">{activeSetterName}</span> 👋</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-[2rem] shadow-2xl">
                        <div className="flex items-center gap-3 px-4 border-r border-slate-800">
                            <Calendar className="text-indigo-400" size={20} />
                            <input
                                type="date"
                                required
                                className="bg-transparent border-none outline-none font-bold text-slate-200 cursor-pointer"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="px-4">
                            <select
                                className="bg-transparent border-none outline-none font-bold text-slate-200 cursor-pointer appearance-none"
                                value={formData.setter_id}
                                onChange={e => setFormData({ ...formData, setter_id: e.target.value })}
                            >
                                <option value="" disabled className="bg-slate-900 text-slate-400">Seleccionar Perfil</option>
                                {setters.map(s => (
                                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
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
                        {loadingPrefill && (
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-3 text-indigo-400 animate-pulse">
                                <Loader2 size={18} className="animate-spin shrink-0" />
                                <span className="text-xs font-black uppercase tracking-widest">Autocompletando métricas desde el sistema...</span>
                            </div>
                        )}
                        {prefilledMessage && !loadingPrefill && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 animate-in fade-in slide-in-from-top-2 duration-300">
                                <CheckCircle2 size={18} className="shrink-0" />
                                <span className="text-xs font-black uppercase tracking-widest">{prefilledMessage}</span>
                            </div>
                        )}
                        {/* HIGH LEVEL METRICS ROW */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Entrantes', value: formData.inbox_entrantes || '0', icon: Inbox, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                                { label: 'Agendas', value: formData.funnel_agenda || '0', icon: Calendar, color: 'text-teal-400', bg: 'bg-teal-500/10' },
                                { label: 'Tasa Cualificación', value: `${liveMetrics.qualRate}%`, icon: MessageSquare, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
                                { label: 'Tasa Respuesta FU', value: `${liveMetrics.followUpResponse}%`, icon: RefreshCw, color: 'text-indigo-400', bg: 'bg-indigo-500/10' }
                            ].map((card, i) => (
                                <div key={i} className="bg-slate-900/80 backdrop-blur-lg border border-slate-800 p-6 rounded-[2.5rem] shadow-xl hover:border-slate-700 transition-all group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-2.5 ${card.bg} rounded-2xl group-hover:scale-110 transition-transform`}>
                                            <card.icon className={card.color} size={20} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black text-white tracking-tight">{card.value}</p>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{card.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* MAIN DASHBOARD CONTENT GRID */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            
                            {/* LEFT COLUMN: UNIFIED FUNNEL (The "Standings" equivalent) */}
                            <div className="lg:col-span-8 space-y-10">
                                {/* INBOX REFINEMENT */}
                                <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
                                    <SectionHeader icon={Inbox} title="Inbox Analysis" colorClass="text-rose-400" />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                        <MetricInput label="Entrantes" field="inbox_entrantes" color="pink" value={formData.inbox_entrantes} onChange={handleFieldChange} />
                                        <MetricInput label="No Lead" field="not_lead" color="pink" value={formData.not_lead} onChange={handleFieldChange} />
                                        <MetricInput label="In-abribles" field="inbox_inabribles" color="pink" value={formData.inbox_inabribles} onChange={handleFieldChange} />
                                    </div>
                                    
                                    <div className="mt-8 pt-8 border-t border-slate-800 flex items-center justify-between">
                                        <div className="flex gap-8">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Leads Netos</p>
                                                <p className="text-2xl font-black text-rose-400 italic">{formData.inbox_leads}</p>
                                            </div>
                                            <div className="border-l border-slate-800 pl-8">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">% Lead Ratio</p>
                                                <p className="text-2xl font-black text-slate-200 italic">{100 - liveMetrics.noLeadPct}%</p>
                                            </div>
                                        </div>
                                        <div className="h-2 w-32 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500" style={{ width: `${100 - liveMetrics.noLeadPct}%` }} />
                                        </div>
                                    </div>
                                </div>

                                {/* UNIFIED FUNNEL TABLE */}
                                <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
                                    <SectionHeader icon={Filter} title="Unified Funnel Standings" colorClass="text-indigo-400" />
                                    
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-separate border-spacing-y-2">
                                            <thead>
                                                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
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
                                                    { label: 'Oferta', id: 'offer', hasOpening: true },
                                                    { label: 'Link', id: 'link', hasOpening: true },
                                                    { label: 'Agenda', id: 'agenda', hasOpening: false }
                                                ].map((stage, idx) => (
                                                    <tr key={stage.id} className="group hover:bg-slate-800/30 transition-colors rounded-2xl">
                                                        <td className="p-4 bg-slate-800/20 rounded-l-2xl border-y border-l border-slate-800">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px] font-black font-mono">{idx + 1}</span>
                                                                <span className="text-sm font-black text-slate-200 uppercase italic">{stage.label}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 border-y border-slate-800 text-center">
                                                            <input
                                                                type="number"
                                                                className="w-16 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-center font-black text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                                                value={formData[`funnel_${stage.id}`]}
                                                                onChange={e => handleFieldChange(`funnel_${stage.id}`, e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="p-4 border-y border-slate-800 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    className="w-14 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-center font-black text-rose-400 outline-none shadow-sm"
                                                                    value={formData[`${stage.id}_fu`]}
                                                                    onChange={e => handleFieldChange(`${stage.id}_fu`, e.target.value)}
                                                                    placeholder="I"
                                                                />
                                                                <span className="text-slate-700">/</span>
                                                                <input
                                                                    type="number"
                                                                    className="w-14 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-center font-black text-rose-500 outline-none shadow-sm"
                                                                    value={formData[`${stage.id}_fur`]}
                                                                    onChange={e => handleFieldChange(`${stage.id}_fur`, e.target.value)}
                                                                    placeholder="R"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-4 border-y border-r border-slate-800 rounded-r-2xl text-center">
                                                            {stage.hasOpening ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <input
                                                                        type="number"
                                                                        className="w-14 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-center font-black text-fuchsia-400 outline-none shadow-sm"
                                                                        value={formData[`${stage.id}_opening_submitted`]}
                                                                        onChange={e => handleFieldChange(`${stage.id}_opening_submitted`, e.target.value)}
                                                                        placeholder="I"
                                                                    />
                                                                    <span className="text-slate-700">/</span>
                                                                    <input
                                                                        type="number"
                                                                        className="w-14 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-center font-black text-fuchsia-500 outline-none shadow-sm"
                                                                        value={formData[`${stage.id}_opening_responded`]}
                                                                        onChange={e => handleFieldChange(`${stage.id}_opening_responded`, e.target.value)}
                                                                        placeholder="R"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-800 font-black">—</span>
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
                                <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center justify-center">
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2 w-full text-center">Conversion Graphics</h3>
                                    <div className="w-full flex flex-col items-center justify-center min-h-[400px]">
                                        <FunnelChart data={liveMetrics.funnelData} />
                                    </div>
                                    <div className="mt-6 grid grid-cols-2 gap-4 w-full">
                                        <div className="bg-slate-800/50 p-4 rounded-3xl text-center border border-slate-700">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-1">Qual to Pain</p>
                                            <p className="text-xl font-black text-indigo-400">{liveMetrics.qualToPain}%</p>
                                        </div>
                                        <div className="bg-slate-800/50 p-4 rounded-3xl text-center border border-slate-700">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-1">Link to Agnd</p>
                                            <p className="text-xl font-black text-teal-400">{liveMetrics.linkToAgenda}%</p>
                                        </div>
                                    </div>
                                </div>

                                {/* DON'T FORGET PANEL */}
                                <div className="bg-indigo-600 text-white rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-600/20 relative overflow-hidden group">
                                    <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-700" />
                                    <h4 className="text-2xl font-black italic uppercase leading-tight mb-2">Setup report<br />for next day</h4>
                                    <p className="text-indigo-100 text-xs font-medium mb-6">Completing your data helps us scale your results faster.</p>
                                    <div className="bg-white/20 backdrop-blur-md rounded-full py-3 px-6 text-center font-black text-[10px] uppercase tracking-widest border border-white/20">
                                        Performance Focused
                                    </div>
                                </div>

                                {/* SUBMIT PROGRESS CARD */}
                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1 italic">Submit Status</p>
                                            <p className="text-4xl font-black text-white">{calculateProgress()}%</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                            <Send className="text-indigo-400" size={20} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-8">
                                        <div className="h-full bg-indigo-500 transition-all duration-700 shadow-[0_0_12px_rgba(79,70,229,0.4)]" style={{ width: `${calculateProgress()}%` }} />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting || !formData.setter_id}
                                        className="w-full bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-900 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                    >
                                        {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                                        {submitting ? 'Sending Data...' : 'Submit Report'}
                                    </button>
                                </div>
                            </div>
                        </div>


                        {/* BOTTOM SECTION: QUALITATIVE FEEDBACK (DAILY REFLECTION) */}
                        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl border-t-8 border-t-teal-600">
                            <DailyReflectionSection
                                role="setter"
                                values={formData.reflections}
                                onChange={(key, val) => setFormData(prev => ({
                                    ...prev,
                                    reflections: { ...prev.reflections, [key]: val }
                                }))}
                            />
                        </div>

                    </form>
                )}

                <footer className="flex flex-col md:flex-row justify-between items-center py-10 text-slate-500 font-medium text-xs gap-4 border-t border-slate-800">
                    <div className="flex items-center gap-6">
                        <Link to="/login" className="hover:text-indigo-400 transition-colors uppercase tracking-[0.1em] font-black">Admin Access</Link>
                        <span className="text-slate-800">|</span>
                        <p>© 2026 NeurOPS PERFORMANCE SYSTEM</p>
                    </div>
                    <div className="flex items-center gap-2 italic uppercase font-black text-slate-700">
                        Design Focused • Scalable Results
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PublicSetterReportPage;
