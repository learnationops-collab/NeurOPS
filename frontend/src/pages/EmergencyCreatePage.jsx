import React, { useState } from 'react';
import axios from 'axios';
import { Shield, UserPlus, Key, Lock, CheckCircle, AlertCircle } from 'lucide-react';

const EmergencyCreatePage = () => {
    const [formData, setFormData] = useState({
        secret: '',
        username: '',
        password: '',
        role: 'admin'
    });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            const response = await axios.post('/api/auth/emergency-create', formData);
            setStatus({ type: 'success', message: response.data.message });
            setFormData({ ...formData, username: '', password: '' }); // Clear sensitive fields
        } catch (error) {
            setStatus({
                type: 'error',
                message: error.response?.data?.message || 'Error al conectar con el servidor'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-[#1e293b] rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 flex items-center gap-4">
                    <Shield className="text-white w-10 h-10" />
                    <div>
                        <h1 className="text-white text-xl font-bold">Acceso de Emergencia</h1>
                        <p className="text-red-100 text-xs">Creación de usuario maestro</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {status.message && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                            {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span className="text-sm font-medium">{status.message}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Código Secreto</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono"
                                    placeholder="••••••••"
                                    value={formData.secret}
                                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Nuevo Usuario</label>
                            <div className="relative">
                                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                                    placeholder="Nombre de usuario"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                                    placeholder="Contraseña"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Rol del Usuario</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all appearance-none cursor-pointer"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="admin">Administrador</option>
                                <option value="closer">Closer</option>
                                <option value="lead">Lead</option>
                                <option value="agenda">Agenda</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg ${loading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 active:scale-[0.98] shadow-red-500/20'
                            }`}
                    >
                        {loading ? 'Procesando...' : 'Crear Usuario'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EmergencyCreatePage;
