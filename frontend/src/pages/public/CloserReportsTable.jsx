import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    Search, Trash2, Edit3, Loader2, Calendar,
    ChevronLeft, ChevronRight, X, Save, AlertCircle, PhoneCall, Flag, Activity, Users
} from 'lucide-react';

// Modal de Edición Compleja para Closers
const EditCloserReportModal = ({ report, onClose, onSave }) => {
    const [form, setForm] = useState({ ...report });
    const [saving, setSaving] = useState(false);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value === '' ? '' : Number(value) }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/public/closer-reports/${report.id}`, form);
            onSave();
        } catch (err) {
            alert("Error al guardar el reporte");
        } finally {
            setSaving(false);
        }
    };

    const InputRow = ({ label, field, isFloat = false }) => (
        <div className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 px-2 rounded-lg transition-colors">
            <label className="text-xs font-bold text-slate-300">{label}</label>
            <input
                type="number"
                step={isFloat ? "0.01" : "1"}
                value={form[field]}
                onChange={e => handleChange(field, e.target.value)}
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-center font-black text-indigo-400 focus:border-indigo-500 outline-none"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
                    <div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Editar Reporte</h3>
                        <p className="text-sm font-bold text-indigo-400">{report.closer_name} - {report.date}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* MÉTRICAS GENERALES */}
                        <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                            <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4 pb-2 border-b border-slate-700"><Activity size={14} /> General</h4>
                            <div className="space-y-1">
                                <InputRow label="Slots Disponibles" field="slots" />
                                <InputRow label="Ofertas Hechas" field="offers_made" />
                            </div>
                        </div>

                        {/* SEGUIMIENTOS */}
                        <div className="bg-blue-900/10 p-5 rounded-2xl border border-blue-900/30">
                            <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-blue-400 uppercase mb-4 pb-2 border-b border-blue-900/50"><Users size={14} /> Seguimientos</h4>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-rose-400 mt-2 mb-1">Flujo Caliente</p>
                                <InputRow label="Enviados (Hot)" field="follow_ups_hot_sent" />
                                <InputRow label="Respuestas (Hot)" field="follow_ups_hot_replied" />

                                <p className="text-[10px] font-black uppercase text-sky-400 mt-4 mb-1">Flujo Frío</p>
                                <InputRow label="Enviados (Cold)" field="follow_ups_cold_sent" />
                                <InputRow label="Respuestas (Cold)" field="follow_ups_cold_replied" />

                                <div className="mt-4 pt-3 border-t border-blue-900/40 opacity-70">
                                    <InputRow label="Total Total Enviados" field="follow_ups_sent" />
                                    <InputRow label="Total Total Respuestas" field="follow_ups_replied" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* PRIMERA LLAMADA */}
                        <div className="bg-emerald-900/10 p-5 rounded-2xl border border-emerald-900/30">
                            <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-emerald-400 uppercase mb-4 pb-2 border-b border-emerald-900/50"><PhoneCall size={14} /> Primera Llamada</h4>
                            <div className="space-y-1">
                                <InputRow label="Agendas" field="first_call_scheduled" />
                                <InputRow label="Asistencias" field="first_call_attended" />
                                <InputRow label="No Shows" field="first_call_no_show" />
                                <InputRow label="Reprogramaciones" field="first_call_rescheduled" />
                                <InputRow label="Cancelaciones" field="first_call_canceled" />
                            </div>
                        </div>

                        {/* SEGUNDA LLAMADA */}
                        <div className="bg-emerald-900/10 p-5 rounded-2xl border border-emerald-900/30">
                            <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-emerald-400 uppercase mb-4 pb-2 border-b border-emerald-900/50"><PhoneCall size={14} /> Segunda Llamada</h4>
                            <div className="space-y-1">
                                <InputRow label="Agendas" field="second_call_scheduled" />
                                <InputRow label="Asistencias" field="second_call_attended" />
                                <InputRow label="No Shows" field="second_call_no_show" />
                                <InputRow label="Reprogramaciones" field="second_call_rescheduled" />
                                <InputRow label="Cancelaciones" field="second_call_canceled" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* VENTAS PIF / SPLIT / SEÑAS */}
                        <div className="bg-amber-900/10 p-5 rounded-2xl border border-amber-900/30">
                            <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-amber-500 uppercase mb-4 pb-2 border-b border-amber-900/50"><Flag size={14} /> Ventas (PIF / Split / Señas)</h4>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-amber-500 mb-2">PIF (Pay In Full)</p>
                                    <InputRow label="Cantidad Total" field="pif_count" />
                                    <InputRow label="Cash Total" field="pif_cash_collected" isFloat />
                                    <InputRow label="Cant. En Llamada" field="pif_in_call_count" />
                                    <InputRow label="Cash En Llamada" field="pif_in_call_cash" isFloat />
                                </div>

                                <div className="space-y-1 border-t md:border-t-0 md:border-l border-amber-900/30 pt-4 md:pt-0 md:pl-6">
                                    <p className="text-xs font-black text-amber-500 mb-2">Split Pay</p>
                                    <InputRow label="Cantidad Total" field="split_count" />
                                    <InputRow label="Cash Total" field="split_cash_collected" isFloat />
                                    <InputRow label="Cant. En Llamada" field="split_in_call_count" />
                                    <InputRow label="Cash En Llamada" field="split_in_call_cash" isFloat />
                                </div>

                                <div className="space-y-1 border-t md:border-t-0 md:border-l border-amber-900/30 pt-4 md:pt-0 md:pl-6">
                                    <p className="text-xs font-black text-amber-500 mb-2">Señas</p>
                                    <InputRow label="Cantidad Total" field="deposit_count" />
                                    <InputRow label="Cash Total" field="deposit_cash_collected" isFloat />
                                    <InputRow label="Cant. En Llamada" field="deposit_in_call_count" />
                                    <InputRow label="Cash En Llamada" field="deposit_in_call_cash" isFloat />
                                </div>
                            </div>
                        </div>

                        {/* REFLEXIÓN CUALITATIVA */}
                        <div className="bg-violet-900/10 p-5 rounded-2xl border border-violet-900/30">
                            <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-violet-400 uppercase mb-4 pb-2 border-b border-violet-900/50">Reflexión Cualitativa</h4>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-violet-300">Victoria del Día</label>
                                    <textarea
                                        value={form.reflection_victory || ''}
                                        onChange={e => setForm({ ...form, reflection_victory: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 min-h-[80px] focus:border-violet-500 outline-none"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-violet-300">Oportunidad de Mejora</label>
                                    <textarea
                                        value={form.reflection_opportunity || ''}
                                        onChange={e => setForm({ ...form, reflection_opportunity: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 min-h-[80px] focus:border-violet-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 font-bold text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-8 py-3 font-black text-sm rounded-xl transition-all flex items-center gap-2 ${saving ? 'bg-indigo-600/50 text-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'}`}
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        GUARDAR CAMBIOS
                    </button>
                </div>
            </div>
        </div>
    );
};

