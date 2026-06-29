import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Search, Trash2, Edit3, Loader2, Calendar,
    ChevronLeft, ChevronRight, X, Save, AlertCircle, HelpCircle, Eye, Send
} from 'lucide-react';

const HeaderWithTooltip = ({ label, tooltipInfo }) => (
    <div className="group/h flex items-center justify-center gap-1.5 cursor-help py-1">
        <span className="transition-colors group-hover/h:text-indigo-400">{label}</span>
        {tooltipInfo && (
            <>
                <HelpCircle size={10} className="text-indigo-500 opacity-0 group-hover/h:opacity-100 transition-all transform scale-50 group-hover/h:scale-100" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-slate-900 text-white text-[10px] font-medium normal-case tracking-normal rounded-2xl p-4 opacity-0 group-hover/h:opacity-100 transition-all pointer-events-none z-[9999] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700/50 backdrop-blur-xl">
                    <div className="relative z-10 leading-relaxed">{tooltipInfo}</div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-slate-900"></div>
                </div>
            </>
        )}
    </div>
);

const SetterReportsTable = ({ setters }) => {
    const auth = useAuth();
    const user = auth?.user || { role: 'admin' };
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [resendingId, setResendingId] = useState(null);

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

    const handleResendDiscord = async (id) => {
        setResendingId(id);
        try {
            await api.post(`/public/setter-reports/${id}/resend-discord`);
            alert("Reporte reenviado a Discord con éxito");
        } catch (err) {
            console.error("Error resending report:", err);
            alert("Error al reenviar el reporte a Discord");
        } finally {
            setResendingId(null);
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
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex flex-wrap items-end gap-6 shadow-sm">
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

                <button
                    onClick={fetchReports}
                    className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 px-6"
                >
                    <Search size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Filtrar</span>
                </button>
            </div>

            {/* TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-950/50 relative z-30">
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Setter</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Entrantes" tooltipInfo="Suma total de leads recibidos en el inbox." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Leads" tooltipInfo="Leads válidos para prospectar, excluyendo no leads." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Op. Sub" tooltipInfo="Total de aperturas enviadas (Opening Submitted)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Op. Res" tooltipInfo="Total de aperturas respondidas (Opening Responded)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Qual FU/R" tooltipInfo="Follow Ups en Cualificación: Enviados (Arriba) / Respondidos (Abajo)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Pain FU/R" tooltipInfo="Follow Ups en Dolor: Enviados (Arriba) / Respondidos (Abajo)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Offer FU/R" tooltipInfo="Follow Ups en Oferta: Enviados (Arriba) / Respondidos (Abajo)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Link FU/R" tooltipInfo="Follow Ups en Link: Enviados (Arriba) / Respondidos (Abajo)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Agenda FU/R" tooltipInfo="Follow Ups en Agenda: Enviados (Arriba) / Respondidos (Abajo)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Qual Op" tooltipInfo="Aperturas en Cualificación: Enviadas (Arriba) / Respondidas (Abajo)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center relative group/th"><HeaderWithTooltip label="Pain Op" tooltipInfo="Aperturas en Dolor: Enviadas (Arriba) / Respondidas (Abajo)." /></th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
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
                                <tr key={r.id} className="hover:bg-indigo-500/5 transition-colors group">
                                    <td className="p-4 text-[11px] font-black text-slate-400 tabular-nums">{r.date}</td>
                                    <td className="p-4 text-xs font-bold text-white uppercase italic">{r.setter_name}</td>

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
                                                            className="w-12 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-center font-black text-indigo-400 focus:border-indigo-500 outline-none"
                                                        />
                                                    {col.fur && (
                                                        <input
                                                            type="number"
                                                            value={editForm[col.fur]}
                                                            onChange={e => setEditForm({ ...editForm, [col.fur]: parseInt(e.target.value) || 0 })}
                                                            className="w-12 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-center font-black text-rose-500 focus:border-rose-500 outline-none"
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black text-white tabular-nums">{r[col.f]}</span>
                                                    {col.fur && <span className="text-[10px] font-bold text-slate-500 border-t border-slate-800 w-full mt-1 pt-1 tabular-nums">{r[col.fur]}</span>}
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
                                                    {user.role === 'admin' && (
                                                        <>
                                                            <button 
                                                                onClick={() => {
                                                                    const token = localStorage.getItem('auth_token');
                                                                    window.open(`/api/public/setter-reports/${r.id}/preview?token=${token}`, '_blank');
                                                                }} 
                                                                className="p-2 bg-violet-600/20 text-violet-400 border border-violet-600/30 rounded-lg hover:bg-violet-600 hover:text-white transition-colors cursor-pointer" 
                                                                title="Vista Previa de Discord"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleResendDiscord(r.id)} 
                                                                disabled={resendingId === r.id}
                                                                className="p-2 bg-sky-600/20 text-sky-400 border border-sky-600/30 rounded-lg hover:bg-sky-600 hover:text-white transition-colors cursor-pointer disabled:opacity-50" 
                                                                title="Reenviar a Discord"
                                                            >
                                                                {resendingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                    <button onClick={() => startEdit(r)} className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100" title="Editar Reporte Completo">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(r.id)} className="p-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-100" title="Eliminar Permanente">
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
                <div className="bg-slate-950/50 p-4 border-t border-slate-800 flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-30 shadow-sm hover:text-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-30 shadow-sm hover:text-white"
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
