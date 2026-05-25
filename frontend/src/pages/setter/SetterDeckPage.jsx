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
    ArrowRight,
    ExternalLink, 
    Layers, 
    Loader2, 
    Check, 
    X,
    Clock,
    Tag
} from 'lucide-react';
import api from '../../services/api';
import MazoCartas from '../../components/deck/MazoCartas';
import BuscadorGlobalDeck from '../../components/deck/BuscadorGlobalDeck';
import Button from '../../components/ui/Button';

// Estilos de comentarios en español cortos
const SetterDeckPage = () => {
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isSearchedCard, setIsSearchedCard] = useState(false);

    // Form states
    const [instagram, setInstagram] = useState('');
    const [igChatLink, setIgChatLink] = useState('');
    const [keyword, setKeyword] = useState('');
    const [setterNotes, setSetterNotes] = useState('');
    const [result, setResult] = useState('Entrante');

    // Cargar cola inicial
    const fetchQueue = async () => {
        setLoading(true);
        try {
            const res = await api.get('/setter/deck');
            setCards(res.data || []);
            setCurrentIndex(0);
            setIsSearchedCard(false);
        } catch (err) {
            console.error("Error al cargar mazo:", err);
            toast.error("Error al cargar la cola de leads");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, []);

    // Sincronizar form con la carta activa
    useEffect(() => {
        if (cards.length > 0 && currentIndex < cards.length) {
            const activeCard = cards[currentIndex];
            setInstagram(activeCard.instagram || '');
            setIgChatLink(activeCard.ig_chat_link || '');
            setKeyword(activeCard.keyword || '');
            setSetterNotes(activeCard.setter_notes || '');
            setResult(activeCard.result || 'Pendiente');
        }
    }, [cards, currentIndex]);

    // Buscar lead específico
    const handleSelectLead = async (leadId) => {
        setLoading(true);
        try {
            const res = await api.get(`/setter/deck/card/${leadId}`);
            setCards([res.data]);
            setCurrentIndex(0);
            setIsSearchedCard(true);
            toast.success("Lead cargado en el mazo");
        } catch (err) {
            console.error("Error al buscar lead:", err);
            toast.error("No se pudo cargar la información de este lead");
        } finally {
            setLoading(false);
        }
    };

    // Formatear enlace de Instagram
    const handleInstagramChange = (val) => {
        setInstagram(val);
        // Si no tiene enlace pero tiene usuario, intentar autocompletar enlace
        if (val.trim() && !igChatLink) {
            const cleanUser = val.replace('@', '').trim();
            setIgChatLink(`https://instagram.com/${cleanUser}`);
        }
    };

    // Guardar cambios y despachar al Closer
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (currentIndex >= cards.length) return;

        const activeCard = cards[currentIndex];
        setSubmitting(true);

        const payload = {
            instagram,
            ig_chat_link: igChatLink,
            keyword,
            setter_notes: setterNotes,
            result
        };

        try {
            await api.post(`/setter/deck/${activeCard.id}`, payload);
            if (result === 'Agendado') {
                toast.success("Lead agendado y despachado al Closer");
            } else {
                toast.success("Progreso guardado y lead avanzado");
            }
            
            // Pasar a la siguiente carta
            setCurrentIndex(prev => prev + 1);
        } catch (err) {
            console.error("Error al guardar carta:", err);
            toast.error("Error al procesar el lead");
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
                                Mazo de Leads
                            </h1>
                            <p className="text-muted font-medium uppercase text-[10px] tracking-[0.2em]">
                                {isSearchedCard ? "Vista de Lead Seleccionado" : "Flujo Secuencial de Setters"}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                            {/* Buscador global integrado */}
                            <BuscadorGlobalDeck onSelectLead={handleSelectLead} role="setter" />

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
                            <div className="lg:col-span-2 flex flex-col items-center w-full space-y-4">
                                {cards.length > 0 && (
                                    <div className="flex justify-between items-center bg-[#1a1c23]/90 border border-slate-800/80 px-6 py-3 rounded-2xl w-full max-w-xl mx-auto shadow-xl">
                                        <button
                                            type="button"
                                            disabled={currentIndex === 0}
                                            onClick={() => setCurrentIndex(prev => prev - 1)}
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors flex items-center gap-1.5"
                                        >
                                            <ArrowLeft size={14} />
                                            Anterior
                                        </button>
                                        
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            Ficha {Math.min(currentIndex + 1, cards.length)} de {cards.length}
                                        </span>
                                        
                                        <button
                                            type="button"
                                            disabled={currentIndex >= cards.length}
                                            onClick={() => setCurrentIndex(prev => prev + 1)}
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors flex items-center gap-1.5"
                                        >
                                            Siguiente
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
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

                                                <div className="space-y-1">
                                                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                                                        {activeCard.lead_name}
                                                    </h2>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                        Lead ID: #{activeCard.id}
                                                    </p>
                                                </div>

                                                {/* Grid de contacto */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/20 border border-slate-800/50 p-4 rounded-3xl">
                                                    <div className="flex items-center gap-2.5 text-xs font-medium text-slate-300">
                                                        <Mail size={14} className="text-slate-500 shrink-0" />
                                                        <span className="truncate">{activeCard.email || 'Sin Correo'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2.5 text-xs font-medium text-slate-300">
                                                        <Phone size={14} className="text-slate-500 shrink-0" />
                                                        <span className="truncate">{activeCard.phone || 'Sin Teléfono'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Formulario Secuencial */}
                                            <form onSubmit={handleSubmit} className="space-y-5 flex-1 overflow-y-auto pr-1 py-1 custom-scrollbar">
                                                
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {/* Instagram */}
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                            Usuario de Instagram
                                                        </label>
                                                        <div className="relative">
                                                            <Instagram size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                                            <input
                                                                type="text"
                                                                placeholder="@usuario"
                                                                value={instagram}
                                                                onChange={(e) => handleInstagramChange(e.target.value)}
                                                                className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Palabra Clave */}
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                            Palabra Clave
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
                                                </div>

                                                {/* Link de Conversación */}
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                        Enlace a Conversación IG
                                                    </label>
                                                    <div className="relative flex items-center gap-2">
                                                        <div className="relative flex-1">
                                                            <LinkIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                                            <input
                                                                type="url"
                                                                placeholder="https://instagram.com/direct/inbox/..."
                                                                value={igChatLink}
                                                                onChange={(e) => setIgChatLink(e.target.value)}
                                                                className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all"
                                                            />
                                                        </div>
                                                        {igChatLink && (
                                                            <a
                                                                href={igChatLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="bg-[#1534ff]/10 hover:bg-[#1534ff]/20 text-[#1534ff] border border-[#1534ff]/20 p-3.5 rounded-2xl transition-all flex items-center justify-center"
                                                                title="Abrir chat en pestaña nueva"
                                                            >
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Notas del Setter */}
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                        Notas para el Closer
                                                    </label>
                                                    <div className="relative">
                                                        <MessageSquare size={16} className="absolute left-4 top-4 text-slate-500" />
                                                        <textarea
                                                            placeholder="Instrucciones especiales para el Closer, dudas del lead, etc..."
                                                            value={setterNotes}
                                                            onChange={(e) => setSetterNotes(e.target.value)}
                                                            rows={3}
                                                            className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all resize-none"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Estado de la Agenda (Result) */}
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1 block">
                                                        Estado del Lead
                                                    </label>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {[
                                                            { key: 'Entrante', color: 'slate' },
                                                            { key: 'Contactado', color: 'blue' },
                                                            { key: 'Link', color: 'violet' },
                                                            { key: 'Agendado', color: 'emerald' }
                                                        ].map(opt => {
                                                            const isActive = result === opt.key;
                                                            const colorMap = {
                                                                slate: isActive ? 'bg-slate-500/10 border-slate-500/50 text-slate-300' : 'hover:bg-slate-500/5 border-slate-800 text-slate-500',
                                                                blue: isActive ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'hover:bg-blue-500/5 border-slate-800 text-slate-500',
                                                                violet: isActive ? 'bg-violet-500/10 border-violet-500/50 text-violet-400' : 'hover:bg-violet-500/5 border-slate-800 text-slate-500',
                                                                emerald: isActive ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'hover:bg-emerald-500/5 border-slate-800 text-slate-500'
                                                            };
                                                            return (
                                                                <button
                                                                    key={opt.key}
                                                                    type="button"
                                                                    onClick={() => setResult(opt.key)}
                                                                    className={`py-3 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all ${colorMap[opt.color]}`}
                                                                >
                                                                    {opt.key}
                                                                </button>
                                                            );
                                                        })}
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
                                                        {result === 'Agendado' ? 'Confirmar y Despachar al Closer' : 'Guardar y Avanzar en el Mazo'}
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
                                {/* Estado del Mazo */}
                                <div className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                                    <div className="space-y-4 relative z-10 text-left">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Mi Progreso</h3>
                                        <div className="space-y-1">
                                            <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                                {cards.length === 0 ? "0 / 0" : `${currentIndex} / ${cards.length}`}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                Leads completados en este mazo
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

                                {/* Tips de Setter */}
                                <div className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-left space-y-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Instrucciones</h3>
                                    <ul className="space-y-3 text-[11px] text-slate-400 font-medium">
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">1.</span>
                                            <span>Completa los campos que faltan (Instagram, palabra clave, link de chat).</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">2.</span>
                                            <span>Añade notas concisas para guiar la conversación del Closer.</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">3.</span>
                                            <span>Selecciona el estado actual del lead (Entrante, Contactado, Link, Agendado).</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">4.</span>
                                            <span>Si seleccionas "Agendado", el lead se despachará de inmediato a la cola del Closer.</span>
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

export default SetterDeckPage;
