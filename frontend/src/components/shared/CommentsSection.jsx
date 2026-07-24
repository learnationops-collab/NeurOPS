import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Send, MessageSquare, Clock, User } from 'lucide-react';

const CommentsSection = ({ clientId, type, associatedId }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [operationalUsers, setOperationalUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [pollingEnabled, setPollingEnabled] = useState(true);

    useEffect(() => {
        if (clientId || (type && associatedId)) {
            fetchComments();
            
            let interval;
            if (pollingEnabled) {
                // Polling silencioso cada 10 segundos para actualizar en tiempo real
                interval = setInterval(() => {
                    fetchCommentsSilent();
                }, 10000);
            }
            
            return () => {
                if (interval) clearInterval(interval);
            };
        }
    }, [clientId, type, associatedId, pollingEnabled]);

    useEffect(() => {
        fetchOperationalUsers();
    }, []);

    const fetchOperationalUsers = async () => {
        try {
            const res = await api.get('/comments/users', { skipAuthError: true });
            if (Array.isArray(res.data)) {
                setOperationalUsers(res.data);
            }
        } catch (err) {
            console.error("Error fetching operational users", err);
            if (err.response?.status === 401) {
                setPollingEnabled(false);
            }
        }
    };

    const fetchCommentsSilent = async () => {
        try {
            let res;
            if (clientId) {
                res = await api.get(`/closer/leads/${clientId}/comments`, { skipAuthError: true });
            } else {
                res = await api.get('/comments', {
                    params: { type, associated_id: associatedId },
                    skipAuthError: true
                });
            }
            if (Array.isArray(res.data)) {
                setComments(res.data);
            }
        } catch (err) {
            console.error("Error silently fetching comments", err);
            if (err.response?.status === 401) {
                setPollingEnabled(false);
            }
        }
    };

    const fetchComments = async () => {
        setLoading(true);
        try {
            let res;
            if (clientId) {
                res = await api.get(`/closer/leads/${clientId}/comments`, { skipAuthError: true });
            } else {
                res = await api.get('/comments', {
                    params: { type, associated_id: associatedId },
                    skipAuthError: true
                });
            }
            if (Array.isArray(res.data)) {
                setComments(res.data);
            } else {
                console.error("Comments response is not an array:", res.data);
                setComments([]);
            }
        } catch (err) {
            console.error("Error fetching comments", err);
            setComments([]);
            if (err.response?.status === 401) {
                setPollingEnabled(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setSubmitting(true);
        try {
            let res;
            if (clientId) {
                res = await api.post(`/closer/leads/${clientId}/comments`, { 
                    text: newComment,
                    target_user_ids: selectedUserIds
                });
                setComments([res.data.comment, ...comments]);
            } else {
                res = await api.post('/comments', {
                    text: newComment,
                    type,
                    associated_id: associatedId,
                    target_user_ids: selectedUserIds
                });
                setComments([res.data, ...comments]);
            }
            setNewComment('');
            setSelectedUserIds([]);
        } catch (err) {
            console.error("Error posting comment", err);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleUserSelection = (userId) => {
        setSelectedUserIds(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-800/30">
                <MessageSquare size={18} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Notas & Comentarios</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px] custom-scrollbar">
                {loading ? (
                    <div className="text-center text-slate-500 text-xs py-10">Cargando...</div>
                ) : comments.length === 0 ? (
                    <div className="text-center text-slate-600 text-xs italic py-10">
                        No hay comentarios aún. Sé el primero en escribir algo.
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="flex gap-3 group animate-in slide-in-from-bottom-2 duration-300">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                                <span className="text-xs font-bold text-slate-400">
                                    {(comment.author || comment.author_name || '?')[0].toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-300">{comment.author || comment.author_name}</span>
                                    <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                        <Clock size={10} />
                                        {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl text-sm text-slate-300 leading-relaxed border border-slate-700/50">
                                    {comment.text}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Selector de Destinatarios de Notificación */}
            {operationalUsers.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900/40 space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                        Notificar a:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {operationalUsers.map(u => {
                            const isSelected = selectedUserIds.includes(u.id);
                            let roleColor = 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700';
                            if (isSelected) {
                                roleColor = 'border-indigo-500 bg-indigo-600/20 text-indigo-400 font-bold shadow-[0_0_8px_rgba(99,102,241,0.25)]';
                            } else {
                                if (u.role === 'setter') roleColor = 'border-emerald-900/50 bg-emerald-950/10 text-emerald-400 hover:bg-emerald-900/20';
                                else if (u.role === 'closer') roleColor = 'border-violet-900/50 bg-violet-950/10 text-violet-400 hover:bg-violet-900/20';
                                else if (u.role === 'triage') roleColor = 'border-cyan-900/50 bg-cyan-950/10 text-cyan-400 hover:bg-cyan-900/20';
                                else if (u.role === 'admin') roleColor = 'border-rose-900/50 bg-rose-950/10 text-rose-450 hover:bg-rose-900/20';
                            }
                            return (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => toggleUserSelection(u.id)}
                                    className={`text-[9px] uppercase tracking-wider px-2 py-1 border rounded-lg transition-all cursor-pointer ${roleColor}`}
                                >
                                    {u.username} ({u.role})
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-800/30 flex gap-2">
                <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escribe una nota..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                    type="submit"
                    disabled={submitting || !newComment.trim()}
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
};

export default CommentsSection;
