import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    Loader2, ArrowRightLeft, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import FunnelChart from '../../components/charts/FunnelChart';

const SetterComparisonView = ({ setters }) => {
    // Comparison States
    const [compA, setCompA] = useState({
        setter_id: '',
        start_date: '',
        end_date: '',
        data: null,
        loading: false,
        time_preset: 'last_7',
        custom_days: 7
    });

    const [compB, setCompB] = useState({
        setter_id: '',
        start_date: '',
        end_date: '',
        data: null,
        loading: false,
        time_preset: 'last_7',
        custom_days: 7
    });

    const calculateDates = (preset, customDays) => {
        const now = new Date();
        let start = '';
        let end = now.toISOString().split('T')[0];

        if (preset === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            start = yesterday.toISOString().split('T')[0];
            end = start;
        } else if (preset === 'last_days') {
            const d = new Date();
            d.setDate(now.getDate() - parseInt(customDays || 7));
            start = d.toISOString().split('T')[0];
        } else if (preset === 'all_time') {
            start = '';
            end = '';
        }
        return { start, end };
    };

    const updateCompPreset = (side, preset, customDays = null) => {
        const target = side === 'A' ? compA : compB;
        const setTarget = side === 'A' ? setCompA : setCompB;
        const days = customDays !== null ? customDays : target.custom_days;

        const { start, end } = calculateDates(preset, days);
        setTarget(prev => ({
            ...prev,
            time_preset: preset,
            custom_days: days,
            start_date: start,
            end_date: end
        }));
    };

    const fetchComparisonData = async (side) => {
        const target = side === 'A' ? compA : compB;
        const setTarget = side === 'A' ? setCompA : setCompB;

        setTarget(prev => ({ ...prev, loading: true }));
        try {
            const params = new URLSearchParams();
            if (target.setter_id) params.append('setter_id', target.setter_id);
            if (target.start_date) params.append('start_date', target.start_date);
            if (target.end_date) params.append('end_date', target.end_date);
            params.append('agg_type', 'sum'); // Comparison always uses sum for totals usually

            const res = await api.get(`/public/setter-stats?${params.toString()}`);
            setTarget(prev => ({ ...prev, data: res.data, loading: false }));
        } catch (err) {
            console.error(err);
            setTarget(prev => ({ ...prev, loading: false }));
        }
    };

    const getDisplayTitle = (side) => {
        const target = side === 'A' ? compA : compB;
        let setterName = "Todo el Equipo";
        if (target.setter_id) {
            const setter = setters.find(s => s.id === parseInt(target.setter_id));
            if (setter) setterName = setter.name;
        }

        let timeLabel = "";
        if (target.time_preset === 'yesterday') timeLabel = "Ayer";
        if (target.time_preset === 'last_days') timeLabel = `Últimos ${target.custom_days} días`;
        if (target.time_preset === 'last_7') timeLabel = "Últimos 7 días";
        if (target.time_preset === 'last_30') timeLabel = "Últimos 30 días";
        if (target.time_preset === 'all_time') timeLabel = "Todo el tiempo";
        if (target.time_preset === 'custom') timeLabel = "Periodo personalizado";

        return `${setterName} - ${timeLabel}`;
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* SELECTORES DE COMPARACIÓN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

                {/* LADO A */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-600/30">A</div>
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{getDisplayTitle('A')}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Setter</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all font-black"
                                value={compA.setter_id}
                                onChange={e => setCompA({ ...compA, setter_id: e.target.value })}
                            >
                                <option value="">Todo el Equipo</option>
                                {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all font-black"
                                value={compA.time_preset}
                                onChange={e => updateCompPreset('A', e.target.value)}
                            >
                                <option value="yesterday">Ayer</option>
                                <option value="last_days">Últimos X días</option>
                                <option value="last_7">Últimos 7 días</option>
                                <option value="last_30">Últimos 30 días</option>
                                <option value="all_time">Todo el tiempo</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>

                        {compA.time_preset === 'last_days' && (
                            <div className="space-y-1 col-span-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Número de Días</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white font-black outline-none focus:border-indigo-500"
                                    value={compA.custom_days}
                                    onChange={e => updateCompPreset('A', 'last_days', e.target.value)}
                                />
                            </div>
                        )}

                        {compA.time_preset === 'custom' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Desde</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white font-black outline-none focus:border-indigo-500"
                                        value={compA.start_date}
                                        onChange={e => setCompA({ ...compA, start_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white font-black outline-none focus:border-indigo-500"
                                        value={compA.end_date}
                                        onChange={e => setCompA({ ...compA, end_date: e.target.value })}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => fetchComparisonData('A')}
                        className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"
                    >
                        {compA.loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Cargar Datos A'}
                    </button>
                </div>

                {/* LADO B */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-fuchsia-600 flex items-center justify-center font-black text-white shadow-lg shadow-fuchsia-600/30">B</div>
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{getDisplayTitle('B')}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Setter</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-fuchsia-500 transition-all font-black"
                                value={compB.setter_id}
                                onChange={e => setCompB({ ...compB, setter_id: e.target.value })}
                            >
                                <option value="">Todo el Equipo</option>
                                {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-fuchsia-500 transition-all font-black"
                                value={compB.time_preset}
                                onChange={e => updateCompPreset('B', e.target.value)}
                            >
                                <option value="yesterday">Ayer</option>
                                <option value="last_days">Últimos X días</option>
                                <option value="last_7">Últimos 7 días</option>
                                <option value="last_30">Últimos 30 días</option>
                                <option value="all_time">Todo el tiempo</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>

                        {compB.time_preset === 'last_days' && (
                            <div className="space-y-1 col-span-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Número de Días</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white font-black outline-none focus:border-fuchsia-500"
                                    value={compB.custom_days}
                                    onChange={e => updateCompPreset('B', 'last_days', e.target.value)}
                                />
                            </div>
                        )}

                        {compB.time_preset === 'custom' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Desde</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white font-black outline-none focus:border-fuchsia-500"
                                        value={compB.start_date}
                                        onChange={e => setCompB({ ...compB, start_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white font-black outline-none focus:border-fuchsia-500"
                                        value={compB.end_date}
                                        onChange={e => setCompB({ ...compB, end_date: e.target.value })}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => fetchComparisonData('B')}
                        className="w-full py-3 bg-fuchsia-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-fuchsia-600/20 hover:bg-fuchsia-700"
                    >
                        {compB.loading ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Cargar Datos B'}
                    </button>
                </div>
            </div>

            {/* RESULTADOS COMPARATIVOS */}
            {compA.data && compB.data ? (
                <div className="grid grid-cols-1 gap-8 animate-in slide-in-from-bottom duration-700">

                    {/* TABLE COMPARISON */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-950/50">
                                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Métrica Analizada</th>
                                    <th className="p-6 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] text-center">Valor A</th>
                                    <th className="p-6 text-[10px] font-black text-fuchsia-400 uppercase tracking-[0.2em] text-center">Valor B</th>
                                    <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {[
                                    { label: 'Entrantes', key: 'entrantes', category: 'totals' },
                                    { label: 'Leads Clasificados', key: 'leads', category: 'totals' },
                                    { label: 'No Leads', key: 'not_lead', category: 'totals' },
                                    { label: 'In-abribles', key: 'inabribles', category: 'totals' },
                                    { label: 'Agendas Finales', key: 'funnel_agenda', category: 'totals' },
                                    { label: 'Tasa Apertura', key: 'opening_rate', category: 'percentages.rates', isPct: true },
                                    { label: 'Tasa Respuesta Op.', key: 'opening_response', category: 'percentages.rates', isPct: true },
                                    { label: 'Tasa Respuesta FU Link', key: 'link_fur', category: 'percentages.rates', isPct: true },
                                    { label: 'Conv. Link a Agenda', key: 'link_to_agenda', category: 'percentages.conversions_to_agenda', isPct: true },
                                    { label: 'Conv. Oferta a Agenda', key: 'offer_to_agenda', category: 'percentages.conversions_to_agenda', isPct: true },
                                    { label: 'Conv. Apertura a Agenda', key: 'opening_to_agenda', category: 'percentages.conversions_to_agenda', isPct: true },
                                    { label: 'Evol. Qual → Pain', key: 'qual_to_pain', category: 'percentages.funnel_evolution', isPct: true },
                                    { label: 'Evol. Pain → Offer', key: 'pain_to_offer', category: 'percentages.funnel_evolution', isPct: true },
                                    { label: 'Evol. Offer → Link', key: 'offer_to_link', category: 'percentages.funnel_evolution', isPct: true },
                                    {label: 'Evol. Link → Agenda', key: 'link_to_agenda', category: 'percentages.funnel_evolution', isPct: true },
                                    { label: 'Eficacia Q1 (%)', key: 'q1_useful', category: 'percentages.questions', isPct: true },
                                    { label: 'Total Q1', key: 'q1_total', category: 'percentages.questions' },
                                    { label: 'Eficacia Q2 (%)', key: 'q2_useful', category: 'percentages.questions', isPct: true },
                                    { label: 'Total Q2', key: 'q2_total', category: 'percentages.questions' },
                                ].map((row, idx) => {
                                    const valA = row.category.split('.').reduce((obj, key) => obj[key], compA.data)[row.key];
                                    const valB = row.category.split('.').reduce((obj, key) => obj[key], compB.data)[row.key];
                                    const diff = valB - valA;
                                    const isBetter = diff >= 0;

                                    return (
                                        <tr key={idx} className="hover:bg-indigo-500/5 transition-colors">
                                            <td className="p-6 font-bold text-slate-300">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-sm" />
                                                    <span className="text-xs uppercase font-black tracking-wider">{row.label}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-center font-black text-white text-lg italic tabular-nums">
                                                {valA}{row.isPct ? '%' : ''}
                                            </td>
                                            <td className="p-6 text-center font-black text-white text-lg italic tabular-nums">
                                                {valB}{row.isPct ? '%' : ''}
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center justify-center gap-1">
                                                    {isBetter ? <ArrowUpRight size={14} className="text-emerald-500" /> : <ArrowDownRight size={14} className="text-rose-500" />}
                                                    <span className={`font-black text-sm tabular-nums ${isBetter ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {Math.abs(diff).toFixed(row.isPct ? 2 : 0)}{row.isPct ? '%' : ''}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* COMPARATIVE FUNNELS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
                            <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-8 text-center italic">Embudo A - Proceso</h4>
                            <FunnelChart data={[
                                { name: 'Qual', value: compA.data.totals.funnel_qualification, fill: '#6366f1' },
                                { name: 'Pain', value: compA.data.totals.funnel_pain, fill: '#818cf8' },
                                { name: 'Offer', value: compA.data.totals.funnel_offer, fill: '#a5b4fc' },
                                { name: 'Link', value: compA.data.totals.funnel_link, fill: '#c7d2fe' },
                                { name: 'Agenda', value: compA.data.totals.funnel_agenda, fill: '#4f46e5' }
                            ]} />
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
                            <h4 className="text-sm font-black text-fuchsia-400 uppercase tracking-widest mb-8 text-center italic">Embudo B - Proceso</h4>
                            <FunnelChart data={[
                                { name: 'Qual', value: compB.data.totals.funnel_qualification, fill: '#be185d' },
                                { name: 'Pain', value: compB.data.totals.funnel_pain, fill: '#db2777' },
                                { name: 'Offer', value: compB.data.totals.funnel_offer, fill: '#f472b6' },
                                { name: 'Link', value: compB.data.totals.funnel_link, fill: '#fbcfe8' },
                                { name: 'Agenda', value: compB.data.totals.funnel_agenda, fill: '#9d174d' }
                            ]} />
                        </div>
                    </div>

                </div>
            ) : (
                <div className="py-32 flex flex-col items-center justify-center bg-slate-900/50 border border-dashed border-slate-800 rounded-[3rem] opacity-50">
                    <ArrowRightLeft size={48} className="text-slate-700 mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs italic">Carga dos periodos para comparar rendimiento side-by-side</p>
                </div>
            )}
        </div>
    );
};

export default SetterComparisonView;
