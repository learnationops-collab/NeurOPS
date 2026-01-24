import React, { useState } from 'react';
import { Database, Trash2, Zap, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const OperationsPage = () => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [counts, setCounts] = useState({ leads: 20, agendas: 15, sales: 5 });

    const handleClear = async () => {
        if (!window.confirm("¿ESTÁS SEGURO? Esta acción borrará todos los leads, agendas y ventas de forma irreversible.")) return;

        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await axios.post('/api/admin/ops/clear');
            setMessage({ type: 'success', text: res.data.message });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al limpiar base de datos' });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await axios.post('/api/admin/ops/generate', counts);
            setMessage({ type: 'success', text: res.data.message });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al generar datos' });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all";

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Database className="text-blue-500" />
                        Operaciones de Sistema
                    </h1>
                    <p className="text-slate-400 mt-1">Gestión de datos masivos y herramientas de desarrollo.</p>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Mock Data Generator */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <Zap className="text-blue-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-white">Generador de Datos Ficticios</h2>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">Cant. de Leads (Clientes)</label>
                            <input
                                type="number"
                                value={counts.leads}
                                onChange={(e) => setCounts({ ...counts, leads: parseInt(e.target.value) })}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">Cant. de Agendas</label>
                            <input
                                type="number"
                                value={counts.agendas}
                                onChange={(e) => setCounts({ ...counts, agendas: parseInt(e.target.value) })}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">Cant. de Ventas (Enrollments)</label>
                            <input
                                type="number"
                                value={counts.sales}
                                onChange={(e) => setCounts({ ...counts, sales: parseInt(e.target.value) })}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Zap size={20} />}
                        Generar Datos de Prueba
                    </button>
                    <p className="text-xs text-slate-500 mt-4 text-center">
                        * Los datos se distribuirán aleatoriamente entre los Closers existentes.
                    </p>
                </div>

                {/* Danger Zone */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-1 bg-rose-500 text-[10px] font-bold text-white uppercase tracking-widest -rotate-45 translate-x-4 translate-y-2 w-24 text-center">
                        Peligro
                    </div>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-rose-500/10 rounded-xl">
                            <Trash2 className="text-rose-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-white">Zona de Limpieza</h2>
                    </div>

                    <p className="text-slate-400 mb-8 leading-relaxed">
                        Esta herramienta eliminará **TODOS** los registros de Clientes, Agendas, Ventas, Pagos y Encuestas.
                        Los usuarios administradores y closers **NO** serán afectados.
                    </p>

                    <div className="p-4 bg-rose-500/5 rounded-xl border border-rose-500/10 mb-8">
                        <div className="flex gap-3 text-rose-500 text-sm">
                            <AlertTriangle size={18} className="shrink-0" />
                            <span>Esta acción es irreversible. Se recomienda usar solo en entornos de desarrollo o pruebas.</span>
                        </div>
                    </div>

                    <button
                        onClick={handleClear}
                        disabled={loading}
                        className="w-full bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-500 hover:text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Trash2 size={20} />}
                        Limpiar Base de Datos de Negocio
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OperationsPage;
