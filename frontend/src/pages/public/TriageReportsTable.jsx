import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    Search, Trash2, Edit3, Loader2, Calendar,
    ChevronLeft, ChevronRight, X, Save
} from 'lucide-react';

const TriageReportsTable = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [filters, setFilters] = useState({
        triage_name: '',
        start_date: '',
        end_date: '',
        time_preset: 'last_30',
        custom_days: 30
    });

    // Helper to calculate dates based on preset
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
            d.setDate(now.getDate() - parseInt(filters.custom_days || 30));
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
        fetchReports();
    }, [page, filters.triage_name, filters.start_date, filters.end_date]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                triage_name: filters.triage_name,
                start_date: filters.start_date,
                end_date: filters.end_date
            });
            const res = await api.get(`/public/triage-reports?${params.toString()}`);
            setReports(res.data.reports || []);
            setTotalPages(res.data.pages || 1);
        } catch (err) {
            console.error("Error fetching reports:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar este reporte?")) return;
        try {
            await api.delete(`/public/triage-reports/${id}`);
            fetchReports();
        } catch (err) {
            alert("Error al eliminar");
        }
    };

    const startEdit = (report) => {
        setEditingId(report.id);
        setEditForm({ ...report });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/public/triage-reports/${editingId}`, editForm);
            setEditingId(null);
            fetchReports();
        } catch (err) {
            alert("Error al guardar el reporte");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-[2rem] flex flex-wrap items-end gap-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Triaje</label>
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
                                className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white"
                                value={filters.start_date}
                                onChange={e => { setFilters({ ...filters, start_date: e.target.value }); setPage(1); }}
                            />
                        </div>
                        <div className="flex flex-col gap-2 animate-in slide-in-from-left duration-300">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                            <input
                                type="date"
                                className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white"
                                value={filters.end_date}
                                onChange={e => { setFilters({ ...filters, end_date: e.target.value }); setPage(1); }}
                            />
                        </div>
                    </>
                )}

                <button
                    onClick={fetchReports}
                    className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-xl hover:bg-indigo-600/30 transition-all flex items-center gap-2 px-4"
                >
                    <Search size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filtrar</span>
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-800/50">
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Triaje</th>
                                <th className="p-4 text-[9px] font-black text-indigo-500 uppercase tracking-widest text-center border-l border-slate-800" colSpan="5">Confirmaciones Hoy</th>
                                <th className="p-4 text-[9px] font-black text-fuchsia-500 uppercase tracking-widest text-center border-l border-slate-800" colSpan="5">Confirmaciones Futuro</th>
                                <th className="p-4 text-[9px] font-black text-rose-500 uppercase tracking-widest text-center border-l border-slate-800" colSpan="3">Recuperaciones</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right border-l border-slate-800">Acciones</th>
                            </tr>
                            <tr className="bg-slate-800/20 border-t border-slate-800 border-b">
                                <th></th>
                                <th></th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-l border-slate-800">Age.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Cont.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Conf.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Canc.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-800">Reag.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-l border-slate-800">Próx.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Cont.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Conf.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Canc.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-800">Reag.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-l border-slate-800">Cont.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Resp.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-800">Age.</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan="16" className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                                        <span className="text-[10px] font-black text-slate-500 uppercase">Cargando registros...</span>
                                    </td>
                                </tr>
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan="16" className="py-20 text-center text-slate-600 font-bold italic">No se encontraron reportes</td>
                                </tr>
                            ) : reports.map(r => (
                                <tr key={r.id} className="hover:bg-slate-800/20 transition-colors group">
                                    <td className="p-4 text-[11px] font-black text-slate-400 tabular-nums">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={12} className="text-slate-600" />
                                            {r.date}
                                        </div>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-white uppercase italic">{r.triage_name}</td>
                                    
                                    {[
                                        { f: 'today_agendas', color: 'text-indigo-400', isLeft: true },
                                        { f: 'today_contacted', color: 'text-slate-400', isLeft: false },
                                        { f: 'today_confirmed', color: 'text-emerald-400', isLeft: false },
                                        { f: 'today_canceled', color: 'text-rose-400', isLeft: false },
                                        { f: 'today_rescheduled', color: 'text-orange-400', isLeft: false, isRight: true },
                                        { f: 'future_agendas', color: 'text-fuchsia-400', isLeft: true },
                                        { f: 'future_contacted', color: 'text-slate-400', isLeft: false },
                                        { f: 'future_confirmed', color: 'text-emerald-400', isLeft: false },
                                        { f: 'future_canceled', color: 'text-rose-400', isLeft: false },
                                        { f: 'future_rescheduled', color: 'text-orange-400', isLeft: false, isRight: true },
                                        { f: 'recoveries_contacted', color: 'text-rose-400', isLeft: true },
                                        { f: 'recoveries_replied', color: 'text-rose-300', isLeft: false },
                                        { f: 'recoveries_scheduled', color: 'text-teal-400', isLeft: false, isRight: true }
                                    ].map(col => (
                                        <td key={col.f} className={`p-4 text-center ${col.isLeft ? 'border-l border-slate-800' : ''} ${col.isRight ? 'border-r border-slate-800' : ''}`}>
                                            {editingId === r.id ? (
                                                <input
                                                    type="number"
                                                    value={editForm[col.f]}
                                                    onChange={e => setEditForm({ ...editForm, [col.f]: parseInt(e.target.value) || 0 })}
                                                    className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-black text-indigo-400 focus:border-indigo-500 outline-none"
                                                />
                                            ) : (
                                                <span className={`text-xs font-black tabular-nums ${col.color}`}>{r[col.f]}</span>
                                            )}
                                        </td>
                                    ))}
                                    
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId === r.id ? (
                                                <>
                                                    <button onClick={handleSave} disabled={saving} className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/40">
                                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(r)} className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer" title="Editar Reporte">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(r.id)} className="p-2 bg-rose-600/20 text-rose-400 border border-rose-600/30 rounded-lg hover:bg-rose-600 hover:text-white transition-colors cursor-pointer" title="Eliminar Permanente">
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

                <div className="bg-slate-800/30 p-4 border-t border-slate-800 flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TriageReportsTable;
