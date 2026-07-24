import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Trash2, Pencil, Save, X, DollarSign, CalendarDays, TrendingUp, Folder, Layers, ChevronDown, ChevronRight, Eye, EyeOff, UploadCloud } from 'lucide-react';
import usePersistentFilters from '../../hooks/usePersistentFilters';
import ImportSpendModal from '../../components/modals/ImportSpendModal';

const PeriodSpendTab = ({ campaigns, onRefresh }) => {
    const [selectedStartDate, setSelectedStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedEndDate, setSelectedEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    // Estados para los inputs
    const [campValues, setCampValues] = useState({}); 
    const [setValues, setSetValues] = useState({});
    
    const [history, setHistory] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedCamps, setExpandedCamps] = useState({});
    const [expandedHistory, setExpandedHistory] = useState({});
    const [allCollapsed, setAllCollapsed] = useState(true);

    // Estados para la edición en el historial
    const [editingSpendId, setEditingSpendId] = useState(null);
    const [editingSpendValue, setEditingSpendValue] = useState('');
    const [updatingSpendId, setUpdatingSpendId] = useState(null);

    const [editingGroupKey, setEditingGroupKey] = useState(null);
    const [editingGroupDate, setEditingGroupDate] = useState('');
    const [updatingGroupKey, setUpdatingGroupKey] = useState(null);

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
            if (!isNaN(val) && val >= 0) {
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
            if (onRefresh) onRefresh();
        } catch (err) { alert(err.response?.data?.error || 'Error al guardar'); } finally { setSaving(false); }
    };

    const handleDeleteSpend = async (id) => {
        if (!confirm('¿Eliminar registro?')) return;
        try {
            await api.delete(`/public/ads/period-spend/${id}`);
            loadHistory();
            loadPeriodData();
            if (onRefresh) onRefresh();
        } catch (err) {}
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
            if (onRefresh) onRefresh();
        } catch (err) {
            alert('Error al actualizar: ' + (err.response?.data?.error || err.message));
        } finally {
            setUpdatingSpendId(null);
        }
    };

    const handleUpdateGroupDate = async (key, entries, newDate) => {
        if (!newDate) {
            alert('Por favor seleccione una fecha válida.');
            return;
        }
        setUpdatingGroupKey(key);
        try {
            const promises = entries.map(entry => 
                api.put(`/public/ads/period-spend/${entry.id}`, { date: newDate })
            );
            await Promise.all(promises);
            setEditingGroupKey(null);
            setEditingGroupDate('');
            await Promise.all([loadHistory(), loadPeriodData()]);
            if (onRefresh) onRefresh();
        } catch (err) {
            alert('Error al actualizar fecha del grupo: ' + (err.response?.data?.error || err.message));
        } finally {
            setUpdatingGroupKey(null);
        }
    };

    const handleImportConfirm = (importedData) => {
        const spendByCamp = {}; 
        const spendBySet = {}; 

        importedData.forEach(({ setId, spend }) => {
            let parentCampId = null;
            campaigns.forEach(c => {
                if (c.ad_sets?.find(s => s.id === setId)) {
                    parentCampId = c.id;
                }
            });

            if (parentCampId) {
                spendBySet[setId] = { spend: spend.toString(), percent: '' };
                spendByCamp[parentCampId] = (spendByCamp[parentCampId] || 0) + spend;
            }
        });

        const newCampValues = { ...campValues };
        Object.entries(spendByCamp).forEach(([campId, totalSpend]) => {
            newCampValues[campId] = totalSpend.toString();
        });
        setCampValues(newCampValues);

        const newSetValues = { ...setValues, ...spendBySet };
        
        Object.keys(spendBySet).forEach(setIdStr => {
            const setId = parseInt(setIdStr);
            let parentCampId = null;
            campaigns.forEach(c => {
                if (c.ad_sets?.find(s => s.id === setId)) parentCampId = c.id;
            });
            if (parentCampId) {
                const cTotal = parseFloat(newCampValues[parentCampId]);
                const sTotal = parseFloat(spendBySet[setIdStr].spend);
                if (cTotal > 0) {
                    newSetValues[setIdStr].percent = ((sTotal / cTotal) * 100).toFixed(1);
                }
            }
        });

        setSetValues(newSetValues);
        
        const campsToExpand = {};
        Object.keys(spendByCamp).forEach(campId => {
            campsToExpand[campId] = true;
        });
        setExpandedCamps(prev => ({ ...prev, ...campsToExpand }));
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

    const handleToggleHideCamp = async (e, camp) => {
        e.stopPropagation();
        const newStatus = camp.status === 'archived' ? 'active' : 'archived';
        try {
            await api.put(`/public/campaigns/${camp.id}`, { status: newStatus });
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Error al archivar campaña:', err);
        }
    };

    const handleToggleHideSet = async (e, set) => {
        e.stopPropagation();
        const newStatus = set.status === 'archived' ? 'active' : 'archived';
        try {
            await api.put(`/public/adsets/${set.id}`, { status: newStatus });
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Error al archivar conjunto:', err);
        }
    };

    const archivedCampsCount = campaigns.filter(c => c.status === 'archived').length;
    const visibleCampaigns = showHidden ? campaigns : campaigns.filter(c => c.status !== 'archived');

    return (
        <div className="space-y-8">
            {/* Cabecera */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Inversión</label>
                        <div className="flex items-center gap-2">
                            <input type="date" className="px-5 py-3 w-48 bg-slate-900 border border-slate-700/50 rounded-xl text-white font-bold" value={selectedStartDate} onChange={e => {
                                setSelectedStartDate(e.target.value);
                                setSelectedEndDate(e.target.value);
                            }} />
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex flex-col items-end gap-2">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total del Día</p>
                                <p className="text-3xl font-black text-amber-400">${periodTotal.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsImportModalOpen(true)} 
                                    className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 transition-colors flex items-center gap-1 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                >
                                    <UploadCloud size={12} /> Cargar Inversión
                                </button>
                                {archivedCampsCount > 0 && (
                                    <button 
                                        onClick={() => setShowHidden(!showHidden)} 
                                        className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border ${showHidden ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/50'}`}
                                    >
                                        {showHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                        {showHidden ? 'Ocultar Archivados' : `Mostrar Archivados (${archivedCampsCount})`}
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
                <div className="max-w-[98%] mx-auto space-y-12 animate-in fade-in duration-700 text-center py-20 bg-slate-800/30 rounded-3xl border border-slate-800/50">
                    <DollarSign size={48} className="mx-auto mb-4 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-400">No hay campañas disponibles</p>
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
                        const isHidden = camp.status === 'archived';
                        
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
                                            onClick={(e) => handleToggleHideCamp(e, camp)} 
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
                                            const isSetHidden = set.status === 'archived';
                                            if (isSetHidden && !showHidden) return null;

                                            const sData = setValues[set.id] || { spend: '', percent: '' };
                                            const isSetFilled = sData.spend !== '' && parseFloat(sData.spend) >= 0;
                                            
                                            return (
                                                <div key={set.id} className={`flex flex-wrap items-center justify-between p-3 pl-12 rounded-xl border transition-all duration-300
                                                    ${isSetFilled ? 'bg-slate-800/40 border-slate-700/80 shadow-md' : 'bg-slate-950/40 border-transparent hover:bg-slate-900/80'}
                                                    ${isSetHidden ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Layers size={16} className={isSetFilled ? 'text-amber-500' : 'text-slate-600'} />
                                                        <div className="flex flex-col">
                                                            <span className={`font-bold text-sm ${isSetFilled ? 'text-white' : 'text-slate-400'}`}>{set.name}</span>
                                                            {isSetHidden && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mt-0.5">Archivado</span>}
                                                        </div>
                                                        <button 
                                                            onClick={(e) => handleToggleHideSet(e, set)} 
                                                            className="ml-2 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                                            title={isSetHidden ? "Desarchivar Conjunto" : "Archivar / Ocultar Conjunto"}
                                                        >
                                                            {isSetHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                                        </button>
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
                                                                className={`w-20 py-1 px-2 outline-none font-bold text-right text-sm rounded-lg transition-colors border ${isSetFilled ? 'bg-white border-slate-300 text-slate-900 shadow-sm' : 'bg-slate-900 border-slate-880 text-slate-300 focus:border-emerald-500 focus:bg-slate-950'}`}
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
                            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} {saving ? 'Guardando...' : 'Guardar Inversión'}
                        </button>
                    </div>
                </div>
            )}

            {/* Historial */}
            <div className="space-y-4">
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
                                        {editingGroupKey === key ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="date"
                                                    className="bg-slate-950 border border-slate-700 rounded text-xs text-slate-300 px-2 py-1 outline-none focus:border-amber-500"
                                                    value={editingGroupDate}
                                                    onChange={e => setEditingGroupDate(e.target.value)}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                                {updatingGroupKey === key ? (
                                                    <Loader2 size={12} className="animate-spin text-amber-500" />
                                                ) : (
                                                    <div className="flex gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); handleUpdateGroupDate(key, group.entries, editingGroupDate); }} className="p-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded"><Save size={12} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); setEditingGroupKey(null); }} className="p-1 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded"><X size={12} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <CalendarDays size={14} className={expandedHistory[key] ? "text-amber-400" : "text-slate-500"} />
                                                <span className="text-sm font-bold text-slate-300">
                                                    {new Date(group.start + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                                    {group.start !== group.end && <> al {new Date(group.end + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</>}
                                                </span>
                                                <button onClick={(e) => { e.stopPropagation(); setEditingGroupKey(key); setEditingGroupDate(group.start); }} className="p-1 text-slate-400 hover:text-white transition-colors" title="Editar Fecha del Grupo"><Pencil size={12} /></button>
                                            </div>
                                        )}
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
            
            <ImportSpendModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                onConfirm={handleImportConfirm} 
                campaigns={campaigns} 
            />
        </div>
    );
};

export default PeriodSpendTab;
