import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    Search, Trash2, Edit3, Loader2, Calendar,
    ChevronLeft, ChevronRight, X, Save, Activity
} from 'lucide-react';

const EditTriageReportModal = ({ report, onClose, onSave }) => {
    const [form, setForm] = useState({ ...report });
    const [saving, setSaving] = useState(false);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value === '' ? '' : Number(value) }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/public/triage-reports/${report.id}`, form);
            onSave();
        } catch (err) {
            alert("Error al guardar el reporte");
        } finally {
            setSaving(false);
        }
    };

    const InputRow = ({ label, field }) => (
        <div className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 px-2 rounded-lg transition-colors">
            <label className="text-xs font-bold text-slate-300">{label}</label>
            <input
                type="number"
                value={form[field]}
                onChange={e => handleChange(field, e.target.value)}
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-center font-black text-indigo-400 focus:border-indigo-500 outline-none"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
                    <div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Editar Reporte Triage</h3>
                        <p className="text-sm font-bold text-indigo-400">{report.triage_name} - {report.date}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                        <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4 pb-2 border-b border-slate-700"><Activity size={14} /> Gestión de Agendas</h4>
                        <div className="space-y-1">
                            <InputRow label="Agendas Nuevas" field="agendas_nuevas" />
                            <InputRow label="Confirmadas" field="agendas_confirmadas" />
                            <InputRow label="No Contestan" field="no_contestan" />
                            <InputRow label="Cancelaciones" field="cancelaciones" />
                            <InputRow label="Reprogramandos" field="reprogramandos" />
                        </div>
                    </div>

                    <div className="bg-blue-900/10 p-5 rounded-2xl border border-blue-900/30">
                        <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-blue-400 uppercase mb-4 pb-2 border-b border-blue-900/50"><Activity size={14} /> Seguimientos</h4>
                        <div className="space-y-1">
                            <InputRow label="Seguimientos Iniciados" field="seguimientos_iniciados" />
                            <InputRow label="Seguimientos Contestados" field="seguimientos_contestados" />
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                    <button onClick={onClose} className="px-6 py-3 font-bold text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors" disabled={saving}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving} className={`px-8 py-3 font-black text-sm rounded-xl transition-all flex items-center gap-2 ${saving ? 'bg-indigo-600/50 text-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'}`}>
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        GUARDAR CAMBIOS
                    </button>
                </div>
            </div>
        </div>
    );
};

const TriageReportsTable = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [editingReport, setEditingReport] = useState(null);

    const [filters, setFilters] = useState({
        triage_name: '',
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
            console.error(err);
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {editingReport && (
                <EditTriageReportModal
                    report={editingReport}
                    onClose={() => setEditingReport(null)}
                    onSave={() => { setEditingReport(null); fetchReports(); }}
                />
            )}

            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-[2rem] flex flex-wrap items-end gap-6">
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
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-800/50">
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Triage</th>
                                <th className="p-4 text-[9px] font-black text-indigo-500 uppercase tracking-widest text-center" colSpan="5">Gestión de Agendas</th>
                                <th className="p-4 text-[9px] font-black text-sky-500 uppercase tracking-widest text-center" colSpan="2">Seguimientos</th>
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                            <tr className="bg-slate-800/20 border-t border-slate-800 border-b">
                                <th></th>
                                <th></th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-l border-slate-800">Nuevas</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Conf.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">No Cont.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Canc.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-800">Reprog.</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">Iniciados</th>
                                <th className="p-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-800">Contest.</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                                        <span className="text-[10px] font-black text-slate-500 uppercase">Cargando registros...</span>
                                    </td>
                                </tr>
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-20 text-center text-slate-600 font-bold italic">No se encontraron reportes</td>
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
                                    
                                    <td className="p-4 border-l border-slate-800 text-xs font-black text-indigo-400 tabular-nums text-center">{r.agendas_nuevas || 0}</td>
                                    <td className="p-4 text-xs font-black text-emerald-400 tabular-nums text-center">{r.agendas_confirmadas || 0}</td>
                                    <td className="p-4 text-xs font-black text-rose-400 tabular-nums text-center">{r.no_contestan || 0}</td>
                                    <td className="p-4 text-xs font-black text-amber-400 tabular-nums text-center">{r.cancelaciones || 0}</td>
                                    <td className="p-4 border-r border-slate-800 text-xs font-black text-violet-400 tabular-nums text-center">{r.reprogramandos || 0}</td>
                                    
                                    <td className="p-4 text-xs font-black text-sky-400 tabular-nums text-center">{r.seguimientos_iniciados || 0}</td>
                                    <td className="p-4 border-r border-slate-800 text-xs font-black text-emerald-400 tabular-nums text-center">{r.seguimientos_contestados || 0}</td>
                                    
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingReport(r)} className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer" title="Editar Reporte">
                                                <Edit3 size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(r.id)} className="p-2 bg-rose-600/20 text-rose-400 border border-rose-600/30 rounded-lg hover:bg-rose-600 hover:text-white transition-colors cursor-pointer" title="Eliminar Permanente">
                                                <Trash2 size={14} />
                                            </button>
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
