import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    Instagram, 
    Link as LinkIcon, 
    Key, 
    MessageSquare, 
    Calendar, 
    User, 
    Phone, 
    Mail, 
    ArrowLeft, 
    ExternalLink, 
    Layers, 
    Loader2, 
    Check, 
    Clock,
    Tag,
    Video,
    MessageCircle
} from 'lucide-react';
import api from '../../services/api';
import MazoCartas from '../../components/deck/MazoCartas';
import BuscadorGlobalDeck from '../../components/deck/BuscadorGlobalDeck';
import Button from '../../components/ui/Button';

// Estilos de comentarios en español cortos
const CloserDeckPage = () => {
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isSearchedCard, setIsSearchedCard] = useState(false);

    // Form states
    const [keyword, setKeyword] = useState('');
    const [linkedCall, setLinkedCall] = useState('');
    const [closerNotes, setCloserNotes] = useState('');
    const [result, setResult] = useState('Pendiente');

    // Cargar cola del Closer
    const fetchQueue = async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/deck');
            setCards(res.data || []);
            setCurrentIndex(0);
            setIsSearchedCard(false);
        } catch (err) {
            console.error("Error al cargar mazo Closer:", err);
            toast.error("Error al cargar la cola de closers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, []);

    // Sincronizar form con la carta activa del Closer
    useEffect(() => {
        if (cards.length > 0 && currentIndex < cards.length) {
            const activeCard = cards[currentIndex];
            setKeyword(activeCard.keyword || '');
            setLinkedCall(activeCard.linked_call || '');
            setCloserNotes(activeCard.closer_notes || '');
            setResult(activeCard.result || 'Pendiente');
        }
    }, [cards, currentIndex]);

    // Buscar lead específico para Closer
    const handleSelectLead = async (leadId) => {
        setLoading(true);
        try {
            const res = await api.get(`/closer/deck/card/${leadId}`);
            setCards([res.data]);
            setCurrentIndex(0);
            setIsSearchedCard(true);
            toast.success("Lead Closer cargado en el mazo");
        } catch (err) {
            console.error("Error al buscar lead Closer:", err);
            toast.error("No se pudo cargar la información de este lead");
        } finally {
            setLoading(false);
        }
    };

    // Guardar cambios y cerrar el flujo de esta carta
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (currentIndex >= cards.length) return;

        const activeCard = cards[currentIndex];
        setSubmitting(true);

        const payload = {
            keyword,
            linked_call: linkedCall,
            closer_notes: closerNotes,
            result
        };

        try {
            await api.post(`/closer/deck/${activeCard.id}`, payload);
            toast.success("Seguimiento y cierre guardados con éxito");
            
            // Pasar a la siguiente carta
            setCurrentIndex(prev => prev + 1);
        } catch (err) {
            console.error("Error al guardar cierre Closer:", err);
            toast.error("Error al procesar el cierre del lead");
        } finally {
            setSubmitting(false);
        }
    };

    const activeCard = cards[currentIndex];

    // Formatear fecha legible
    const formatTime = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return d.toLocaleDateString('es-ES', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="h-screen overflow-y-auto custom-scrollbar bg-main pb-32">
            <div className="flex flex-col items-center justify-start p-6 md:p-12">
                <div className="w-full max-w-6xl space-y-8 py-4">
                    
                    {/* Header */}
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-base pb-6 gap-4">
                        <div className="space-y-1 text-left">
                            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none flex items-center gap-3">
                                <Layers className="text-primary" size={32} />
                                Mazo de Closers
                            </h1>
                            <p className="text-muted font-medium uppercase text-[10px] tracking-[0.2em]">
                                {isSearchedCard ? "Vista de Lead Seleccionado" : "Flujo Secuencial de Cierres"}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                            {/* Buscador global Closer */}
                            <BuscadorGlobalDeck onSelectLead={handleSelectLead} role="closer" />

                            {isSearchedCard && (
                                <Button
                                    onClick={fetchQueue}
                                    variant="outline"
                                    className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2"
                                    icon={ArrowLeft}
                                >
                                    Volver al Mazo
                                </Button>
                            )}
                        </div>
                    </header>

                    {/* Contenido Principal */}
                    {loading ? (
                        <div className="h-[400px] flex items-center justify-center">
                            <Loader2 className="animate-spin text-primary" size={36} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            
                            {/* Columna Mazo de Cartas */}
                            <div className="lg:col-span-2 flex flex-col items-center">
                                <MazoCartas cards={cards} currentIndex={currentIndex}>
                                    {activeCard && (
                                        <div className="flex flex-col justify-between h-full space-y-6">
                                            
                                            {/* Cabecera de la carta */}
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-start gap-4">
                                                    <span className="text-[10px] font-black uppercase bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-xl tracking-widest flex items-center gap-1.5">
                                                        <Clock size={12} />
                                                        {formatTime(activeCard.start_time)}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase bg-white/5 border border-white/10 text-slate-400 px-3 py-1.5 rounded-xl tracking-widest flex items-center gap-1.5">
                                                        <Tag size={12} />
                                                        {activeCard.origin || 'Sin Origen'}
                                                    </span>
                                                </div>

                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <div className="space-y-1">
                                                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                                                            {activeCard.lead_name}
                                                        </h2>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                            Lead ID: #{activeCard.id} • {activeCard.instagram ? `@${activeCard.instagram}` : 'Sin Instagram'}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Enlace al chat directo */}
                                                    {activeCard.ig_chat_link && (
                                                        <a
                                                            href={activeCard.ig_chat_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 bg-[#1534ff] hover:bg-[#1534ff]/90 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/10 transition-all shrink-0"
                                                        >
                                                            Abrir Chat IG
                                                            <ExternalLink size={12} />
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Info del Setter (Notas del Setter en estilo chat bubble) */}
                                                <div className="bg-[#1534ff]/5 border border-[#1534ff]/10 p-5 rounded-3xl space-y-2 text-left relative overflow-hidden">
                                                    <div className="flex items-center gap-2 text-[9px] font-black text-primary uppercase tracking-widest">
                                                        <MessageCircle size={14} />
                                                        Instrucciones del Setter
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-300 italic">
                                                        "{activeCard.setter_notes || 'El Setter no dejó notas adicionales para esta cita.'}"
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Formulario Secuencial Closer */}
                                            <form onSubmit={handleSubmit} className="space-y-5 flex-1 overflow-y-auto pr-1 py-1 custom-scrollbar">
                                                
                                                {/* Palabra Clave editable para corregir */}
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                        Palabra Clave (Verificar)
                                                    </label>
                                                    <div className="relative">
                                                        <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                                        <input
                                                            type="text"
                                                            placeholder="Ej: EVENTO"
                                                            value={keyword}
                                                            onChange={(e) => setKeyword(e.target.value)}
                                                            className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Grabación de Llamada */}
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                        Enlace a Grabación de la Llamada
                                                    </label>
                                                    <div className="relative">
                                                        <Video size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                                        <input
                                                            type="url"
                                                            placeholder="https://zoom.us/rec/play/... o Google Drive"
                                                            value={linkedCall}
                                                            onChange={(e) => setLinkedCall(e.target.value)}
                                                            className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Estado de la Agenda (Result) */}
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                        Resultado de la Agenda (Asistencia)
                                                    </label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[
                                                            { key: 'Pendiente', color: 'amber' },
                                                            { key: 'Asistió', color: 'emerald' },
                                                            { key: 'No Show', color: 'rose' }
                                                        ].map(opt => {
                                                            const isActive = result === opt.key;
                                                            const colorMap = {
                                                                amber: isActive ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'hover:bg-amber-500/5 border-slate-800 text-slate-400',
                                                                emerald: isActive ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'hover:bg-emerald-500/5 border-slate-800 text-slate-400',
                                                                rose: isActive ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'hover:bg-rose-500/5 border-slate-800 text-slate-400'
                                                            };
                                                            return (
                                                                <button
                                                                    key={opt.key}
                                                                    type="button"
                                                                    onClick={() => setResult(opt.key)}
                                                                    className={`py-3 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all ${colorMap[opt.color]}`}
                                                                >
                                                                    {opt.key}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
 
                                                {/* Notas del Closer */}
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                        Notas de Seguimiento y Cierre
                                                    </label>
                                                    <div className="relative">
                                                        <MessageSquare size={16} className="absolute left-4 top-4 text-slate-500" />
                                                        <textarea
                                                            placeholder="Detalles sobre objeciones de venta, monto cobrado, señas, etc..."
                                                            value={closerNotes}
                                                            onChange={(e) => setCloserNotes(e.target.value)}
                                                            rows={3}
                                                            className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            </form>

                                            {/* Botón de envío */}
                                            <button
                                                type="button"
                                                onClick={handleSubmit}
                                                disabled={submitting}
                                                className="w-full bg-[#1534ff] hover:bg-[#1534ff]/90 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 group disabled:opacity-50"
                                            >
                                                {submitting ? (
                                                    <Loader2 className="animate-spin" size={14} />
                                                ) : (
                                                    <>
                                                        Completar Seguimiento y Cierre
                                                        <Check size={14} className="group-hover:scale-110 transition-transform" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </MazoCartas>
                            </div>

                            {/* Panel lateral informativo */}
                            <div className="space-y-6">
                                {/* Estado del Mazo Closer */}
                                <div className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                                    <div className="space-y-4 relative z-10 text-left">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Mi Progreso</h3>
                                        <div className="space-y-1">
                                            <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                                {cards.length === 0 ? "0 / 0" : `${currentIndex} / ${cards.length}`}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                Cierres completados en este mazo
                                            </p>
                                        </div>

                                        {/* Barra de progreso */}
                                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-[#1534ff] h-full rounded-full transition-all duration-500" 
                                                style={{ width: `${cards.length > 0 ? (currentIndex / cards.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Tips de Closer */}
                                <div className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-left space-y-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Instrucciones del Closer</h3>
                                    <ul className="space-y-3 text-[11px] text-slate-400 font-medium">
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">1.</span>
                                            <span>Lee con atención las notas y la información de triage preparadas por el Setter.</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">2.</span>
                                            <span>Usa el botón "Abrir Chat IG" para contactar o revisar el contexto de chat directamente.</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">3.</span>
                                            <span>Pega el enlace a la grabación de zoom o drive de la videollamada para auditorías.</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">4.</span>
                                            <span>Agrega notas con los pormenores del cierre para llevar un control financiero.</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CloserDeckPage;
