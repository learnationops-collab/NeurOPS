import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Plus, Trash2, Pencil, Save, X, DollarSign, Megaphone, ArrowLeft, CalendarDays, TrendingUp, Search, Radio, Users, Folder, Layers, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import WebhookMonitorTab from './WebhookMonitorTab';
import AdDashboardTab from './AdDashboardTab';

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
// Tab: Gestión de Anuncios (Árbol)
// ==========================================
const AdsTab = ({ campaigns, ads, onRefresh, loading }) => {
    // Expand states
    const [expandedCamps, setExpandedCamps] = useState({});
    const [expandedSets, setExpandedSets] = useState({});

    // Create forms
    const [showCampForm, setShowCampForm] = useState(false);
    const [campForm, setCampForm] = useState({ name: '' });
    const [loadingCreate, setLoadingCreate] = useState(false);

    const [createSetForCamp, setCreateSetForCamp] = useState(null);
    const [setForm, setSetForm] = useState({ name: '' });

    const [createAdForSet, setCreateAdForSet] = useState(null);
    const [adForm, setAdForm] = useState({ name: '', keyword: '' });

    // Editing states
    const [editingNode, setEditingNode] = useState(null); // { type: 'camp'|'set'|'ad', id: 1 }
    const [editData, setEditData] = useState({ name: '', keyword: '', status: '' });

    const toggleCamp = (id) => setExpandedCamps(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleSet = (id) => setExpandedSets(prev => ({ ...prev, [id]: !prev[id] }));

    // ========================================================
    // CREATE Methods
    // ========================================================
    const handleCreateCamp = async (e) => {
        e.preventDefault();
        if (!campForm.name.trim()) return;
        setLoadingCreate(true);
        try {
            await api.post('/public/campaigns', campForm);
            setCampForm({ name: '' });
            setShowCampForm(false);
            onRefresh();
        } catch (err) { alert('Error al crear campaña'); } finally { setLoadingCreate(false); }
    };

    const handleCreateSet = async (e) => {
        e.preventDefault();
        if (!setForm.name.trim()) return;
        setLoadingCreate(true);
        try {
            await api.post('/public/adsets', { name: setForm.name, campaign_id: createSetForCamp });
            setSetForm({ name: '' });
            setExpandedCamps(prev => ({ ...prev, [createSetForCamp]: true })); // open parent
            setCreateSetForCamp(null);
            onRefresh();
        } catch (err) { alert('Error al crear conjunto'); } finally { setLoadingCreate(false); }
    };

    const handleCreateAd = async (e) => {
        e.preventDefault();
        if (!adForm.name.trim() || !adForm.keyword.trim()) return;
        setLoadingCreate(true);
        try {
            await api.post('/public/ads', { ...adForm, ad_set_id: createAdForSet });
            setAdForm({ name: '', keyword: '' });
            setExpandedSets(prev => ({ ...prev, [createAdForSet]: true })); // open parent
            setCreateAdForSet(null);
            onRefresh();
        } catch (err) { alert('Error al crear anuncio'); } finally { setLoadingCreate(false); }
    };

    // ========================================================
    // UPDATE / DELETE Methods
    // ========================================================
    const handleToggleStatus = async (type, item) => {
        const url = type === 'camp' ? `/public/campaigns/${item.id}` 
                  : type === 'set' ? `/public/adsets/${item.id}` 
                  : `/public/ads/${item.id}`;
        try {
            await api.put(url, { status: item.status === 'active' ? 'paused' : 'active' });
            onRefresh();
        } catch (err) { alert('Error al actualizar estado'); }
    };

    const startEdit = (type, item) => {
        setEditingNode({ type, id: item.id });
        setEditData({ name: item.name, status: item.status, keyword: item.keyword || '' });
    };

    const handleUpdate = async () => {
        const { type, id } = editingNode;
        const url = type === 'camp' ? `/public/campaigns/${id}` 
                  : type === 'set' ? `/public/adsets/${id}` 
                  : `/public/ads/${id}`;
        
        try {
            await api.put(url, editData);
            setEditingNode(null);
            onRefresh();
        } catch (err) { alert('Error al actualizar'); }
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

    // ========================================================
    // HELPERS FOR RENDER
    // ========================================================
    // Find ads for a specific adSet
    const adsForSet = (setId) => ads.filter(a => a.ad_set_id === setId);

    // Sum metrics for an adSet
    const getSetMetrics = (setId) => {
        const myAds = adsForSet(setId);
        return myAds.reduce((acc, ad) => ({
            total_spend: acc.total_spend + (ad.total_spend || 0),
            total_leads: acc.total_leads + (ad.total_leads || 0),
            qualified_leads: acc.qualified_leads + (ad.qualified_leads || 0)
        }), { total_spend: 0, total_leads: 0, qualified_leads: 0 });
    };

    // Sum metrics for a campaign
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

    return (
        <div className="space-y-6">
            {/* Header / Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Administrador de Estructura</h2>
                    <p className="text-sm text-slate-400 font-medium">Organiza tus presupuestos en Campañas &gt; Conjuntos &gt; Anuncios</p>
                </div>
                <button
                    onClick={() => setShowCampForm(!showCampForm)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(52,211,153,0.2)] active:scale-95"
                >
                    <Plus size={18} /> Nueva Campaña
                </button>
            </div>

            {/* Campaign Form */}
            {showCampForm && (
                <form onSubmit={handleCreateCamp} className="bg-slate-800/80 border border-emerald-500/30 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-4 shadow-xl">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Nombre de la Campaña</label>
                        <input
                            type="text" autoFocus required placeholder="Ej: Black Friday 2026"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition-all font-bold"
                            value={campForm.name} onChange={e => setCampForm({ name: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowCampForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">Cancelar</button>
                        <button type="submit" disabled={loadingCreate} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2">
                            {loadingCreate ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar Campaña
                        </button>
                    </div>
                </form>
            )}

            {/* Arbol de Campañas */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-slate-800/50">
                    <Folder size={64} className="mx-auto mb-4 text-emerald-500/20" />
                    <p className="text-xl font-black text-white italic tracking-tighter uppercase">Sin Campañas</p>
                    <p className="text-slate-400 text-sm">Crea tu primera campaña para comenzar a ordenar tus anuncios.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {campaigns.map(camp => {
                        const mCamp = getCampMetrics(camp);
                        const isExpanded = expandedCamps[camp.id];
                        const isEditing = editingNode?.type === 'camp' && editingNode?.id === camp.id;

                        return (
                            <div key={camp.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all">
                                {/* CAMPAIGN HEADER */}
                                <div 
                                    className={`flex items-center justify-between p-4 px-5 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-800/80 border-b border-slate-800' : 'hover:bg-slate-800/40'}`}
                                    onClick={(e) => { 
                                        if (e.target.closest('button') || e.target.closest('input')) return;
                                        toggleCamp(camp.id); 
                                    }}
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className={`p-2 rounded-xl ${isExpanded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </div>
                                        <Folder size={24} className={isExpanded ? 'text-emerald-400' : 'text-slate-500'} />
                                        
                                        {isEditing ? (
                                            <input type="text" autoFocus className="px-3 py-1.5 bg-slate-950 border border-emerald-500/50 rounded-lg text-white font-black" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                                        ) : (
                                            <div>
                                                <h3 className="text-lg font-black text-white tracking-tight">{camp.name}</h3>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                                                    <span>Conjuntos: {(camp.ad_sets||[]).length}</span>
                                                    <span>•</span>
                                                    <span>Gasto: ${mCamp.total_spend.toFixed(2)}</span>
                                                    <span>•</span>
                                                    <span>Leads: {mCamp.total_leads}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isEditing ? (
                                            <>
                                                <button onClick={handleUpdate} className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg"><Save size={16} /></button>
                                                <button onClick={() => setEditingNode(null)} className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg"><X size={16} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <StatusBadge status={camp.status} onClick={() => handleToggleStatus('camp', camp)} />
                                                <button onClick={() => setCreateSetForCamp(camp.id)} className="ml-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                                                    + Conjunto
                                                </button>
                                                <div className="w-px h-6 bg-slate-800 mx-1" />
                                                <button onClick={() => startEdit('camp', camp)} className="p-1.5 text-slate-500 hover:text-white transition-colors"><Pencil size={14} /></button>
                                                <button onClick={() => handleDelete('camp', camp)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* CREATE AD SET FORM */}
                                {createSetForCamp === camp.id && (
                                    <form onSubmit={handleCreateSet} className="bg-slate-800/40 p-4 border-b border-slate-800 flex items-center justify-between animate-in fade-in pl-14">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Layers size={18} className="text-emerald-500" />
                                            <input type="text" autoFocus required placeholder="Nombre del nuevo Conjunto..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" value={setForm.name} onChange={e => setSetForm({name: e.target.value})} />
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <button type="button" onClick={() => setCreateSetForCamp(null)} className="px-3 py-2 text-slate-400 text-sm">Cancelar</button>
                                            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold flex items-center gap-2"><Save size={14} /> Guardar</button>
                                        </div>
                                    </form>
                                )}

                                {/* AD SETS LIST */}
                                {isExpanded && (
                                    <div className="bg-slate-900/50 pb-2">
                                        {(!camp.ad_sets || camp.ad_sets.length === 0) ? (
                                            <div className="py-6 px-14 text-slate-500 text-sm font-medium border-t border-slate-800/50">No hay conjuntos de anuncios en esta campaña.</div>
                                        ) : (
                                            camp.ad_sets.map(set => {
                                                const mSet = getSetMetrics(set.id);
                                                const isSetExpanded = expandedSets[set.id];
                                                const isSetEditing = editingNode?.type === 'set' && editingNode?.id === set.id;
                                                const setAds = adsForSet(set.id);

                                                return (
                                                    <div key={set.id} className="border-t border-slate-800/50">
                                                        <div 
                                                            className="flex items-center justify-between p-3 pl-12 pr-5 hover:bg-slate-800/30 cursor-pointer transition-colors"
                                                            onClick={(e) => { 
                                                                if (e.target.closest('button') || e.target.closest('input')) return;
                                                                toggleSet(set.id); 
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <div className={`p-1.5 rounded-lg ${isSetExpanded ? 'text-emerald-400' : 'text-slate-600'}`}>
                                                                    {isSetExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                </div>
                                                                <Layers size={18} className={isSetExpanded ? 'text-emerald-400' : 'text-slate-500'} />
                                                                {isSetEditing ? (
                                                                    <input type="text" autoFocus className="px-2 py-1 bg-slate-950 border border-emerald-500/50 rounded text-white text-sm font-bold" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                                                                ) : (
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="text-white font-bold text-sm tracking-wide">{set.name}</span>
                                                                        <span className="text-xs text-slate-500 font-mono bg-slate-950 px-2 py-0.5 border border-slate-800 rounded">
                                                                            ${mSet.total_spend.toFixed(2)} | {mSet.total_leads} leads
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {isSetEditing ? (
                                                                    <>
                                                                        <button onClick={handleUpdate} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded"><Save size={14} /></button>
                                                                        <button onClick={() => setEditingNode(null)} className="p-1.5 text-slate-400 hover:bg-slate-700 rounded"><X size={14} /></button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <StatusBadge status={set.status} onClick={() => handleToggleStatus('set', set)} />
                                                                        <button onClick={() => setCreateAdForSet(set.id)} className="ml-2 text-[10px] font-black uppercase px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700">
                                                                            + Anuncio
                                                                        </button>
                                                                        <div className="w-px h-4 bg-slate-800 mx-1" />
                                                                        <button onClick={() => startEdit('set', set)} className="p-1 text-slate-600 hover:text-white transition-colors"><Pencil size={12} /></button>
                                                                        <button onClick={() => handleDelete('set', set)} className="p-1 text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* CREATE AD FORM */}
                                                        {createAdForSet === set.id && (
                                                            <form onSubmit={handleCreateAd} className="bg-slate-950/50 p-3 flex flex-wrap items-center gap-3 pl-[4.5rem] border-y border-slate-800/80">
                                                                <Megaphone size={16} className="text-emerald-500" />
                                                                <input type="text" required placeholder="Nombre del Anuncio..." className="w-48 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs" value={adForm.name} onChange={e => setAdForm({...adForm, name: e.target.value})} />
                                                                <input type="text" required placeholder="Keyword Exacta (Manychat)" className="w-48 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-emerald-400 font-mono text-xs" value={adForm.keyword} onChange={e => setAdForm({...adForm, keyword: e.target.value})} />
                                                                <div className="flex gap-1 ml-auto">
                                                                    <button type="button" onClick={() => setCreateAdForSet(null)} className="px-2 py-1.5 text-slate-400 text-xs">Cancelar</button>
                                                                    <button type="submit" className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"><Save size={12} className="inline mr-1" />Guardar</button>
                                                                </div>
                                                            </form>
                                                        )}

                                                        {/* ADS LIST (Nivel 3) */}
                                                        {isSetExpanded && (
                                                            <div className="bg-slate-950 py-2 pl-[4.5rem] pr-5">
                                                                {setAds.length === 0 ? (
                                                                    <div className="py-2 text-xs text-slate-600 font-medium">No hay anuncios individuales creados.</div>
                                                                ) : (
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="border-b border-slate-800 text-left text-[9px] font-black uppercase text-slate-600 tracking-widest">
                                                                                <th className="pb-2">Icon</th>
                                                                                <th className="pb-2">Anuncio</th>
                                                                                <th className="pb-2">Keyword</th>
                                                                                <th className="pb-2">Estado</th>
                                                                                <th className="pb-2 text-right">Gasto</th>
                                                                                <th className="pb-2 text-right">Leads</th>
                                                                                <th className="pb-2 text-right">CPL</th>
                                                                                <th className="pb-2 text-right"></th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-800/50">
                                                                            {setAds.map(ad => {
                                                                                const isAdEd = editingNode?.type === 'ad' && editingNode?.id === ad.id;
                                                                                return (
                                                                                    <tr key={ad.id} className="hover:bg-slate-900/80 transition-colors">
                                                                                        <td className="py-2.5 text-slate-700"><Megaphone size={14} /></td>
                                                                                        <td className="py-2.5">
                                                                                            {isAdEd ? <input type="text" className="w-full bg-slate-900 border border-emerald-500/50 px-2 py-1 rounded text-white" value={editData.name} onChange={e=>setEditData({...editData, name:e.target.value})} />
                                                                                                    : <span className="text-white font-medium">{ad.name}</span>}
                                                                                        </td>
                                                                                        <td className="py-2.5">
                                                                                            {isAdEd ? <input type="text" className="w-full bg-slate-900 border border-emerald-500/50 px-2 py-1 rounded text-emerald-400 font-mono" value={editData.keyword} onChange={e=>setEditData({...editData, keyword:e.target.value})} />
                                                                                                    : <span className="bg-slate-900 border border-slate-800 text-emerald-400 font-mono px-2 py-0.5 rounded text-[10px]"><Tag size={8} className="inline mr-1 opacity-50"/>{ad.keyword}</span>}
                                                                                        </td>
                                                                                        <td className="py-2.5">
                                                                                            {isAdEd ? null : <StatusBadge status={ad.status} onClick={() => handleToggleStatus('ad', ad)} />}
                                                                                        </td>
                                                                                        <td className="py-2.5 text-right font-bold text-slate-300">${(ad.total_spend||0).toFixed(2)}</td>
                                                                                        <td className="py-2.5 text-right text-slate-400">{ad.total_leads||0}</td>
                                                                                        <td className="py-2.5 text-right font-mono text-amber-500/80">${(ad.cost_per_lead||0).toFixed(2)}</td>
                                                                                        <td className="py-2.5 text-right">
                                                                                            {isAdEd ? (
                                                                                                <div className="flex justify-end gap-1">
                                                                                                    <button onClick={handleUpdate} className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"><Save size={14} /></button>
                                                                                                    <button onClick={() => setEditingNode(null)} className="p-1 text-slate-400 hover:bg-slate-800 rounded"><X size={14} /></button>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{opacity: 1}}>
                                                                                                    <button onClick={() => startEdit('ad', ad)} className="p-1 text-slate-600 hover:text-white rounded"><Pencil size={12} /></button>
                                                                                                    <button onClick={() => handleDelete('ad', ad)} className="p-1 text-slate-600 hover:text-red-400 rounded"><Trash2 size={12} /></button>
                                                                                                </div>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                )
                                                                            })}
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
            const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30);
            const res = await api.get('/public/ads/period-spend', { params: { start_date: start.toISOString().split('T')[0], end_date: end.toISOString().split('T')[0] } });
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
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total del Período</p>
                        <p className="text-3xl font-black text-amber-400">${periodTotal.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Arbol de inputs de inversión (Campañas / Conjuntos) */}
            {campaigns.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <DollarSign size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-medium">No hay campañas disponibles</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {campaigns.map(camp => {
                        const campSets = camp.ad_sets || [];
                        const cVal = campValues[camp.id] ?? '';
                        const isCampFilled = cVal !== '' && parseFloat(cVal) > 0;
                        
                        return (
                            <div key={camp.id} className="bg-slate-900/50 border border-slate-800 shadow-lg rounded-2xl overflow-hidden">
                                {/* Encabezado Campaña */}
                                <div className={`flex flex-wrap items-center justify-between p-4 px-5 border-b transition-colors ${isCampFilled ? 'bg-slate-800/80 border-slate-700' : 'border-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <Folder size={20} className="text-emerald-500" />
                                        <span className="text-white font-bold text-lg tracking-wide">{camp.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
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
                                <div className="p-4 space-y-3">
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
                                <div className="flex items-center justify-between px-5 py-3 bg-slate-800/30">
                                    <div className="flex items-center gap-2">
                                        <CalendarDays size={14} className="text-slate-500" />
                                        <span className="text-sm font-bold text-slate-300">
                                            {new Date(group.start + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                            {group.start !== group.end && <> al {new Date(group.end + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</>}
                                        </span>
                                    </div>
                                    <span className="text-sm font-black text-amber-400">${group.total.toFixed(2)}</span>
                                </div>
                                <div className="divide-y divide-slate-800/30">
                                    {group.entries.map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-800/20 transition-colors">
                                            <div>
                                                <span className="text-sm text-white font-medium">{entry.ad_set_name || entry.ad_name || 'Registro Huérfano'}</span>
                                                <span className="text-xs text-slate-500 ml-2 font-mono uppercase tracking-wider">{entry.campaign_name || 'Desconocido'}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-white">${entry.spend.toFixed(2)}</span>
                                                <button onClick={() => handleDeleteSpend(entry.id)} className="p-1 text-slate-600 hover:text-red-400"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
        { key: 'ads_dashboard', label: 'Rendimiento por Anuncio', icon: Users },
        { key: 'webhooks', label: 'Webhooks', icon: Radio },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center p-4 py-12 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-900/15 to-transparent pointer-events-none" />

            <div className="w-full max-w-5xl z-10 space-y-8">
                {/* Header */}
                <div className="text-center space-y-4 mb-2">
                    <p className="text-emerald-400 font-bold tracking-widest text-xs uppercase">NeurOPS High Performance</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Gestor de Marketing
                    </h1>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-2xl">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all
                                    ${isActive
                                        ? 'bg-slate-800 text-white shadow-lg'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <Icon size={18} />
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
