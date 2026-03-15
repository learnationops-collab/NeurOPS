import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Calendar, User as UserIcon, Trash2, Edit2, Check, X } from 'lucide-react';

const TriageReportsTable = () => {

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/triage-reports');
            setReports(res.data.reports || []);
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
            setReports(reports.filter(r => r.id !== id));
        } catch (err) {
            alert("Error al eliminar");
        }
    };

    const startEdit = (report) => {
        setEditingId(report.id);
        setEditData({ ...report });
    };

    const handleSave = async (id) => {
        try {
            await api.put(`/public/triage-reports/${id}`, editData);
            setReports(reports.map(r => r.id === id ? { ...r, ...editData } : r));
            setEditingId(null);
        } catch (err) {
            alert("Error al actualizar");
        }
    };

    if (loading) return (
        <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
    );

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-950/50 border-b border-slate-800">
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Triage</th>
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Nuevas</th>
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Conf.</th>
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Asist.</th>
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">N.S.</th>
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Canc.</th>
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Reprog.</th>
                            <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {reports.map((report) => (
                            <tr key={report.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="p-5">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-600" />
                                        <span className="text-xs font-black text-slate-300">{new Date(report.date).toLocaleDateString()}</span>
                                    </div>
                                </td>
                                <td className="p-5">
                                    <div className="flex items-center gap-2">
                                        <UserIcon size={14} className="text-slate-600" />
                                        <span className="text-xs font-bold text-white">{report.triage_name}</span>
                                    </div>
                                </td>
                                {[
                                    { key: 'agendas_nuevas', color: 'text-indigo-400' },
                                    { key: 'agendas_confirmadas', color: 'text-emerald-400' },
                                    { key: 'asistencias', color: 'text-sky-400' },
                                    { key: 'no_shows', color: 'text-rose-400' },
                                    { key: 'cancelaciones', color: 'text-amber-400' },
                                    { key: 'reprogramandos', color: 'text-violet-400' }
                                ].map(field => (
                                    <td key={field.key} className="p-4 text-center">
                                        {editingId === report.id ? (
                                            <input
                                                type="number"
                                                className="w-16 bg-slate-950 border border-slate-700 rounded-lg p-1 text-center text-xs font-black text-white outline-none focus:border-indigo-500"
                                                value={editData[field.key]}
                                                onChange={e => setEditData({ ...editData, [field.key]: parseInt(e.target.value) || 0 })}
                                            />
                                        ) : (
                                            <span className={`text-sm font-black tabular-nums ${field.color}`}>{report[field.key]}</span>
                                        )}
                                    </td>
                                ))}
                                <td className="p-5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {editingId === report.id ? (
                                            <>
                                                <button onClick={() => handleSave(report.id)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 transition-all">
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEdit(report)} className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl hover:bg-indigo-500 hover:text-white transition-all">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(report.id)} className="p-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {reports.length === 0 && (
                    <div className="py-20 text-center text-slate-500 font-bold italic uppercase tracking-widest text-xs">
                        No hay reportes registrados
                    </div>
                )}
            </div>
        </div>
    );
};

export default TriageReportsTable;
