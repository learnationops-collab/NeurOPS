import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Trash2, Edit2, Check, X, Loader2, Package, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';

const ProgramsManager = () => {
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(null); // id of program being edited
    const [editData, setEditData] = useState({ name: '', price: '', is_active: true });
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchPrograms();
    }, []);

    const fetchPrograms = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/db/programs');
            setPrograms(res.data);
        } catch (err) {
            console.error("Error fetching programs:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (id = null) => {
        setSaving(true);
        try {
            const payload = id ? { ...editData, id } : editData;
            await api.post('/admin/db/programs', payload);
            setIsEditing(null);
            setIsAdding(false);
            setEditData({ name: '', price: '', is_active: true });
            fetchPrograms();
        } catch (err) {
            console.error("Error saving program:", err);
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (program) => {
        setIsEditing(program.id);
        setEditData({ name: program.name, price: program.price, is_active: program.is_active });
        setIsAdding(false);
    };

    const cancelEdit = () => {
        setIsEditing(null);
        setIsAdding(false);
        setEditData({ name: '', price: '', is_active: true });
    };

    return (
        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-500">
                        <Package size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white italic tracking-tighter">Programas de Formación</h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Gestión de oferta comercial</p>
                    </div>
                </div>
                {!isAdding && !isEditing && (
                    <button
                        onClick={() => { setIsAdding(true); setEditData({ name: '', price: '', is_active: true }); }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Nuevo Programa
                    </button>
                )}
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
                    <Loader2 className="animate-spin" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Cargando programas...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Add Form */}
                    {isAdding && (
                        <div className="bg-slate-800/40 border-2 border-dashed border-indigo-600/30 p-6 rounded-3xl space-y-4 animate-in zoom-in-95 duration-300">
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Nombre del Programa"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                                    value={editData.name}
                                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                />
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input
                                            type="number"
                                            placeholder="Precio"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                                            value={editData.price}
                                            onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setEditData({ ...editData, is_active: !editData.is_active })}
                                        className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all border ${editData.is_active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                    >
                                        {editData.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">{editData.is_active ? 'Activo' : 'Inactivo'}</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={() => handleSave()}
                                    disabled={saving || !editData.name || !editData.price}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all"
                                >
                                    {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Guardar Programa'}
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

                    {/* Program Cards */}
                    {programs.map(program => (
                        <div key={program.id} className={`group bg-slate-800/20 border border-slate-800 p-6 rounded-3xl transition-all hover:border-slate-700 relative overflow-hidden ${isEditing === program.id ? 'ring-2 ring-indigo-600 bg-slate-800/40' : ''}`}>
                            {isEditing === program.id ? (
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                        value={editData.name}
                                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                            value={editData.price}
                                            onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                                        />
                                        <button
                                            onClick={() => setEditData({ ...editData, is_active: !editData.is_active })}
                                            className={`p-2 rounded-lg transition-all ${editData.is_active ? 'text-emerald-500' : 'text-slate-500'}`}
                                        >
                                            {editData.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleSave(program.id)} className="flex-1 bg-indigo-600 text-[10px] font-black uppercase py-2 rounded-lg"><Check size={16} className="mx-auto" /></button>
                                        <button onClick={cancelEdit} className="flex-1 bg-slate-700 text-[10px] font-black uppercase py-2 rounded-lg"><X size={16} className="mx-auto" /></button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between relative z-10">
                                        <div>
                                            <h3 className="text-white font-black italic tracking-tighter text-lg">{program.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${program.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                                                    {program.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-indigo-500 italic tracking-tighter">${program.price}</p>
                                        </div>
                                    </div>

                                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEdit(program)}
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

export default ProgramsManager;