// Componente Principal de la Tabla
const CloserReportsTable = ({ closers }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [editingReport, setEditingReport] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        closer_id: '',
        start_date: '',
        end_date: '',
        time_preset: 'last_30',
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">

            {/* Modal superpuesto */}
            {editingReport && (
                <EditCloserReportModal
                    report={editingReport}
                    onClose={() => setEditingReport(null)}
                    onSave={() => { setEditingReport(null); fetchReports(); }}
                />
            )}

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
                                <th className="p-4 text-[9px] font-black text-rose-500 uppercase tracking-widest text-center" colSpan="2">Seguimientos</th>
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
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Hot (R/S)</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-800">Cold (R/S)</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Total</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Cash</th>
                                <th></th>
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
                            ) : reports.map(r => {
                                const totalSales = (r.pif_count || 0) + (r.split_count || 0) + (r.deposit_count || 0);
                                const totalCash = (r.pif_cash_collected || 0) + (r.split_cash_collected || 0) + (r.deposit_cash_collected || 0);

                                return (
                                    <tr key={r.id} className="hover:bg-slate-800/20 transition-colors group">
                                        <td className="p-4 text-[11px] font-black text-slate-400 tabular-nums">{r.date}</td>
                                        <td className="p-4 text-xs font-bold text-white uppercase italic">{r.closer_name}</td>
                                        <td className="p-4 text-xs font-black text-white tabular-nums text-center">{r.slots || 0}</td>

                                        <td className="p-4 border-l border-slate-800 text-xs font-black text-emerald-400 tabular-nums text-center">{r.first_call_scheduled || 0}</td>
                                        <td className="p-4 text-xs font-black text-slate-300 tabular-nums text-center">{r.first_call_attended || 0}</td>

                                        <td className="p-4 border-l border-slate-800 text-xs font-black text-emerald-400 tabular-nums text-center">{r.second_call_scheduled || 0}</td>
                                        <td className="p-4 border-r border-slate-800 text-xs font-black text-slate-300 tabular-nums text-center">{r.second_call_attended || 0}</td>

                                        <td className="p-4 text-xs font-black text-rose-400 tabular-nums text-center">
                                            {r.follow_ups_hot_replied || 0} / {r.follow_ups_hot_sent || 0}
                                        </td>
                                        <td className="p-4 border-r border-slate-800 text-xs font-black text-sky-400 tabular-nums text-center">
                                            {r.follow_ups_cold_replied || 0} / {r.follow_ups_cold_sent || 0}
                                        </td>

                                        <td className="p-4 text-xs font-black text-amber-500 tabular-nums text-center">{totalSales}</td>
                                        <td className="p-4 text-xs font-black text-amber-500 tabular-nums text-center">${totalCash.toLocaleString()}</td>

                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingReport(r)} className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer" title="Editar Reporte Completo">
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
