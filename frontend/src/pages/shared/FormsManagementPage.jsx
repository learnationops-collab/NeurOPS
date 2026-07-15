import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
    Search, 
    FileText, 
    Link2, 
    User, 
    Phone, 
    Instagram, 
    Mail, 
    AlertCircle, 
    CheckCircle2, 
    ArrowRight, 
    X,
    Loader2,
    Calendar,
    Globe,
    FilterX
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function FormsManagementPage() {
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [unlinkedOnly, setUnlinkedOnly] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [fuente, setFuente] = useState('');
    
    // Modales
    const [selectedForm, setSelectedForm] = useState(null);
    const [mergeModalOpen, setMergeModalOpen] = useState(false);
    const [formToMerge, setFormToMerge] = useState(null);
    
    // Busqueda de Lead Destino
    const [destinationSearch, setDestinationSearch] = useState('');
    const [destinationResults, setDestinationResults] = useState([]);
    const [searchingDest, setSearchingDest] = useState(false);
    const [selectedDest, setSelectedDest] = useState(null);
    const [submittingMerge, setSubmittingMerge] = useState(false);

    // Cargar formularios
    const fetchForms = async () => {
        try {
            setLoading(true);
            const response = await api.get('/triage/qualified-forms', {
                params: {
                    unlinked_only: unlinkedOnly,
                    search: search,
                    start_date: startDate,
                    end_date: endDate,
                    fuente: fuente
                }
            });
            setForms(response.data || []);
        } catch (error) {
            console.error("Error al obtener formularios:", error);
            toast.error("Error al cargar los formularios de calificación");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchForms();
    }, [unlinkedOnly, search, startDate, endDate, fuente]);

    // Buscar lead destino para fusionar
    useEffect(() => {
        if (destinationSearch.trim().length < 2) {
            setDestinationResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            try {
                setSearchingDest(true);
                const response = await api.get(`/closer/leads/search?q=${destinationSearch}`);
                // Filtrar el propio cliente de origen para que no aparezca en la busqueda
                const filtered = (response.data || []).filter(item => item.id !== formToMerge?.id);
                setDestinationResults(filtered);
            } catch (error) {
                console.error("Error al buscar leads:", error);
            } finally {
                setSearchingDest(false);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [destinationSearch, formToMerge]);

    // Procesar fusion de clientes
    const handleMerge = async () => {
        if (!formToMerge || !selectedDest) return;
        
        try {
            setSubmittingMerge(true);
            const response = await api.post('/triage/merge-clients', {
                source_client_id: formToMerge.id,
                target_client_id: selectedDest.id
            });
            
            toast.success(response.data?.message || "Formularios fusionados correctamente.");
            setMergeModalOpen(false);
            setFormToMerge(null);
            setSelectedDest(null);
            setDestinationSearch('');
            setDestinationResults([]);
            fetchForms();
        } catch (error) {
            console.error("Error al fusionar clientes:", error);
            toast.error(error.response?.data?.error || "Error al realizar la fusión");
        } finally {
            setSubmittingMerge(false);
        }
    };

    return (
        <div className="p-6 text-slate-100 max-w-7xl mx-auto space-y-6">
            {/* Cabecera */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <FileText className="w-7 h-7 text-primary" />
                        Gesti&oacute;n de Formularios
                    </h1>
                    <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                        Encuentra y vincula respuestas de formularios n8n a leads del CRM
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-md space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, instagram, teléfono..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-800/60 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-all"
                        />
                    </div>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Filtrar por fuente (ej: workshop)..."
                            value={fuente}
                            onChange={(e) => setFuente(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-800/60 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-all"
                        />
                    </div>
                    <div className="flex items-center justify-start md:justify-end">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                checked={unlinkedOnly}
                                onChange={(e) => setUnlinkedOnly(e.target.checked)}
                                className="w-4 h-4 accent-primary rounded border-slate-800 bg-slate-950"
                            />
                            <span className="text-xs font-medium text-slate-300">Mostrar solo hu&eacute;rfanos (sin citas)</span>
                        </label>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center border-t border-slate-800/50 pt-4">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registro:</span>
                    </div>
                    <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
                        <input 
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-slate-950/50 border border-slate-800/60 px-3 py-2 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                        />
                        <input 
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-slate-950/50 border border-slate-800/60 px-3 py-2 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                    {(startDate || endDate || fuente || search) && (
                        <button
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                                setFuente('');
                                setSearch('');
                            }}
                            className="text-xs font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5 ml-auto md:ml-4 cursor-pointer border-none bg-transparent"
                        >
                            <FilterX className="w-4 h-4" />
                            Limpiar Filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Listado de Formularios */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Cargando formularios...</p>
                </div>
            ) : forms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 border border-slate-800/40 rounded-2xl p-6">
                    <CheckCircle2 className="w-12 h-12 text-slate-600 mb-3" />
                    <p className="text-sm font-semibold text-slate-300">No se encontraron formularios</p>
                    <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">¡Todos los cuestionarios est&aacute;n correctamente vinculados o no coinciden con los filtros!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {forms.map((item) => (
                        <div 
                            key={item.id} 
                            className="bg-slate-900/40 border border-slate-800/70 p-5 rounded-2xl backdrop-blur-sm flex flex-col justify-between hover:border-slate-700/80 transition-all group"
                        >
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-3">
                                    <div className="truncate">
                                        <h3 className="font-bold text-white text-sm truncate">{item.full_name}</h3>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">ID: {item.id}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black tracking-widest ${
                                        item.appointments_count > 0 
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}>
                                        {item.appointments_count > 0 ? `${item.appointments_count} citas` : 'Huérfano'}
                                    </span>
                                </div>

                                <div className="space-y-2 text-xs text-slate-400 my-4 border-t border-b border-slate-800/60 py-3">
                                    <div className="flex items-center gap-2">
                                        <Instagram className="w-3.5 h-3.5 text-slate-500" />
                                        <span className="truncate">{item.instagram ? `@${item.instagram}` : 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                                        <span>{item.phone || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                                        <span className="truncate">{item.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 border-t border-slate-800/40 pt-2 mt-1">
                                        <Globe className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Fuente: <span className="text-white italic">{item.fuente || 'Desconocida'}</span></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Registro: <span className="text-white font-semibold">{item.created_at ? new Date(item.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2 pt-2">
                                <button 
                                    onClick={() => setSelectedForm(item)}
                                    className="flex-1 text-center py-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-all"
                                >
                                    Ver Respuestas
                                </button>
                                <button 
                                    onClick={() => {
                                        setFormToMerge(item);
                                        setMergeModalOpen(true);
                                    }}
                                    className="flex-1 text-center py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 hover:border-primary/50 rounded-xl text-[10px] font-bold uppercase tracking-wider text-primary-foreground text-primary transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Link2 className="w-3.5 h-3.5" />
                                    Vincular Lead
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Ver Respuestas del Formulario */}
            {selectedForm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <div>
                                <h3 className="font-bold text-white text-base">Respuestas de Calificaci&oacute;n</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">{selectedForm.full_name}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedForm(null)}
                                className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
                            {/* Visualizador amigable de form_data */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Examen / Dolor Principal</span>
                                    <p className="font-semibold text-white">{selectedForm.form_data?.examen || 'No especificado'}</p>
                                </div>
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Puntaje / Calificaci&oacute;n</span>
                                    <p className="font-black text-primary text-sm">{selectedForm.form_data?.puntaje || 'N/A'}</p>
                                </div>
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Profesi&oacute;n</span>
                                    <p className="font-semibold text-white">{selectedForm.form_data?.profesion || 'No especificado'}</p>
                                </div>
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Empleo Actual</span>
                                    <p className="font-semibold text-white">{selectedForm.form_data?.empleo || 'No especificado'}</p>
                                </div>
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl col-span-2">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Formaci&oacute;n Requerida / Meta</span>
                                    <p className="font-semibold text-white">{selectedForm.form_data?.formacion || 'No especificado'}</p>
                                </div>
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl col-span-2">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Inter&eacute;s en Inversi&oacute;n</span>
                                    <p className="font-semibold text-white">{selectedForm.form_data?.interes || 'No especificado'}</p>
                                </div>
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Capacidad de Inversi&oacute;n</span>
                                    <p className="font-semibold text-white">{selectedForm.form_data?.inversion || 'No especificado'}</p>
                                </div>
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Apoyo / Red Familiar</span>
                                    <p className="font-semibold text-white">{selectedForm.form_data?.apoyo || 'No especificado'}</p>
                                </div>
                                <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl col-span-2">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Fecha de Env&iacute;o (UTC)</span>
                                    <p className="font-mono text-slate-400">{selectedForm.form_data?.submitted_at ? new Date(selectedForm.form_data.submitted_at).toLocaleString() : 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
                            <button 
                                onClick={() => setSelectedForm(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Vincular / Fusionar Leads */}
            {mergeModalOpen && formToMerge && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <div>
                                <h3 className="font-bold text-white text-base">Vincular Formulario a Lead del CRM</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">Resolver duplicados de leads y asignación de encuestas</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setMergeModalOpen(false);
                                    setFormToMerge(null);
                                    setSelectedDest(null);
                                    setDestinationSearch('');
                                    setDestinationResults([]);
                                }}
                                className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Comparación Visual */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                {/* Origen (Formulario) */}
                                <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl space-y-3 relative overflow-hidden">
                                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-black uppercase rounded tracking-wider">
                                        Origen (Formulario)
                                    </div>
                                    <h4 className="font-black text-white text-xs uppercase tracking-wider text-slate-400">Cliente Duplicado</h4>
                                    <div>
                                        <p className="font-bold text-sm text-white">{formToMerge.full_name}</p>
                                        <p className="text-[10px] text-slate-500">ID: {formToMerge.id}</p>
                                    </div>
                                    <div className="text-xs text-slate-400 space-y-1.5 border-t border-slate-850 pt-2.5">
                                        <div className="flex items-center gap-2">
                                            <Instagram className="w-3 h-3 text-slate-500" />
                                            <span className="truncate">{formToMerge.instagram ? `@${formToMerge.instagram}` : 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3 h-3 text-slate-500" />
                                            <span>{formToMerge.phone || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3 h-3 text-slate-500" />
                                            <span className="truncate">{formToMerge.email || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Destino (Lead del CRM) */}
                                {selectedDest ? (
                                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-3 relative overflow-hidden">
                                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-primary/25 text-primary border border-primary/20 text-[8px] font-black uppercase rounded tracking-wider">
                                            Destino (CRM)
                                        </div>
                                        <h4 className="font-black text-primary text-xs uppercase tracking-wider">Lead Original</h4>
                                        <div>
                                            <p className="font-bold text-sm text-white">{selectedDest.full_name}</p>
                                            <p className="text-[10px] text-slate-500">ID: {selectedDest.id}</p>
                                        </div>
                                        <div className="text-xs text-slate-400 space-y-1.5 border-t border-slate-850/50 pt-2.5">
                                            <div className="flex items-center gap-2">
                                                <Instagram className="w-3 h-3 text-slate-500" />
                                                <span className="truncate">{selectedDest.instagram ? `@${selectedDest.instagram}` : 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-3 h-3 text-slate-500" />
                                                <span>{selectedDest.phone || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-3 h-3 text-slate-500" />
                                                <span className="truncate">{selectedDest.email || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedDest(null)}
                                            className="absolute bottom-2 right-2 text-[9px] uppercase font-bold text-slate-450 hover:text-white transition-all"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-500 h-[156px] flex flex-col items-center justify-center gap-2">
                                        <User className="w-8 h-8 text-slate-700" />
                                        <p className="text-xs font-semibold uppercase tracking-wider text-[10px]">Busca y selecciona el lead de destino</p>
                                    </div>
                                )}
                            </div>

                            {/* Buscador de Destino */}
                            {!selectedDest && (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-350 block">Buscar Lead Destino en el CRM:</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input 
                                            type="text" 
                                            placeholder="Escribe al menos 2 letras del nombre, instagram o teléfono..."
                                            value={destinationSearch}
                                            onChange={(e) => setDestinationSearch(e.target.value)}
                                            className="w-full bg-slate-950/70 border border-slate-800 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-all"
                                            autoFocus
                                        />
                                    </div>
                                    
                                    {/* Resultados de la busqueda */}
                                    <div className="max-h-[220px] overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/40 divide-y divide-slate-850">
                                        {searchingDest ? (
                                            <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-500">
                                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                <span>Buscando leads...</span>
                                            </div>
                                        ) : destinationSearch.trim().length >= 2 && destinationResults.length === 0 ? (
                                            <p className="text-center py-6 text-xs text-slate-500 uppercase tracking-widest font-bold">No se encontraron leads coincidentes</p>
                                        ) : destinationResults.map(item => (
                                            <div 
                                                key={item.id}
                                                onClick={() => setSelectedDest(item)}
                                                className="p-3 hover:bg-slate-900 cursor-pointer transition-all flex items-center justify-between text-xs group"
                                            >
                                                <div>
                                                    <p className="font-bold text-white group-hover:text-primary transition-all">{item.full_name}</p>
                                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                                                        <span>IG: {item.instagram ? `@${item.instagram}` : 'N/A'}</span>
                                                        <span>•</span>
                                                        <span>Tel: {item.phone || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary transition-all group-hover:translate-x-1" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Alerta explicativa */}
                            {selectedDest && (
                                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 text-xs text-amber-200">
                                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                                    <div>
                                        <p className="font-bold">¿Confirmas la fusión de leads?</p>
                                        <p className="mt-1 text-slate-350 leading-relaxed">
                                            Al confirmar, las respuestas del formulario del lead **{formToMerge.full_name}** se inyectarán en la ficha de **{selectedDest.full_name}**. Cualquier cita o reporte previo se transferirá. El perfil origen **{formToMerge.full_name}** será eliminado de forma definitiva del CRM para evitar duplicados.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3">
                            <button 
                                onClick={() => {
                                    setMergeModalOpen(false);
                                    setFormToMerge(null);
                                    setSelectedDest(null);
                                    setDestinationSearch('');
                                    setDestinationResults([]);
                                }}
                                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-slate-800"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleMerge}
                                disabled={!selectedDest || submittingMerge}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                                {submittingMerge && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Confirmar Fusión
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
