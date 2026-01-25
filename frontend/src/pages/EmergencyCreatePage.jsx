import React, { useState } from 'react';
import axios from 'axios';
import { Shield, UserPlus, Key, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

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
        <div className="min-h-screen bg-main flex items-center justify-center p-4">
            <Card variant="surface" className="max-w-md w-full overflow-hidden p-0 border-accent/20">
                <div className="bg-accent p-8 flex items-center gap-4">
                    <Shield className="text-white w-10 h-10" />
                    <div>
                        <h1 className="text-white text-xl font-black uppercase italic tracking-tighter">Acceso de Emergencia</h1>
                        <p className="text-white/70 font-bold uppercase text-[10px] tracking-widest leading-none mt-1">Creación de usuario maestro</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {status.message && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-accent/10 text-accent border border-accent/20'
                            }`}>
                            {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span className="text-sm font-black uppercase tracking-widest">{status.message}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1">Código Secreto</label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-main border border-base rounded-xl py-4 pl-12 pr-4 text-base placeholder-muted/20 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-mono font-black"
                                    placeholder="••••••••"
                                    value={formData.secret}
                                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1">Nuevo Usuario</label>
                            <div className="relative">
                                <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50 w-5 h-5" />
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-main border border-base rounded-xl py-4 pl-12 pr-4 text-base placeholder-muted/20 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-black"
                                    placeholder="Nombre de usuario"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50 w-5 h-5" />
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-main border border-base rounded-xl py-4 pl-12 pr-4 text-base placeholder-muted/20 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-black"
                                    placeholder="Contraseña"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1">Rol del Usuario</label>
                            <select
                                className="w-full bg-main border border-base rounded-xl py-4 px-4 text-base focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all appearance-none cursor-pointer font-black uppercase"
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

                    <Button
                        type="submit"
                        loading={loading}
                        variant="primary"
                        className="w-full h-16 bg-accent border-accent hover:bg-accent/80 text-white"
                        icon={UserPlus}
                    >
                        Crear Usuario Maestro
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default EmergencyCreatePage;
