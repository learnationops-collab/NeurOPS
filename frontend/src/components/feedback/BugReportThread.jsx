import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

// Hilo de mensajes de un reporte de bug — usado tanto por el panel del operador
// (BugReportsPanel) como por "Mis reportes" del usuario (BugReportHistory). Antes había
// un solo campo admin_response que la segunda respuesta pisaba y el usuario no podía
// contestar; ahora es una conversación real vía GET/POST /bug-reports/<id>/messages.
const BugReportThread = ({ reportId, onReportUpdate }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef(null);

    const fetchThread = () => {
        setLoading(true);
        return api.get(`/bug-reports/${reportId}/messages`, { skipBugReport: true })
            .then(res => {
                setMessages(res.data.messages);
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
    }, [messages]);

    const handleSend = async () => {
        if (!text.trim()) return;
        setSending(true);
        try {
            const res = await api.post(`/bug-reports/${reportId}/messages`, { message: text.trim() }, { skipBugReport: true });
            setMessages(prev => [...prev, res.data]);
            setText('');
            fetchThread(); // refresca resumen del reporte (estado, unread) en el padre
        } catch (err) {
            console.error('Error al enviar mensaje:', err);
            toast.error('No se pudo enviar el mensaje.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2 pr-1">
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
                            <div className={`rounded-2xl px-3 py-2 text-xs max-w-[85%] whitespace-pre-wrap break-words ${isMine ? 'bg-primary/15 text-primary rounded-tr-sm' : 'bg-surface border border-base rounded-tl-sm'}`}>
                                {m.message}
                            </div>
                            <span className="text-[9px] text-muted mt-0.5 px-1">
                                {m.sender_name || 'Usuario'} · {new Date(m.created_at).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                    disabled={!text.trim() || sending}
                    onClick={handleSend}
                    className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
};

export default BugReportThread;
