import React, { useState } from 'react';
import api from '../../../../services/api';
import Button from '../../../../components/ui/Button';
import { Trash2, Database, AlertTriangle, Loader2, Zap, Archive, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

const DatabaseTools = () => {
    const [cleaning, setCleaning] = useState(false);
    const [selectedTable, setSelectedTable] = useState('');
    const [backlogDays, setBacklogDays] = useState(30);
    const [backlogPreview, setBacklogPreview] = useState(null);
    const [checkingBacklog, setCheckingBacklog] = useState(false);
    const [archivingBacklog, setArchivingBacklog] = useState(false);

    const TABLES = [
        { key: 'setter_daily_stats', name: 'Reportes de Setters' },
        { key: 'daily_report_answers', name: 'Respuestas de Reportes (Legacy)' },
        { key: 'appointments', name: 'Agendas/Citas' },
        { key: 'leads', name: 'Leads (Marketing)' },
        { key: 'clients', name: 'Clientes' },
        { key: 'expenses', name: 'Gastos' },
        { key: 'recurring_expenses', name: 'Gastos Recurrentes' },
        { key: 'availability', name: 'Disponibilidad' },
        { key: 'client_comments', name: 'Comentarios de Clientes' }
    ];

    const handleClearTable = async () => {
        if (!selectedTable) {
            toast.error("Por favor selecciona una tabla");
            return;
        }

        const tableName = TABLES.find(t => t.key === selectedTable)?.name;

        if (!window.confirm(`¿Estás COMPLETAMENTE seguro de limpiar la tabla "${tableName}"?`)) return;
        if (!window.confirm(`ADVERTENCIA FINAL: Todos los registros de "${tableName}" serán eliminados permanentemente. ¿Confirmas la eliminación?`)) return;

        setCleaning(true);
        try {
            // Sin timeout a propósito: puede borrar una tabla completa (ver frontend/src/services/api.js).
            const res = await api.post('/admin/db/clear-table', { table_key: selectedTable }, { timeout: 0 });
            toast.success(res.data.message);
            setSelectedTable('');
        } catch (error) {
            console.error("Error clearing table", error);
            toast.error(error.response?.data?.message || "Error al limpiar la tabla");
        } finally {
            setCleaning(false);
        }
    };

    const handleCheckBacklog = async () => {
        setCheckingBacklog(true);
        try {
            // Sin timeout a propósito: recorre agendas históricas, puede tardar más que el
            // límite general de la app (ver frontend/src/services/api.js).
            const res = await api.get('/admin/tools/backlog-cleanup', { params: { days: backlogDays }, timeout: 0 });
            setBacklogPreview(res.data);
        } catch (error) {
            console.error("Error checking backlog", error);
            toast.error(error.response?.data?.message || "Error al revisar el backlog");
        } finally {
            setCheckingBacklog(false);
        }
    };

    const handleArchiveBacklog = async () => {
        const count = backlogPreview?.count ?? 0;
        if (!window.confirm(`Se archivarán ${count} citas nunca confirmadas (más de ${backlogDays} días) como "Archivada sin reporte". Esto no borra ningún registro, solo las saca de las colas activas del closer. ¿Continuar?`)) return;

        setArchivingBacklog(true);
        try {
            // Sin timeout a propósito: archiva agendas históricas en lote (ver frontend/src/services/api.js).
            const res = await api.post('/admin/tools/backlog-cleanup', { days: backlogDays }, { timeout: 0 });
            toast.success(res.data.message);
            setBacklogPreview(null);
        } catch (error) {
            console.error("Error archiving backlog", error);
            toast.error(error.response?.data?.message || "Error al archivar el backlog");
        } finally {
            setArchivingBacklog(false);
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
                            "herramientas de limpieza del sistema."
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Backlog de Confirmaciones sin Atender */}
                <div className="glass-panel p-8 rounded-[32px] border border-white/5 bg-[#1a1c23]/80 flex flex-col h-full xl:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-sky-500/20 rounded-xl text-sky-400">
                            <Archive size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Backlog de Confirmaciones sin Atender</h2>
                    </div>

                    <div className="bg-sky-500/10 border border-sky-500/30 p-6 rounded-2xl mb-8">
                        <div className="flex gap-4">
                            <div className="text-sky-400 shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-sky-200 uppercase tracking-tight">Qué hace</p>
                                <p className="text-xs text-sky-400/80 leading-relaxed font-medium">
                                    Citas que nunca fueron confirmadas por el closer y cuya fecha ya pasó hace más del umbral configurado se marcan como <span className="text-sky-300 font-black">"Archivada sin reporte"</span> para que dejen de acumularse invisibles en el mazo. No borra ningún registro — solo las saca de las colas activas. También corre automáticamente en segundo plano cada pocas horas, así que en uso normal no debería ser necesario ejecutarla manualmente.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 mt-auto">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 h-14">
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest whitespace-nowrap">Más de</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={backlogDays}
                                    onChange={(e) => { setBacklogDays(e.target.value); setBacklogPreview(null); }}
                                    className="w-16 bg-transparent text-center text-white font-black outline-none"
                                />
                                <span className="text-[10px] font-black text-muted uppercase tracking-widest whitespace-nowrap">días sin confirmar</span>
                            </div>

                            <Button
                                onClick={handleCheckBacklog}
                                disabled={checkingBacklog}
                                className="flex-1 h-14 bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center justify-center gap-2 rounded-xl transition-all font-black uppercase tracking-widest text-[9px]"
                            >
                                {checkingBacklog ? <Loader2 className="animate-spin" size={16} /> : <><Search size={16} /> Revisar Cuántas Hay</>}
                            </Button>

                            <Button
                                onClick={handleArchiveBacklog}
                                disabled={archivingBacklog || !backlogPreview || backlogPreview.count === 0}
                                className={`px-8 h-14 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all ${archivingBacklog || !backlogPreview || backlogPreview.count === 0
                                    ? 'bg-sky-500/20 text-white/20'
                                    : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/20 active:scale-95'
                                    }`}
                            >
                                {archivingBacklog ? (
                                    <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Archivando...</span>
                                ) : (
                                    <span className="flex items-center gap-2 italic"><Archive size={14} /> Archivar Backlog</span>
                                )}
                            </Button>
                        </div>

                        {backlogPreview && (
                            <p className="text-xs font-bold text-sky-300/80 uppercase tracking-widest px-1">
                                {backlogPreview.count === 0
                                    ? "No hay citas pendientes de archivar con ese umbral."
                                    : `${backlogPreview.count} citas se archivarían como "Archivada sin reporte".`}
                            </p>
                        )}
                    </div>
                </div>

                {/* Selective Cleaning Tool */}
                <div className="glass-panel p-8 rounded-[32px] border border-white/5 bg-[#1a1c23]/80 flex flex-col h-full xl:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500">
                            <Zap size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Limpieza Selectiva de Tablas</h2>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-2xl mb-8">
                        <div className="flex gap-4">
                            <div className="text-amber-500 shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-amber-200 uppercase tracking-tight">Uso Precautorio</p>
                                <p className="text-xs text-amber-400/80 leading-relaxed font-medium">
                                    Selecciona una tabla para eliminar <span className="text-amber-300 font-black">TODOS</span> sus registros. Útil para resetear datos de reportes o limpiar agendas antiguas tras cambios en el sistema.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mt-auto">
                        <select
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value)}
                            className="flex-1 h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">-- Seleccionar Tabla a Limpiar --</option>
                            {TABLES.map(table => (
                                <option key={table.key} value={table.key}>{table.name}</option>
                            ))}
                        </select>

                        <Button
                            onClick={handleClearTable}
                            disabled={cleaning || !selectedTable}
                            className={`px-8 h-14 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all ${cleaning || !selectedTable
                                ? 'bg-amber-500/20 text-white/20'
                                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 active:scale-95'
                                }`}
                        >
                            {cleaning ? (
                                <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Trabajando...</span>
                            ) : (
                                <span className="flex items-center gap-2 italic"><Trash2 size={14} /> Limpiar Datos de Tabla</span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseTools;
