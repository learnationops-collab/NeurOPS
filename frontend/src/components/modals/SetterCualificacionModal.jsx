import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Check, Play, ExternalLink, Save, ArrowRight, Loader2, Instagram, MessageSquare, Clock } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const SetterCualificacionModal = ({ isOpen, onClose, lead, availableKeywords, onUpdate, onSaveAndNext }) => {
    const [qualification, setQualification] = useState('true');
    const [keyword, setKeyword] = useState('');
    const [dolores, setDolores] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (lead) {
            setQualification(lead.result === 'false' ? 'false' : 'true');
            setKeyword(lead.keyword || '');
            setDolores(lead.dolores || '');
            setObservaciones(lead.observaciones || '');
        }
    }, [lead]);

    if (!isOpen || !lead) return null;

    const handleSave = async (andNext = false) => {
        if (qualification === 'true' && !dolores.trim()) {
            toast.error("Los dolores del prospecto son obligatorios");
            return;
        }
        if (!keyword) {
            toast.error("El anuncio de origen es obligatorio");
            return;
        }

        setSaving(true);
        try {
            await api.post(`/setter/deck/update-qualified/${lead.id}`, {
                qualification,
                keyword,
                dolores,
                observaciones
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
            <div className="px-8 pt-6 pb-6 border-b border-slate-900 bg-[#07080d] flex flex-col gap-6">
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

            {/* Cuerpo del formulario scrollable */}
            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scrollbar max-w-7xl mx-auto w-full">
                
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
                        <div className="relative">
                            <select
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="w-full bg-[#0d0e14] border border-slate-800/80 rounded-xl px-4 py-3 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                            >
                                <option value="">Seleccionar anuncio...</option>
                                {availableKeywords.map((k) => (
                                    <option key={k.id} value={k.slug}>{k.name} ({k.slug})</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                ▾
                            </div>
                        </div>
                        {keyword && (
                            <a 
                                href="https://adsmanager.facebook.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-black text-violet-400 hover:text-violet-300 transition-colors uppercase tracking-wider"
                            >
                                Ver anuncio en Meta Ads
                                <ExternalLink size={10} />
                            </a>
                        )}
                    </div>
                </div>

                {/* Paso 3: Información del prospecto */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-10">
                    <div className="lg:col-span-4 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-violet-650/20 text-violet-400 flex items-center justify-center text-xs font-black">3</span>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Información del prospecto</h3>
                        </div>
                        <p className="text-xs text-slate-500 font-bold pl-8">Completa la información clave de esta conversación.</p>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        {/* Dolores */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Dolores del prospecto (obligatorio)</span>
                            <div className="relative">
                                <textarea
                                    value={dolores}
                                    onChange={(e) => setDolores(e.target.value.slice(0, 500))}
                                    placeholder="Ej: Me siento estancada en mi negocio, no tengo claridad, me cuesta vender..."
                                    className="w-full bg-[#0d0e14] border border-slate-800/80 rounded-2xl p-4 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 min-h-[110px] resize-none"
                                />
                                <span className="absolute bottom-3 right-4 text-[9px] font-bold text-slate-650">{dolores.length}/500</span>
                            </div>
                        </div>

                        {/* Notas internas */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Notas internas (opcional)</span>
                            <div className="relative">
                                <textarea
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value.slice(0, 500))}
                                    placeholder="Cualquier información relevante sobre esta conversación..."
                                    className="w-full bg-[#0d0e14] border border-[#1e293b] rounded-2xl p-4 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 min-h-[110px] resize-none"
                                />
                                <span className="absolute bottom-3 right-4 text-[9px] font-bold text-slate-650">{observaciones.length}/500</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer con botones de control */}
            <div className="px-8 py-5 border-t border-slate-900 bg-[#07080d] flex items-center justify-between">
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
                        className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-violet-650/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                        Guardar y revisar siguiente
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetterCualificacionModal;
