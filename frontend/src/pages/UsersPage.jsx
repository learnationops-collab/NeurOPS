import { useState, useEffect } from 'react';
import api from '../services/api';
import { UserPlus, Search, Edit2, Trash2, Mail, Shield, Clock, X, Check, Loader2, Eye, EyeOff, Power } from 'lucide-react';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showDeactivated, setShowDeactivated] = useState(false);
    const [modal, setModal] = useState({ show: false, type: 'create', user: null });
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'closer',
        timezone: 'America/La_Paz',
        is_active: true
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

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
        setError(null);
        if (type === 'edit' && user) {
            setFormData({
                username: user.username,
                email: user.email || '',
                password: '', // Leave empty for edit unless changing
                role: user.role,
                timezone: user.timezone || 'America/La_Paz',
                is_active: user.is_active
            });
        } else {
            setFormData({
                username: '',
                email: '',
                password: '',
                role: 'closer',
                timezone: 'America/La_Paz',
                is_active: true
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            if (modal.type === 'create') {
                await api.post('/admin/users', formData);
            } else {
                await api.put(`/admin/users/${modal.user.id}`, formData);
            }
            setModal({ show: false, type: 'create', user: null });
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al procesar la solicitud');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (user) => {
        try {
            await api.put(`/admin/users/${user.id}`, {
                ...user,
                is_active: !user.is_active
            });
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Error al actualizar estado');
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este miembro?')) return;
        try {
            await api.delete(`/admin/users/${id}`);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Error al eliminar usuario');
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
    );

    if (loading && users.length === 0) return (
        <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter">Gestión de Equipo</h1>
                    <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Administradores y Closers</p>
                </div>
                <button
                    onClick={() => handleOpenModal('create')}
                    className="flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                >
                    <UserPlus size={20} />
                    <span className="uppercase tracking-widest text-xs">Nuevo Miembro</span>
                </button>
            </header>

            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <button
                    onClick={() => setShowDeactivated(!showDeactivated)}
                    className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all border ${showDeactivated
                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                        : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-800'
                        }`}
                >
                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${showDeactivated ? 'bg-indigo-500' : 'bg-slate-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${showDeactivated ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="uppercase tracking-widest text-xs">
                        {showDeactivated ? 'Ocultar Inactivos' : 'Mostrar Inactivos'}
                    </span>
                </button>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800/50 overflow-hidden shadow-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/20">
                            <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Usuario</th>
                            <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Rol</th>
                            <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Estado</th>
                            <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className={`hover:bg-slate-800/30 transition-colors group ${!user.is_active ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black border shadow-lg ${user.is_active
                                            ? 'bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/20'
                                            : 'bg-slate-800 text-slate-500 border-slate-700'
                                            }`}>
                                            {user.username[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-lg flex items-center gap-2">
                                                {user.username}
                                                {!user.is_active && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider">Inactivo</span>}
                                            </p>
                                            <p className="text-xs text-slate-500 font-medium">{user.email || 'Sin email'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${user.role === 'admin'
                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        : user.role === 'closer'
                                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-8 py-6">
                                    <button
                                        onClick={() => handleToggleActive(user)}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors ${user.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                        title={user.is_active ? "Desactivar usuario" : "Activar usuario"}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${user.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenModal('edit', user)}
                                            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all border border-transparent hover:border-slate-600 shadow-lg"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20 shadow-lg"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden card-shadow">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                            <div>
                                <h2 className="text-2xl font-black text-white italic tracking-tighter">
                                    {modal.type === 'create' ? 'Nuevo Miembro' : 'Editar Miembro'}
                                </h2>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Configura los accesos del usuario</p>
                            </div>
                            <button
                                onClick={() => setModal({ ...modal, show: false })}
                                className="p-2 text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-bold animate-in shake duration-300">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2 col-span-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Usuario</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2 col-span-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Rol</label>
                                    <select
                                        className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold appearance-none cursor-pointer"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="admin">Administrador</option>
                                        <option value="closer">Closer</option>
                                        <option value="setter">Setter</option>
                                        <option value="operator">Operador</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                                    <input
                                        type="password"
                                        placeholder={modal.type === 'edit' ? 'Vacio para no cambiar' : '********'}
                                        required={modal.type === 'create'}
                                        className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>

                                <div className="col-span-2 flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${formData.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            <Power size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">Estado de la cuenta</p>
                                            <p className="text-xs text-slate-500">{formData.is_active ? 'El usuario puede ingresar al sistema' : 'Acceso denegado'}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        <Check size={20} />
                                        <span className="uppercase tracking-widest text-xs">Guardar Cambios</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;
