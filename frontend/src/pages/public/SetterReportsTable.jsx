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
            // Re-mapping keys for backend compatibility if they differ
            const payload = {
                entrantes: editForm.entrantes,
                not_lead: editForm.not_lead,
                inabribles: editForm.inabribles,
                leads: editForm.leads,
                op_sub: editForm.op_sub,
                op_res: editForm.op_res,
                fun_qual: editForm.fun_qual,
                fun_pain: editForm.fun_pain,
                fun_offer: editForm.fun_offer,
                fun_link: editForm.fun_link,
                fun_agenda: editForm.fun_agenda,
                qualification_fu: editForm.qualification_fu,
                pain_fu: editForm.pain_fu,
                offer_fu: editForm.offer_fu,
                agenda_fu: editForm.agenda_fu,
                qualification_fur: editForm.qualification_fur,
                pain_fur: editForm.pain_fur,
                offer_fur: editForm.offer_fur,
                agenda_fur: editForm.agenda_fur
                // Missing: links? check backend Put logic
            };
            await api.put(`/public/setter-reports/${editingId}`, payload);
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
            <div className="bg-white/80 border border-white p-6 rounded-[2rem] flex flex-wrap items-end gap-6 shadow-sm backdrop-blur-md">
                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Setter</label>
                    <select
                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-4 py-2 text-slate-700 outline-none focus:border-indigo-500 min-w-[150px]"
                        value={filters.setter_id}
                        onChange={e => { setFilters({ ...filters, setter_id: e.target.value }); setPage(1); }}
                    >
                        <option value="">Todos</option>
                        {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Periodo</label>
                    <select
                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-4 py-2 text-slate-700 outline-none focus:border-indigo-500 min-w-[150px]"
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
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Días</label>
                        <input
                            type="number"
                            className="w-16 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-4 py-2 text-slate-700 outline-none focus:border-indigo-500 transition-all font-black text-center"
                            value={filters.custom_days}
                            onChange={e => setFilters({ ...filters, custom_days: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                )}

                <button
                    onClick={fetchReports}
                    className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 px-6"
                >
                    <Search size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filtrar</span>
                </button>
            </div>

            {/* TABLE */}
            <div className="bg-white/80 border border-white rounded-[2.5rem] overflow-hidden shadow-xl backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Setter</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Entrantes</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Leads</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Op. Sub</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Op. Res</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Qual FU/R</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Pain FU/R</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Offer FU/R</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Link FU/R</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Agenda FU/R</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Qual Op</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Pain Op</th>
                                <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="14" className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Cargando registros...</span>
                                    </td>
                                </tr>
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan="14" className="py-20 text-center text-slate-500 font-bold italic">No se encontraron reportes</td>
                                </tr>
                            ) : reports.map(r => (
                                <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="p-4 text-[11px] font-black text-slate-700 tabular-nums">{r.date}</td>
                                    <td className="p-4 text-xs font-bold text-slate-900 uppercase italic">{r.setter_name}</td>

                                    {/* MAPPING DYNAMICALLY FOR DISPLAY/EDIT */}
                                    {[
                                        { f: 'entrantes', label: 'E' },
                                        { f: 'leads', label: 'L' },
                                        { f: 'op_sub', label: 'OS' },
                                        { f: 'op_res', label: 'OR' },
                                        { f: 'qualification_fu', fur: 'qualification_fur', label: 'QFU' },
                                        { f: 'pain_fu', fur: 'pain_fur', label: 'PFU' },
                                        { f: 'offer_fu', fur: 'offer_fur', label: 'OFU' },
                                        { f: 'link_fu', fur: 'link_fur', label: 'LFU' },
                                        { f: 'agenda_fu', fur: 'agenda_fur', label: 'AFU' },
                                        { f: 'qualification_opening_submitted', fur: 'qualification_opening_responded', label: 'QOp' },
                                        { f: 'pain_opening_submitted', fur: 'pain_opening_responded', label: 'POp' }
                                    ].map(col => (
                                        <td key={col.f} className="p-4 text-center">
                                            {editingId === r.id ? (
                                                <div className="flex flex-col gap-1 items-center">
                                                    <input
                                                        type="number"
                                                        value={editForm[col.f]}
                                                        onChange={e => setEditForm({ ...editForm, [col.f]: parseInt(e.target.value) || 0 })}
                                                        className="w-12 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-center font-black text-indigo-600 focus:border-indigo-500 outline-none"
                                                    />
                                                    {col.fur && (
                                                        <input
                                                            type="number"
                                                            value={editForm[col.fur]}
                                                            onChange={e => setEditForm({ ...editForm, [col.fur]: parseInt(e.target.value) || 0 })}
                                                            className="w-12 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-center font-black text-rose-500 focus:border-rose-500 outline-none"
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black text-slate-900 tabular-nums">{r[col.f]}</span>
                                                    {col.fur && <span className="text-[10px] font-bold text-slate-400 tabular-nums border-t border-slate-100 w-full mt-1 pt-1">{r[col.fur]}</span>}
                                                </div>
                                            )}
                                        </td>
                                    ))}

                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId === r.id ? (
                                                <>
                                                    <button onClick={handleSave} disabled={saving} className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-100">
                                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg">
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEdit(r)} className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(r.id)} className="p-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-100">
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
                <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 shadow-sm"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 shadow-sm"
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
