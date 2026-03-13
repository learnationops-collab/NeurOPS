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

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({
        lead_name: '',
        lead_ig: '',
        follower: '',
        qualification: '',
        ad_id: ''
    });
    const [saving, setSaving] = useState(false);

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
    const startEditing = (log) => {
        setEditingId(log.id);
        setEditForm({
            lead_name: log.lead_name || '',
            lead_ig: log.lead_ig || '',
            follower: log.follower === true ? 'true' : 'false',
            qualification: log.qualification || 'null',
            ad_id: log.ad_id || ''
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
    };

    const saveEdit = async (id) => {
        try {
            setSaving(true);
            await api.put(`/manychat-webhook/answer/${id}`, editForm);
            setEditingId(null);
            fetchLogs(true);
        } catch (err) {
            console.error('Error saving lead:', err);
            alert('Error al guardar los cambios');
        } finally {
            setSaving(false);
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
                    {logs.map(log =>
                        editingId === log.id ? (
                            <div key={log.id} className="p-4 bg-slate-800 border border-slate-700 rounded-xl space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Nombre</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-violet-500"
                                            value={editForm.lead_name}
                                            onChange={e => setEditForm({ ...editForm, lead_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">IG Username</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-violet-500"
                                            value={editForm.lead_ig}
                                            onChange={e => setEditForm({ ...editForm, lead_ig: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Follower</label>
                                        <select
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-violet-500"
                                            value={editForm.follower}
                                            onChange={e => setEditForm({ ...editForm, follower: e.target.value })}
                                        >
                                            <option value="true">Sí (Follower)</option>
                                            <option value="false">No Follower</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Ad ID</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-violet-500 font-mono"
                                            value={editForm.ad_id}
                                            onChange={e => setEditForm({ ...editForm, ad_id: e.target.value })}
                                            placeholder="Vacio = N/A"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Cualificación</label>
                                        <select
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-violet-500"
                                            value={editForm.qualification}
                                            onChange={e => setEditForm({ ...editForm, qualification: e.target.value })}
                                        >
                                            <option value="true">Cualificado</option>
                                            <option value="false">No Cualificado</option>
                                            <option value="null">Pendiente</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1 border-t border-slate-700/50 mt-2">
                                    <button onClick={cancelEditing} disabled={saving} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">Cancelar</button>
                                    <button onClick={() => saveEdit(log.id)} disabled={saving} className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                                        {saving ? <Loader2 size={12} className="animate-spin" /> : null} Guardar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div key={log.id} className="flex items-center gap-4 p-3.5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800/50 rounded-xl transition-colors group">
                                {/* Indicador de estado */}
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.qualification === 'true' ? 'bg-emerald-400' :
                                    log.qualification === 'false' ? 'bg-red-400' : 'bg-slate-500'
                                    }`} />

                                {/* Info principal */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-white leading-none">{log.lead_name || 'Desconocido'}</span>
                                        {log.lead_ig && (
                                            <a href={`https://instagram.com/${log.lead_ig}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-pink-400 hover:underline">
                                                @{log.lead_ig}
                                            </a>
                                        )}
                                        {log.follower && (
                                            <span className="text-[9px] font-black uppercase tracking-widest text-violet-300 bg-violet-500/20 px-1.5 py-0.5 rounded border border-violet-500/30">
                                                Follower
                                            </span>
                                        )}
                                        <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded leading-none">ID: {log.manychat_id}</span>
                                        <QualificationBadge value={log.qualification} />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500 pb-1">
                                        <span className="flex items-center gap-1">Ad: <strong className="text-slate-300">{log.ad_name}</strong> {log.ad_id ? <span className="font-mono text-[9px]">(#{log.ad_id})</span> : ''}</span>
                                        {log.variante && <span>Var: <strong className="text-amber-400 font-medium">{log.variante}</strong></span>}
                                        {log.opening && <span>Open: <strong className="text-blue-400 font-medium">{log.opening}</strong></span>}
                                        {log.fecha && <span>Fecha (MC): <strong className="text-slate-400">{log.fecha}</strong></span>}
                                    </div>
                                </div>

                                {/* Timestamp y Acciones */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-600">
                                            {log.created_at ? new Date(log.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-mono">
                                            {log.created_at ? new Date(log.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => startEditing(log)}
                                        className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="Editar Lead"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                    </button>
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Instrucciones del endpoint */}
            <div className="bg-slate-800/20 border border-slate-800/50 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Endpoint</p>
                <code className="block text-xs text-violet-400 bg-slate-900/50 p-3 rounded-lg font-mono">
                    POST /api/manychat-webhook
                </code>
                <p className="text-[10px] text-slate-600 mt-2 whitespace-pre-wrap font-mono">
                    Body: {`{ \n  "manychat_id": "...",\n  "lead_name": "...",\n  "lead_ig": "...",\n  "follower": "true/false",\n  "ad_id": N,\n  "keyword": "...",\n  "opening": "...",\n  "variante": "...",\n  "fecha": "...",\n  "cualificacion": "true/false/null"\n}`}
                </p>
            </div>
        </div>
    );
};

export default WebhookMonitorTab;
