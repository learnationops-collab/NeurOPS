import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
    Search, Trash2, Edit3, Loader2, Calendar,
    ChevronLeft, ChevronRight, X, Save, AlertCircle, PhoneCall, Flag, Activity, Users, Eye, Send
} from 'lucide-react';

// Componente Principal de la Tabla
const CloserReportsTable = ({ closers }) => {
    const auth = useAuth();
    const user = auth?.user || { role: 'admin' };
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [resendingId, setResendingId] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        closer_id: user.role === 'closer' && user.id ? user.id.toString() : '',
        start_date: '',
        end_date: '',
        time_preset: 'last_days',
        custom_days: 30
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
            d.setDate(now.getDate() - parseInt(filters.custom_days || 30));
            start = d.toISOString().split('T')[0];
        } else if (filters.time_preset === 'all_time') {
            start = '';
            end = '';
        }

        setFilters(prev => ({ ...prev, start_date: start, end_date: end }));
        setPage(1);
    }, [filters.time_preset, filters.custom_days]);

    useEffect(() => {
        fetchReports();
    }, [page, filters.closer_id, filters.start_date, filters.end_date]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                closer_id: filters.closer_id,
                start_date: filters.start_date,
                end_date: filters.end_date
            });
            const res = await api.get(`/public/closer-reports?${params.toString()}`);
            setReports(res.data.reports);
            setTotalPages(res.data.pages);
        } catch (err) {
            console.error("Error fetching reports:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que quieres borrar este reporte de Closer permanentemente?")) return;
        try {
            await api.delete(`/public/closer-reports/${id}`);
            fetchReports();
        } catch (err) {
            alert("Error al borrar");
        }
    };

    const handleResendDiscord = async (id) => {
        setResendingId(id);
        try {
            await api.post(`/public/closer-reports/${id}/resend-discord`);
            alert("Reporte reenviado a Discord con éxito");
        } catch (err) {
            console.error("Error resending report:", err);
            alert("Error al reenviar el reporte a Discord");
        } finally {
            setResendingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">

            {/* FILTERS */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-[2rem] flex flex-wrap items-end gap-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Closer</label>
                    <select
                        className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 min-w-[150px]"
                        value={filters.closer_id}
                        onChange={e => { setFilters({ ...filters, closer_id: e.target.value }); setPage(1); }}
                    >
                        <option value="">Todos</option>
                        {closers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Closer</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Slots</th>
                                <th className="p-4 text-[9px] font-black text-emerald-500 uppercase tracking-widest text-center" colSpan="2">1ra Llamada</th>
                                <th className="p-4 text-[9px] font-black text-emerald-500 uppercase tracking-widest text-center" colSpan="2">2da Llamada</th>
                                <th className="p-4 text-[9px] font-black text-rose-500 uppercase tracking-widest text-center" colSpan="3">Seguimientos y Referidos</th>
                                <th className="p-4 text-[9px] font-black text-amber-500 uppercase tracking-widest text-center" colSpan="2">Ventas / Cash</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                            <tr className="bg-slate-800/20 border-t border-slate-800 border-b">
                                <th></th>
                                <th></th>
                                <th></th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-l border-slate-800">Agendas</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Asist.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-l border-slate-800">Agendas</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-800">Asist.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">SRD Hot (C/R/A)</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">SRD Cold (C/R/A)</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-800">Ref (G/C/A)</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Total</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Cash</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan="13" className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                                        <span className="text-[10px] font-black text-slate-500 uppercase">Cargando registros...</span>
                                    </td>
                                </tr>
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan="13" className="py-20 text-center text-slate-600 font-bold italic">No se encontraron reportes</td>
                                </tr>
                            ) : reports.map(r => {
                                const totalSales = (r.pif_count || 0) + (r.split_count || 0) + (r.deposit_count || 0) + (r.installment_count || 0);
                                const totalCash = (r.pif_cash_collected || 0) + (r.split_cash_collected || 0) + (r.deposit_cash_collected || 0) + (r.installment_cash_collected || 0);

                                return (
                                    <tr key={r.id} className="hover:bg-slate-800/20 transition-colors group">
                                        <td className="p-4 text-[11px] font-black text-slate-400 tabular-nums">{r.date}</td>
                                        <td className="p-4 text-xs font-bold text-white uppercase italic">{r.closer_name}</td>
                                        <td className="p-4 text-xs font-black text-white tabular-nums text-center">{r.slots || 0}</td>

                                        <td className="p-4 border-l border-slate-800 text-xs font-black text-emerald-400 tabular-nums text-center">{r.first_call_scheduled || 0}</td>
                                        <td className="p-4 text-xs font-black text-slate-300 tabular-nums text-center">{r.first_call_attended || 0}</td>

                                        <td className="p-4 border-l border-slate-800 text-xs font-black text-emerald-400 tabular-nums text-center">{r.second_call_scheduled || 0}</td>
                                        <td className="p-4 border-r border-slate-800 text-xs font-black text-slate-300 tabular-nums text-center">{r.second_call_attended || 0}</td>

                                        <td className="p-4 text-[11px] font-black text-rose-400 tabular-nums text-center">
                                            {r.follow_ups_hot_sent || 0}/{r.follow_ups_hot_replied || 0}/{r.follow_ups_hot_scheduled || 0}
                                        </td>
                                        <td className="p-4 text-[11px] font-black text-sky-400 tabular-nums text-center">
                                            {r.follow_ups_cold_sent || 0}/{r.follow_ups_cold_replied || 0}/{r.follow_ups_cold_scheduled || 0}
                                        </td>
                                        <td className="p-4 border-r border-slate-800 text-[11px] font-black text-emerald-400 tabular-nums text-center">
                                            {r.referrals_sourced || 0}/{r.referrals_contacted || 0}/{r.referrals_scheduled || 0}
                                        </td>

                                        <td className="p-4 text-xs font-black text-amber-500 tabular-nums text-center">{totalSales}</td>
                                        <td className="p-4 text-xs font-black text-amber-500 tabular-nums text-center">${totalCash.toLocaleString()}</td>

                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {user.role === 'admin' && (
                                                    <button 
                                                        onClick={() => {
                                                            const token = localStorage.getItem('auth_token');
                                                            window.open(`/api/public/closer-reports/${r.id}/preview?token=${token}`, '_blank');
                                                        }} 
                                                        className="p-2 bg-violet-600/20 text-violet-400 border border-violet-600/30 rounded-lg hover:bg-violet-600 hover:text-white transition-colors cursor-pointer" 
                                                        title="Vista Previa de Discord"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                )}
                                                {(user.role === 'admin' || user.role === 'closer') && (
                                                    <button 
                                                        onClick={() => handleResendDiscord(r.id)} 
                                                        disabled={resendingId === r.id}
                                                        className="p-2 bg-sky-600/20 text-sky-400 border border-sky-600/30 rounded-lg hover:bg-sky-600 hover:text-white transition-colors cursor-pointer disabled:opacity-50" 
                                                        title="Reenviar a Discord"
                                                    >
                                                        {resendingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                    </button>
                                                )}
                                                <button onClick={() => navigate('/closer/report', { state: { editReport: r } })} className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer" title="Editar Reporte Completo">
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(r.id)} className="p-2 bg-rose-600/20 text-rose-400 border border-rose-600/30 rounded-lg hover:bg-rose-600 hover:text-white transition-colors cursor-pointer" title="Eliminar Permanente">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
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
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CloserReportsTable;
