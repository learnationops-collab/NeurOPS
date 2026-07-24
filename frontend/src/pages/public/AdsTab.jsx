import React, { useState, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Plus, Trash2, Pencil, Save, X, Megaphone, Folder, Layers, ChevronDown, ChevronRight, Tag, Eye, EyeOff } from 'lucide-react';

// Badge para mostrar estado de campaña/conjunto/anuncio
const StatusBadge = ({ status, onClick }) => (
    <button onClick={onClick} className="group shrink-0" type="button">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all
            ${status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]'
            }`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {status === 'active' ? 'Activo' : 'Pausado'}
        </span>
    </button>
);

// Modal genérico para formularios
const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">{title}</h3>
                <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <X size={18} />
                </button>
            </div>
            <div className="p-5 overflow-y-auto">
                {children}
            </div>
        </div>
    </div>
);

const AdsTab = ({ campaigns, ads, onRefresh, loading }) => {
    const [expandedCamps, setExpandedCamps] = useState({});
    const [expandedSets, setExpandedSets] = useState({});
    const [showPaused, setShowPaused] = useState(false);

    // Configuración para el modal unificado
    const [modal, setModal] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleCamp = (id) => setExpandedCamps(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleSet = (id) => setExpandedSets(prev => ({ ...prev, [id]: !prev[id] }));

    const openCreateCamp = () => { setFormData({ name: '' }); setModal({ type: 'create_camp' }); };
    const openEditCamp = (c) => { setFormData({ name: c.name, status: c.status }); setModal({ type: 'edit_camp', id: c.id }); };
    
    const openCreateSet = (campId) => { setFormData({ name: '', campaign_id: campId }); setModal({ type: 'create_set' }); };
    const openEditSet = (s) => { setFormData({ name: s.name, status: s.status }); setModal({ type: 'edit_set', id: s.id }); };
    const openMoveSet = (s) => { setFormData({ campaign_id: s.campaign_id }); setModal({ type: 'move_set', id: s.id, item: s }); };

    const openCreateAd = (setId) => { setFormData({ name: '', keyword: '', ad_set_id: setId }); setModal({ type: 'create_ad' }); };
    const openEditAd = (a) => { setFormData({ name: a.name, keyword: a.keyword || '', status: a.status }); setModal({ type: 'edit_ad', id: a.id }); };
    const openMoveAd = (a) => { setFormData({ ad_set_id: a.ad_set_id }); setModal({ type: 'move_ad', id: a.id, item: a }); };

    // Conteo de elementos pausados (campañas, conjuntos de campañas visibles, y anuncios)
    const pausedCount = useMemo(() => {
        const pausedCamps = campaigns.filter(c => c.status === 'paused').length;
        const pausedSets = campaigns.flatMap(c => c.ad_sets || []).filter(s => s.status === 'paused').length;
        const pausedAds = ads.filter(a => a.status === 'paused').length;
        return pausedCamps + pausedSets + pausedAds;
    }, [campaigns, ads]);

    // Filtrar campañas, conjuntos y anuncios si showPaused es false
    const visibleCampaigns = useMemo(() => {
        if (showPaused) return campaigns;
        return campaigns.filter(c => c.status !== 'paused');
    }, [campaigns, showPaused]);

    const getVisibleSets = (camp) => {
        const sets = camp.ad_sets || [];
        if (showPaused) return sets;
        return sets.filter(s => s.status !== 'paused');
    };

    const getVisibleAds = (setId) => {
        const setAds = adsForSet(setId);
        if (showPaused) return setAds;
        return setAds.filter(a => a.status !== 'paused');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (modal.type === 'create_camp') {
                if (!formData.name.trim()) return;
                await api.post('/public/campaigns', formData);
            } else if (modal.type === 'edit_camp') {
                await api.put(`/public/campaigns/${modal.id}`, formData);
            } else if (modal.type === 'create_set') {
                if (!formData.name.trim()) return;
                await api.post('/public/adsets', formData);
                setExpandedCamps(prev => ({...prev, [formData.campaign_id]: true}));
            } else if (modal.type === 'edit_set') {
                await api.put(`/public/adsets/${modal.id}`, formData);
            } else if (modal.type === 'move_set') {
                await api.put(`/public/adsets/${modal.id}`, { campaign_id: formData.campaign_id });
            } else if (modal.type === 'create_ad') {
                if (!formData.name.trim() || !formData.keyword.trim()) return;
                await api.post('/public/ads', formData);
                setExpandedSets(prev => ({...prev, [formData.ad_set_id]: true}));
            } else if (modal.type === 'edit_ad') {
                await api.put(`/public/ads/${modal.id}`, formData);
            } else if (modal.type === 'move_ad') {
                await api.put(`/public/ads/${modal.id}`, { ad_set_id: formData.ad_set_id });
            }
            
            setModal(null);
            onRefresh();
        } catch (err) {
            alert('Error al guardar: ' + (err.response?.data?.message || err.response?.data?.error || err.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (type, item) => {
        const url = type === 'camp' ? `/public/campaigns/${item.id}` 
                  : type === 'set' ? `/public/adsets/${item.id}` 
                  : `/public/ads/${item.id}`;
        try {
            await api.put(url, { status: item.status === 'active' ? 'paused' : 'active' });
            onRefresh();
        } catch (err) { alert('Error al actualizar estado'); }
    };

    const handleDelete = async (type, item) => {
        if (!confirm(`¿Eliminar ${type === 'camp' ? 'campaña' : type === 'set' ? 'conjunto' : 'anuncio'} "${item.name}"? Se borrarán sus dependencias y gastos.`)) return;
        const url = type === 'camp' ? `/public/campaigns/${item.id}` 
                  : type === 'set' ? `/public/adsets/${item.id}` 
                  : `/public/ads/${item.id}`;
        try {
            await api.delete(url);
            onRefresh();
        } catch (err) {}
    };

    const adsForSet = (setId) => ads.filter(a => a.ad_set_id === setId);

    const getSetMetrics = (setId) => {
        const myAds = adsForSet(setId);
        return myAds.reduce((acc, ad) => ({
            total_spend: acc.total_spend + (ad.total_spend || 0),
            total_leads: acc.total_leads + (ad.total_leads || 0),
            qualified_leads: acc.qualified_leads + (ad.qualified_leads || 0)
        }), { total_spend: 0, total_leads: 0, qualified_leads: 0 });
    };

    const getCampMetrics = (camp) => {
        return (camp.ad_sets || []).reduce((acc, set) => {
            const m = getSetMetrics(set.id);
            return {
                total_spend: acc.total_spend + m.total_spend,
                total_leads: acc.total_leads + m.total_leads,
                qualified_leads: acc.qualified_leads + m.qualified_leads
            };
        }, { total_spend: 0, total_leads: 0, qualified_leads: 0 });
    };

    const renderModalForm = () => {
        if (!modal) return null;
        
        const isCamp = modal.type.includes('camp');
        const isSet = modal.type.includes('set');
        const isAd = modal.type.includes('ad');
        const isMove = modal.type.includes('move_');

        let title = "Formulario";
        if (modal.type === 'create_camp') title = "Nueva Campaña";
        if (modal.type === 'edit_camp') title = "Editar Campaña";
        if (modal.type === 'create_set') title = "Nuevo Conjunto de Anuncios";
        if (modal.type === 'edit_set') title = "Editar Conjunto";
        if (modal.type === 'create_ad') title = "Nuevo Anuncio";
        if (modal.type === 'edit_ad') title = "Editar Anuncio";
        if (modal.type === 'move_set') title = `Mover Conjunto "${modal.item?.name}"`;
        if (modal.type === 'move_ad') title = `Mover Anuncio "${modal.item?.name}"`;

        return (
            <Modal title={title} onClose={() => setModal(null)}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {isAd && modal.id && (
                        <div className="space-y-1.5 opacity-80">
                            <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider ml-1">Ad ID (Para Webhook)</label>
                            <div className="w-full px-4 py-3 bg-slate-950 border border-emerald-500/20 rounded-xl text-emerald-400 font-black font-mono text-sm shadow-inner group flex items-center justify-between">
                                #{modal.id}
                                <span className="text-[9px] text-slate-500 uppercase">Usar este ID en ManyChat</span>
                            </div>
                        </div>
                    )}

                    {!isMove && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nombre</label>
                            <input type="text" required autoFocus placeholder="Ej: Black Friday..."
                                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-medium transition-colors"
                                value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                    )}

                    {isAd && !isMove && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Keyword (Manychat)</label>
                            <input type="text" required placeholder="Ej: INFO-PROMO..."
                                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-mono text-sm outline-none focus:border-emerald-500 transition-colors"
                                value={formData.keyword || ''} onChange={e => setFormData({...formData, keyword: e.target.value})}
                            />
                        </div>
                    )}

                    {modal.type === 'move_set' && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Campaña Destino</label>
                            <select 
                                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition-colors"
                                value={formData.campaign_id || ''} onChange={e => setFormData({...formData, campaign_id: parseInt(e.target.value)})}
                            >
                                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}

                    {modal.type === 'move_ad' && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Conjunto Destino</label>
                            <select 
                                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition-colors"
                                value={formData.ad_set_id || ''} onChange={e => setFormData({...formData, ad_set_id: parseInt(e.target.value)})}
                            >
                                {campaigns.map(c => {
                                    if(!c.ad_sets || c.ad_sets.length === 0) return null;
                                    return (
                                        <optgroup key={c.id} label={c.name}>
                                            {c.ad_sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </optgroup>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
                        <button type="button" onClick={() => setModal(null)} className="px-5 py-2.5 text-slate-400 hover:text-white transition-colors text-sm font-bold">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(52,211,153,0.3)] disabled:opacity-50">
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                            Guardar
                        </button>
                    </div>
                </form>
            </Modal>
        );
    };

    return (
        <div className="space-y-6 relative">
            {renderModalForm()}

            {/* Cabecera y acciones */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Administrador de Estructura</h2>
                    <p className="text-sm text-slate-400 font-medium">Organiza tus presupuestos en Campañas &gt; Conjuntos &gt; Anuncios</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setShowPaused(!showPaused)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                            showPaused
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/50'
                        }`}
                    >
                        {showPaused ? <EyeOff size={16} /> : <Eye size={16} />}
                        {showPaused ? 'Ocultar Pausados' : `Mostrar Pausados (${pausedCount})`}
                    </button>
                    <button
                        onClick={openCreateCamp}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(52,211,153,0.2)] active:scale-95"
                    >
                        <Plus size={18} /> Nueva Campaña
                    </button>
                </div>
            </div>

            {/* Grid de Campañas (Tarjetas) */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : visibleCampaigns.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-slate-800/50">
                    <Folder size={64} className="mx-auto mb-4 text-emerald-500/20" />
                    <p className="text-xl font-black text-white italic tracking-tighter uppercase">Sin Campañas</p>
                    <p className="text-slate-400 text-sm">{showPaused ? 'Crea tu primera campaña para comenzar a ordenar tus anuncios.' : 'No hay campañas activas o visibles.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {visibleCampaigns.map(camp => {
                        const mCamp = getCampMetrics(camp);
                        const isExpanded = expandedCamps[camp.id];
                        const visibleSets = getVisibleSets(camp);

                        return (
                            <div key={camp.id} className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-xl flex flex-col transition-all duration-300 overflow-hidden">
                                {/* Encabezado de tarjeta de campaña */}
                                <div 
                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 cursor-pointer bg-gradient-to-r from-slate-800/80 to-transparent hover:from-slate-800 transition-colors border-b border-slate-800/80"
                                    onClick={(e) => { 
                                        if (e.target.closest('button')) return;
                                        toggleCamp(camp.id); 
                                    }}
                                >
                                    <div className="flex items-start sm:items-center gap-4 mb-4 sm:mb-0">
                                        <div className={`p-3 rounded-xl border transition-colors ${isExpanded ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                                            <Folder size={28} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-xl font-black text-white tracking-tight">{camp.name}</h3>
                                                <StatusBadge status={camp.status} onClick={() => handleToggleStatus('camp', camp)} />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono mt-2">
                                                <span className="bg-slate-950 px-2 py-1 rounded-md border border-slate-800/50 shadow-inner">
                                                    Conjuntos: <span className="text-emerald-400 font-bold">{visibleSets.length}</span>
                                                </span>
                                                <span className="bg-slate-950 px-2 py-1 rounded-md border border-slate-800/50 shadow-inner">
                                                    Gasto: <span className="text-amber-400 font-bold">${mCamp.total_spend.toFixed(2)}</span>
                                                </span>
                                                <span className="bg-slate-950 px-2 py-1 rounded-md border border-slate-800/50 shadow-inner">
                                                    Leads: <span className="text-blue-400 font-bold">{mCamp.total_leads}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <button onClick={(e) => { e.stopPropagation(); openCreateSet(camp.id); }} className="text-xs font-bold px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5">
                                            <Plus size={14} /> Conjunto
                                        </button>
                                        <div className="w-px h-6 bg-slate-700/50 mx-1 hidden sm:block" />
                                        <div className="flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); openEditCamp(camp); }} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Editar"><Pencil size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete('camp', camp); }} className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                                            <button className={`p-2 rounded-lg transition-colors ml-1 ${isExpanded ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
                                                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Listado de conjuntos de anuncios */}
                                {isExpanded && (
                                    <div className="bg-slate-950 p-4 space-y-4">
                                        {visibleSets.length === 0 ? (
                                            <div className="py-8 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                                                <Layers size={32} className="mx-auto mb-2 opacity-20" />
                                                <span className="text-sm font-medium">No hay conjuntos de anuncios visibles en esta campaña.</span>
                                                <button onClick={() => openCreateSet(camp.id)} className="block mx-auto mt-3 text-xs text-emerald-400 hover:underline">Crear el primero</button>
                                            </div>
                                        ) : (
                                            visibleSets.map(set => {
                                                const mSet = getSetMetrics(set.id);
                                                const isSetExpanded = expandedSets[set.id];
                                                const visibleAds = getVisibleAds(set.id);

                                                return (
                                                    <div key={set.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                                        <div 
                                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-800/40 cursor-pointer transition-colors border-b border-transparent data-[expanded=true]:border-slate-800/80"
                                                            data-expanded={isSetExpanded}
                                                            onClick={(e) => { 
                                                                if (e.target.closest('button')) return;
                                                                toggleSet(set.id); 
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3 mb-3 sm:mb-0">
                                                                <div className={`p-1.5 rounded-lg ${isSetExpanded ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-950'}`}>
                                                                    {isSetExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                </div>
                                                                <Layers size={20} className={isSetExpanded ? 'text-emerald-400' : 'text-slate-500'} />
                                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                                                    <span className="text-white font-bold text-base tracking-wide">{set.name}</span>
                                                                    <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded-md border border-slate-800/50">
                                                                        Gasto: <span className="text-amber-400">${mSet.total_spend.toFixed(2)}</span> | Leads: <span className="text-blue-400">{mSet.total_leads}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                                <StatusBadge status={set.status} onClick={() => handleToggleStatus('set', set)} />
                                                                <button onClick={(e) => { e.stopPropagation(); openCreateAd(set.id); }} className="ml-1 text-[10px] font-black uppercase px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-all border border-slate-700 flex items-center gap-1">
                                                                    <Plus size={12} /> Anuncio
                                                                </button>
                                                                <div className="w-px h-5 bg-slate-700 mx-1 hidden sm:block" />
                                                                <div className="flex gap-1">
                                                                    <button onClick={(e) => { e.stopPropagation(); openEditSet(set); }} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Editar"><Pencil size={14} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); openMoveSet(set); }} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors" title="Mover Conjunto a otra Campaña"><Folder size={14} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete('set', set); }} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* listado de anuncios (Nivel 3) */}
                                                        {isSetExpanded && (
                                                            <div className="bg-slate-950/80 p-0 overflow-x-auto">
                                                                {visibleAds.length === 0 ? (
                                                                    <div className="py-4 text-center text-xs text-slate-500 font-medium">No hay anuncios visibles en este conjunto.</div>
                                                                ) : (
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="bg-slate-900 border-b border-slate-800 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                                                                <th className="py-3 px-4 w-12 text-center">ID</th>
                                                                                <th className="py-3 px-2 w-8">Icono</th>
                                                                                <th className="py-3 px-2">Anuncio</th>
                                                                                <th className="py-3 px-2">Keyword</th>
                                                                                <th className="py-3 px-2">Estado</th>
                                                                                <th className="py-3 px-2 text-right">Gasto</th>
                                                                                <th className="py-3 px-2 text-right">Leads</th>
                                                                                <th className="py-3 px-2 text-right">CPL</th>
                                                                                <th className="py-3 px-4 text-right">Acciones</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-800/50">
                                                                            {visibleAds.map(ad => (
                                                                                <tr key={ad.id} className="hover:bg-slate-800/40 transition-colors group">
                                                                                    <td className="py-3 px-4 text-center">
                                                                                        <span className="font-mono text-[10px] text-slate-400 font-black bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 shadow-sm">#{ad.id}</span>
                                                                                    </td>
                                                                                    <td className="py-3 px-2 text-emerald-500/70"><Megaphone size={14} /></td>
                                                                                    <td className="py-3 px-2">
                                                                                        <span className="text-white font-bold">{ad.name}</span>
                                                                                    </td>
                                                                                    <td className="py-3 px-2">
                                                                                        <span className="bg-slate-900 border border-slate-700 text-emerald-400 font-mono px-2 py-1 rounded text-[10px] shadow-inner"><Tag size={10} className="inline mr-1.5 opacity-60"/>{ad.keyword}</span>
                                                                                    </td>
                                                                                    <td className="py-3 px-2">
                                                                                        <StatusBadge status={ad.status} onClick={() => handleToggleStatus('ad', ad)} />
                                                                                    </td>
                                                                                    <td className="py-3 px-2 text-right font-bold text-slate-300">
                                                                                        ${(ad.total_spend||0).toFixed(2)}
                                                                                    </td>
                                                                                    <td className="py-3 px-2 text-right text-slate-400 font-bold">
                                                                                        {ad.total_leads||0}
                                                                                    </td>
                                                                                    <td className="py-3 px-2 text-right font-mono text-amber-500 font-bold">
                                                                                        ${(ad.cost_per_lead||0).toFixed(2)}
                                                                                    </td>
                                                                                    <td className="py-3 px-4 text-right">
                                                                                        <div className="flex justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                                                            <button onClick={() => openEditAd(ad)} className="p-1.5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Editar"><Pencil size={12} /></button>
                                                                                            <button onClick={() => openMoveAd(ad)} className="p-1.5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors" title="Mover Anuncio de Conjunto"><Layers size={12} /></button>
                                                                                            <button onClick={() => handleDelete('ad', ad)} className="p-1.5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors" title="Eliminar"><Trash2 size={12} /></button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

export default AdsTab;
