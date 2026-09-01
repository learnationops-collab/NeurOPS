import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History, Loader2, Reply, Clock } from 'lucide-react';
import api from '../../services/api';

const STATUS_LABELS = {
    open: 'Pendiente',
    reviewed: 'En revisión',
    resolved: 'Resuelto',
};

const URGENCY_LABELS = {
    muy_urgente: 'Muy urgente',
    urgente: 'Urgente',
    neutro: 'Neutro',
    sin_urgencia: 'Sin urgencia',
};

const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Historial de reportes propios del usuario (cualquier rol). Al abrirse marca como
// leídas las respuestas nuevas en el backend (?mark_read=true) — el fetch pasivo que hace
// BugReportWidget para calcular el badge de "no leído" NO manda ese flag, así el aviso no
// desaparece antes de que el usuario efectivamente lo vea acá.
const BugReportHistory = ({ isOpen, onClose }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        api.get('/bug-reports/mine', { params: { mark_read: 'true' }, skipBugReport: true })
            .then(res => setReports(res.data))
            .catch(err => console.error('Error al cargar tus reportes:', err))
            .finally(() => setLoading(false));
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    data-bug-report-ignore="true"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.95 }}
                    className="fixed bottom-8 right-8 z-[210] w-[min(26rem,calc(100vw-2rem))] max-h-[70vh] glass-effect rounded-[2rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden"
                >
                    <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                                <History size={18} />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-tight">Mis reportes</h3>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-muted hover:text-base transition-all active:scale-95">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                        {loading && (
                            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted">
                                <Loader2 size={14} className="animate-spin" /> Cargando...
                            </div>
                        )}

                        {!loading && reports.length === 0 && (
                            <p className="text-xs text-muted text-center py-10">Todavía no enviaste ningún reporte.</p>
                        )}

                        {!loading && reports.map((r) => (
                            <div key={r.id} className="bg-surface border border-base rounded-2xl p-4 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">{URGENCY_LABELS[r.urgency] || r.urgency}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1">
                                        <Clock size={10} /> {formatDate(r.created_at)}
                                    </span>
                                </div>
                                {r.problem && <p className="text-xs text-muted italic">"{r.problem}"</p>}
                                <p className="text-sm break-words">{r.description}</p>
                                <span className="inline-block text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                                    {STATUS_LABELS[r.status] || r.status}
                                </span>

                                {r.admin_response && (
                                    <div className="flex items-start gap-2 mt-2 pt-2 border-t border-white/5">
                                        <Reply size={14} className="text-primary mt-0.5 shrink-0" />
                                        <div className="text-xs">
                                            <p className="font-bold text-primary">{r.responded_by_name || 'Equipo NeurOPS'} respondió:</p>
                                            <p className="text-muted whitespace-pre-wrap break-words">{r.admin_response}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BugReportHistory;
