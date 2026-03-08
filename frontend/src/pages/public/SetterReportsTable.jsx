import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    Search, Trash2, Edit3, Loader2, Calendar,
    ChevronLeft, ChevronRight, X, Save, AlertCircle
} from 'lucide-react';

const SetterReportsTable = ({ setters }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [filters, setFilters] = useState({
        setter_id: '',
        start_date: '',
        end_date: '',
        time_preset: 'last_30', // Matching table needs more range by default
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
    }, [page, filters.setter_id, filters.start_date, filters.end_date]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                setter_id: filters.setter_id,
                start_date: filters.start_date,
                end_date: filters.end_date
            });
            const res = await api.get(`/public/setter-reports?${params.toString()}`);
            setReports(res.data.reports);
            setTotalPages(res.data.pages);
        } catch (err) {
            console.error("Error fetching reports:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que quieres borrar este reporte?")) return;
        try {
            await api.delete(`/public/setter-reports/${id}`);
            fetchReports();
        } catch (err) {
            alert("Error al borrar");
        }
    };

    const startEdit = (report) => {
        setEditingId(report.id);
        setEditForm({ ...report });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/public/setter-reports/${editingId}`, editForm);
            setEditingId(null);
            fetchReports();
        } catch (err) {
            alert("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* FILTERS */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-[2rem] flex flex-wrap items-end gap-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Setter</label>
                    <select
                        className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 min-w-[150px]"
                        value={filters.setter_id}
                        onChange={e => { setFilters({ ...filters, setter_id: e.target.value }); setPage(1); }}
                    >
                        <option value="">Todos</option>
                        {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

            {/* TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-800/50">
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Setter</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Entrantes</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Leads</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Op. Sub</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Op. Res</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Qual</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Pain</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Offer</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Link</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Agenda</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan="12" className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                                        <span className="text-[10px] font-black text-slate-500 uppercase">Cargando registros...</span>
                                    </td>
                                </tr>
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan="12" className="py-20 text-center text-slate-600 font-bold italic">No se encontraron reportes</td>
                                </tr>
                            ) : reports.map(r => (
                                <tr key={r.id} className="hover:bg-slate-800/20 transition-colors group">
                                    <td className="p-4 text-[11px] font-black text-slate-400 tabular-nums">{r.date}</td>
                                    <td className="p-4 text-xs font-bold text-white uppercase italic">{r.setter_name}</td>

                                    {/* MAPPING DYNAMICALLY FOR DISPLAY/EDIT */}
                                    {[
                                        { f: 'entrantes', label: 'E' },
                                        { f: 'leads', label: 'L' },
                                        { f: 'op_sub', label: 'OS' },
                                        { f: 'op_res', label: 'OR' },
                                        { f: 'fun_qual', label: 'Q' },
                                        { f: 'fun_pain', label: 'P' },
                                        { f: 'fun_offer', label: 'O' },
                                        { f: 'fun_link', label: 'Lk' },
                                        { f: 'fun_agenda', label: 'A' }
                                    ].map(col => (
                                        <td key={col.f} className="p-4 text-center">
                                            {editingId === r.id ? (
                                                <input
                                                    type="number"
                                                    value={editForm[col.f]}
                                                    onChange={e => setEditForm({ ...editForm, [col.f]: parseInt(e.target.value) || 0 })}
                                                    className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-black text-indigo-400 focus:border-indigo-500 outline-none"
                                                />
                                            ) : (
                                                <span className="text-xs font-black text-white tabular-nums">{r[col.f]}</span>
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
                                                    <button onClick={() => setEditingId(null)} className="p-2 bg-slate-700 text-slate-300 rounded-lg">
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(r)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/40">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(r.id)} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/40">
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
                <div className="bg-slate-800/30 p-4 border-t border-slate-800 flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-30"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-30"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetterReportsTable;
