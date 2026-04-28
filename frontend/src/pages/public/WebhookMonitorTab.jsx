import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Radio, RefreshCw, CheckCircle, XCircle, HelpCircle, DatabaseBackup, ArrowRightLeft, Search, Eraser } from 'lucide-react';

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
    const [migrating, setMigrating] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({
        lead_name: '',
        lead_ig: '',
        follower: '',
        qualification: '',
        ad_id: ''
    });
    const [saving, setSaving] = useState(false);

    // Reasignación masiva
    const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
    const [reassignForm, setReassignForm] = useState({
        from_ad_id: '',
        to_ad_id: '',
        start_date: '',
        end_date: '',
        limit: ''
    });
    const [reassignPreviewCount, setReassignPreviewCount] = useState(null);
    const [reassigning, setReassigning] = useState(false);

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

    const handleMigration = async () => {
        if (!window.confirm("¿Estás seguro de querer migrar la tabla antigua de Manychat a las nuevas tablas? Esto procesará todos los registros antiguos. Puede demorar varios segundos.")) return;
        
        try {
            setMigrating(true);
            const res = await api.post('/manychat-webhook/migrate');
            alert(res.data.message);
            fetchLogs(true);
        } catch (err) {
            console.error("Migration error", err);
            alert("Error ejecutando migración: " + (err.response?.data?.message || err.message));
        } finally {
            setMigrating(false);
        }
    }

    const [cleaning, setCleaning] = useState(false);
    const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
    
    const handleCleanupDuplicates = async () => {
        if (!window.confirm("¿Estás seguro de fusionar y limpiar los leads duplicados históricos? Esta acción es irreversible.")) return;
        
        try {
            setCleaningDuplicates(true);
            const res = await api.post('/manychat-webhook/cleanup-duplicates');
            alert(res.data.message);
            fetchLogs(true);
        } catch (err) {
            console.error("Cleanup duplicates error", err);
            alert("Error ejecutando limpieza: " + (err.response?.data?.message || err.message));
        } finally {
            setCleaningDuplicates(false);
        }
    }
    
    const handleCleanup = async () => {
        if (!window.confirm("¿Limpiar todos los registros que contienen 'cuf_' en su Variante u Opening?")) return;
        
        try {
            setCleaning(true);
            const res = await api.post('/manychat-webhook/cleanup-cuf');
            alert(res.data.message);
            fetchLogs(true);
        } catch (err) {
            console.error("Cleanup error", err);
            alert("Error ejecutando limpieza: " + (err.response?.data?.message || err.message));
        } finally {
            setCleaning(false);
        }
    }

    const handlePreviewReassign = async (e) => {
        e.preventDefault();
        try {
            setReassigning(true);
            const res = await api.post('/manychat-webhook/bulk-reassign/preview', reassignForm);
            setReassignPreviewCount(res.data.count);
        } catch (err) {
            alert(err.response?.data?.message || 'Error al previsualizar');
        } finally {
            setReassigning(false);
        }
    };

    const handleExecuteReassign = async () => {
        if (reassignPreviewCount === 0) return;
        const moverCantidad = reassignForm.limit ? Math.min(reassignPreviewCount, parseInt(reassignForm.limit)) : reassignPreviewCount;
        if (!window.confirm(`¿Estás seguro de reasignar ${moverCantidad} leads al Anuncio #${reassignForm.to_ad_id}? Esta acción no se puede deshacer.`)) return;
        
        try {
            setReassigning(true);
            const payload = { ...reassignForm };
            if (payload.limit === '') delete payload.limit;
            const res = await api.post('/manychat-webhook/bulk-reassign', payload);
            alert(res.data.message);
            setIsReassignModalOpen(false);
            setReassignPreviewCount(null);
            fetchLogs(true);
        } catch (err) {
            alert(err.response?.data?.message || 'Error al reasignar');
        } finally {
            setReassigning(false);
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-500/10 rounded-xl">
                        <Radio className="text-violet-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white">Monitor de Webhooks</h3>
                        <p className="text-xs text-slate-500">Últimos leads recibidos desde ManyChat</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCleanup}
                        disabled={cleaning || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold transition-all border border-red-500/20"
                    >
                        <XCircle size={14} className={cleaning ? 'animate-spin' : ''} />
                        {cleaning ? 'Limpiando...' : 'Limpiar CUF'}
                    </button>
                    <button
                        onClick={handleMigration}
                        disabled={migrating || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-xl text-xs font-bold transition-all border border-amber-500/20"
                    >
                        <DatabaseBackup size={14} className={migrating ? 'animate-bounce' : ''} />
                        {migrating ? 'Migrando...' : 'Migrar Data Antigua'}
                    </button>
                    <button
                        onClick={handleCleanupDuplicates}
                        disabled={cleaningDuplicates || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-xl text-xs font-bold transition-all border border-purple-500/20"
                        title="Fusiona leads duplicados en las últimas 24h"
                    >
                        <Eraser size={14} className={cleaningDuplicates ? 'animate-pulse' : ''} />
                        {cleaningDuplicates ? 'Limpiando...' : 'Limpieza Inteligente'}
                    </button>
                    <button
                        onClick={() => {
                            setReassignForm({ from_ad_id: '', to_ad_id: '', start_date: '', end_date: '', limit: '' });
                            setReassignPreviewCount(null);
                            setIsReassignModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
                    >
                        <ArrowRightLeft size={14} /> Reasignación Masiva
                    </button>
                    <button
                        onClick={() => fetchLogs(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
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
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-bold text-[9px] ${ log.last_stage != null ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-600' }`}>
                                            {{ 0: 'Entrante', 1: 'Cualificación', 2: 'Dolor' }[log.last_stage] ?? (log.last_stage != null ? `Stage ${log.last_stage}` : '—')}
                                        </span>
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

            {/* Modal de Reasignación Masiva */}
            {isReassignModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-blue-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                                <ArrowRightLeft className="text-blue-400" size={18} /> Reasignación Masiva
                            </h3>
                            <button onClick={() => setIsReassignModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <p className="text-xs text-slate-400 mb-5">
                                Esta herramienta permite mover leads de un anuncio a otro. Útil si se asignó un ID incorrecto en ManyChat o Meta.
                            </p>
                            
                            <form onSubmit={handlePreviewReassign} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Anuncio Origen (Error)</label>
                                        <input 
                                            type="text"
                                            value={reassignForm.from_ad_id}
                                            onChange={e => setReassignForm({...reassignForm, from_ad_id: e.target.value})}
                                            placeholder="Ej: 154 o 'null'"
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-blue-500 transition-colors font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Anuncio Destino (Correcto)</label>
                                        <input 
                                            type="number"
                                            value={reassignForm.to_ad_id}
                                            onChange={e => setReassignForm({...reassignForm, to_ad_id: e.target.value})}
                                            placeholder="Ej: 200"
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-blue-500 transition-colors font-mono"
                                            required
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Inicio (Opcional)</label>
                                        <input 
                                            type="date"
                                            value={reassignForm.start_date}
                                            onChange={e => setReassignForm({...reassignForm, start_date: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-300 text-sm outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Fin (Opcional)</label>
                                        <input 
                                            type="date"
                                            value={reassignForm.end_date}
                                            onChange={e => setReassignForm({...reassignForm, end_date: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-300 text-sm outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad Exacta a Mover (Opcional)</label>
                                    <input 
                                        type="number"
                                        value={reassignForm.limit}
                                        onChange={e => setReassignForm({...reassignForm, limit: e.target.value})}
                                        placeholder="Ej: 10 (Deja vacío para mover todos)"
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 text-sm outline-none focus:border-blue-500 transition-colors font-mono"
                                    />
                                    <p className="text-[9px] text-slate-500 ml-1">Útil si un anuncio solo recibió "X" leads equivocados un día.</p>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button 
                                        type="submit" 
                                        disabled={reassigning} 
                                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                    >
                                        {reassigning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar Leads Afectados
                                    </button>
                                </div>
                            </form>

                            {reassignPreviewCount !== null && (
                                <div className="mt-6 p-4 rounded-xl border bg-blue-500/10 border-blue-500/30 animate-in slide-in-from-bottom-2">
                                    <div className="text-center space-y-2">
                                        <p className="text-sm font-medium text-slate-300">
                                            Se encontraron <strong className="text-white text-lg">{reassignPreviewCount}</strong> leads coincidentes.
                                            {reassignForm.limit && reassignPreviewCount > 0 && (
                                                <span className="block mt-1 text-amber-400 font-bold">
                                                    ⚠️ Solo se moverán {Math.min(reassignPreviewCount, parseInt(reassignForm.limit))} leads recientes.
                                                </span>
                                            )}
                                        </p>
                                        
                                        {reassignPreviewCount > 0 ? (
                                            <button 
                                                onClick={handleExecuteReassign}
                                                disabled={reassigning}
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                                            >
                                                Confirmar y Mover {reassignForm.limit ? Math.min(reassignPreviewCount, parseInt(reassignForm.limit)) : reassignPreviewCount} Leads
                                            </button>
                                        ) : (
                                            <p className="text-xs text-amber-400">No hay leads que coincidan con estos filtros.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WebhookMonitorTab;
