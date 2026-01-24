import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Trash2, Edit2, Check, X, Loader2, CreditCard, Percent, Hash, ToggleLeft, ToggleRight } from 'lucide-react';

const PaymentMethodsManager = () => {
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(null);
    const [editData, setEditData] = useState({ name: '', fee_percent: 0, fee_fixed: 0, is_active: true });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/db/payment-methods');
            setMethods(res.data);
        } catch (err) {
            console.error("Error fetching payment methods:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (id = null) => {
        setSaving(true);
        try {
            const payload = id ? { ...editData, id } : editData;
            await api.post('/admin/db/payment-methods', payload);
            setIsEditing(null);
            setIsAdding(false);
            setEditData({ name: '', fee_percent: 0, fee_fixed: 0, is_active: true });
            fetchMethods();
        } catch (err) {
            console.error("Error saving payment method:", err);
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (method) => {
        setIsEditing(method.id);
        setEditData({
            name: method.name,
            fee_percent: method.fee_percent,
            fee_fixed: method.fee_fixed,
            is_active: method.is_active
        });
        setIsAdding(false);
    };

    const cancelEdit = () => {
        setIsEditing(null);
        setIsAdding(false);
        setEditData({ name: '', fee_percent: 0, fee_fixed: 0, is_active: true });
    };

    return (
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-500">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white italic tracking-tighter">Métodos de Pago</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Pasarelas y comisiones</p>
                    </div>
                </div>
                {!isAdding && !isEditing && (
                    <button
                        onClick={() => { setIsAdding(true); setEditData({ name: '', fee_percent: 0, fee_fixed: 0, is_active: true }); }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Nuevo Método
                    </button>
                )}
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
                    <Loader2 className="animate-spin" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Cargando métodos...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Add Form */}
                    {isAdding && (
                        <div className="bg-slate-800/40 border-2 border-dashed border-indigo-600/30 p-6 rounded-3xl space-y-4 animate-in zoom-in-95 duration-300">
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Nombre del Método (Ej: Stripe, PayPal)"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                                    value={editData.name}
                                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Fee %"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                                            value={editData.fee_percent}
                                            onChange={(e) => setEditData({ ...editData, fee_percent: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Fixed Fee"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                                            value={editData.fee_fixed}
                                            onChange={(e) => setEditData({ ...editData, fee_fixed: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditData({ ...editData, is_active: !editData.is_active })}
                                    className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl transition-all border ${editData.is_active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest">{editData.is_active ? 'Estado: Activo' : 'Estado: Inactivo'}</span>
                                    {editData.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={() => handleSave()}
                                    disabled={saving || !editData.name}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all"
                                >
                                    {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Guardar Método'}
                                </button>
                                <button
                                    onClick={cancelEdit}
                                    className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Method Cards */}
                    {methods.map(method => (
                        <div key={method.id} className={`group bg-slate-800/20 border border-slate-800 p-6 rounded-3xl transition-all hover:border-slate-700 relative overflow-hidden ${isEditing === method.id ? 'ring-2 ring-indigo-600 bg-slate-800/40' : ''}`}>
                            {isEditing === method.id ? (
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                        value={editData.name}
                                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                            value={editData.fee_percent}
                                            onChange={(e) => setEditData({ ...editData, fee_percent: parseFloat(e.target.value) })}
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                            value={editData.fee_fixed}
                                            onChange={(e) => setEditData({ ...editData, fee_fixed: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={() => setEditData({ ...editData, is_active: !editData.is_active })}
                                            className={`flex items-center gap-2 p-2 rounded-lg transition-all ${editData.is_active ? 'text-emerald-500' : 'text-slate-500'}`}
                                        >
                                            {editData.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                            <span className="text-[8px] font-black uppercase tracking-widest">{editData.is_active ? 'Activo' : 'Inactivo'}</span>
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleSave(method.id)} className="bg-indigo-600 text-white p-2 rounded-lg"><Check size={16} /></button>
                                            <button onClick={cancelEdit} className="bg-slate-700 text-white p-2 rounded-lg"><X size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between relative z-10">
                                        <div className="space-y-1">
                                            <h3 className="text-white font-black italic tracking-tighter text-lg">{method.name}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${method.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                                                    {method.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                                <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full">
                                                    Fee: {method.fee_percent}% + ${method.fee_fixed}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEdit(method)}
                                            className="p-2 bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    </div>

                                    <div className={`absolute -bottom-4 -right-4 w-24 h-24 bg-indigo-600/5 rounded-full blur-2xl group-hover:bg-indigo-600/10 transition-all`}></div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PaymentMethodsManager;
