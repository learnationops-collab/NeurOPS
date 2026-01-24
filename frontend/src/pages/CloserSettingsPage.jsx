import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Clock,
    Calendar,
    Trash2,
    Plus,
    Check,
    X,
    Loader2,
    Settings,
    Shield,
    User as UserIcon,
    Bell
} from 'lucide-react';

const CloserSettingsPage = () => {
    const [availability, setAvailability] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newSlot, setNewSlot] = useState({ date: '', start_time: '', end_time: '' });
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('availability');

    useEffect(() => {
        fetchAvailability();
    }, []);

    const fetchAvailability = async () => {
        try {
            const res = await api.get('/api/closer/availability');
            setAvailability(res.data);
        } catch (err) {
            console.error("Error fetching availability", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSlot = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/closer/availability', { action: 'add', ...newSlot });
            setNewSlot({ date: '', start_time: '', end_time: '' });
            fetchAvailability();
        } catch (err) {
            alert("Error al añadir horario");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSlot = async (id) => {
        if (!window.confirm("¿Eliminar este horario?")) return;
        try {
            await api.post('/api/closer/availability', { action: 'delete', id });
            fetchAvailability();
        } catch (err) {
            alert("Error al eliminar horario");
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
            <header>
                <h1 className="text-3xl font-black text-white italic tracking-tighter">CONFIGURACIÓN</h1>
                <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Gestiona tu disponibilidad y perfil</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* Sidebar Menu */}
                <div className="lg:col-span-1 space-y-2">
                    <button
                        onClick={() => setActiveTab('availability')}
                        className={`w-full flex items-center gap-4 p-5 rounded-3xl transition-all ${activeTab === 'availability'
                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                            : 'text-slate-500 hover:bg-slate-800/50 hover:text-white'
                            }`}
                    >
                        <Clock size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Mi Disponibilidad</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full flex items-center gap-4 p-5 rounded-3xl transition-all ${activeTab === 'profile'
                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                            : 'text-slate-500 hover:bg-slate-800/50 hover:text-white'
                            }`}
                    >
                        <UserIcon size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Perfil</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`w-full flex items-center gap-4 p-5 rounded-3xl transition-all ${activeTab === 'notifications'
                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                            : 'text-slate-500 hover:bg-slate-800/50 hover:text-white'
                            }`}
                    >
                        <Bell size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Notificaciones</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-8">
                    {activeTab === 'availability' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                            {/* New Slot Form */}
                            <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-xl">
                                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 px-1">Añadir Nuevo Horario</h3>
                                <form onSubmit={handleAddSlot} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full px-5 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold text-sm"
                                            value={newSlot.date}
                                            onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Desde</label>
                                        <input
                                            type="time"
                                            required
                                            className="w-full px-5 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold text-sm"
                                            value={newSlot.start_time}
                                            onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                                        <input
                                            type="time"
                                            required
                                            className="w-full px-5 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold text-sm"
                                            value={newSlot.end_time}
                                            onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full h-[46px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                                        >
                                            {submitting ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} /> Añadir</>}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Activity Logic / Table of availability */}
                            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-800 bg-slate-800/20">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Horario</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {availability.length > 0 ? availability.map(slot => (
                                            <tr key={slot.id} className="hover:bg-slate-800/30 transition-all">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <Calendar size={16} className="text-indigo-500" />
                                                        <span className="text-white font-bold">{new Date(slot.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <Clock size={16} className="text-slate-500" />
                                                        <span className="text-slate-300 font-medium">{slot.start_time} - {slot.end_time}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <button
                                                        onClick={() => handleDeleteSlot(slot.id)}
                                                        className="p-3 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="3" className="p-12 text-center text-slate-500 uppercase font-black tracking-widest text-[10px]">No tienes horarios configurados</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div className="bg-slate-900/40 p-12 rounded-[2.5rem] border border-slate-800 text-center space-y-8 animate-in slide-in-from-right-4 duration-500">
                            <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-3xl mx-auto flex items-center justify-center text-white text-4xl font-black shadow-2xl">
                                {api.user?.username?.[0]?.toUpperCase() || 'C'}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{api.user?.username || 'Closer Account'}</h3>
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{api.user?.role || 'Closer'}</p>
                            </div>
                            <div className="pt-8 border-t border-slate-800 grid grid-cols-2 gap-4 max-w-md mx-auto">
                                <button className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Cambiar Password</button>
                                <button className="py-4 bg-indigo-600 border border-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Guardar Perfil</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CloserSettingsPage;
