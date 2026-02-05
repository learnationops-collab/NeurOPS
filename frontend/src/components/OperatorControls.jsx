import React, { useState, useEffect } from 'react';
import { X, Power, Users, AlertTriangle, Loader2, ArrowLeft, Ghost } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const OperatorControls = ({ isOpen, onClose }) => {
    const [user, setUser] = useState(null);
    const [targets, setTargets] = useState([]);
    const [filteredTargets, setFilteredTargets] = useState([]);
    const [activeRoleFilter, setActiveRoleFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
        const checkUser = async () => {
            try {
                const res = await api.get('/auth/me');
                setUser(res.data.user);

                // Fetch potential targets if we are authorized
                if (res.data.user.role === 'operator' || res.data.user.role === 'admin' || res.data.user.is_impersonating) {
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
            const res = await api.get('/admin/users');
            setTargets(res.data);
            setFilteredTargets(res.data.filter(u => u.username !== 'admin'));
        } catch (err) {
            console.error("Error fetching impersonation targets", err);
        }
    };

    useEffect(() => {
        if (activeRoleFilter === 'all') {
            setFilteredTargets(targets.filter(u => u.username !== 'admin'));
        } else {
            setFilteredTargets(targets.filter(u => u.role === activeRoleFilter && u.username !== 'admin'));
        }
        setSelectedUserId(''); // Reset selection when filter changes
    }, [activeRoleFilter, targets]);

    const handleImpersonate = async () => {
        if (!selectedUserId) return;
        setLoading(true);
        try {
            const res = await api.post('/auth/impersonate', { user_id: selectedUserId });
            const { user: targetUser, token } = res.data;

            // Sincronizar estado local
            localStorage.setItem('user', JSON.stringify(targetUser));
            if (token) localStorage.setItem('auth_token', token);

            // Redirigir según el rol del usuario simulado
            let redirectPath = '/';
            if (targetUser.role === 'admin' || targetUser.role === 'operator') {
                redirectPath = '/admin/dashboard';
            } else if (targetUser.role === 'closer') {
                redirectPath = '/closer/dashboard';
            } else if (targetUser.role === 'setter') {
                redirectPath = '/setter/dashboard';
            }

            window.location.href = redirectPath;
        } catch (err) {
            alert(err.response?.data?.message || 'Error executing impersonation');
            setLoading(false);
        }
    };

    const handleRevert = async () => {
        setLoading(true);
        try {
            const res = await api.post('/auth/revert');
            const { user: originalUser, token } = res.data;

            // Sincronizar estado local
            localStorage.setItem('user', JSON.stringify(originalUser));
            if (token) localStorage.setItem('auth_token', token);

            // Redirigir al dashboard original
            let redirectPath = '/admin/dashboard';
            if (originalUser.role === 'closer') redirectPath = '/closer/dashboard';
            if (originalUser.role === 'setter') redirectPath = '/setter/dashboard';

            window.location.href = redirectPath;
        } catch (err) {
            alert('Error reverting session');
            setLoading(false);
        }
    };

    if (!user) return null;

    // Visibility: operator, admin, or currently impersonating
    const isAuthorized = user.role === 'admin' || user.role === 'operator' || user.is_impersonating;
    if (!isAuthorized) return null;

    const roles = [
        { id: 'all', label: 'Todos' },
        { id: 'closer', label: 'Closers' },
        { id: 'setter', label: 'Setters' },
        { id: 'admin', label: 'Admins' },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />

                    {/* Menu Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed bottom-24 right-8 z-[70] w-[28rem] glass-effect p-8 rounded-[2.5rem] shadow-2xl border-white/10"
                    >
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500">
                                        <Ghost size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black italic uppercase tracking-tighter">Acceso Simulado</h3>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">{user.is_impersonating ? 'Suplantación Activa' : 'Panel de Operador'}</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 hover:bg-surface-hover rounded-2xl text-muted hover:text-base transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {user.is_impersonating ? (
                            <div className="space-y-6">
                                <div className="bg-primary/5 p-8 rounded-3xl border border-primary/20 text-center">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Actualmente viendo como</p>
                                    <p className="text-3xl font-black text-base">{user.username}</p>
                                    <div className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase">
                                        <AlertTriangle size={14} />
                                        <span>Modo Simulación</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleRevert}
                                    disabled={loading}
                                    className="w-full py-5 bg-primary text-white font-black rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={24} /> : <ArrowLeft size={24} />}
                                    <span className="uppercase tracking-widest text-sm">Volver a mi sesión</span>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* Role Filter Chips */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Filtrar por Rol</label>
                                    <div className="flex flex-wrap gap-2">
                                        {roles.map(role => (
                                            <button
                                                key={role.id}
                                                onClick={() => setActiveRoleFilter(role.id)}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${activeRoleFilter === role.id
                                                    ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20'
                                                    : 'bg-main/50 border-base text-muted hover:border-amber-500/50'
                                                    }`}
                                            >
                                                {role.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Seleccionar Usuario</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-main/50 border border-base rounded-2xl px-6 py-5 text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm font-bold appearance-none cursor-pointer"
                                            value={selectedUserId}
                                            onChange={(e) => setSelectedUserId(e.target.value)}
                                        >
                                            <option value="">-- {filteredTargets.length > 0 ? `Elegir (${filteredTargets.length})` : 'No hay usuarios'} --</option>
                                            {filteredTargets.map(t => (
                                                <option key={t.id} value={t.id} className="bg-slate-900 text-white p-4">
                                                    {t.username}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                                            <Users size={20} />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleImpersonate}
                                    disabled={!selectedUserId || loading}
                                    className="w-full py-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black rounded-2xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={24} /> : <Ghost size={24} />}
                                    <span className="uppercase tracking-widest text-sm font-black">Iniciar Simulación</span>
                                </button>

                                <div className="p-5 bg-amber-500/5 rounded-3xl border border-amber-500/10 flex gap-4">
                                    <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                                    <p className="text-[11px] text-amber-500/80 font-bold leading-relaxed uppercase tracking-tight">
                                        Atención: Entrarás en una sesión espejada. Acciones realizadas afectarán los datos del usuario real.
                                    </p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default OperatorControls;
