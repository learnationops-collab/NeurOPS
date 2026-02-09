import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, MessageSquare, Send } from 'lucide-react';
import Badge from '../ui/Badge';
import Card from '../ui/Card';

const NotificationWidget = ({ notifications, onMarkAsRead }) => {
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <Card variant="surface" className="p-8 border-primary/20 bg-primary/5 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <MessageSquare size={18} />
                    </div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-primary italic">Notificaciones</h3>
                </div>
                {unreadCount > 0 && (
                    <Badge variant="neutral" className="bg-primary text-white font-black italic px-3 py-1">
                        {unreadCount}
                    </Badge>
                )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                    {notifications.length > 0 ? (
                        notifications.map((n) => (
                            <motion.div
                                key={n.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`group p-5 rounded-2xl border transition-all relative overflow-hidden ${n.is_read
                                        ? 'bg-surface/20 border-base opacity-40 shadow-none'
                                        : 'bg-surface border-primary/10 shadow-xl shadow-primary/5 hover:border-primary/30'
                                    }`}
                            >
                                {!n.is_read && (
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                )}

                                <div className="flex justify-between items-start gap-3 relative z-10">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-tight leading-tight text-main group-hover:text-primary transition-colors">
                                            {n.subject}
                                        </p>
                                        <p className="text-[8px] font-bold text-muted uppercase tracking-widest opacity-50">
                                            {new Date(n.created_at).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {!n.is_read && (
                                        <button
                                            onClick={() => onMarkAsRead(n.id)}
                                            className="p-2 rounded-lg bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all transform hover:scale-110"
                                            title="Marcar como leída"
                                        >
                                            <CheckCircle2 size={12} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted mt-3 leading-relaxed font-medium line-clamp-3">
                                    {n.content}
                                </p>
                            </motion.div>
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="h-full flex flex-col items-center justify-center py-20 opacity-20"
                        >
                            <Send size={40} className="mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-center">Sin avisos nuevos</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--primary-rgb), 0.2); border-radius: 10px; }
            `}} />
        </Card>
    );
};

export default NotificationWidget;
