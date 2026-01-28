import { useState, useEffect } from 'react';
import api from '../services/api';
import { Send, MessageSquare, Clock, User } from 'lucide-react';

const CommentsSection = ({ clientId }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (clientId) fetchComments();
    }, [clientId]);

    const fetchComments = async () => {
        try {
            const res = await api.get(`/leads/${clientId}/comments`);
            setComments(res.data);
        } catch (err) {
            console.error("Error fetching comments", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setSubmitting(true);
        try {
            const res = await api.post(`/leads/${clientId}/comments`, { text: newComment });
            setComments([res.data.comment, ...comments]);
            setNewComment('');
        } catch (err) {
            console.error("Error posting comment", err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-800/30">
                <MessageSquare size={18} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Notas & Comentarios</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px]">
                {loading ? (
                    <div className="text-center text-slate-500 text-xs py-10">Cargando...</div>
                ) : comments.length === 0 ? (
                    <div className="text-center text-slate-600 text-xs italic py-10">
                        No hay comentarios aún. Sé el primero en escribir algo.
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="flex gap-3 group">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                                <span className="text-xs font-bold text-slate-400">
                                    {comment.author ? comment.author[0].toUpperCase() : '?'}
                                </span>
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-300">{comment.author}</span>
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
