import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Plus, Trash2, Pencil, Save, X, DollarSign, Megaphone, ArrowLeft, CalendarDays, TrendingUp, Search, Radio, Users, Folder, Layers, ChevronDown, ChevronRight, Tag, MessageSquare, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import WebhookMonitorTab from './WebhookMonitorTab';
import AdDashboardTab from './AdDashboardTab';
import usePersistentFilters from '../../hooks/usePersistentFilters';

// ==========================================
// Componentes Auxiliares
// ==========================================
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

// ==========================================
// Componente Modal Base
// ==========================================
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

// ==========================================
// Tab: Gestión de Anuncios (Tarjetas)
// ==========================================
const AdsTab = ({ campaigns, ads, onRefresh, loading }) => {
    const [expandedCamps, setExpandedCamps] = useState({});
    const [expandedSets, setExpandedSets] = useState({});

    // Unify all forms in a single modal config
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
        } catch (err) { alert('Error al eliminar'); }
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

    // Render Modal contents
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

            {/* Header / Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Administrador de Estructura</h2>
                    <p className="text-sm text-slate-400 font-medium">Organiza tus presupuestos en Campañas &gt; Conjuntos &gt; Anuncios</p>
                </div>
                <button
                    onClick={openCreateCamp}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(52,211,153,0.2)] active:scale-95"
                >
                    <Plus size={18} /> Nueva Campaña
                </button>
            </div>

            {/* Grid de Campañas (Tarjetas) */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-slate-800/50">
                    <Folder size={64} className="mx-auto mb-4 text-emerald-500/20" />
                    <p className="text-xl font-black text-white italic tracking-tighter uppercase">Sin Campañas</p>
                    <p className="text-slate-400 text-sm">Crea tu primera campaña para comenzar a ordenar tus anuncios.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {campaigns.map(camp => {
                        const mCamp = getCampMetrics(camp);
                        const isExpanded = expandedCamps[camp.id];

                        return (
                            <div key={camp.id} className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-xl flex flex-col transition-all duration-300 overflow-hidden">
                                {/* CAMPAIGN CARD HEADER */}
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
                                                    Conjuntos: <span className="text-emerald-400 font-bold">{(camp.ad_sets||[]).length}</span>
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

                                {/* AD SETS LIST (Inside Card) */}
                                {isExpanded && (
                                    <div className="bg-slate-950 p-4 space-y-4">
                                        {(!camp.ad_sets || camp.ad_sets.length === 0) ? (
                                            <div className="py-8 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                                                <Layers size={32} className="mx-auto mb-2 opacity-20" />
                                                <span className="text-sm font-medium">No hay conjuntos de anuncios en esta campaña.</span>
                                                <button onClick={() => openCreateSet(camp.id)} className="block mx-auto mt-3 text-xs text-emerald-400 hover:underline">Crear el primero</button>
                                            </div>
                                        ) : (
                                            camp.ad_sets.map(set => {
                                                const mSet = getSetMetrics(set.id);
                                                const isSetExpanded = expandedSets[set.id];
                                                const setAds = adsForSet(set.id);

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

                                                        {/* ADS LIST (Nivel 3) */}
                                                        {isSetExpanded && (
                                                            <div className="bg-slate-950/80 p-0 overflow-x-auto">
                                                                {setAds.length === 0 ? (
                                                                    <div className="py-4 text-center text-xs text-slate-500 font-medium">No hay anuncios en este conjunto.</div>
                                                                ) : (
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="bg-slate-900 border-b border-slate-800 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                                                                <th className="py-3 px-4 w-12 text-center">ID</th>
                                                                                <th className="py-3 px-2 w-8">Icon</th>
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
                                                                            {setAds.map(ad => (
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

// ==========================================
// Tab: Inversión por Período
// ==========================================
const PeriodSpendTab = ({ campaigns }) => {
    const [selectedStartDate, setSelectedStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedEndDate, setSelectedEndDate] = useState(new Date().toISOString().split('T')[0]);
    
    // States for inputs
    const [campValues, setCampValues] = useState({}); 
    const [setValues, setSetValues] = useState({});
    
    const [history, setHistory] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedCamps, setExpandedCamps] = useState({});
    const [expandedHistory, setExpandedHistory] = useState({});
    const [allCollapsed, setAllCollapsed] = useState(true);

    // Estados para la edicion en el historial
    const [editingSpendId, setEditingSpendId] = useState(null);
    const [editingSpendValue, setEditingSpendValue] = useState('');
    const [updatingSpendId, setUpdatingSpendId] = useState(null);


    const { filters: hiddenFilters, updateFilter: setHiddenFilters } = usePersistentFilters('hidden_camps_v1', { hidden: [] });
    const hiddenCamps = hiddenFilters.hidden || [];
    const [showHidden, setShowHidden] = useState(false);

    useEffect(() => { loadPeriodData(); }, [selectedStartDate, selectedEndDate, campaigns]);
    useEffect(() => { loadHistory(); }, []);

    const loadPeriodData = async () => {
        if (!campaigns.length) return;
        try {
            const res = await api.get('/public/ads/period-spend', { params: { start_date: selectedStartDate, end_date: selectedEndDate } });
            const newSetVals = {};
            const newCampVals = {};
            
            res.data.forEach(s => {
                if (s.ad_set_id) {
                    newSetVals[s.ad_set_id] = { spend: s.spend.toString(), percent: '' };
                    
                    const camp = campaigns.find(c => (c.ad_sets||[]).some(set => set.id === s.ad_set_id));
                    if (camp) {
                        newCampVals[camp.id] = (newCampVals[camp.id] || 0) + s.spend;
                    }
                }
            });
            
            Object.keys(newSetVals).forEach(setId => {
                const camp = campaigns.find(c => (c.ad_sets||[]).some(s => s.id == setId));
                if (camp && newCampVals[camp.id] > 0) {
                    newSetVals[setId].percent = ((parseFloat(newSetVals[setId].spend) / newCampVals[camp.id]) * 100).toFixed(1);
                }
            });
            
            Object.keys(newCampVals).forEach(k => newCampVals[k] = newCampVals[k].toString());
            setSetValues(newSetVals);
            setCampValues(newCampVals);
        } catch (err) {}
    };

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await api.get('/public/ads/period-spend');
            setHistory(res.data);
        } catch (err) {} finally { setLoadingHistory(false); }
    };

    const handleCampSpendChange = (campId, val, campSets) => {
        setCampValues(prev => ({ ...prev, [campId]: val }));
        
        const num = campSets.length;
        if (num === 0) return;
        const total = parseFloat(val) || 0;
        const each = total / num;
        const percent = total > 0 ? (100 / num) : 0;
        
        setSetValues(prev => {
            const newSets = { ...prev };
            campSets.forEach(s => {
                newSets[s.id] = { spend: each > 0 ? each.toFixed(2) : '', percent: percent > 0 ? percent.toFixed(1) : '' };
            });
            return newSets;
        });
    };

    const handleSetPercentChange = (setId, campId, percent) => {
        const campTotal = parseFloat(campValues[campId]) || 0;
        const parsed = parseFloat(percent) || 0;
        const spend = campTotal > 0 ? (campTotal * (parsed / 100)) : 0;
        
        setSetValues(prev => ({ ...prev, [setId]: { spend: spend > 0 ? spend.toFixed(2) : '', percent: percent } }));
    };

    const handleSetSpendChange = (setId, campId, spend) => {
        const campTotal = parseFloat(campValues[campId]);
        let percent = '';
        if (campTotal && campTotal > 0) {
            percent = ((parseFloat(spend) || 0) / campTotal * 100).toFixed(1);
        }
        setSetValues(prev => ({ ...prev, [setId]: { spend: spend, percent: percent } }));
    };

    const handleSaveAll = async () => {
        if (selectedStartDate > selectedEndDate) return alert('Fecha inválida');

        const entries = [];
        Object.entries(setValues).forEach(([setId, data]) => {
            const val = parseFloat(data.spend);
            if (!isNaN(val) && val >= 0) { // Permitir guardar 0 para vaciar
                entries.push({
                    ad_set_id: parseInt(setId),
                    start_date: selectedStartDate,
                    end_date: selectedEndDate,
                    spend: val,
                    notes: ''
                });
            }
        });

        if (entries.length === 0) return alert('Ingresa al menos un valor de monto o porcentaje para procesar la inversión.');

        setSaving(true);
        try {
            await api.post('/public/ads/period-spend', { entries });
            alert(`${entries.length} registro(s) de conjuntos guardados correctamente`);
            loadHistory();
        } catch (err) { alert(err.response?.data?.error || 'Error al guardar'); } finally { setSaving(false); }
    };

    const handleDeleteSpend = async (id) => {
        if (!confirm('¿Eliminar registro?')) return;
        try { await api.delete(`/public/ads/period-spend/${id}`); loadHistory(); loadPeriodData(); } catch (err) {}
    };

    const handleUpdateSpend = async (id, newSpend) => {
        const val = parseFloat(newSpend);
        if (isNaN(val) || val < 0) {
            alert('Por favor ingrese un monto válido.');
            return;
        }
        setUpdatingSpendId(id);
        try {
            await api.put(`/public/ads/period-spend/${id}`, { spend: val });
            setEditingSpendId(null);
            setEditingSpendValue('');
            await Promise.all([loadHistory(), loadPeriodData()]);
        } catch (err) {
            alert('Error al actualizar: ' + (err.response?.data?.error || err.message));
        } finally {
            setUpdatingSpendId(null);
        }
    };


    const periodTotal = useMemo(() => {
        let sum = 0;
        Object.values(setValues).forEach(data => {
            const val = parseFloat(data.spend);
            if (!isNaN(val)) sum += val;
        });
        return sum;
    }, [setValues]);

    const historyByDate = useMemo(() => {
        const grouped = {};
        history.forEach(s => {
            const key = `${s.start_date}|${s.end_date}`;
            if (!grouped[key]) grouped[key] = { entries: [], total: 0, start: s.start_date, end: s.end_date };
            grouped[key].entries.push(s); grouped[key].total += s.spend;
        });
        return Object.entries(grouped).sort((a, b) => b[1].start.localeCompare(a[1].start));
    }, [history]);

    const handleToggleAll = () => {
        if (allCollapsed) {
            const newCamps = {};
            campaigns.forEach(c => newCamps[c.id] = true);
            setExpandedCamps(newCamps);
            const newHist = {};
            historyByDate.forEach(([k]) => newHist[k] = true);
            setExpandedHistory(newHist);
            setAllCollapsed(false);
        } else {
            setExpandedCamps({});
            setExpandedHistory({});
            setAllCollapsed(true);
        }
    };

    const handleToggleHideCamp = (e, campId) => {
        e.stopPropagation();
        if (hiddenCamps.includes(campId)) {
            setHiddenFilters({ hidden: hiddenCamps.filter(id => id !== campId) });
        } else {
            setHiddenFilters({ hidden: [...hiddenCamps, campId] });
        }
    };

    const visibleCampaigns = showHidden ? campaigns : campaigns.filter(c => !hiddenCamps.includes(c.id));

    return (
        <div className="space-y-8">
            {/* Cabecera */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Período de Inversión</label>
                        <div className="flex items-center gap-2">
                            <input type="date" className="px-5 py-3 w-40 bg-slate-900 border border-slate-700/50 rounded-xl text-white font-bold" value={selectedStartDate} onChange={e => setSelectedStartDate(e.target.value)} />
                            <span className="text-slate-500 font-bold">-</span>
                            <input type="date" className="px-5 py-3 w-40 bg-slate-900 border border-slate-700/50 rounded-xl text-white font-bold" value={selectedEndDate} onChange={e => setSelectedEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex flex-col items-end gap-2">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total del Período</p>
                                <p className="text-3xl font-black text-amber-400">${periodTotal.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {hiddenCamps.length > 0 && (
                                    <button 
                                        onClick={() => setShowHidden(!showHidden)} 
                                        className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border ${showHidden ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/50'}`}
                                    >
                                        {showHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                        {showHidden ? 'Ocultar Archivados' : `Mostrar Archivados (${hiddenCamps.length})`}
                                    </button>
                                )}
                                <button 
                                    onClick={handleToggleAll} 
                                    className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 border border-slate-700/50"
                                >
                                    {allCollapsed ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    {allCollapsed ? 'Expandir Todo' : 'Minimizar Todo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Arbol de inputs de inversión (Campañas / Conjuntos) */}
            {campaigns.length === 0 ? (
                <div className="max-w-[98%] mx-auto space-y-12 animate-in fade-in duration-700">
                    <DollarSign size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-medium">No hay campañas disponibles</p>
                </div>
            ) : visibleCampaigns.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-slate-800/50 border-dashed">
                    <EyeOff size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="text-slate-400 text-sm font-medium">Todas las campañas están archivadas/ocultas.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {visibleCampaigns.map(camp => {
                        const campSets = camp.ad_sets || [];
                        const cVal = campValues[camp.id] ?? '';
                        const isCampFilled = cVal !== '' && parseFloat(cVal) > 0;
                        const isHidden = hiddenCamps.includes(camp.id);
                        
                        return (
                            <div key={camp.id} className={`bg-slate-900/50 border border-slate-800 shadow-lg rounded-2xl overflow-hidden transition-all duration-300 ${isHidden ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}>
                                {/* Encabezado Campaña */}
                                <div 
                                    className={`flex flex-wrap items-center justify-between p-4 px-5 transition-colors cursor-pointer ${isCampFilled ? 'bg-slate-800/80 hover:bg-slate-800' : 'hover:bg-slate-800/50'} ${expandedCamps[camp.id] ? 'border-b border-slate-700' : 'border-b border-transparent'}`}
                                    onClick={() => setExpandedCamps(prev => ({ ...prev, [camp.id]: !prev[camp.id] }))}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${expandedCamps[camp.id] ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-950'}`}>
                                            {expandedCamps[camp.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </div>
                                        <Folder size={20} className={expandedCamps[camp.id] ? "text-emerald-400" : "text-emerald-500"} />
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-lg tracking-wide">{camp.name}</span>
                                            {isHidden && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none">Archivada</span>}
                                        </div>
                                        <button 
                                            onClick={(e) => handleToggleHideCamp(e, camp.id)} 
                                            className="ml-2 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                            title={isHidden ? "Desarchivar Campaña" : "Archivar / Ocultar Campaña"}
                                        >
                                            {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Inversión Total</span>
                                        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 focus-within:border-emerald-500 transition-colors shadow-inner">
                                            <span className="pl-3 font-black text-slate-500">$</span>
                                            <input type="number" step="0.01" min="0" placeholder="0.00"
                                                   className="w-28 py-1.5 px-2 outline-none font-bold text-right bg-transparent text-white"
                                                   value={cVal} onChange={e => handleCampSpendChange(camp.id, e.target.value, campSets)} />
                                        </div>
                                    </div>
                                </div>

                                {/* Conjuntos de la Campaña */}
                                {expandedCamps[camp.id] && (
                                <div className="p-4 space-y-3 bg-slate-950/20">
                                    {campSets.length === 0 ? (
                                        <div className="py-2 text-sm text-slate-600 pl-4">No hay conjuntos de anuncios.</div>
                                    ) : (
                                        campSets.map(set => {
                                            const sData = setValues[set.id] || { spend: '', percent: '' };
                                            const isSetFilled = sData.spend !== '' && parseFloat(sData.spend) >= 0;
                                            
                                            return (
                                                <div key={set.id} className={`flex flex-wrap items-center justify-between p-3 pl-12 rounded-xl border transition-all duration-300
                                                    ${isSetFilled ? 'bg-slate-800/40 border-slate-700/80 shadow-md' : 'bg-slate-950/40 border-transparent hover:bg-slate-900/80'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Layers size={16} className={isSetFilled ? 'text-amber-500' : 'text-slate-600'} />
                                                        <span className={`font-bold text-sm ${isSetFilled ? 'text-white' : 'text-slate-400'}`}>{set.name}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-4">
                                                        {/* Input Porcentaje */}
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative">
                                                                <input type="number" step="0.1" min="0" max="100" placeholder="0.0"
                                                                    className={`w-16 py-1 px-2 outline-none font-bold text-right text-xs rounded-lg transition-colors border ${isSetFilled ? 'bg-slate-900 border-slate-700 text-amber-400' : 'bg-slate-900/50 border-slate-800 text-slate-500 focus:border-amber-500 focus:text-white'}`}
                                                                    value={sData.percent} onChange={e => handleSetPercentChange(set.id, camp.id, e.target.value)} />
                                                                <span className="absolute right-1.5 top-1.5 text-[9px] font-black opacity-50">%</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-slate-700 font-black">/</span>
                                                        {/* Input Monto Final */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-black text-slate-500">$</span>
                                                            <input type="number" step="0.01" min="0" placeholder="0.00"
                                                                className={`w-20 py-1 px-2 outline-none font-bold text-right text-sm rounded-lg transition-colors border ${isSetFilled ? 'bg-white border-slate-300 text-slate-900 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-300 focus:border-emerald-500 focus:bg-slate-950'}`}
                                                                value={sData.spend} onChange={e => handleSetSpendChange(set.id, camp.id, e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                                )}
                            </div>
                        );
                    })}

                    <div className="pt-4">
                        <button onClick={handleSaveAll} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-[0.15em] transition-all shadow-xl shadow-amber-600/20 flex items-center justify-center gap-3">
                            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} {saving ? 'Guardando...' : 'Guardar Inversión del Período'}
                        </button>
                    </div>
                </div>
            )}

            {/* Historial */}
            <div className="space-y-4">
               {/* Keep standard history list */}
               <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4 mt-8">
                    <div className="p-3 bg-slate-800/50 rounded-2xl"><TrendingUp className="text-amber-400" size={24} /></div>
                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Historial de Inversión</h2>
                </div>
                {loadingHistory ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-amber-500" size={24} /></div>
                ) : historyByDate.length === 0 ? (
                    <p className="text-center text-slate-500 py-8 text-sm">Sin registros de inversión aún</p>
                ) : (
                    <div className="space-y-4">
                        {historyByDate.map(([key, group]) => (
                            <div key={key} className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden">
                                <div 
                                    className="flex items-center justify-between px-5 py-3 bg-slate-800/30 cursor-pointer hover:bg-slate-800/50 transition-colors"
                                    onClick={() => setExpandedHistory(prev => ({ ...prev, [key]: !prev[key] }))}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1 rounded-lg ${expandedHistory[key] ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 bg-slate-900'}`}>
                                            {expandedHistory[key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CalendarDays size={14} className={expandedHistory[key] ? "text-amber-400" : "text-slate-500"} />
                                            <span className="text-sm font-bold text-slate-300">
                                                {new Date(group.start + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                                {group.start !== group.end && <> al {new Date(group.end + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</>}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-amber-400">${group.total.toFixed(2)}</span>
                                </div>
                                {expandedHistory[key] && (
                                <div className="divide-y divide-slate-800/30">
                                    {group.entries.map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-800/20 transition-colors">
                                            <div>
                                                <span className="text-sm text-white font-medium">{entry.ad_set_name || entry.ad_name || 'Registro Huérfano'}</span>
                                                <span className="text-xs text-slate-500 ml-2 font-mono uppercase tracking-wider">{entry.campaign_name || 'Desconocido'}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {editingSpendId === entry.id ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-700 shadow-inner">
                                                            <span className="pl-1 font-black text-slate-500 text-xs">$</span>
                                                            <input 
                                                                type="number" 
                                                                step="0.01" 
                                                                min="0" 
                                                                placeholder="0.00"
                                                                className="w-16 py-0.5 px-1 outline-none font-bold text-right bg-transparent text-white text-xs"
                                                                value={editingSpendValue} 
                                                                onChange={e => setEditingSpendValue(e.target.value)}
                                                                autoFocus
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleUpdateSpend(entry.id, editingSpendValue);
                                                                    if (e.key === 'Escape') { setEditingSpendId(null); setEditingSpendValue(''); }
                                                                }}
                                                            />
                                                        </div>
                                                        {updatingSpendId === entry.id ? (
                                                            <Loader2 size={12} className="animate-spin text-emerald-500" />
                                                        ) : (
                                                            <div className="flex gap-1">
                                                                <button onClick={() => handleUpdateSpend(entry.id, editingSpendValue)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors" title="Guardar"><Save size={12} /></button>
                                                                <button onClick={() => { setEditingSpendId(null); setEditingSpendValue(''); }} className="p-1 text-slate-400 hover:text-slate-200 transition-colors" title="Cancelar"><X size={12} /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-white">${entry.spend.toFixed(2)}</span>
                                                        <button onClick={() => { setEditingSpendId(entry.id); setEditingSpendValue(entry.spend.toString()); }} className="p-1 text-slate-400 hover:text-white transition-colors" title="Editar"><Pencil size={12} /></button>
                                                    </div>
                                                )}
                                                <button onClick={() => handleDeleteSpend(entry.id)} className="p-1 text-slate-600 hover:text-red-400"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// Página Principal
// ==========================================
const AdManagementPage = () => {
    const [activeTab, setActiveTab] = useState('ads');
    const [campaigns, setCampaigns] = useState([]);
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [campRes, adsRes] = await Promise.all([
                api.get('/public/campaigns'),
                api.get('/public/ads')
            ]);
            setCampaigns(campRes.data);
            setAds(adsRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { key: 'ads', label: 'Estructura', icon: Layers },
        { key: 'spend', label: 'Inversión (Períodos)', icon: DollarSign },
        { key: 'ads_dashboard', label: 'Rend. por Anuncio', icon: Users },
        { key: 'webhooks', label: 'Webhooks', icon: Radio },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center p-4 py-12 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-900/15 to-transparent pointer-events-none" />

            <div className="w-full max-w-[98%] z-10 space-y-6">
                {/* Tabs */}
                <div className="flex flex-wrap gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-2xl">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 min-w-[180px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all
                                    ${isActive
                                        ? 'bg-slate-800 text-white shadow-lg border border-slate-700/50'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Contenido activo */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-4 md:p-8 shadow-2xl overflow-hidden ring-1 ring-white/5">
                    {activeTab === 'ads' ? (
                        <AdsTab campaigns={campaigns} ads={ads} onRefresh={fetchAll} loading={loading} />
                    ) : activeTab === 'spend' ? (
                        <PeriodSpendTab ads={ads} campaigns={campaigns} />
                    ) : activeTab === 'ads_dashboard' ? (
                        <AdDashboardTab />
                    ) : (
                        <WebhookMonitorTab />
                    )}
                </div>

                {/* Footer */}
                <div className="text-center pt-4">
                    <Link to="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 font-medium text-sm transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inicio de Sesión
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdManagementPage;
