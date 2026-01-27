import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Plus, Calendar, DollarSign, Repeat, Trash2, ToggleLeft, ToggleRight, Loader2, Play } from 'lucide-react';
import Button from './ui/Button';

const ExpensesManagerModal = ({ isOpen, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState('new');
    const [loading, setLoading] = useState(false);
    const [loadingRecurring, setLoadingRecurring] = useState(false);

    // New Expense Form
    const [newExpense, setNewExpense] = useState({
        description: '',
        amount: '',
        category: 'variable',
        date: new Date().toISOString().split('T')[0]
    });

    // Recurring Expenses
    const [recurringExpenses, setRecurringExpenses] = useState([]);
    const [newRecurring, setNewRecurring] = useState({
        description: '',
        amount: '',
        day_of_month: 1,
        is_active: true
    });
    const [isAddingRecurring, setIsAddingRecurring] = useState(false);

    useEffect(() => {
        if (isOpen && activeTab === 'recurring') {
            fetchRecurring();
        }
    }, [isOpen, activeTab]);

    const fetchRecurring = async () => {
        setLoadingRecurring(true);
        try {
            const res = await api.get('/admin/finance/recurring');
            setRecurringExpenses(res.data);
        } catch (err) {
            console.error("Error fetching recurring expenses", err);
        } finally {
            setLoadingRecurring(false);
        }
    };

    const handleCreateExpense = async () => {
        setLoading(true);
        try {
            await api.post('/admin/finance/expenses', newExpense);
            setNewExpense({ description: '', amount: '', category: 'variable', date: new Date().toISOString().split('T')[0] });
            onSuccess();
            onClose(); // Optional: Keep open or close? Typically close for one-time actions
        } catch (err) {
            alert('Error al crear gasto');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRecurring = async () => {
        setLoading(true);
        try {
            await api.post('/admin/finance/recurring', newRecurring);
            setNewRecurring({ description: '', amount: '', day_of_month: 1, is_active: true });
            setIsAddingRecurring(false);
            fetchRecurring();
        } catch (err) {
            alert('Error al crear gasto fijo');
        } finally {
            setLoading(false);
        }
    };

    const toggleRecurring = async (id) => {
        try {
            await api.post(`/admin/finance/recurring/${id}/toggle`);
            fetchRecurring();
        } catch (err) { console.error(err); }
    };

    const deleteRecurring = async (id) => {
        if (!window.confirm("¿Eliminar este gasto fijo?")) return;
        try {
            await api.delete(`/admin/finance/recurring/${id}`);
            fetchRecurring();
        } catch (err) { console.error(err); }
    };

    const generateMonthly = async () => {
        setLoading(true);
        try {
            const res = await api.post('/admin/finance/recurring/generate');
            alert(res.data.message);
            onSuccess(); // Refresh dashboard
        } catch (err) {
            alert('Error al generar gastos');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface border border-base rounded-[2rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-base flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black italic tracking-tighter">Gestión de Gastos</h2>
                        <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Configura tus egresos</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="flex p-2 gap-2 border-b border-base bg-surface-hover/50">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'new' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-white hover:bg-white/5'}`}
                    >
                        Nuevo Gasto
                    </button>
                    <button
                        onClick={() => setActiveTab('recurring')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'recurring' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-white hover:bg-white/5'}`}
                    >
                        Gastos Fijos
                    </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {activeTab === 'new' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Descripción</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-base rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="Ej. Hosting Web"
                                        value={newExpense.description}
                                        onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Monto</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                        <input
                                            type="number"
                                            className="w-full bg-slate-900 border border-base rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            placeholder="0.00"
                                            value={newExpense.amount}
                                            onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Fecha</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                                        <input
                                            type="date"
                                            className="w-full bg-slate-900 border border-base rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                                            value={newExpense.date}
                                            onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Categoría</label>
                                    <select
                                        className="w-full bg-slate-900 border border-base rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={newExpense.category}
                                        onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                                    >
                                        <option value="variable">Variable</option>
                                        <option value="fixed">Fijo</option>
                                    </select>
                                </div>
                            </div>
                            <Button
                                onClick={handleCreateExpense}
                                disabled={loading || !newExpense.description || !newExpense.amount}
                                variant="primary"
                                className="w-full py-4 mt-6"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Registrar Gasto'}
                            </Button>
                        </div>
                    )}

                    {activeTab === 'recurring' && (
                        <div className="space-y-6">
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center justify-between">
                                <div>
                                    <h4 className="text-indigo-400 font-bold text-sm">Automtización Mensual</h4>
                                    <p className="text-[10px] text-indigo-300/60 uppercase tracking-widest">Genera los gastos de este mes basados en tus fijos activos</p>
                                </div>
                                <Button onClick={generateMonthly} disabled={loading} size="sm" icon={Play} variant="primary" className="bg-indigo-600 hover:bg-indigo-500 border-none">
                                    Ejecutar Ahora
                                </Button>
                            </div>

                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black uppercase tracking-widest text-muted">Configuración de Fijos</h3>
                                {!isAddingRecurring && (
                                    <Button onClick={() => setIsAddingRecurring(true)} size="sm" icon={Plus} variant="secondary">Nuevo Fijo</Button>
                                )}
                            </div>

                            {isAddingRecurring && (
                                <div className="bg-slate-800/50 p-4 rounded-2xl space-y-4 border border-base animate-in zoom-in-95">
                                    <div className="grid grid-cols-3 gap-4">
                                        <input
                                            type="text"
                                            placeholder="Descripción"
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                                            value={newRecurring.description}
                                            onChange={e => setNewRecurring({ ...newRecurring, description: e.target.value })}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Monto"
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                                            value={newRecurring.amount}
                                            onChange={e => setNewRecurring({ ...newRecurring, amount: e.target.value })}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Día del mes (1-31)"
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                                            value={newRecurring.day_of_month}
                                            onChange={e => setNewRecurring({ ...newRecurring, day_of_month: e.target.value })}
                                            min="1" max="31"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={handleCreateRecurring} disabled={loading} size="sm" variant="primary">Guardar</Button>
                                        <Button onClick={() => setIsAddingRecurring(false)} size="sm" variant="ghost">Cancelar</Button>
                                    </div>
                                </div>
                            )}

                            {loadingRecurring ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted" /></div>
                            ) : (
                                <div className="space-y-2">
                                    {recurringExpenses.map(item => (
                                        <div key={item.id} className="flex justify-between items-center p-4 bg-surface-hover/30 rounded-xl border border-base/50">
                                            <div className="flex items-center gap-4">
                                                <div onClick={() => toggleRecurring(item.id)} className="cursor-pointer text-muted hover:text-white transition-colors">
                                                    {item.is_active ? <ToggleRight size={24} className="text-emerald-500" /> : <ToggleLeft size={24} />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{item.description}</p>
                                                    <p className="text-[10px] text-muted uppercase">Día {item.day_of_month} de cada mes</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono font-bold text-accent">${item.amount.toLocaleString()}</span>
                                                <button onClick={() => deleteRecurring(item.id)} className="p-2 text-muted hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {recurringExpenses.length === 0 && <p className="text-center text-muted text-xs py-4">No hay gastos fijos configurados.</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExpensesManagerModal;
