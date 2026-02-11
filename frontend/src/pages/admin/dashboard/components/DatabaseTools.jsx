import React, { useState } from 'react';
import api from '../../../../services/api';
import Button from '../../../../components/ui/Button';
import { Trash2, Database, Download, Upload, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const DatabaseTools = () => {
    const [migrating, setMigrating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    const handleMigrateLeads = async () => {
        if (!window.confirm("¿Estás seguro de que deseas depurar los usuarios tipo 'lead'? Serán eliminados de la lista de usuarios y migrados como registros a la tabla de Leads. Esta acción es irreversible.")) {
            return;
        }

        setMigrating(true);
        try {
            const res = await api.post('/admin/tools/migrate-leads');
            if (res.data.success) {
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            console.error("Error migrating leads", error);
            toast.error("Error al ejecutar la migración");
        } finally {
            setMigrating(false);
        }
    };

    const handleExportDB = async () => {
        setExporting(true);
        try {
            const response = await api.get('/admin/db/export');
            const url = window.URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `neurops_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(link);
            link.click();
            toast.success("Respaldo descargado exitosamente");
        } catch (error) {
            console.error("Error exporting DB", error);
            toast.error("Error al exportar la base de datos");
        } finally {
            setExporting(false);
        }
    };

    const handleImportDB = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm("ADVERTENCIA: Importar una base de datos puede sobrescribir registros existentes. ¿Deseas continuar?")) {
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setImporting(true);
        try {
            await api.post('/admin/db/import', formData);
            toast.success("Base de datos importada exitosamente");
        } catch (error) {
            console.error("Error importing DB", error);
            toast.error("Error al importar el archivo");
        } finally {
            setImporting(false);
            e.target.value = null; // Reset input
        }
    };

    return (
        <div className="space-y-10">
            <header className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400">
                        <Database size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                            Mantenimiento de Datos
                        </h1>
                        <p className="text-muted font-medium text-lg italic uppercase tracking-widest text-[10px]">
                            "herramientas de limpieza y respaldo del sistema."
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Lead Migration Tool */}
                <div className="glass-panel p-8 rounded-[32px] border border-white/5 bg-[#1a1c23]/80 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-rose-500/20 rounded-xl text-rose-500">
                            <Trash2 size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Depuración de Usuarios</h2>
                    </div>

                    <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-2xl mb-8">
                        <div className="flex gap-4">
                            <div className="text-rose-500 shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-rose-200 uppercase tracking-tight">Acción Irreversible</p>
                                <p className="text-xs text-rose-400/80 leading-relaxed font-medium">
                                    Esta herramienta busca a todos los usuarios que tengan el rol <span className="text-rose-300 font-black">"lead"</span> o <span className="text-rose-300 font-black">"student"</span>. Los crea como registros en la tabla de leads para su seguimiento posterior y elimina sus cuentas de usuario permanentemente.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <Button
                            onClick={handleMigrateLeads}
                            disabled={migrating}
                            className={`w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl ${migrating ? 'bg-rose-500/30' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20 active:scale-95'
                                }`}
                        >
                            {migrating ? (
                                <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Procesando...</span>
                            ) : (
                                <span className="flex items-center gap-2 font-black italic"><Trash2 size={16} /> Limpiar Usuarios Lead</span>
                            )}
                        </Button>
                    </div>
                </div>

                {/* DB Backup Tools */}
                <div className="glass-panel p-8 rounded-[32px] border border-white/5 bg-[#1a1c23]/80 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <CheckCircle2 size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Respaldo de Sistema</h2>
                    </div>

                    <p className="text-xs text-muted font-medium leading-relaxed mb-10">
                        Descarga una copia completa de la base de datos en formato JSON o restaura un respaldo previo. Ten en cuenta que la importación puede causar duplicados o pérdida de datos recientes.
                    </p>

                    <div className="space-y-4 mt-auto">
                        <Button
                            onClick={handleExportDB}
                            disabled={exporting}
                            className="w-full h-14 bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center justify-center gap-2 rounded-xl transition-all font-black uppercase tracking-widest text-[9px]"
                        >
                            {exporting ? <Loader2 className="animate-spin" /> : <><Download size={18} /> Exportar Base de Datos</>}
                        </Button>

                        <div className="relative">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImportDB}
                                disabled={importing}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                id="db-import-input"
                            />
                            <Button
                                disabled={importing}
                                className="w-full h-14 bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center justify-center gap-2 rounded-xl transition-all font-black uppercase tracking-widest text-[9px]"
                            >
                                {importing ? <Loader2 className="animate-spin" /> : <><Upload size={18} /> Importar Respaldo</>}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseTools;
