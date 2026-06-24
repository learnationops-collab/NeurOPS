import { useState, useEffect, useMemo } from 'react';
import { Calendar, Filter, RotateCcw, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Card from '../ui/Card';

const BitacoraPanel = () => {
    const [loading, setLoading] = useState(true);
    const [bitacoraData, setBitacoraData] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeTypes, setActiveTypes] = useState([]);

    // Tipos de cambios para filtrar
    const changeTypes = [
        { id: 'NEW', label: 'Nuevos', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' },
        { id: 'MODIFY', label: 'Modificaciones', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' },
        { id: 'DELETE', label: 'Eliminaciones', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' },
        { id: 'POLICY', label: 'Políticas / Directivas', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20' }
    ];

    const fetchBitacora = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/admin/bitacora', { withCredentials: true });
            setBitacoraData(response.data);
        } catch (error) {
            console.error('Error al obtener la bitácora:', error);
            toast.error('No se pudo cargar la bitácora de cambios.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBitacora();
    }, []);

    // Alternar tipo de cambio en los filtros
    const toggleType = (typeId) => {
        if (activeTypes.includes(typeId)) {
            setActiveTypes(activeTypes.filter(t => t !== typeId));
        } else {
            setActiveTypes([...activeTypes, typeId]);
        }
    };

    // Resetear todos los filtros
    const handleReset = () => {
        setStartDate('');
        setEndDate('');
        setActiveTypes([]);
        toast.success('Filtros restablecidos');
    };

    // Filtrar los datos reactivamente en el cliente
    const filteredEntries = useMemo(() => {
        return bitacoraData.filter(entry => {
            // Filtro de fecha inicio
            if (startDate && entry.fecha_iso < startDate) {
                return false;
            }
            // Filtro de fecha fin
            if (endDate && entry.fecha_iso > endDate) {
                return false;
            }
            // Filtro por tipo de cambio
            if (activeTypes.length > 0) {
                // Verificar si la entrada tiene alguno de los tipos activos
                const hasMatchingType = entry.types.some(t => activeTypes.includes(t));
                if (!hasMatchingType) return false;
            }
            return true;
        });
    }, [bitacoraData, startDate, endDate, activeTypes]);

    return (
        <div className="space-y-6">
            {/* Header del Panel */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Bitácora del Sistema</h2>
                    <p className="text-xs text-muted uppercase tracking-widest font-medium">Historial y registro de cambios de NeurOPS</p>
                </div>
                <button
                    onClick={fetchBitacora}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-black tracking-wider uppercase text-white transition-all disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refrescar
                </button>
            </div>

            {/* Contenedor de Filtros */}
            <Card variant="surface" className="p-6 space-y-4 bg-surface/30 backdrop-blur-md border-white/5">
                <div className="flex items-center gap-2 text-indigo-400">
                    <Filter size={16} />
                    <span className="text-xs font-black uppercase tracking-wider">Filtros de Búsqueda</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Fecha Desde */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Desde</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors uppercase"
                            />
                            <Calendar size={14} className="absolute right-4 top-3.5 text-muted pointer-events-none" />
                        </div>
                    </div>

                    {/* Fecha Hasta */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted">Hasta</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors uppercase"
                            />
                            <Calendar size={14} className="absolute right-4 top-3.5 text-muted pointer-events-none" />
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-end gap-3">
                        <button
                            onClick={handleReset}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-black tracking-wider uppercase text-white transition-all"
                        >
                            <RotateCcw size={14} />
                            Limpiar Filtros
                        </button>
                    </div>
                </div>

                {/* Filtro por Categorías / Tipos de Cambio */}
                <div className="pt-2 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted block">Filtrar por Categoría</span>
                    <div className="flex flex-wrap gap-2">
                        {changeTypes.map(type => {
                            const isActive = activeTypes.includes(type.id);
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => toggleType(type.id)}
                                    className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                                        isActive
                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                            : type.color
                                    }`}
                                >
                                    {type.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {/* Listado de Entradas */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <RefreshCw className="animate-spin text-indigo-500" size={32} />
                    <span className="text-xs font-black uppercase tracking-widest text-muted">Cargando bitácora...</span>
                </div>
            ) : filteredEntries.length === 0 ? (
                <Card variant="surface" className="p-12 flex flex-col items-center justify-center text-center space-y-4 bg-surface/20 border-dashed border-white/5">
                    <AlertCircle className="text-muted" size={40} />
                    <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-wider text-white">Sin Cambios Registrados</h4>
                        <p className="text-xs text-muted max-w-sm">No se encontraron registros de la bitácora que coincidan con los filtros seleccionados.</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-8 relative before:content-[''] before:absolute before:left-4 before:top-4 before:bottom-4 before:w-[2px] before:bg-white/5">
                    {filteredEntries.map((entry, idx) => (
                        <div key={idx} className="relative pl-10 group animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Marcador de línea de tiempo */}
                            <div className="absolute left-2.5 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-500/20 border-2 border-indigo-500 group-hover:scale-125 transition-transform duration-300 z-10" />

                            <Card variant="surface" className="p-6 space-y-4 bg-surface/30 backdrop-blur-md border-white/5 group-hover:border-white/10 transition-all">
                                {/* Encabezado del Día */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-3">
                                    <h3 className="text-lg font-black italic tracking-tighter uppercase text-indigo-400">
                                        {entry.fecha_str}
                                    </h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {entry.types.map(t => {
                                            const metadata = changeTypes.find(ct => ct.id === t);
                                            return (
                                                <span
                                                    key={t}
                                                    className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-white/5 border border-white/10 text-muted"
                                                >
                                                    {metadata ? metadata.label : t}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Contenido parseado */}
                                <div
                                    className="bitacora-content leading-relaxed text-sm text-muted space-y-2"
                                    dangerouslySetInnerHTML={{ __html: entry.html }}
                                />
                            </Card>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BitacoraPanel;
