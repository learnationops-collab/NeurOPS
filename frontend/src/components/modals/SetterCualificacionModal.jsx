import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Check, Play, ExternalLink, Save, ArrowRight, Loader2, Instagram, MessageSquare, Clock, Search, ChevronDown } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import CommentsSection from '../shared/CommentsSection';

const SetterCualificacionModal = ({ isOpen, onClose, lead, availableKeywords, onUpdate, onSaveAndNext }) => {
    const [qualification, setQualification] = useState('true');
    const [keyword, setKeyword] = useState('');
    const [adSearch, setAdSearch] = useState('');
    const [adDropdownOpen, setAdDropdownOpen] = useState(false);
    const [setterNote, setSetterNote] = useState('');
    const [saving, setSaving] = useState(false);
    const adRef = useRef(null);

    useEffect(() => {
        if (lead) {
            setQualification(lead.result === 'false' ? 'false' : 'true');
            const savedKeyword = lead.keyword || '';
            setKeyword(savedKeyword);
            if (savedKeyword && availableKeywords.length > 0) {
                const found = availableKeywords.find(k => k.slug === savedKeyword);
                setAdSearch(found ? `${found.name} (${found.slug})` : savedKeyword);
            } else {
                setAdSearch(savedKeyword);
            }
            setSetterNote('');
        }
    }, [lead, availableKeywords]);

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (adRef.current && !adRef.current.contains(e.target)) {
                setAdDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isOpen || !lead) return null;

    const handleSave = async (andNext = false) => {
        if (!keyword) {
            toast.error("El anuncio de origen es obligatorio");
            return;
        }

        setSaving(true);
        try {
            await api.post(`/setter/deck/update-qualified/${lead.id}`, {
                qualification,
                keyword,
                setter_note: setterNote
            });
            toast.success("Lead guardado correctamente");
            
            if (andNext && onSaveAndNext) {
                onSaveAndNext(lead.id);
            } else {
                onUpdate();
                onClose();
            }
        } catch (err) {
            console.error("Error al actualizar lead calificado:", err);
            toast.error(err.response?.data?.message || "Error al guardar el lead");
        } finally {
            setSaving(false);
        }
    };

    const getRelativeTimeString = (dateIso) => {
        if (!dateIso) return '';
        const date = new Date(dateIso);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Recibido hace instantes';
        if (diffMins < 60) return `Recibido hace ${diffMins} min`;
        if (diffHours < 24) return `Recibido hace ${diffHours} h`;
        return `Recibido hace ${diffDays} días`;
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#07080d] text-slate-100 flex flex-col h-screen overflow-hidden">
            {/* Cabecera superior del modal */}
            <div className="px-8 pt-6 pb-6 border-b border-slate-900 bg-[#07080d]">
                <div className="max-w-[95%] mx-auto w-full flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={onClose}
                            className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2 cursor-pointer outline-none bg-transparent border-none"
                        >
                            <ArrowLeft size={16} />
                            Volver
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-all cursor-pointer outline-none bg-transparent border-none"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-white tracking-tight">{lead.lead_name || 'Sin Nombre'}</h2>
                        
                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400">
                            {lead.instagram && (
                                <span className="flex items-center gap-1.5 text-violet-400">
                                    <Instagram size={14} />
                                    @{lead.instagram}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <MessageSquare size={14} className="text-slate-500" />
                                ManyChat / Instagram
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Clock size={14} className="text-slate-500" />
                                {getRelativeTimeString(lead.start_time)}
                            </span>
                            <span className="bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full text-[10px] font-black border border-violet-500/20 uppercase tracking-wider">
                                En revisión
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cuerpo del formulario scrollable */}
            <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar max-w-[95%] mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Columna Izquierda: Formulario de Cualificación */}
                    <div className="lg:col-span-8 space-y-8">
                        
                        {/* Paso 1: Estado de cualificación */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-6 border-b border-slate-900">
                            <div className="lg:col-span-4 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-violet-650/20 text-violet-400 flex items-center justify-center text-xs font-black">1</span>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Estado de cualificación</h3>
                                </div>
                                <p className="text-xs text-slate-500 font-bold pl-8">Define si este lead es cualificado.</p>
                            </div>

                            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Tarjeta Cualificado */}
                                <div 
                                    onClick={() => setQualification('true')}
                                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2.5 min-h-[110px] ${
                                        qualification === 'true'
                                            ? 'bg-emerald-500/5 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                                            : 'bg-slate-950/40 border-slate-900 hover:border-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                                            qualification === 'true' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700'
                                        }`}>
                                            {qualification === 'true' && <Check size={12} />}
                                        </div>
                                        <span className={`text-sm font-black ${qualification === 'true' ? 'text-emerald-450' : 'text-slate-400'}`}>Cualificado</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">Este lead continuará en el proceso.</span>
                                </div>

                                {/* Tarjeta No cualificado */}
                                <div 
                                    onClick={() => setQualification('false')}
                                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2.5 min-h-[110px] ${
                                        qualification === 'false'
                                            ? 'bg-slate-900/30 border-slate-700'
                                            : 'bg-slate-950/40 border-slate-900 hover:border-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                                            qualification === 'false' ? 'bg-slate-700 border-slate-700 text-white' : 'border-slate-700'
                                        }`}>
                                            {qualification === 'false' && <Check size={12} />}
                                        </div>
                                        <span className={`text-sm font-black ${qualification === 'false' ? 'text-slate-300' : 'text-slate-400'}`}>No cualificado</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">Este lead será descalificado.</span>
                                </div>
                            </div>
                        </div>


                        {/* Paso 2: Anuncio de origen */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-6 border-b border-slate-900">
                            <div className="lg:col-span-4 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-violet-650/20 text-violet-400 flex items-center justify-center text-xs font-black">2</span>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Anuncio de origen</h3>
                                </div>
                                <p className="text-xs text-slate-500 font-bold pl-8">Selecciona el anuncio activo por el que ingresó.</p>
                            </div>

                            <div className="lg:col-span-8 space-y-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Seleccionar anuncio activo (obligatorio)</span>

                                {/* Combobox buscador de anuncio */}
                                <div className="relative" ref={adRef}>
                                    <div
                                        className={`flex items-center gap-2 w-full bg-[#0d0e14] border rounded-xl px-4 py-3 transition-all ${
                                            adDropdownOpen ? 'border-violet-500/50 ring-1 ring-violet-500/20' : 'border-slate-800/80 hover:border-slate-700'
                                        }`}
                                    >
                                        <Search size={14} className="text-slate-500 shrink-0" />
                                        <input
                                            type="text"
                                            value={adSearch}
                                            onChange={(e) => {
                                                setAdSearch(e.target.value);
                                                setAdDropdownOpen(true);
                                                if (!e.target.value) setKeyword('');
                                            }}
                                            onFocus={() => setAdDropdownOpen(true)}
                                            placeholder="Buscar anuncio por nombre o slug..."
                                            className="flex-1 bg-transparent border-none text-xs font-bold text-slate-200 outline-none placeholder-slate-600"
                                        />
                                        {keyword && (
                                            <button
                                                type="button"
                                                onClick={() => { setKeyword(''); setAdSearch(''); }}
                                                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                        <ChevronDown size={14} className={`text-slate-500 shrink-0 transition-transform ${adDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {/* Dropdown de opciones filtradas */}
                                    {adDropdownOpen && (
                                        <div className="absolute z-50 top-full mt-1 w-full bg-[#0d0e14] border border-slate-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                                            <div className="max-h-56 overflow-y-auto custom-scrollbar">
                                                {(() => {
                                                    const q = adSearch.toLowerCase().trim();
                                                    const filtered = availableKeywords.filter(k =>
                                                        !q ||
                                                        k.name.toLowerCase().includes(q) ||
                                                        k.slug.toLowerCase().includes(q)
                                                    );
                                                    if (filtered.length === 0) {
                                                        return (
                                                            <div className="px-4 py-6 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">
                                                                Sin resultados para "{adSearch}"
                                                            </div>
                                                        );
                                                    }
                                                    return filtered.map((k) => (
                                                        <button
                                                            key={k.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setKeyword(k.slug);
                                                                setAdSearch(`${k.name} (${k.slug})`);
                                                                setAdDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center justify-between gap-3 border-b border-slate-900/60 last:border-none ${
                                                                keyword === k.slug
                                                                    ? 'bg-violet-600/15 text-violet-300'
                                                                    : 'text-slate-300 hover:bg-slate-800/60'
                                                            }`}
                                                        >
                                                            <span>{k.name}</span>
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">{k.slug}</span>
                                                        </button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Badge de anuncio seleccionado */}
                                {keyword && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-wider bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full">
                                            ✓ {keyword}
                                        </span>
                                        <a
                                            href="https://adsmanager.facebook.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-violet-400 transition-colors uppercase tracking-wider"
                                        >
                                            Ver en Meta Ads
                                            <ExternalLink size={10} />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>


                        {/* Paso 3: Observaciones del setter */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-10">
                            <div className="lg:col-span-4 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-violet-650/20 text-violet-400 flex items-center justify-center text-xs font-black">3</span>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Observaciones del setter</h3>
                                </div>
                                <p className="text-xs text-slate-500 font-bold pl-8">Se publicará como nota visible para todo el equipo en Notas &amp; Comentarios.</p>
                            </div>

                            <div className="lg:col-span-8 space-y-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nota / observación (opcional)</span>
                                <div className="relative">
                                    <textarea
                                        value={setterNote}
                                        onChange={(e) => setSetterNote(e.target.value.slice(0, 800))}
                                        placeholder="Ej: El lead mencionó que ya probó otros programas, tiene presupuesto disponible, muy interesado en el proceso..."
                                        className="w-full bg-[#0d0e14] border border-slate-800/80 rounded-2xl p-4 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 min-h-[140px] resize-none"
                                    />
                                    <span className="absolute bottom-3 right-4 text-[9px] font-bold text-slate-650">{setterNote.length}/800</span>
                                </div>
                                <p className="text-[10px] text-slate-600 italic pl-1">💬 Esta nota aparecerá en tiempo real en el panel de comentarios de la derecha y podrán responderte desde otros roles.</p>
                            </div>
                        </div>
                        
                    </div>

                    {/* Columna Derecha: Notas & Comentarios */}
                    <div className="lg:col-span-4 h-full lg:sticky lg:top-0">
                        {lead.client_id ? (
                            <CommentsSection clientId={lead.client_id} />
                        ) : (
                            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 text-center text-xs text-slate-500 italic">
                                Esperando ID del cliente para habilitar notas...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer con botones de control */}
            <div className="px-8 py-5 border-t border-slate-900 bg-[#07080d]">
                <div className="max-w-[95%] mx-auto w-full flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white transition-all text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer bg-transparent"
                    >
                        Cancelar
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleSave(false)}
                            disabled={saving}
                            className="px-6 py-3 border border-slate-850 hover:bg-slate-900 text-slate-200 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 bg-transparent"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Guardar
                        </button>

                        <button
                            onClick={() => handleSave(true)}
                            disabled={saving}
                            className="px-6 py-3 bg-violet-600 hover:bg-violet-755 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-violet-650/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                            Guardar y revisar siguiente
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetterCualificacionModal;
