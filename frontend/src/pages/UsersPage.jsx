import { useState, useEffect } from 'react';
import api from '../services/api';
import { UserPlus, Search, Edit2, Trash2, Mail, Shield, Clock } from 'lucide-react';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            console.error("Error fetching users", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="p-8 text-white">Cargando usuarios...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter">Gestion de Equipo</h1>
                    <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Administradores y Closers</p>
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all">
                    <UserPlus size={18} />
                    <span>Nuevo Miembro</span>
                </button>
            </header>

            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/30">
                            <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Usuario</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Rol</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Zona Horaria</th>
                            <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black">
                                            {user.username[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{user.username}</p>
                                            <p className="text-xs text-slate-500">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-slate-400 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} />
                                        {user.timezone}
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-all"><Edit2 size={16} /></button>
                                        <button className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UsersPage;
