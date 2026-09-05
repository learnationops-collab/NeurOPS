import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bug, RefreshCw, AlertCircle, ImageIcon, Loader2, X, MessageCircle, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../ui/Card';
import BugReportThread from '../feedback/BugReportThread';
import MultiSelectFilter from '../shared/MultiSelectFilter';
import LoomModal from '../shared/LoomModal';

const STATUS_OPTIONS = [
    { id: 'open', label: 'Pendiente', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    { id: 'reviewed', label: 'En revisión', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { id: 'resolved', label: 'Resuelto', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
];

const URGENCY_LABELS = {
    muy_urgente: 'Muy urgente',
    urgente: 'Urgente',
    neutro: 'Neutro',
    sin_urgencia: 'Sin urgencia',
};

const formatDate = (iso) => iso ? new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// Muestra la captura automática (si hay) seguida de las capturas extra que el usuario haya
// pegado a mano (Ctrl+V) — todas en una sola galería vertical, sin distinguir cuál es cuál,
// porque para quien revisa el reporte todas cumplen la misma función.
const ScreenshotModal = ({ reportId, onClose }) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/bug-reports/${reportId}`, { skipBugReport: true })
            .then(res => {
                const all = [res.data.screenshot, ...(res.data.extra_screenshots || [])].filter(Boolean);
                setImages(all);
            })
            .catch(() => toast.error('No se pudo cargar la captura'))
            .finally(() => setLoading(false));
    }, [reportId]);

    return createPortal(
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-8 overflow-y-auto" onClick={onClose}>
            <button className="fixed top-8 right-8 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white" onClick={onClose}>
                <X size={20} />
            </button>
            {loading && <Loader2 className="animate-spin text-white" size={32} />}
            {!loading && images.length > 0 && (
                <div className="flex flex-col gap-4 max-w-full" onClick={(e) => e.stopPropagation()}>
                    {images.map((src, i) => (
                        <img key={i} src={src} alt={`Captura ${i + 1} del reporte`} className="max-w-full rounded-2xl shadow-2xl" />
                    ))}
                </div>
            )}
            {!loading && images.length === 0 && <p className="text-white text-sm">Sin capturas disponibles.</p>}
        </div>,
        document.body
    );
};

const ReportCard = ({ report, onStatusChange, onReportUpdate }) => {
    const [showScreenshot, setShowScreenshot] = useState(false);
    const [showLoom, setShowLoom] = useState(false);

    const statusMeta = STATUS_OPTIONS.find(s => s.id === report.status) || STATUS_OPTIONS[0];

    return (
        <Card variant="surface" className="p-6 space-y-4 bg-surface/30 backdrop-blur-md border-white/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-black text-white">{report.user_name || 'Usuario eliminado'} <span className="text-muted font-medium">· {report.user_role}</span></p>
                    <p className="text-[10px] text-muted uppercase tracking-widest">{report.route} · {formatDate(report.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                    {report.unread_for_manager && (
                        <span className="w-2 h-2 rounded-full bg-rose-500" title="El usuario respondió" />
                    )}
                    {report.urgency && (
                        <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {URGENCY_LABELS[report.urgency] || report.urgency}
                        </span>
                    )}
                    <select
                        value={report.status}
                        onChange={(e) => onStatusChange(report.id, e.target.value)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-transparent ${statusMeta.color}`}
                    >
                        {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.label}</option>)}
                    </select>
                </div>
            </div>

            {report.problem && (
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">Cuál es el problema</p>
                    <p className="text-sm text-white">{report.problem}</p>
                </div>
            )}
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">Qué intentaba hacer</p>
                <p className="text-sm text-white">{report.description}</p>
            </div>

            {report.technical_context && (
                <div className="flex items-start gap-2 text-xs bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl p-3">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span className="break-words font-mono">{report.technical_context}</span>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
                {(report.has_screenshot || report.extra_screenshots_count > 0) && (
                    <button
                        onClick={() => setShowScreenshot(true)}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300"
                    >
                        <ImageIcon size={14} />
                        Ver captura{(report.extra_screenshots_count > 0) ? `s (${(report.has_screenshot ? 1 : 0) + report.extra_screenshots_count})` : ' de pantalla'}
                    </button>
                )}
                {report.loom_link && (
                    <button
                        type="button"
                        onClick={() => setShowLoom(true)}
                        className="flex items-center gap-2 text-xs font-bold text-violet-400 hover:text-violet-300"
                    >
                        <Video size={14} /> Ver Loom
                    </button>
                )}
            </div>
            {showScreenshot && <ScreenshotModal reportId={report.id} onClose={() => setShowScreenshot(false)} />}
            {showLoom && <LoomModal url={report.loom_link} onClose={() => setShowLoom(false)} />}

            <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                    <MessageCircle size={12} /> Conversación ({report.message_count})
                </p>
                <BugReportThread reportId={report.id} onReportUpdate={onReportUpdate} />
            </div>
        </Card>
    );
};

const BugReportsPanel = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    // Array de status ids seleccionados; vacío = sin filtrar (todos). Antes era un <select> de
    // un solo valor — el operador pedía poder ver, por ejemplo, "pendientes" + "en revisión"
    // juntos sin los resueltos, así que pasa a multi-selección.
    const [statusFilter, setStatusFilter] = useState([]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = statusFilter.length ? { status: statusFilter.join(',') } : {};
            const res = await api.get('/bug-reports', { params, skipBugReport: true });
            setReports(res.data);
        } catch (err) {
            console.error('Error al obtener reportes de bugs:', err);
            toast.error('No se pudieron cargar los reportes de bugs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, [statusFilter]);

    const handleReportUpdate = (updatedReport) => {
        setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
    };

    const handleStatusChange = async (id, status) => {
        try {
            const res = await api.patch(`/bug-reports/${id}/status`, { status }, { skipBugReport: true });
            setReports(prev => prev.map(r => r.id === id ? res.data : r));
        } catch (err) {
            console.error('Error al actualizar estado:', err);
            toast.error('No se pudo actualizar el estado.');
        }
    };

    const openCount = useMemo(() => reports.filter(r => r.status === 'open').length, [reports]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
                        <Bug size={22} /> Reportes de Bugs y Feedback
                    </h2>
                    <p className="text-xs text-muted uppercase tracking-widest font-medium">{openCount} pendiente(s) de revisar</p>
                </div>
                <div className="flex items-center gap-2">
                    <MultiSelectFilter
                        label="Estado"
                        options={STATUS_OPTIONS.map(s => ({ value: s.id, label: s.label }))}
                        value={statusFilter}
                        onChange={setStatusFilter}
                    />
                    <button
                        onClick={fetchReports}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-black tracking-wider uppercase text-white transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refrescar
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <RefreshCw className="animate-spin text-indigo-500" size={32} />
                    <span className="text-xs font-black uppercase tracking-widest text-muted">Cargando reportes...</span>
                </div>
            ) : reports.length === 0 ? (
                <Card variant="surface" className="p-12 flex flex-col items-center justify-center text-center space-y-4 bg-surface/20 border-dashed border-white/5">
                    <AlertCircle className="text-muted" size={40} />
                    <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-wider text-white">Sin Reportes</h4>
                        <p className="text-xs text-muted max-w-sm">No hay reportes de bugs que coincidan con el filtro seleccionado.</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-4">
                    {reports.map(r => (
                        <ReportCard key={r.id} report={r} onStatusChange={handleStatusChange} onReportUpdate={handleReportUpdate} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BugReportsPanel;
