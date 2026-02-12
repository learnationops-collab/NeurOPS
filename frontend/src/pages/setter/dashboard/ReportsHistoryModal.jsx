import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Edit2, Trash2, FileText, Loader2, AlertCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import api from '../../../services/api';

const ReportsHistoryModal = ({ isOpen, onClose, onEdit, onDeleteSuccess }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchReports();
        }
    }, [isOpen]);

    const fetchReports = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/setter/my-reports');
            setReports(data);
        } catch (err) {
            console.error('Error fetching reports:', err);
            setError('Error al cargar los reportes anteriores.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (reportId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este reporte?')) return;

        setDeletingId(reportId);
        try {
            await api.delete(`/setter/daily-report/${reportId}`);
            setReports(prev => prev.filter(r => r.id !== reportId));
            if (onDeleteSuccess) onDeleteSuccess();
        } catch (err) {
            console.error('Error deleting report:', err);
            alert('Error al eliminar el reporte');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-main border border-base rounded-3xl p-8 max-w-4xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-muted z-10"
                        >
                            <X size={20} />
                        </button>

                        <div className="mb-6 flex-shrink-0">
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                                <FileText size={24} className="text-primary" /> Mis Reportes
                            </h3>
                            <p className="text-sm text-muted mt-2">Historial de tus reportes diarios. Puedes editar o eliminarlos si cometiste un error.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                            {loading && (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                </div>
                            )}

                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-500">
                                    <AlertCircle size={18} />
                                    <span className="text-xs font-black uppercase tracking-wide">{error}</span>
                                </div>
                            )}

                            {!loading && !error && reports.length === 0 && (
                                <div className="text-center py-12 opacity-50 space-y-4">
                                    <FileText size={48} className="mx-auto text-muted/30" />
                                    <p className="text-sm font-medium text-muted">No has enviado ningún reporte aún in los últimos 30 días.</p>
                                </div>
                            )}

                            {!loading && reports.map(report => (
                                <div key={report.id} className="bg-surface/50 p-6 rounded-2xl border border-white/5 hover:border-primary/20 transition-all group">
                                    <div className="flex items-start justify-between gap-6">
                                        <div className="space-y-4 flex-1">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="primary" className="gap-2 px-3">
                                                    <Calendar size={12} />
                                                    {new Date(report.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                </Badge>
                                                <div className="h-px bg-white/10 flex-1" />
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="bg-main/50 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Entrantes</p>
                                                    <p className="text-lg font-black text-white">{Object.values(report.funnel_stats)[0] || 0}</p>
                                                </div>
                                                <div className="bg-main/50 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">No Lead</p>
                                                    <p className="text-lg font-black text-rose-400">{report.fixed_stats.not_lead}</p>
                                                </div>
                                                <div className="bg-main/50 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Ofertas</p>
                                                    <p className="text-lg font-black text-primary">{report.fixed_stats.new_offers}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                onClick={() => onEdit(report)}
                                                variant="ghost"
                                                className="h-10 w-10 p-0 rounded-xl hover:bg-primary/20 hover:text-primary"
                                                title="Editar Reporte"
                                            >
                                                <Edit2 size={18} />
                                            </Button>
                                            <Button
                                                onClick={() => handleDelete(report.id)}
                                                loading={deletingId === report.id}
                                                variant="ghost"
                                                className="h-10 w-10 p-0 rounded-xl hover:bg-rose-500/20 hover:text-rose-500 text-muted"
                                                title="Eliminar Reporte"
                                            >
                                                <Trash2 size={18} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ReportsHistoryModal;
