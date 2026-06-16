import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { 
    Loader2, RefreshCw, CheckCircle2, XCircle, HelpCircle, 
    Search, Edit2, Check, X, Radio, ArrowRight, Instagram
} from 'lucide-react';
import LeadRoadmapModal from '../../components/modals/LeadRoadmapModal';

const QualificationBadge = ({ value }) => {
    if (value === 'true') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/5">
            <CheckCircle2 size={10} /> Cualificado
        </span>
    );
    if (value === 'false') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-red-500/15 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/5">
            <XCircle size={10} /> No Cualificado
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 shadow-sm">
            <HelpCircle size={10} /> Pendiente
        </span>
    );
};

const formatTimeRelative = (isoStr) => {
    if (!isoStr) return '—';
    try {
        const d = new Date(isoStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        
        if (diffMin < 1) return 'Hace un momento';
        if (diffMin < 60) return `Hace ${diffMin} min`;
        
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `Hace ${diffHr} ${diffHr === 1 ? 'hora' : 'horas'}`;
        
        const diffDays = Math.floor(diffHr / 24);
        if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
        
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return '—';
    }
};

const FlowProgress = ({ log }) => {
    // 1. Llegada (Inbox) -> Siempre activo
    const step1 = true;
    // 2. Mensaje Enviado -> Si tiene opening u option_send
    const step2 = !!(log.opening || log.id_option_send);
    // 3. Respondido -> Si tiene id_option
    const step3 = !!log.id_option;
    // 4. Calificado -> Si qualification no es null
    const step4 = log.qualification === 'true' || log.qualification === 'false';

    const steps = [
        { label: 'Inbox', active: step1, color: 'bg-indigo-500 text-indigo-400' },
        { label: 'Mensaje', active: step2, color: 'bg-sky-500 text-sky-400' },
        { label: 'Respuesta', active: step3, color: 'bg-fuchsia-500 text-fuchsia-400' },
        { label: 'Cualificación', active: step4, color: log.qualification === 'true' ? 'bg-emerald-500 text-emerald-400' : log.qualification === 'false' ? 'bg-rose-500 text-rose-400' : 'bg-amber-500 text-amber-400' }
    ];

    return (
        <div className="flex items-center gap-2">
            {steps.map((step, idx) => (
                <React.Fragment key={idx}>
                    <div className="flex items-center gap-1.5">
                        <span 
                            className={`w-2 h-2 rounded-full transition-all duration-500 shadow-sm ${
                                step.active ? `${step.color.split(' ')[0]} scale-110 shadow-current` : 'bg-slate-800'
                            }`}
                        />
                        <span 
                            className={`text-[8px] font-black uppercase tracking-wider leading-none transition-colors duration-500 ${
                                step.active ? 'text-white' : 'text-slate-600'
                            }`}
                        >
                            {step.label}
                        </span>
                    </div>
                    {idx < steps.length - 1 && (
                        <ArrowRight size={10} className={step.active && steps[idx+1].active ? 'text-indigo-500/50' : 'text-slate-800'} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

const IncomingLeadsTab = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Búsqueda y Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [qualFilter, setQualFilter] = useState('all');
    const [limit, setLimit] = useState(30);
    const [selectedRoadmapLead, setSelectedRoadmapLead] = useState(null);

    // Edición de keyword inline
    const [editingId, setEditingId] = useState(null);
    const [editKeyword, setEditKeyword] = useState('');
    const [savingId, setSavingId] = useState(null);

    const intervalRef = useRef(null);

    const fetchLogs = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await api.get('/manychat-webhook/log', { params: { limit } });
            setLogs(res.data || []);
        } catch (err) {
            console.error('Error fetching webhook logs:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Control del Auto-Refresco
    useEffect(() => {
        fetchLogs();
    }, [limit]);

    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => {
                fetchLogs(true);
            }, 5000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoRefresh, limit]);

    // Guardar cambio de palabra clave
    const saveKeyword = async (id, currentLog) => {
        try {
            setSavingId(id);
            const payload = {
                lead_name: currentLog.lead_name,
                lead_ig: currentLog.lead_ig,
                follower: currentLog.follower,
                qualification: currentLog.qualification,
                ad_id: currentLog.ad_id,
                keyword: editKeyword
            };
            await api.put(`/manychat-webhook/answer/${id}`, payload);
            setEditingId(null);
            fetchLogs(true);
        } catch (err) {
            console.error('Error saving keyword:', err);
            alert('Error al guardar la palabra clave');
        } finally {
            setSavingId(null);
        }
    };

    const startEditing = (log) => {
        setEditingId(log.id);
        setEditKeyword(log.keyword || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
    };

    // Filtrado local en el cliente para máxima velocidad
    const filteredLogs = logs.filter(log => {
        // Filtro de Cualificación
        if (qualFilter !== 'all' && log.qualification !== qualFilter) return false;

        // Filtro de Búsqueda (Nombre, Instagram o Keyword)
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            const nameMatch = (log.lead_name || '').toLowerCase().includes(term);
            const igMatch = (log.lead_ig || '').toLowerCase().includes(term);
            const kwMatch = (log.keyword || '').toLowerCase().includes(term);
            const adMatch = (log.ad_name || '').toLowerCase().includes(term);
            return nameMatch || igMatch || kwMatch || adMatch;
        }

        return true;
    });

    return (
        <div className="space-y-6">
            {/* Cabecera con filtros y controles */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-violet-500/10 rounded-2xl border border-violet-500/20 text-violet-400">
                        <Radio size={18} className={autoRefresh ? 'animate-pulse' : ''} />
                    </div>
                    <div className="text-left">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Flujo de Conversaciones</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Leads por anuncios ingresando vía Manychat</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Búsqueda */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar prospecto, IG o keyword..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-xs font-bold rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-violet-500 transition-all min-w-[240px]"
                        />
                    </div>

                    {/* Selector de Cualificación */}
                    <div className="flex flex-col gap-1 text-left">
                        <select
                            value={qualFilter}
                            onChange={e => setQualFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-xs font-bold rounded-xl px-4 py-2.5 text-white outline-none focus:border-violet-500 cursor-pointer min-w-[150px]"
                        >
                            <option value="all">Todas las cualificaciones</option>
                            <option value="true">Cualificados</option>
                            <option value="false">No Cualificados</option>
                            <option value="null">Pendientes</option>
                        </select>
                    </div>

                    {/* Límite */}
                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                        <span className="text-[9px] font-black text-slate-500 uppercase">Ver:</span>
                        <select
                            value={limit}
                            onChange={e => setLimit(parseInt(e.target.value))}
                            className="bg-transparent text-xs font-black text-white outline-none cursor-pointer"
                        >
                            <option value="15">15</option>
                            <option value="30">30</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>

                    {/* Interruptor Auto-Refresco */}
                    <div className="flex items-center gap-2.5 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 select-none">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tiempo Real</span>
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            type="button"
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                                autoRefresh ? 'bg-violet-600 shadow-lg shadow-violet-600/20' : 'bg-slate-900 border border-slate-850'
                            }`}
                        >
                            <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                                    autoRefresh ? 'translate-x-4.5' : 'translate-x-0.5'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Botón Refrescar Manual */}
                    <button
                        onClick={() => fetchLogs(true)}
                        disabled={refreshing}
                        className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all active:scale-95 shadow-md"
                        title="Actualizar ahora"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Listado de Logs */}
            {loading && logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <Loader2 className="animate-spin text-violet-500" size={32} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Cargando flujos...</span>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] py-20 text-center text-slate-500 shadow-xl">
                    <Radio size={48} className="mx-auto mb-4 opacity-15 text-violet-400" />
                    <p className="font-black uppercase tracking-wider text-sm text-slate-400">Sin leads coincidentes</p>
                    <p className="text-[10px] mt-1 text-slate-500 uppercase font-bold tracking-widest">Los leads entrantes por anuncios aparecerán aquí automáticamente</p>
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-950/40 border-b border-slate-800/80">
                                    <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] w-8">#</th>
                                    <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Prospecto (Instagram)</th>
                                    <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Palabra Clave (Keyword)</th>
                                    <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Anuncio Relacionado</th>
                                    <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Cualificación</th>
                                    <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Flujo (Estatus)</th>
                                    <th className="p-5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Recibido</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40 font-medium">
                                {filteredLogs.map((log, idx) => (
                                    <tr key={log.id} className="hover:bg-violet-500/5 transition-all duration-150">
                                        <td className="p-5 text-[10px] font-black text-slate-600 font-mono">{idx + 1}</td>
                                        <td className="p-5">
                                            <div className="flex flex-col text-left space-y-1">
                                                <span 
                                                    className="text-xs font-black text-white uppercase tracking-wide leading-none hover:text-indigo-400 hover:underline cursor-pointer"
                                                    onClick={() => setSelectedRoadmapLead({
                                                        instagram: log.lead_ig,
                                                        email: null,
                                                        phone: null,
                                                        full_name: log.lead_name
                                                    })}
                                                >
                                                    {log.lead_name || 'Desconocido'}
                                                </span>
                                                {log.lead_ig ? (
                                                    <a 
                                                        href={`https://instagram.com/${log.lead_ig.replace('@', '')}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="inline-flex items-center gap-1 text-[10px] font-black text-pink-400 hover:text-pink-300 hover:underline w-fit leading-none"
                                                    >
                                                        <Instagram size={10} /> @{log.lead_ig.replace('@', '')}
                                                    </a>
                                                ) : (
                                                    <span className="text-[10px] text-slate-600 leading-none">Sin Instagram</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            {editingId === log.id ? (
                                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={editKeyword}
                                                        onChange={e => setEditKeyword(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') saveKeyword(log.id, log);
                                                            if (e.key === 'Escape') cancelEditing();
                                                        }}
                                                        className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono outline-none focus:border-violet-500 w-32"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => saveKeyword(log.id, log)}
                                                        disabled={savingId === log.id}
                                                        className="p-1 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-md transition-colors"
                                                        title="Guardar"
                                                    >
                                                        {savingId === log.id ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Check size={12} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        disabled={savingId === log.id}
                                                        className="p-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 rounded-md transition-colors"
                                                        title="Cancelar"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group/kw">
                                                    <span className="text-xs font-mono font-bold text-slate-300 bg-slate-950/60 px-2 py-1 border border-slate-850 rounded-lg select-all">
                                                        {log.keyword || '—'}
                                                    </span>
                                                    <button
                                                        onClick={() => startEditing(log)}
                                                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors opacity-0 group-hover/kw:opacity-100"
                                                        title="Editar palabra clave"
                                                    >
                                                        <Edit2 size={10} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            <span className={`text-xs font-bold ${log.ad_id ? 'text-white' : 'text-slate-500 italic'}`}>
                                                {log.ad_name || 'Desatribuido'}
                                            </span>
                                            {log.ad_id && (
                                                <span className="block text-[8px] font-mono text-slate-500 mt-0.5">ID Anuncio: #{log.ad_id}</span>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            <QualificationBadge value={log.qualification} />
                                        </td>
                                        <td className="p-5">
                                            <FlowProgress log={log} />
                                        </td>
                                        <td className="p-5 text-right">
                                            <p className="text-xs font-black text-white whitespace-nowrap">
                                                {formatTimeRelative(log.created_at)}
                                            </p>
                                            {log.created_at && (
                                                <p className="text-[9px] text-slate-500 mt-1 font-mono">
                                                    {new Date(log.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} {new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedRoadmapLead && (
                <LeadRoadmapModal
                    isOpen={!!selectedRoadmapLead}
                    instagram={selectedRoadmapLead.instagram}
                    email={selectedRoadmapLead.email}
                    phone={selectedRoadmapLead.phone}
                    onClose={() => setSelectedRoadmapLead(null)}
                    onSuccess={() => fetchLogs(true)}
                />
            )}
        </div>
    );
};

export default IncomingLeadsTab;
