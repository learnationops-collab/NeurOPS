import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Ghost,
    Search,
    User,
    Shield,
    Users,
    Zap,
    ArrowRight,
    Loader2,
    AlertCircle,
    UserPlus,
    Edit2,
    Trash2,
    X,
    Check,
    Power,
    Eye,
    EyeOff,
    Mail
} from 'lucide-react';
import api from '../../../services/api';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

const TeamManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRole, setActiveRole] = useState('all');
    const [impersonatingId, setImpersonatingId] = useState(null);
    const [showDeactivated, setShowDeactivated] = useState(false);

    // Modal state
    const [modal, setModal] = useState({ show: false, type: 'create', user: null });
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'closer',
        timezone: 'America/La_Paz',
        two_chat_number: '',
        is_active: true
    });
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, [showDeactivated]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/users?show_deactivated=${showDeactivated}`);
            setUsers(res.data);
        } catch (err) {
            console.error("Error fetching users", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (type, user = null) => {
        setModal({ show: true, type, user });
        setModalError(null);
        if (type === 'edit' && user) {
            setFormData({
                username: user.username,
                email: user.email || '',
                password: '',
                role: user.role,
                timezone: user.timezone || 'America/La_Paz',
                two_chat_number: user.two_chat_number || '',
                is_active: user.is_active
            });
        } else {
            setFormData({
                username: '',
                email: '',
                password: '',
                role: 'closer',
                timezone: 'America/La_Paz',
                two_chat_number: '',
                is_active: true
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setModalError(null);
        try {
            if (modal.type === 'create') {
                await api.post('/admin/users', formData);
            } else {
                await api.put(`/admin/users/${modal.user.id}`, formData);
            }
            setModal({ show: false, type: 'create', user: null });
            fetchUsers();
        } catch (err) {
            setModalError(err.response?.data?.message || 'Error al procesar la solicitud');
        } finally {
            setSubmitting(false);
        }
    };

    const handleImpersonate = async (e, targetUser) => {
        e.stopPropagation();
        if (!targetUser.is_active) return;

        setImpersonatingId(targetUser.id);
        try {
            const res = await api.post('/auth/impersonate', { user_id: targetUser.id });
            const { user: impersonatedUser, token } = res.data;

            localStorage.setItem('user', JSON.stringify(impersonatedUser));
            if (token) localStorage.setItem('auth_token', token);

            let path = '/';
            if (impersonatedUser.role === 'admin') path = '/admin/dashboard';
            else if (impersonatedUser.role === 'operator') path = '/ops/dashboard';
            else if (impersonatedUser.role === 'sales_admin') path = '/sales-admin/dashboard';
            else if (impersonatedUser.role === 'closer') path = '/closer/dashboard';
            else if (impersonatedUser.role === 'setter') path = '/setter/dashboard';

            window.location.href = path;
        } catch (err) {
            alert(err.response?.data?.message || 'Error al iniciar simulación');
            setImpersonatingId(null);
        }
    };

    const handleDelete = async (e, user) => {
        e.stopPropagation();
        if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${user.username}?`)) return;
        try {
            await api.delete(`/admin/users/${user.id}`);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Error al eliminar usuario');
        }
    };

    const roles = [
        { id: 'all', label: 'Todos', icon: Users },
        { id: 'closer', label: 'Closers', icon: User },
        { id: 'setter', label: 'Setters', icon: User },
        { id: 'sales_admin', label: 'Sales Admin', icon: Shield },
        { id: 'operator', label: 'Operadores', icon: Zap },
        { id: 'admin', label: 'Admins', icon: Shield },
    ];

    const getRoleLabel = (roleId) => {
        const role = roles.find(r => r.id === roleId);
        return role ? role.label : roleId.replace('_', ' ').toUpperCase();
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = activeRole === 'all' || u.role === activeRole;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <h1 className="text-5xl font-black italic tracking-tighter text-base uppercase">Gestión de Equipo</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.3em] flex items-center gap-2">
                        <Users size={14} className="text-primary" />
                        Control central de usuarios y simulación de roles
                    </p>
                </div>

                <div className="flex gap-4">
                    <Button
                        onClick={() => setShowDeactivated(!showDeactivated)}
                        variant="outline"
                        className={`h-14 px-6 rounded-2xl border-base font-black uppercase text-[10px] tracking-widest ${showDeactivated ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
                    >
                        {showDeactivated ? 'Ocultar Inactivos' : 'Ver Inactivos'}
                    </Button>
                    <Button
                        onClick={() => handleOpenModal('create')}
                        variant="primary"
                        className="h-14 px-8 rounded-2xl shadow-brand-glow font-black uppercase text-[10px] tracking-widest flex items-center gap-2"
                    >
                        <UserPlus size={18} />
                        Nuevo Miembro
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Búsqueda</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input
                                type="text"
                                placeholder="Nombre o Email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-surface border border-base rounded-2xl py-4 pl-12 pr-4 text-sm font-bold placeholder:text-muted focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Filtro por Rol</label>
                        <div className="space-y-2">
                            {roles.map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setActiveRole(role.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${activeRole === role.id
                                        ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-[1.02]'
                                        : 'bg-surface border-base text-muted hover:border-primary/40'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <role.icon size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{role.label}</span>
                                    </div>
                                    {activeRole === role.id && <ArrowRight size={14} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    {loading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-4 glass-effect rounded-[2.5rem] border border-base">
                            <Loader2 size={40} className="text-primary animate-spin" />
                            <p className="text-xs font-black text-muted uppercase tracking-widest">Sincronizando equipo...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                            <AnimatePresence mode="popLayout">
                                {filteredUsers.map((u, idx) => (
                                    <motion.div
                                        key={u.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <Card variant="surface" className={`p-6 group relative overflow-hidden h-full border-base hover:border-primary/50 transition-all ${!u.is_active ? 'opacity-50' : ''}`}>
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="w-16 h-16 bg-main rounded-[1.25rem] flex items-center justify-center text-2xl font-black text-primary border border-base group-hover:scale-110 transition-transform">
                                                    {u.username[0].toUpperCase()}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', u); }}
                                                        className="p-3 bg-main border border-base rounded-xl text-muted hover:text-white hover:border-primary transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(e, u)}
                                                        className="p-3 bg-main border border-base rounded-xl text-muted hover:text-rose-500 hover:border-rose-500/50 transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-1 mb-6">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xl font-black text-base truncate uppercase italic tracking-tighter">{u.username}</h3>
                                                    {!u.is_active && <Badge variant="destructive" className="text-[8px] px-1.5 py-0">INACTIVO</Badge>}
                                                </div>
                                                <p className="text-xs text-muted font-medium truncate flex items-center gap-2">
                                                    <Mail size={12} />
                                                    {u.email || 'Sin correo configurado'}
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-base/50">
                                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-3">
                                                    {getRoleLabel(u.role)}
                                                </Badge>

                                                <button
                                                    onClick={(e) => handleImpersonate(e, u)}
                                                    disabled={!u.is_active || impersonatingId === u.id}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${u.is_active
                                                        ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black shadow-lg shadow-amber-500/5'
                                                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {impersonatingId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Ghost size={14} />}
                                                    Simular
                                                </button>
                                            </div>

                                            {/* Decoration */}
                                            <div className="absolute -right-6 -bottom-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                                                <Users size={120} />
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Modal */}
            <AnimatePresence>
                {modal.show && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setModal({ ...modal, show: false })}
                            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-surface border border-base w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden relative"
                        >
                            <div className="p-10 border-b border-base flex justify-between items-center bg-main/30">
                                <div>
                                    <h2 className="text-3xl font-black text-base italic tracking-tighter uppercase">
                                        {modal.type === 'create' ? 'Nuevo Miembro' : 'Editar Miembro'}
                                    </h2>
                                    <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-1">Configuración técnica de acceso</p>
                                </div>
                                <button
                                    onClick={() => setModal({ ...modal, show: false })}
                                    className="p-4 bg-main hover:bg-surface-hover border border-base rounded-[1.5rem] text-muted hover:text-white transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-10 space-y-8">
                                {modalError && (
                                    <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] text-rose-400 text-xs font-black uppercase tracking-widest flex items-center gap-3 animate-in shake duration-300">
                                        <AlertCircle size={20} />
                                        {modalError}
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Nombre de Usuario</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ej: jsmith"
                                                className="w-full px-6 py-5 bg-main border border-base rounded-2xl text-base outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:text-muted/30"
                                                value={formData.username}
                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            />
                                        </div>

                                        <div className="space-y-2 col-span-2">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Correo Electrónico</label>
                                            <input
                                                type="email"
                                                placeholder="usuario@learnation.com"
                                                className="w-full px-6 py-5 bg-main border border-base rounded-2xl text-base outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:text-muted/30"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Rol Operativo</label>
                                            <select
                                                className="w-full px-6 py-5 bg-main border border-base rounded-2xl text-base outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold appearance-none cursor-pointer"
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            >
                                                <option value="admin">Administrador</option>
                                                <option value="closer">Closer Principal</option>
                                                <option value="setter">Setter de Leads</option>
                                                <option value="operator">Operador Técnico</option>
                                                <option value="sales_admin">Sales Admin</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Contraseña</label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    placeholder={modal.type === 'edit' ? 'Vacio para no cambiar' : '••••••••'}
                                                    required={modal.type === 'create'}
                                                    className="w-full px-6 py-5 bg-main border border-base rounded-2xl text-base outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-6 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-6 bg-main/40 rounded-[2rem] border border-base">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-2xl ${formData.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                <Power size={24} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black uppercase text-base tracking-widest">Estado de Cuenta</p>
                                                <p className="text-[10px] text-muted font-bold uppercase mt-0.5">{formData.is_active ? 'Acceso Habilitado' : 'Acceso Restringido'}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                            className={`w-14 h-7 rounded-full p-1 transition-all duration-500 ease-in-out ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-xl transform transition-transform duration-500 ${formData.is_active ? 'translate-x-7' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    variant="primary"
                                    className="w-full h-20 rounded-[1.5rem] shadow-brand-glow flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.3em]"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={24} /> : (
                                        <>
                                            <Check size={24} />
                                            {modal.type === 'create' ? 'Crear Miembro' : 'Guardar Cambios'}
                                        </>
                                    )}
                                </Button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TeamManagementPage;
