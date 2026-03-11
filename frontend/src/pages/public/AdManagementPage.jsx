import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Plus, Trash2, Pencil, Save, X, DollarSign, Megaphone, ArrowLeft, CalendarDays, TrendingUp, Search, Radio, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import WebhookMonitorTab from './WebhookMonitorTab';

// ==========================================
// Tab: Gestión de Anuncios
// ==========================================
const AdsTab = ({ ads, onRefresh, loading }) => {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', keyword: '' });
    const [editData, setEditData] = useState({ name: '', keyword: '', status: '' });
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAds = useMemo(() => {
        if (!searchTerm) return ads;
        const lower = searchTerm.toLowerCase();
        return ads.filter(a =>
            a.name.toLowerCase().includes(lower) ||
            (a.keyword || '').toLowerCase().includes(lower)
        );
    }, [ads, searchTerm]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.keyword.trim()) return;
        setSubmitting(true);
        try {
            await api.post('/public/ads', formData);
            setFormData({ name: '', keyword: '' });
            setShowForm(false);
            onRefresh();
        } catch (err) {
            alert(err.response?.data?.message || 'Error al crear anuncio');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async (id) => {
        setSubmitting(true);
        try {
            await api.put(`/public/ads/${id}`, editData);
            setEditingId(null);
            onRefresh();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al actualizar');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`¿Eliminar el anuncio "${name}"? Esto también borrará todo su historial de gasto.`)) return;
        try {
            await api.delete(`/public/ads/${id}`);
            onRefresh();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al eliminar');
        }
    };

    const handleToggleStatus = async (ad) => {
        const newStatus = ad.status === 'active' ? 'paused' : 'active';
        try {
            await api.put(`/public/ads/${ad.id}`, { status: newStatus });
            onRefresh();
        } catch (err) {
            alert('Error al cambiar estado');
        }
    };

    const startEdit = (ad) => {
        setEditingId(ad.id);
        setEditData({ name: ad.name, keyword: ad.keyword, status: ad.status });
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1 w-full sm:max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar anuncios..."
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                >
                    <Plus size={18} /> Nuevo Anuncio
                </button>
            </div>

            {/* Formulario de creación */}
            {showForm && (
                <form onSubmit={handleCreate} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Anuncio</label>
                            <input
                                type="text"
                                required
                                placeholder="Ej: Video Testimonial Principal"
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-white outline-none focus:border-emerald-500 transition-all font-medium"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keyword</label>
                            <input
                                type="text"
                                required
                                placeholder="Ej: video_testimonial_01"
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-white outline-none focus:border-emerald-500 transition-all font-medium"
                                value={formData.keyword}
                                onChange={e => setFormData({ ...formData, keyword: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">Cancelar</button>
                        <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all">
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Crear
                        </button>
                    </div>
                </form>
            )}

            {/* Tabla de anuncios */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
            ) : filteredAds.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <Megaphone size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-medium">{searchTerm ? 'Sin resultados' : 'No hay anuncios creados'}</p>
                    <p className="text-sm mt-1">{searchTerm ? 'Intenta con otro término' : 'Crea tu primer anuncio para comenzar'}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                                <th className="text-left py-3 px-3">ID</th>
                                <th className="text-left py-3 px-3">Nombre</th>
                                <th className="text-left py-3 px-3">Keyword</th>
                                <th className="text-left py-3 px-3">Estado</th>
                                <th className="text-right py-3 px-3">Gasto</th>
                                <th className="text-right py-3 px-3">Leads</th>
                                <th className="text-right py-3 px-3">Cual.</th>
                                <th className="text-right py-3 px-3">CPL</th>
                                <th className="text-right py-3 px-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAds.map(ad => (
                                <tr key={ad.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    {editingId === ad.id ? (
                                        <>
                                            <td className="py-3 px-4 text-slate-500 font-mono text-xs">#{ad.id}</td>
                                            <td className="py-3 px-4">
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-emerald-500"
                                                    value={editData.name}
                                                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                                                />
                                            </td>
                                            <td className="py-3 px-4">
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm font-mono outline-none focus:border-emerald-500"
                                                    value={editData.keyword}
                                                    onChange={e => setEditData({ ...editData, keyword: e.target.value })}
                                                />
                                            </td>
                                            <td className="py-3 px-4">
                                                <select
                                                    className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm outline-none"
                                                    value={editData.status}
                                                    onChange={e => setEditData({ ...editData, status: e.target.value })}
                                                >
                                                    <option value="active">Activo</option>
                                                    <option value="paused">Pausado</option>
                                                </select>
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-400">${ad.total_spend.toFixed(2)}</td>
                                            <td className="py-3 px-3 text-right text-slate-400">{ad.total_leads || 0}</td>
                                            <td className="py-3 px-3 text-right text-slate-400">{ad.qualified_leads || 0}</td>
                                            <td className="py-3 px-3 text-right text-slate-400">${(ad.cost_per_lead || 0).toFixed(2)}</td>
                                            <td className="py-3 px-3 text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <button onClick={() => handleUpdate(ad.id)} disabled={submitting} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors">
                                                        <Save size={16} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="py-3 px-4 text-slate-500 font-mono text-xs">#{ad.id}</td>
                                            <td className="py-3 px-4 text-white font-medium">{ad.name}</td>
                                            <td className="py-3 px-4">
                                                <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-xs font-mono text-emerald-400">{ad.keyword}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <button onClick={() => handleToggleStatus(ad)} className="group">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all
                                                        ${ad.status === 'active'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                                                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                                                        }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${ad.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                        {ad.status === 'active' ? 'Activo' : 'Pausado'}
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-white">${ad.total_spend.toFixed(2)}</td>
                                            <td className="py-3 px-3 text-right">
                                                <span className={`font-bold ${(ad.total_leads || 0) > 0 ? 'text-violet-400' : 'text-slate-600'}`}>{ad.total_leads || 0}</span>
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <span className={`font-bold ${(ad.qualified_leads || 0) > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>{ad.qualified_leads || 0}</span>
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <span className={`font-bold ${(ad.cost_per_lead || 0) > 0 ? 'text-amber-400' : 'text-slate-600'}`}>${(ad.cost_per_lead || 0).toFixed(2)}</span>
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <button onClick={() => startEdit(ad)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Editar">
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(ad.id, ad.name)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Resumen */}
            {ads.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                    <div className="bg-slate-800/40 rounded-xl p-4 text-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Anuncios</p>
                        <p className="text-2xl font-black text-white">{ads.length}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-4 text-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Activos</p>
                        <p className="text-2xl font-black text-emerald-400">{ads.filter(a => a.status === 'active').length}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Inversión Total</p>
                        <p className="text-2xl font-black text-amber-400">${ads.reduce((sum, a) => sum + a.total_spend, 0).toFixed(2)}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// Tab: Inversión Diaria
// ==========================================
const DailySpendTab = ({ ads }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [spendValues, setSpendValues] = useState({});
    const [history, setHistory] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const activeAds = useMemo(() => ads.filter(a => a.status === 'active'), [ads]);

    // Cargar datos existentes para la fecha seleccionada
    useEffect(() => {
        loadDayData();
    }, [selectedDate]);

    // Cargar historial reciente
    useEffect(() => {
        loadHistory();
    }, []);

    const loadDayData = async () => {
        try {
            const res = await api.get('/public/ads/daily-spend', { params: { date: selectedDate } });
            const vals = {};
            res.data.forEach(s => {
                vals[s.ad_id] = { spend: s.spend, entrantes: s.entrantes || 0, agendas: s.agendas || 0, notes: s.notes || '' };
            });
            setSpendValues(vals);
        } catch (err) {
            console.error('Error loading day data:', err);
        }
    };

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            // Últimos 30 días
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 30);
            const res = await api.get('/public/ads/daily-spend', {
                params: {
                    start_date: start.toISOString().split('T')[0],
                    end_date: end.toISOString().split('T')[0]
                }
            });
            setHistory(res.data);
        } catch (err) {
            console.error('Error loading history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSpendChange = (adId, value) => {
        setSpendValues(prev => ({
            ...prev,
            [adId]: { ...(prev[adId] || {}), spend: value }
        }));
    };

    const handleSaveAll = async () => {
        const entries = activeAds
            .filter(ad => {
                const val = spendValues[ad.id]?.spend;
                return val !== undefined && val !== '' && parseFloat(val) >= 0;
            })
            .map(ad => ({
                ad_id: ad.id,
                date: selectedDate,
                spend: parseFloat(spendValues[ad.id]?.spend || 0),
                entrantes: parseInt(spendValues[ad.id]?.entrantes || 0),
                agendas: parseInt(spendValues[ad.id]?.agendas || 0),
                notes: spendValues[ad.id]?.notes || ''
            }));

        if (entries.length === 0) {
            alert('Ingresa al menos un valor de inversión');
            return;
        }

        setSaving(true);
        try {
            await api.post('/public/ads/daily-spend', { entries });
            alert(`${entries.length} registro(s) guardados correctamente`);
            loadHistory();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSpend = async (id) => {
        if (!confirm('¿Eliminar este registro de gasto?')) return;
        try {
            await api.delete(`/public/ads/daily-spend/${id}`);
            loadHistory();
            loadDayData();
        } catch (err) {
            alert('Error al eliminar registro');
        }
    };

    // Calcular total del día
    const dayTotal = useMemo(() => {
        return activeAds.reduce((sum, ad) => {
            const val = parseFloat(spendValues[ad.id]?.spend || 0);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
    }, [spendValues, activeAds]);

    // Agrupar historial por fecha
    const historyByDate = useMemo(() => {
        const grouped = {};
        history.forEach(s => {
            if (!grouped[s.date]) grouped[s.date] = { entries: [], total: 0 };
            grouped[s.date].entries.push(s);
            grouped[s.date].total += s.spend;
        });
        return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
    }, [history]);

    return (
        <div className="space-y-8">
            {/* Selector de fecha + Resumen */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Inversión</label>
                        <input
                            type="date"
                            className="px-5 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-white outline-none focus:border-amber-500 transition-all font-bold"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total del Día</p>
                        <p className="text-3xl font-black text-amber-400">${dayTotal.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Formulario de inversión por anuncio */}
            {activeAds.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <DollarSign size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-medium">No hay anuncios activos</p>
                    <p className="text-sm mt-1">Crea anuncios en la pestaña "Anuncios" y actívalos</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activeAds.map(ad => {
                        const val = spendValues[ad.id]?.spend ?? '';
                        const isFilled = val !== '' && parseFloat(val) > 0;
                        return (
                            <div key={ad.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300
                                ${isFilled
                                    ? 'bg-slate-200 border-slate-300 shadow-md'
                                    : 'bg-slate-900 border-slate-800'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-sm truncate ${isFilled ? 'text-slate-800' : 'text-white'}`}>{ad.name}</p>
                                    <p className={`text-xs font-mono ${isFilled ? 'text-slate-500' : 'text-emerald-400/70'}`}>{ad.keyword}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-lg font-black ${isFilled ? 'text-slate-600' : 'text-slate-500'}`}>$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className={`w-28 px-3 py-2.5 rounded-xl outline-none font-bold text-right transition-all
                                            ${isFilled
                                                ? 'bg-white border border-slate-300 text-slate-900 shadow-sm'
                                                : 'bg-slate-800/50 border border-slate-700/50 text-white focus:border-amber-500'
                                            }`}
                                        value={val}
                                        onChange={e => handleSpendChange(ad.id, e.target.value)}
                                    />
                                </div>
                                {/* Entrantes y Agendas opcionales */}
                                <div className="flex items-center gap-2">
                                    <div className="text-center">
                                        <p className={`text-[8px] font-black uppercase tracking-wider mb-0.5 ${isFilled ? 'text-slate-500' : 'text-slate-600'}`}>Entr.</p>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className={`w-16 px-2 py-2 rounded-lg outline-none font-bold text-center text-xs transition-all
                                                ${isFilled
                                                    ? 'bg-white border border-slate-300 text-slate-900 shadow-sm'
                                                    : 'bg-slate-800/50 border border-slate-700/50 text-white focus:border-blue-500'
                                                }`}
                                            value={spendValues[ad.id]?.entrantes ?? ''}
                                            onChange={e => setSpendValues(prev => ({
                                                ...prev,
                                                [ad.id]: { ...(prev[ad.id] || {}), entrantes: e.target.value }
                                            }))}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className={`text-[8px] font-black uppercase tracking-wider mb-0.5 ${isFilled ? 'text-slate-500' : 'text-slate-600'}`}>Agnd.</p>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className={`w-16 px-2 py-2 rounded-lg outline-none font-bold text-center text-xs transition-all
                                                ${isFilled
                                                    ? 'bg-white border border-slate-300 text-slate-900 shadow-sm'
                                                    : 'bg-slate-800/50 border border-slate-700/50 text-white focus:border-blue-500'
                                                }`}
                                            value={spendValues[ad.id]?.agendas ?? ''}
                                            onChange={e => setSpendValues(prev => ({
                                                ...prev,
                                                [ad.id]: { ...(prev[ad.id] || {}), agendas: e.target.value }
                                            }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="pt-4">
                        <button
                            onClick={handleSaveAll}
                            disabled={saving}
                            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase text-sm tracking-[0.15em] transition-all shadow-xl shadow-amber-600/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            {saving ? 'Guardando...' : 'Guardar Inversión del Día'}
                        </button>
                    </div>
                </div>
            )}

            {/* Historial */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                    <div className="p-3 bg-slate-800/50 rounded-2xl">
                        <TrendingUp className="text-amber-400" size={24} />
                    </div>
                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Historial de Inversión</h2>
                </div>

                {loadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-amber-500" size={24} />
                    </div>
                ) : historyByDate.length === 0 ? (
                    <p className="text-center text-slate-500 py-8 text-sm">Sin registros de inversión aún</p>
                ) : (
                    <div className="space-y-4">
                        {historyByDate.map(([date, group]) => (
                            <div key={date} className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-3 bg-slate-800/30">
                                    <div className="flex items-center gap-2">
                                        <CalendarDays size={14} className="text-slate-500" />
                                        <span className="text-sm font-bold text-slate-300">
                                            {new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    <span className="text-sm font-black text-amber-400">${group.total.toFixed(2)}</span>
                                </div>
                                <div className="divide-y divide-slate-800/30">
                                    {group.entries.map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-800/20 transition-colors">
                                            <div>
                                                <span className="text-sm text-white font-medium">{entry.ad_name}</span>
                                                <span className="text-xs text-slate-500 ml-2 font-mono">{entry.ad_keyword}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-white">${entry.spend.toFixed(2)}</span>
                                                <button onClick={() => handleDeleteSpend(entry.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                                                    <Trash2 size={12} />
                                                </button>
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
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAds();
    }, []);

    const fetchAds = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/ads');
            setAds(res.data);
        } catch (err) {
            console.error('Error fetching ads:', err);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { key: 'ads', label: 'Anuncios', icon: Megaphone },
        { key: 'spend', label: 'Inversión Diaria', icon: DollarSign },
        { key: 'webhooks', label: 'Webhooks', icon: Radio },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center p-4 py-12 relative overflow-hidden">
            {/* Efecto de fondo */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-900/15 to-transparent pointer-events-none" />

            <div className="w-full max-w-4xl z-10 space-y-8">
                {/* Header */}
                <div className="text-center space-y-4 mb-2">
                    <p className="text-emerald-400 font-bold tracking-widest text-xs uppercase">NeurOPS High Performance</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Gestión de Anuncios
                    </h1>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all
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
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
                    {activeTab === 'ads' ? (
                        <AdsTab ads={ads} onRefresh={fetchAds} loading={loading} />
                    ) : activeTab === 'spend' ? (
                        <DailySpendTab ads={ads} />
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
