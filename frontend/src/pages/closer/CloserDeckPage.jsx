import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
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
    Clock,
    Tag,
    Video,
    MessageCircle,
    X,
    DollarSign
} from 'lucide-react';
import api from '../../services/api';
import MazoCartas from '../../components/deck/MazoCartas';
import BuscadorGlobalDeck from '../../components/deck/BuscadorGlobalDeck';
import Button from '../../components/ui/Button';
import QuickSaleModal from '../../components/modals/QuickSaleModal';

// Estilos de comentarios en español cortos
const CloserDeckPage = () => {
    const [searchParams] = useSearchParams();
    const apptIdParam = searchParams.get('appt_id');

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
        if (apptIdParam) {
            handleSelectLead(apptIdParam);
        } else {
            fetchQueue();
        }
    }, [apptIdParam]);

    // Sincronizar form con la carta activa del Closer
    useEffect(() => {
        if (cards.length > 0 && currentIndex < cards.length) {
            const activeCard = cards[currentIndex];
            setKeyword(activeCard.keyword || '');
            setLinkedCall(activeCard.linked_call || '');
            setCloserNotes(activeCard.closer_notes || '');
            let closerRes = activeCard.closer_result || 'Pendiente';
            if (closerRes === 'Show up') closerRes = 'Asistió';
            setResult(closerRes);
        }
    }, [cards, currentIndex]);

    // Comentarios states
    const [comments, setComments] = useState([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [replyToId, setReplyToId] = useState(null);
    const [replyToName, setReplyToName] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);

    // Nuevos estados para pestañas derecha, historial y registro de venta
    const [rightPanelTab, setRightPanelTab] = useState('comments');
    const [eventLogs, setEventLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

    const activeCard = cards[currentIndex];

    // Cargar comentarios
    const fetchComments = async (apptId) => {
        setLoadingComments(true);
        try {
            const res = await api.get(`/closer/deck/comments/${apptId}`);
            setComments(res.data || []);
        } catch (err) {
            console.error("Error al cargar comentarios:", err);
        } finally {
            setLoadingComments(false);
        }
    };

    // Cargar historial de actividad del lead
    const fetchEventLogs = async (apptId) => {
        setLoadingLogs(true);
        try {
            const res = await api.get(`/closer/deck/events/${apptId}`);
            setEventLogs(res.data || []);
        } catch (err) {
            console.error("Error al cargar historial del lead:", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    useEffect(() => {
        if (activeCard?.id) {
            fetchComments(activeCard.id);
            fetchEventLogs(activeCard.id);
        } else {
            setComments([]);
            setEventLogs([]);
        }
    }, [activeCard?.id]);

    const handleSendComment = async (e) => {
        if (e) e.preventDefault();
        if (!newCommentText.trim() || !activeCard?.id) return;
        
        try {
            const payload = {
                text: newCommentText,
                parent_id: replyToId
            };
            await api.post(`/closer/deck/comments/${activeCard.id}`, payload);
            toast.success(replyToId ? "Respuesta enviada" : "Comentario enviado");
            setNewCommentText('');
            setReplyToId(null);
            setReplyToName('');
            fetchComments(activeCard.id);
        } catch (err) {
            console.error("Error al enviar comentario:", err);
            toast.error("Error al enviar comentario");
        }
    };


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
                                    {activeCard && (() => {
                                        const cleanPhone = activeCard.phone ? activeCard.phone.replace(/\D/g, '') : '';
                                        const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${activeCard.lead_name}, te saluda tu asesor de NeurOPS. ¿Cómo estás?`)}` : '';
                                        const mailLink = activeCard.email ? `mailto:${activeCard.email}` : '';

                                        return (
                                            <div className="flex flex-col justify-between h-full space-y-6">
                                                
                                                {/* Cabecera de la carta */}
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-start gap-4 flex-wrap">
                                                        <span className="text-[10px] font-black uppercase bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-xl tracking-widest flex items-center gap-1.5">
                                                            <Clock size={12} />
                                                            {formatTime(activeCard.start_time)}
                                                        </span>
                                                        <span className="text-[10px] font-black uppercase bg-teal-500/10 border border-teal-500/20 text-teal-400 px-3 py-1.5 rounded-xl tracking-widest flex items-center gap-1.5">
                                                            Confirmer: {activeCard.result || 'Pendiente'}
                                                        </span>
                                                        <span className="text-[10px] font-black uppercase bg-white/5 border border-white/10 text-slate-400 px-3 py-1.5 rounded-xl tracking-widest flex items-center gap-1.5 ml-auto">
                                                            <Tag size={12} />
                                                            {activeCard.origin || 'Sin Origen'}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800/60 pb-3">
                                                        <div className="space-y-1.5 text-left">
                                                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                                                                {activeCard.lead_name}
                                                            </h2>
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-400 font-bold">
                                                                <span>Lead ID: #{activeCard.id}</span>
                                                                {activeCard.instagram && activeCard.instagram !== 'N/A' && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Instagram size={11} className="text-pink-500" />
                                                                        @{activeCard.instagram}
                                                                    </span>
                                                                )}
                                                                {activeCard.phone && activeCard.phone !== 'N/A' && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Phone size={11} className="text-emerald-500" />
                                                                        {activeCard.phone}
                                                                    </span>
                                                                )}
                                                                {activeCard.email && activeCard.email !== 'N/A' && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Mail size={11} className="text-sky-500" />
                                                                        {activeCard.email}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Acciones Rápidas de Contacto */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {activeCard.ig_chat_link && (
                                                                <a
                                                                    href={activeCard.ig_chat_link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1.5 bg-[#1534ff] hover:bg-[#1534ff]/90 text-white text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all shadow-sm"
                                                                    title="Abrir Chat IG"
                                                                >
                                                                    Chat IG
                                                                    <ExternalLink size={10} />
                                                                </a>
                                                            )}
                                                            {cleanPhone && (
                                                                <a
                                                                    href={waLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all shadow-sm animate-pulse"
                                                                    title="WhatsApp Rápido"
                                                                >
                                                                    WhatsApp
                                                                    <MessageCircle size={10} />
                                                                </a>
                                                            )}
                                                            {activeCard.email && activeCard.email !== 'N/A' && (
                                                                <a
                                                                    href={mailLink}
                                                                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all border border-slate-700"
                                                                    title="Enviar Email"
                                                                >
                                                                    Email
                                                                    <Mail size={10} />
                                                                </a>
                                                            )}
                                                        </div>
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

                                                    {/* Triage / Respuestas de Encuesta colapsables */}
                                                    {activeCard.survey_answers && activeCard.survey_answers.length > 0 && (
                                                        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 space-y-3 text-left">
                                                            <div className="flex items-center gap-2 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                                                <Layers size={14} />
                                                                Perfil de Call Confirmer (Calificación)
                                                            </div>
                                                            <div className="max-h-[180px] overflow-y-auto custom-scrollbar space-y-3.5 pr-2">
                                                                {activeCard.survey_answers.map((ans, idx) => (
                                                                    <div key={idx} className="space-y-0.5 border-l-2 border-emerald-500/20 pl-3">
                                                                        <p className="text-[10px] font-bold text-slate-400 leading-tight">{ans.question}</p>
                                                                        <p className="text-xs font-black text-white leading-normal">{ans.answer || 'Sin respuesta'}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
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

                                            {/* Botones de acción inferiores */}
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                {result === 'Asistió' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsSaleModalOpen(true)}
                                                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer"
                                                    >
                                                        <DollarSign size={14} />
                                                        Registrar Venta
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleSubmit}
                                                    disabled={submitting}
                                                    className={`${result === 'Asistió' ? 'flex-1' : 'w-full'} bg-[#1534ff] hover:bg-[#1534ff]/90 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer`}
                                                >
                                                    {submitting ? (
                                                        <Loader2 className="animate-spin" size={14} />
                                                    ) : (
                                                        <>
                                                            Completar Seguimiento
                                                            <Check size={14} className="group-hover:scale-110 transition-transform" />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        );
                                    })()}
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

                                {/* Sección de Comentarios e Historial de Leads (Closer) */}
                                {activeCard && (
                                    <div className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-left relative overflow-hidden">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                            <div className="flex gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setRightPanelTab('comments')}
                                                    className={`text-xs font-black uppercase tracking-[0.2em] transition-colors ${rightPanelTab === 'comments' ? 'text-primary border-b-2 border-primary pb-1' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    Mensajes
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRightPanelTab('history')}
                                                    className={`text-xs font-black uppercase tracking-[0.2em] transition-colors ${rightPanelTab === 'history' ? 'text-primary border-b-2 border-primary pb-1' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    Historial
                                                </button>
                                            </div>
                                            {rightPanelTab === 'comments' ? (
                                                <span className="text-[10px] font-black uppercase bg-[#1534ff]/10 text-primary border border-[#1534ff]/20 px-2.5 py-1 rounded-xl">
                                                    {comments.length} Mensajes
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                                                    {eventLogs.length} Eventos
                                                </span>
                                            )}
                                        </div>

                                        {/* Vista de Mensajes/Comentarios */}
                                        {rightPanelTab === 'comments' && (
                                            <>
                                                {/* Historial de Comentarios con Scroll */}
                                                <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                                                    {loadingComments ? (
                                                        <div className="flex justify-center py-6">
                                                            <Loader2 className="animate-spin text-primary" size={20} />
                                                        </div>
                                                    ) : comments.length === 0 ? (
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center py-6">
                                                            Sin comentarios en este lead aún.
                                                        </p>
                                                    ) : (
                                                        comments.filter(c => !c.parent_id).map(comment => (
                                                            <div key={comment.id} className="space-y-3">
                                                                {/* Comentario Principal */}
                                                                <div className="bg-black/35 border border-slate-850/80 p-4 rounded-3xl relative group">
                                                                    <div className="flex justify-between items-start mb-1.5">
                                                                        <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                                                                            {comment.author_name}
                                                                        </span>
                                                                        <span className="text-[9px] text-slate-500 font-bold">
                                                                            {new Date(comment.created_at).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'})}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                                                                        {comment.text}
                                                                    </p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setReplyToId(comment.id);
                                                                            setReplyToName(comment.author_name);
                                                                        }}
                                                                        className="mt-2 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-wider transition-colors block"
                                                                    >
                                                                        Responder
                                                                    </button>
                                                                </div>

                                                                {/* Respuestas Identadas */}
                                                                {comments.filter(c => c.parent_id === comment.id).map(reply => (
                                                                    <div key={reply.id} className="ml-6 bg-[#1d1e26]/50 border border-slate-800/40 p-4 rounded-3xl relative">
                                                                        <div className="flex justify-between items-start mb-1.5">
                                                                            <span className="text-[10px] font-black text-violet-400 uppercase tracking-wider">
                                                                                {reply.author_name}
                                                                            </span>
                                                                            <span className="text-[9px] text-slate-500 font-bold">
                                                                                {new Date(reply.created_at).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'})}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-slate-300 font-medium leading-relaxed">
                                                                            {reply.text}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Input de Nuevo Comentario */}
                                                <form onSubmit={handleSendComment} className="space-y-3">
                                                    {replyToId && (
                                                        <div className="flex justify-between items-center bg-violet-500/10 border border-violet-500/20 px-4 py-2.5 rounded-2xl">
                                                            <span className="text-[9px] font-black text-violet-400 uppercase tracking-wider">
                                                                Respondiendo a {replyToName}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setReplyToId(null);
                                                                    setReplyToName('');
                                                                }}
                                                                className="text-slate-400 hover:text-white"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="relative flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder={replyToId ? "Escribe tu respuesta..." : "Escribe un comentario..."}
                                                            value={newCommentText}
                                                            onChange={(e) => setNewCommentText(e.target.value)}
                                                            className="flex-1 bg-black/40 border border-slate-800 rounded-2xl py-3 px-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all"
                                                        />
                                                        <button
                                                            type="submit"
                                                            className="bg-[#1534ff] hover:bg-[#1534ff]/90 text-white font-black text-[9px] uppercase tracking-widest px-4 rounded-2xl transition-all shadow-lg shadow-blue-600/10 flex items-center justify-center"
                                                        >
                                                            Enviar
                                                        </button>
                                                    </div>
                                                </form>
                                            </>
                                        )}

                                        {/* Vista de Historial / Eventos en Línea de Tiempo */}
                                        {rightPanelTab === 'history' && (
                                            <div className="max-h-[360px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                                                {loadingLogs ? (
                                                    <div className="flex justify-center py-6">
                                                        <Loader2 className="animate-spin text-primary" size={20} />
                                                    </div>
                                                ) : eventLogs.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center py-6">
                                                        Sin eventos registrados para este lead.
                                                    </p>
                                                ) : (
                                                    <div className="relative border-l-2 border-slate-800 ml-3 pl-5 space-y-5 py-2">
                                                        {eventLogs.map((log) => (
                                                            <div key={log.id} className="relative">
                                                                {/* Punto de la línea de tiempo */}
                                                                <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-sm" />
                                                                <div className="space-y-0.5">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                                                            {log.event_type || 'Acción'}
                                                                        </span>
                                                                        <span className="text-[8px] text-slate-500 font-bold">
                                                                            {new Date(log.created_at).toLocaleDateString('es-ES', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-200 font-bold leading-normal">{log.description}</p>
                                                                    {log.user_name && (
                                                                        <p className="text-[9px] text-slate-500 font-semibold uppercase">
                                                                            Por: {log.user_name}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Tips de Closer */}
                                <div className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-left space-y-4 font-bold text-slate-400">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Instrucciones del Closer</h3>
                                    <ul className="space-y-3 text-[11px] text-slate-400 font-medium">
                                        <li className="flex gap-2">
                                            <span className="text-primary font-black">1.</span>
                                            <span>Lee con atención las notas y la información de Call Confirmer preparadas por el Setter.</span>
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
            
            {/* Modal de Registro Rápido de Venta */}
            <QuickSaleModal
                isOpen={isSaleModalOpen}
                onClose={() => setIsSaleModalOpen(false)}
                onSuccess={() => {
                    toast.success("Venta registrada con éxito");
                    fetchQueue();
                }}
                preselectedLead={activeCard ? {
                    id: activeCard.client_id,
                    username: activeCard.lead_name,
                    email: activeCard.email
                } : null}
            />
        </div>
    );
};

export default CloserDeckPage;
