import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Loader2, RotateCcw, Video, Play, ExternalLink, GraduationCap, Maximize2, Minimize2, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import LoomModal, { getLoomEmbedUrl } from '../shared/LoomModal';
import SaveAsSkillModal from './SaveAsSkillModal';

const MANAGER_ROLES = ['admin', 'operator'];

// Hilo de mensajes de un reporte de bug — usado tanto por el panel del operador
// (BugReportsPanel) como por "Mis reportes" del usuario (BugReportHistory). Antes había
// un solo campo admin_response que la segunda respuesta pisaba y el usuario no podía
// contestar; ahora es una conversación real vía GET/POST /bug-reports/<id>/messages.
//
// Cualquiera de los dos lados puede adjuntar un Loom a un mensaje (ej. el operador
// reenviando la grabación de cómo resolvió algo) — y un manager puede "guardarlo como
// skill" para que quede disponible en el Playbook, no solo perdido en este chat.
const BugReportThread = ({ reportId, onReportUpdate }) => {
    const { user } = useAuth();
    const isManager = MANAGER_ROLES.includes(user?.role);
    const [report, setReport] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [reopening, setReopening] = useState(false);
    const [showLoomField, setShowLoomField] = useState(false);
    const [loomInput, setLoomInput] = useState('');
    const [viewingLoom, setViewingLoom] = useState(null);
    const [savingSkillFor, setSavingSkillFor] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const bottomRef = useRef(null);

    const fetchThread = () => {
        setLoading(true);
        return api.get(`/bug-reports/${reportId}/messages`, { skipBugReport: true })
            .then(res => {
                setMessages(res.data.messages);
                setReport(res.data.report);
                onReportUpdate?.(res.data.report);
            })
            .catch(err => {
                console.error('Error al cargar la conversación:', err);
                toast.error('No se pudo cargar la conversación.');
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchThread(); }, [reportId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, expanded]);

    const handleSend = async () => {
        const trimmedText = text.trim();
        const trimmedLoom = loomInput.trim();
        if (!trimmedText && !trimmedLoom) return;
        setSending(true);
        try {
            const payload = { message: trimmedText };
            if (trimmedLoom) payload.loom_link = trimmedLoom;
            const res = await api.post(`/bug-reports/${reportId}/messages`, payload, { skipBugReport: true });
            setMessages(prev => [...prev, res.data]);
            setText('');
            setLoomInput('');
            setShowLoomField(false);
            fetchThread(); // refresca resumen del reporte (estado, unread) en el padre
        } catch (err) {
            console.error('Error al enviar mensaje:', err);
            toast.error('No se pudo enviar el mensaje.');
        } finally {
            setSending(false);
        }
    };

    const handleReopen = async () => {
        setReopening(true);
        try {
            const res = await api.post(`/bug-reports/${reportId}/reopen`, {}, { skipBugReport: true });
            setReport(res.data);
            onReportUpdate?.(res.data);
            toast.success('Marcado como que el problema sigue presente.');
            fetchThread(); // trae el mensaje automático que se agregó al reabrir
        } catch (err) {
            console.error('Error al reabrir el reporte:', err);
            toast.error(err.response?.data?.message || 'No se pudo reabrir el reporte.');
        } finally {
            setReopening(false);
        }
    };

    const canReopen = report?.status === 'resolved' && report?.user_id === user?.id;

    const messageListHeight = expanded ? 'flex-1' : 'max-h-72';

    const content = (
        <div className={`space-y-3 ${expanded ? 'flex flex-col h-full' : ''}`}>
            {canReopen && (
                <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl px-3 py-2.5 shrink-0">
                    <p className="text-[11px] font-medium leading-snug">Este reporte está marcado como resuelto. Si el problema sigue pasando, no hace falta reportarlo de nuevo.</p>
                    <button
                        onClick={handleReopen}
                        disabled={reopening}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                    >
                        {reopening ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        Sigue roto
                    </button>
                </div>
            )}
            <div className={`${messageListHeight} overflow-y-auto custom-scrollbar space-y-2 pr-1`}>
                {loading && (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted">
                        <Loader2 size={14} className="animate-spin" /> Cargando conversación...
                    </div>
                )}
                {!loading && messages.length === 0 && (
                    <p className="text-xs text-muted text-center py-4">Todavía no hay mensajes en este reporte.</p>
                )}
                {!loading && messages.map((m) => {
                    const isMine = m.sender_id === user?.id;
                    return (
                        <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                            {m.loom_link && (
                                <div className={`w-full max-w-[85%] rounded-2xl border overflow-hidden ${isMine ? 'border-primary/30 bg-primary/10' : 'border-base bg-surface'} ${m.message ? 'mb-1' : ''}`}>
                                    <button
                                        type="button"
                                        onClick={() => setViewingLoom(m.loom_link)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-all text-left"
                                    >
                                        <span className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                                            <Play size={14} fill="currentColor" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-xs font-bold truncate">Grabación de Loom</span>
                                            <span className="block text-[10px] text-muted">Toca para reproducir</span>
                                        </span>
                                    </button>
                                    <div className="flex items-center gap-1 px-3 pb-2 -mt-1">
                                        <a
                                            href={m.loom_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-base"
                                            title="Abrir en una pestaña nueva (más rápido si el embed tarda en cargar)"
                                        >
                                            <ExternalLink size={11} /> Abrir en pestaña nueva
                                        </a>
                                        {isManager && (
                                            <button
                                                type="button"
                                                onClick={() => setSavingSkillFor(m)}
                                                className="flex items-center gap-1 ml-auto text-[10px] font-bold text-emerald-400 hover:text-emerald-300"
                                                title="Dejar este video como skill en el Playbook"
                                            >
                                                <GraduationCap size={11} /> Guardar como skill
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {m.message && (
                                <div className={`rounded-2xl px-3 py-2 text-xs max-w-[85%] whitespace-pre-wrap break-words ${isMine ? 'bg-primary/15 text-primary rounded-tr-sm' : 'bg-surface border border-base rounded-tl-sm'}`}>
                                    {m.message}
                                </div>
                            )}
                            <span className="text-[9px] text-muted mt-0.5 px-1">
                                {m.sender_name || 'Usuario'} · {new Date(m.created_at).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5 shrink-0">
                {showLoomField && (
                    <div className="flex items-center gap-2">
                        <input
                            value={loomInput}
                            onChange={(e) => setLoomInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                            placeholder="Pega el link de Loom..."
                            autoFocus
                            className="flex-1 bg-black/30 border border-violet-500/30 rounded-2xl px-4 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                        />
                        <button
                            type="button"
                            onClick={() => { setShowLoomField(false); setLoomInput(''); }}
                            className="p-2 rounded-xl text-muted hover:text-base hover:bg-white/10"
                            title="Quitar el video"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowLoomField((v) => !v)}
                        className={`p-2.5 rounded-2xl transition-all active:scale-95 ${showLoomField || loomInput ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-muted hover:text-base hover:bg-white/10'}`}
                        title="Adjuntar un video de Loom"
                    >
                        <Video size={16} />
                    </button>
                    <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                        disabled={(!text.trim() && !loomInput.trim()) || sending}
                        onClick={handleSend}
                        className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {!expanded && (
                <>
                    <div className="flex items-center justify-end -mb-1">
                        <button
                            type="button"
                            onClick={() => setExpanded(true)}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-muted hover:text-base"
                            title="Ver la conversación en grande"
                        >
                            <Maximize2 size={11} /> Expandir
                        </button>
                    </div>
                    {content}
                </>
            )}

            {expanded && createPortal(
                <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setExpanded(false)}>
                    <div
                        data-bug-report-ignore="true"
                        className="w-full max-w-2xl h-[85vh] bg-surface border border-white/10 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5 shrink-0">
                            <h3 className="text-sm font-black uppercase tracking-tight">Conversación</h3>
                            <button onClick={() => setExpanded(false)} className="p-2 -mr-2 hover:bg-white/10 rounded-xl text-muted hover:text-base transition-all active:scale-95" title="Volver al tamaño normal">
                                <Minimize2 size={16} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 p-5">
                            {content}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {viewingLoom && <LoomModal url={viewingLoom} onClose={() => setViewingLoom(null)} />}
            {savingSkillFor && (
                <SaveAsSkillModal
                    loomLink={savingSkillFor.loom_link}
                    defaultTitle={report?.problem || report?.description || ''}
                    defaultRoles={report?.user_role ? [report.user_role] : []}
                    onClose={() => setSavingSkillFor(null)}
                />
            )}
        </>
    );
};

export default BugReportThread;
