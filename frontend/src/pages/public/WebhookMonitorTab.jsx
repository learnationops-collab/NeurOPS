import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Radio, RefreshCw, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

const QualificationBadge = ({ value }) => {
    if (value === 'true') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle size={10} /> Cualificado
        </span>
    );
    if (value === 'false') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/30">
            <XCircle size={10} /> No Cualificado
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-500/10 text-slate-400 border border-slate-500/30">
            <HelpCircle size={10} /> Pendiente
        </span>
    );
};

const WebhookMonitorTab = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await api.get('/manychat-webhook/log', { params: { limit: 15 } });
            setLogs(res.data);
        } catch (err) {
            console.error('Error fetching webhook logs:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Calcular resumen
    const totalLeads = logs.length;
    const qualified = logs.filter(l => l.qualification === 'true').length;
    const notQualified = logs.filter(l => l.qualification === 'false').length;
    const pending = logs.filter(l => l.qualification === 'null').length;

    return (
        <div className="space-y-6">
            {/* Header con refresh */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-500/10 rounded-xl">
                        <Radio className="text-violet-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white">Monitor de Webhooks</h3>
                        <p className="text-xs text-slate-500">Últimos leads recibidos desde ManyChat</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchLogs(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Stats rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Recibidos</p>
                    <p className="text-xl font-black text-white">{totalLeads}</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest mb-1">Cualificados</p>
                    <p className="text-xl font-black text-emerald-400">{qualified}</p>
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-red-500/70 uppercase tracking-widest mb-1">No Cual.</p>
                    <p className="text-xl font-black text-red-400">{notQualified}</p>
                </div>
                <div className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pendientes</p>
                    <p className="text-xl font-black text-slate-400">{pending}</p>
                </div>
            </div>

            {/* Log */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-violet-500" size={28} />
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <Radio size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="font-medium text-sm">Sin webhooks recibidos</p>
                    <p className="text-xs mt-1">Los leads de ManyChat aparecerán aquí automáticamente</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {logs.map(log => (
                        <div key={log.id} className="flex items-center gap-4 p-3.5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800/50 rounded-xl transition-colors">
                            {/* Indicador de estado */}
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.qualification === 'true' ? 'bg-emerald-400' :
                                log.qualification === 'false' ? 'bg-red-400' : 'bg-slate-500'
                                }`} />

                            {/* Info principal */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-white">{log.lead_name || 'Desconocido'}</span>
                                    <span className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">ID: {log.manychat_id}</span>
                                    <QualificationBadge value={log.qualification} />
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                    <span>Anuncio: <strong className="text-slate-300">{log.ad_name}</strong></span>
                                    {log.keyword && <span className="font-mono text-slate-600">kw:{log.keyword}</span>}
                                </div>
                            </div>

                            {/* Timestamp */}
                            <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-slate-600">
                                    {log.created_at ? new Date(log.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                    {log.created_at ? new Date(log.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Instrucciones del endpoint */}
            <div className="bg-slate-800/20 border border-slate-800/50 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Endpoint</p>
                <code className="block text-xs text-violet-400 bg-slate-900/50 p-3 rounded-lg font-mono">
                    POST /api/manychat-webhook
                </code>
                <p className="text-[10px] text-slate-600 mt-2 whitespace-pre-wrap font-mono">
                    Body: {`{ \n  "manychat_id": "...",\n  "lead_name": "...",\n  "ad_id": N,\n  "keyword": "...",\n  "cualificacion": "true/false/null"\n}`}
                </p>
            </div>
        </div>
    );
};

export default WebhookMonitorTab;
