import React, { useState, useEffect } from 'react';
import { 
    UserCheck, Trash2, Plus, Loader2, RefreshCw, AlertCircle, Check
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CloserAliasesPanel = () => {
    const [users, setUsers] = useState([]);
    const [aliases, setAliases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    
    // Form state
    const [selectedUserId, setSelectedUserId] = useState('');
    const [aliasName, setAliasName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Cargar usuarios y alias
    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, aliasesRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/closer-aliases')
            ]);
            // Filtrar closers y admins (para que aparezcan Sebastian, Mary, Jean Carlo)
            const closersOrAdmins = (usersRes.data || []).filter(u => 
                u.role === 'closer' || u.role === 'admin' || u.role === 'setter'
            );
            setUsers(closersOrAdmins);
            setAliases(aliasesRes.data || []);
        } catch (err) {
            console.error("Error al cargar datos:", err);
            toast.error("Error al cargar datos de asignación");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Agregar nuevo alias
    const handleAddAlias = async (e) => {
        e.preventDefault();
        if (!selectedUserId) {
            toast.error("Selecciona un usuario del CRM");
            return;
        }
        if (!aliasName.trim()) {
            toast.error("Ingresa el alias de Sheets");
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/admin/closer-aliases', {
                user_id: parseInt(selectedUserId),
                alias_name: aliasName.trim()
            });
            toast.success("Alias agregado con éxito");
            setAliasName('');
            fetchData();
        } catch (err) {
            console.error("Error al agregar alias:", err);
            const errMsg = err.response?.data?.message || "Error al agregar alias";
            toast.error(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    // Eliminar alias
    const handleDeleteAlias = async (aliasId) => {
        if (!window.confirm("¿Seguro que deseas eliminar este alias?")) return;
        
        try {
            await api.delete(`/admin/closer-aliases/${aliasId}`);
            toast.success("Alias eliminado");
            fetchData();
        } catch (err) {
            console.error("Error al eliminar alias:", err);
            toast.error("Error al eliminar alias");
        }
    };

    // Gatillar sincronización selectiva en caliente
    const handleTriggerSync = async () => {
        setSyncing(true);
        try {
            const res = await api.post('/public/financial-agendas/sync-appointments?days=14');
            toast.success(`¡Sincronización completada! ${res.data.synced || 0} agendas procesadas y reasignadas.`);
        } catch (err) {
            console.error("Error al sincronizar:", err);
            toast.error("Error al ejecutar la sincronización");
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-3 bg-[#111219]/95 border border-slate-900 rounded-[2rem]">
                <Loader2 className="animate-spin text-violet-500" size={32} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando alias y usuarios...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header del Panel */}
            <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                        <UserCheck className="text-violet-500" size={22} />
                        Mapeo de Alias de Closers
                    </h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Vincula nombres de Google Sheets a usuarios reales del CRM
                    </p>
                </div>
                <button
                    onClick={handleTriggerSync}
                    disabled={syncing}
                    className="w-full md:w-auto px-5 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-650/20"
                >
                    {syncing ? (
                        <>
                            <Loader2 className="animate-spin" size={14} />
                            Aplicando en caliente...
                        </>
                    ) : (
                        <>
                            <RefreshCw size={14} />
                            Aplicar mapeo a agendas
                        </>
                    )}
                </button>
            </div>

            {/* Grid de Configuración */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Formulario de creación (Izquierda) */}
                <div className="lg:col-span-5 bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-900 pb-3">
                        Vincular Nuevo Alias
                    </h3>
                    
                    <form onSubmit={handleAddAlias} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                Usuario del CRM
                            </label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-3 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all cursor-pointer"
                            >
                                <option value="">Selecciona un closer/usuario...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.username} ({u.role.toUpperCase()})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                Alias en Google Sheets
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Jean Carlo Perez"
                                value={aliasName}
                                onChange={(e) => setAliasName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-3 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                            />
                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wide">
                                Se pueden asignar múltiples alias diferentes al mismo usuario
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-11 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-primary/20"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                            Guardar Vinculación
                        </button>
                    </form>
                </div>

                {/* Listado de Alias Existentes (Derecha) */}
                <div className="lg:col-span-7 bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-900 pb-3">
                        Alias Registrados
                    </h3>

                    {aliases.length === 0 ? (
                        <div className="text-center py-16 text-slate-600 text-xs font-bold uppercase tracking-wide">
                            No hay ningún alias configurado aún.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                            {aliases.map((a) => (
                                <div 
                                    key={a.id}
                                    className="p-4 bg-black/20 border border-slate-900 rounded-2xl flex items-center justify-between gap-4"
                                >
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg">
                                            Alias: {a.alias_name}
                                        </span>
                                        <div className="text-xs font-black text-white">
                                            → Asignado a: <span className="text-primary">{a.username}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDeleteAlias(a.id)}
                                        className="p-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white rounded-xl text-rose-500 transition-all cursor-pointer border border-rose-500/20"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Nota de Ayuda */}
            <div className="bg-blue-500/5 border border-blue-500/10 p-5 rounded-[1.5rem] flex gap-3 text-left">
                <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                        ¿Cómo funciona la resolución?
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                        Al importar/sincronizar agendas de Google Sheets, el sistema busca si la columna "closer" coincide con algún alias definido aquí. Si coincide, la cita se asigna automáticamente al usuario del CRM vinculado. Si no coincide con ningún alias, el sistema intentará resolverlo por su nombre real mediante coincidencia parcial de texto.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CloserAliasesPanel;
