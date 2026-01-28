import { useState, useEffect } from 'react';
import { Power, Users, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import api from '../services/api';

const OperatorControls = () => {
    const [user, setUser] = useState(null);
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
        const checkUser = async () => {
            try {
                const res = await api.get('/auth/me');
                setUser(res.data.user);

                // Only fetch potential targets if we are an operator
                if (res.data.user.role === 'operator' || res.data.user.is_impersonating) {
                    fetchTargets();
                }
            } catch (err) {
                console.error("Error checking user status", err);
            }
        };
        checkUser();
    }, []);

    const fetchTargets = async () => {
        try {
            // Reusing the users endpoint, might need adjustment if permissions change
            const res = await api.get('/admin/users');
            setTargets(res.data.filter(u => u.username !== 'admin')); // Filter out admin if needed or keep all
        } catch (err) {
            console.error("Error fetching impersonation targets", err);
        }
    };

    const handleImpersonate = async () => {
        if (!selectedUserId) return;
        setLoading(true);
        try {
            const res = await api.post('/auth/impersonate', { user_id: selectedUserId });
            window.location.reload(); // Hard reload to ensure all contexts update
        } catch (err) {
            alert(err.response?.data?.message || 'Error executing impersonation');
            setLoading(false);
        }
    };

    const handleRevert = async () => {
        setLoading(true);
        try {
            await api.post('/auth/revert');
            window.location.reload();
        } catch (err) {
            alert('Error reverting session');
            setLoading(false);
        }
    };

    if (!user) return null;

    // Show if role is operator OR if currently impersonating
    if (user.role !== 'operator' && !user.is_impersonating) return null;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 bg-amber-500 hover:bg-amber-400 text-black font-black p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                title="Menú de Operador"
            >
                <Users size={24} />
                {user.is_impersonating && <span className="text-xs uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded-md">Activado</span>}
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 border border-amber-500/50 rounded-3xl shadow-2xl p-6 w-80 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />

                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-amber-500 font-black italic uppercase text-lg">Modo Operador</h3>
                        <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                            {user.is_impersonating ? 'Sesión Simulada Activa' : 'Control de Sesión'}
                        </p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                        <Power size={20} />
                    </button>
                </div>

                {user.is_impersonating ? (
                    <div className="space-y-4">
                        <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                            <div className="flex items-center gap-3 mb-2">
                                <AlertTriangle className="text-amber-500" size={20} />
                                <span className="font-bold text-amber-500 text-sm">Suplantando a:</span>
                            </div>
                            <p className="text-white font-black text-xl text-center">{user.username}</p>
                            <p className="text-slate-500 text-xs text-center uppercase tracking-widest mt-1">Rol: {user.role}</p>
                        </div>

                        <button
                            onClick={handleRevert}
                            disabled={loading}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowLeft size={18} />}
                            <span className="uppercase tracking-widest text-xs">Volver a mi sesión</span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Seleccionar Usuario</label>
                            {targets.length > 0 ? (
                                <select
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-medium"
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                >
                                    <option value="">-- Elegir usuario --</option>
                                    {targets.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.username} ({t.role})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No hay usuarios disponibles para suplantar.</p>
                            )}
                        </div>

                        <button
                            onClick={handleImpersonate}
                            disabled={!selectedUserId || loading}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
                            <span className="uppercase tracking-widest text-xs">Simular Sesión</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OperatorControls;
