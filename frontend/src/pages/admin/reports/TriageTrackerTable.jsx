import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
    Search, Trash2, Edit3, Loader2, ChevronLeft, ChevronRight, X, Save
} from 'lucide-react';

export default function TriageTrackerTable() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [filters, setFilters] = useState({
        triage_name: '',
        start_date: '',
        end_date: '',
        time_preset: 'last_days',
        custom_days: 7 // Default recent days
    });

    useEffect(() => {
        if (filters.time_preset === 'custom') return;

        const now = new Date();
        let start = '';
        let end = now.toISOString().split('T')[0];

        if (filters.time_preset === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            start = yesterday.toISOString().split('T')[0];
            end = start;
        } else if (filters.time_preset === 'last_days') {
            const d = new Date();
            d.setDate(now.getDate() - parseInt(filters.custom_days || 7));
            start = d.toISOString().split('T')[0];
        } else if (filters.time_preset === 'all_time') {
            start = '';
            end = '';
        }

        setFilters(prev => ({ ...prev, start_date: start, end_date: end }));
        setPage(1);
    }, [filters.time_preset, filters.custom_days]);

    // Editing State
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [page, filters.triage_name, filters.start_date, filters.end_date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                per_page: 20
            });
            if (filters.triage_name) params.append('triage_name', filters.triage_name);
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);

            const res = await api.get(`/api/triage/tracker?${params.toString()}`);
            setReports(res.data.reports || []);
            setTotalPages(res.data.pages || 1);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const startEdit = (report) => {
        setEditingId(report.id);
        setEditForm({ ...report });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // TriageTracker updates via POST to /api/triage/tracker matching triage_name & date
            // or we could reconstruct
            const payload = {
                ...editForm,
                date: editForm.date.substring(0, 10) // Ensure format for backend match
            };
            await api.post('/api/triage/tracker', payload);
            setEditingId(null);
            fetchData();
        } catch (err) {
            alert("Error al guardar: " + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que quieres borrar este reporte del Tracker?")) return;
        try {
            await api.delete(`/api/triage/tracker/${id}`);
            fetchData();
        } catch (err) {
            alert("Error al borrar");
        }
    };

    // Helper for columns
    const renderEditableCell = (field, r, width = "w-14") => {
        if (editingId === r.id) {
            return (
                <input
                    type="number"
                    value={editForm[field] || ''}
                    onChange={e => setEditForm({ ...editForm, [field]: parseInt(e.target.value) || 0 })}
                    className={`${width} bg-slate-950 border border-slate-700 rounded-lg px-1 py-1 text-[11px] text-center font-black text-indigo-400 focus:border-indigo-500 outline-none`}
                />
            );
        }
        return <span className="text-[11px] font-black tabular-nums">{r[field] || 0}</span>;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-slate-200">
            {/* FILTERS */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-[2rem] flex flex-wrap items-end gap-6 shadow-2xl">
                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Triage</label>
                    <select
                        className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 min-w-[150px]"
                        value={filters.triage_name}
                        onChange={e => { setFilters({ ...filters, triage_name: e.target.value }); setPage(1); }}
                    >
                        <option value="">Todos</option>
                        <option value="Kerwin">Kerwin</option>
                    </select>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
                    <select
                        className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 min-w-[150px]"
                        value={filters.time_preset}
                        onChange={e => setFilters({ ...filters, time_preset: e.target.value })}
                    >
                        <option value="yesterday">Ayer</option>
                        <option value="last_days">Últimos X días</option>
                        <option value="all_time">Todo el tiempo</option>
                        <option value="custom">Personalizado</option>
                    </select>
                </div>

                {filters.time_preset === 'last_days' && (
                    <div className="flex flex-col gap-2 animate-in slide-in-from-left duration-300">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Días</label>
                        <input
                            type="number"
                            className="w-16 bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all font-black text-center"
                            value={filters.custom_days}
                            onChange={e => setFilters({ ...filters, custom_days: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                )}

                {filters.time_preset === 'custom' && (
                    <>
                        <div className="flex flex-col gap-2 animate-in slide-in-from-left duration-300">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Desde</label>
                            <input
                                type="date"
                                className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500"
                                value={filters.start_date}
                                onChange={e => { setFilters({ ...filters, start_date: e.target.value }); setPage(1); }}
                            />
                        </div>
                        <div className="flex flex-col gap-2 animate-in slide-in-from-left duration-300">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                            <input
                                type="date"
                                className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500"
                                value={filters.end_date}
                                onChange={e => { setFilters({ ...filters, end_date: e.target.value }); setPage(1); }}
                            />
                        </div>
                    </>
                )}

                <button
                    onClick={fetchData}
                    className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-xl hover:bg-indigo-600/30 transition-all flex items-center gap-2 px-4"
                >
                    <Search size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filtrar</span>
                </button>
            </div>

            {/* TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                <div className="overflow-x-auto max-h-[700px] custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[2800px]">
                        <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm">
                            <tr>
                                <th rowSpan="2" className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 border-r border-b border-slate-800 sticky left-0 z-30 min-w-[100px]">Fecha</th>
                                <th rowSpan="2" className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 border-r border-b border-slate-800 sticky left-[100px] z-30 min-w-[100px]">Triage</th>
                                
                                <th colSpan="5" className="p-2 text-[10px] font-black text-center text-indigo-400 uppercase tracking-widest border-r border-b border-slate-800 bg-indigo-500/10">ST (1st Call)</th>
                                <th colSpan="5" className="p-2 text-[10px] font-black text-center text-indigo-300 uppercase tracking-widest border-r border-b border-slate-800 bg-indigo-400/10">ST (2nd Call)</th>
                                
                                <th colSpan="5" className="p-2 text-[10px] font-black text-center text-pink-400 uppercase tracking-widest border-r border-b border-slate-800 bg-pink-500/10">All (1st Call)</th>
                                <th colSpan="5" className="p-2 text-[10px] font-black text-center text-pink-300 uppercase tracking-widest border-r border-b border-slate-800 bg-pink-400/10">All (2nd Call)</th>
                                
                                <th colSpan="2" className="p-2 text-[10px] font-black text-center text-emerald-400 uppercase tracking-widest border-r border-b border-slate-800 bg-emerald-500/10">PC Hoy</th>
                                <th colSpan="2" className="p-2 text-[10px] font-black text-center text-teal-400 uppercase tracking-widest border-r border-b border-slate-800 bg-teal-500/10">PC All</th>
                                
                                <th colSpan="4" className="p-2 text-[10px] font-black text-center text-cyan-400 uppercase tracking-widest border-r border-b border-slate-800 bg-cyan-500/10">FU Cold</th>
                                <th colSpan="4" className="p-2 text-[10px] font-black text-center text-blue-400 uppercase tracking-widest border-r border-b border-slate-800 bg-blue-500/10">FU Warm</th>
                                <th colSpan="4" className="p-2 text-[10px] font-black text-center text-violet-400 uppercase tracking-widest border-r border-b border-slate-800 bg-violet-500/10">FU Hot</th>
                                
                                <th rowSpan="2" className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-800 bg-slate-900 sticky right-0 z-30 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.3)]">Acciones</th>
                            </tr>
                            <tr>
                                {/* ST 1 */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Agendas</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Confirmando</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Reprog</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Conf</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Canc</th>
                                {/* ST 2 */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Agendas</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Confirmando</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Reprog</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Conf</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Canc</th>
                                {/* ALL 1 */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Agendas</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Confirmando</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Reprog</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Conf</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Canc</th>
                                {/* ALL 2 */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Agendas</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Confirmando</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Reprog</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Conf</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Canc</th>
                                {/* PC Hoy */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Conf</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">PPC Comp</th>
                                {/* PC All */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Conf</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">PPC Comp</th>
                                {/* FU Cold */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Disp FU</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Mjs Real</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Per Real</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Per Resp</th>
                                {/* FU Warm */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Disp FU</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Mjs Real</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Per Real</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Per Resp</th>
                                {/* FU Hot */}
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Disp FU</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Mjs Real</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Per Real</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 text-center border-r border-b border-slate-800">Per Resp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="40" className="py-20 text-center text-slate-500 bg-slate-900 sticky left-0">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                                        <span className="text-[10px] font-black uppercase">Cargando registros...</span>
                                    </td>
                                </tr>
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan="40" className="py-20 text-center text-slate-600 font-bold italic bg-slate-900 sticky left-0">No se encontraron reportes</td>
                                </tr>
                            ) : reports.map(r => (
                                <tr key={r.id} className={`hover:bg-slate-800/40 transition-colors group ${editingId === r.id ? 'bg-slate-800/30' : ''}`}>
                                    <td className="p-4 text-[11px] font-black text-slate-400 tabular-nums sticky left-0 bg-slate-900 border-r border-slate-800 group-hover:bg-slate-800/40">
                                        {r.date?.substring(0, 10)}
                                    </td>
                                    <td className="p-4 text-xs font-bold text-white uppercase italic sticky left-[100px] bg-slate-900 border-r border-slate-800 group-hover:bg-slate-800/40">
                                        {r.triage_name}
                                    </td>

                                    {/* ST 1 */}
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-indigo-300 bg-indigo-500/5">{renderEditableCell('starting_1st_call_agendas', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-indigo-200 bg-indigo-500/5">{renderEditableCell('starting_1st_call_confirmando', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-indigo-200 bg-indigo-500/5">{renderEditableCell('starting_1st_call_reprogramando', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-emerald-400 bg-indigo-500/5">{renderEditableCell('starting_1st_call_confirmadas', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-rose-400 bg-indigo-500/5">{renderEditableCell('starting_1st_call_canceladas', r)}</td>
                                    {/* ST 2 */}
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-indigo-300 bg-indigo-400/5">{renderEditableCell('starting_2nd_call_agendas', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-indigo-200 bg-indigo-400/5">{renderEditableCell('starting_2nd_call_confirmando', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-indigo-200 bg-indigo-400/5">{renderEditableCell('starting_2nd_call_reprogramando', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-emerald-400 bg-indigo-400/5">{renderEditableCell('starting_2nd_call_confirmadas', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-rose-400 bg-indigo-400/5">{renderEditableCell('starting_2nd_call_canceladas', r)}</td>

                                    {/* ALL 1 */}
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-pink-300 bg-pink-500/5">{renderEditableCell('all_1st_call_agendas', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-pink-200 bg-pink-500/5">{renderEditableCell('all_1st_call_confirmando', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-pink-200 bg-pink-500/5">{renderEditableCell('all_1st_call_reprogramando', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-emerald-400 bg-pink-500/5">{renderEditableCell('all_1st_call_confirmadas', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-rose-400 bg-pink-500/5">{renderEditableCell('all_1st_call_canceladas', r)}</td>
                                    {/* ALL 2 */}
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-pink-300 bg-pink-400/5">{renderEditableCell('all_2nd_call_agendas', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-pink-200 bg-pink-400/5">{renderEditableCell('all_2nd_call_confirmando', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-pink-200 bg-pink-400/5">{renderEditableCell('all_2nd_call_reprogramando', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-emerald-400 bg-pink-400/5">{renderEditableCell('all_2nd_call_confirmadas', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-rose-400 bg-pink-400/5">{renderEditableCell('all_2nd_call_canceladas', r)}</td>

                                    {/* PC */}
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-emerald-400 bg-emerald-500/5">{renderEditableCell('post_hoy_confirmadas', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-teal-400 bg-emerald-500/5">{renderEditableCell('post_hoy_ppc_completo', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-emerald-400 bg-teal-500/5">{renderEditableCell('post_all_confirmadas', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-cyan-400 bg-teal-500/5">{renderEditableCell('post_all_ppc_completo', r)}</td>

                                    {/* FU COLD */}
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-cyan-300 bg-cyan-500/5">{renderEditableCell('fu_cold_personas_disp_fu', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-cyan-200 bg-cyan-500/5">{renderEditableCell('fu_cold_mjes_realizados', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-cyan-400 bg-cyan-500/5">{renderEditableCell('fu_cold_personas_realizados', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-blue-400 bg-cyan-500/5">{renderEditableCell('fu_cold_personas_respondidos', r)}</td>

                                    {/* FU WARM */}
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-blue-300 bg-blue-500/5">{renderEditableCell('fu_warm_personas_disp_fu', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-blue-200 bg-blue-500/5">{renderEditableCell('fu_warm_mjes_realizados', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-blue-400 bg-blue-500/5">{renderEditableCell('fu_warm_personas_realizados', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-indigo-400 bg-blue-500/5">{renderEditableCell('fu_warm_personas_respondidos', r)}</td>

                                    {/* FU HOT */}
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-violet-300 bg-violet-500/5">{renderEditableCell('fu_hot_personas_disp_fu', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center text-violet-200 bg-violet-500/5">{renderEditableCell('fu_hot_mjes_realizados', r)}</td>
                                    <td className="p-2 border-r border-slate-800/50 text-center font-bold text-violet-400 bg-violet-500/5">{renderEditableCell('fu_hot_personas_realizados', r)}</td>
                                    <td className="p-2 border-r border-slate-800 text-center font-bold text-purple-400 bg-violet-500/5">{renderEditableCell('fu_hot_personas_respondidos', r)}</td>

                                    <td className="p-2 text-center sticky right-0 bg-slate-900 border-l border-slate-800 group-hover:bg-slate-800/40 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.3)] min-w-[100px]">
                                        <div className="flex items-center justify-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            {editingId === r.id ? (
                                                <>
                                                    <button onClick={handleSave} disabled={saving} className="p-2 ml-1 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/40 border border-emerald-500/20 text-[10px] font-black tracking-widest uppercase">
                                                        {saving ? <Loader2 size={12} className="animate-spin" /> : '✓'}
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700">
                                                        <X size={12} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(r)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/40 border border-indigo-500/20">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(r.id)} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/40 border border-rose-500/20">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                <div className="bg-slate-900/80 p-4 border-t border-slate-800 flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-30 text-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-30 text-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
