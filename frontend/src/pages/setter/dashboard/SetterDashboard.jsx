import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send,
    CheckCircle2,
    Loader2,
    BarChart3,
    Copy,
    Link,
    X,
    ExternalLink,
    MessageSquare,
    Edit2,
    Trash2,
    FileText
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import api from '../../../services/api';
import HotkeysTable from '../../../components/dashboard/HotkeysTable';

import ReportsHistoryModal from './ReportsHistoryModal';
import SetterReportModal from './SetterReportModal';
import AgendaManagerModal from '../../../components/modals/AgendaManagerModal';

const SetterDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeSection, setActiveSection] = useState(0);

    // Data State
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [stages, setStages] = useState([]);
    const [funnelStats, setFunnelStats] = useState({});
    const [summaryStats, setSummaryStats] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [todaysReport, setTodaysReport] = useState(null);
    const [selectedReport, setSelectedReport] = useState(null);

    // Links Modal State
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [availableLinks, setAvailableLinks] = useState({ events: [], closers: [] });

    // Agenda Modal State
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);

    // Report Modal State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // --- CHECK TODAY'S REPORT ---
    const checkTodaysReport = async () => {
        const today = new Date().toISOString().split('T')[0];
        try {
            const { data } = await api.get('/setter/daily-report', {
                params: { date: today }
            });
            setTodaysReport(data);
        } catch (err) {
            console.error("Error checking daily report:", err);
        }
    };

    useEffect(() => {
        checkTodaysReport();
    }, []);

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Collapsible Sections State
    const [sections, setSections] = useState({ quant: true, qual: true });

    const toggleSection = (section) => {
        setSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Initial Fetch
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchQuestionsAndStats(),
                    fetchStages()
                ]);
            } catch (err) {
                console.error("Error fetching data", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const fetchStages = async () => {
        try {
            const res = await api.get('/setter/stages');
            setStages(res.data || []);
            const initialStats = {};
            (res.data || []).forEach(stage => {
                initialStats[stage.id] = '';
            });
            setFunnelStats(initialStats);
        } catch (err) {
            console.error("Error fetching stages", err);
        }
    };

    const fetchQuestionsAndStats = async () => {
        try {
            const [qRes, sRes] = await Promise.all([
                api.get('/setter/questions'),
                api.get('/setter/stats/summary', { params: { start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0] } })
            ]);
            setQuestions(qRes.data);
            setSummaryStats(sRes.data);
        } catch (err) {
            console.error("Error fetching stats", err);
        }
    };

    const handleAgendaClick = (appt) => {
        setSelectedAgenda(appt);
        setIsAgendaModalOpen(true);
    };

    const fetchLinks = async () => {
        try {
            const res = await api.get('/setter/links');
            setAvailableLinks(res.data);
            setIsLinkModalOpen(true);
        } catch (err) {
            console.error("Error fetching links", err);
        }
    };

    // Listen for section change requests from DOCK
    useEffect(() => {
        const handleRequest = (e) => {
            const { index } = e.detail;
            setActiveSection(index);
        };
        window.addEventListener('request-section-change', handleRequest);
        return () => window.removeEventListener('request-section-change', handleRequest);
    }, []);

    // Send active section to Dock
    useEffect(() => {
        const category = 'Dashboard';
        const event = new CustomEvent('page-section-changed', {
            detail: { activeSection: 0, category }
        });
        window.dispatchEvent(event);
    }, []);

    // Handle "L" key for links
    useEffect(() => {
        const handleKeys = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.key.toLowerCase() === 'l') {
                if (!isLinkModalOpen) fetchLinks();
                else setIsLinkModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [isLinkModalOpen]);

    // History Modal Handlers
    const handleEditReport = (report) => {
        setSelectedReport(report);
        setIsReportModalOpen(true);
        setIsHistoryModalOpen(false);
    };

    const handleAnswerChange = (qId, value) => {
        setAnswers(prev => ({ ...prev, [qId]: value }));
    };

    const handleDeleteTodaysReport = async () => {
        if (!todaysReport) return;
        if (!window.confirm('¿Estás seguro de que quieres eliminar el reporte de hoy?')) return;

        try {
            await api.delete(`/setter/daily-report/${todaysReport.id}`);
            setTodaysReport(null);
            fetchQuestionsAndStats();
            setSuccess('Reporte eliminado');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error deleting todays report:', err);
            setError('Error al eliminar');
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-main"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="h-screen overflow-y-auto custom-scrollbar bg-main pb-32">
            <div className="flex flex-col items-center justify-start p-12">
                <div className="w-full max-w-6xl space-y-12 py-12">
                    <header className="flex justify-between items-center border-b border-base pb-8 mb-4">
                        <div className="space-y-1 text-left">
                            <h1 className="text-5xl font-black text-base italic tracking-tighter uppercase leading-none">Dashboard</h1>
                            <p className="text-muted font-medium uppercase text-[10px] tracking-[0.2em]">Resumen y Atajos de Teclado</p>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button
                                onClick={fetchLinks}
                                variant="primary"
                                className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 text-[10px] font-black uppercase tracking-widest gap-2"
                                icon={Link}
                            >
                                Links de Agendamiento
                            </Button>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Hotkeys Table */}
                        <div className="space-y-6">
                            <div className="h-full">
                                <HotkeysTable />
                            </div>
                        </div>

                        {/* Report Status Tile */}
                        <div className="space-y-6">
                            <Card variant="surface" className="p-8 border-base/50 shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <FileText size={80} />
                                </div>

                                <div className="flex flex-col h-full justify-between gap-6 relative z-10">
                                    <div>
                                        <h3 className="text-xs font-black text-muted uppercase tracking-[0.2em] mb-4">Estado del Reporte</h3>
                                        {!todaysReport ? (
                                            <div className="space-y-2">
                                                <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter">Completa tu reporte de hoy</h4>
                                                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Aún no has enviado tus métricas diarias</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-emerald-400">
                                                    <CheckCircle2 size={16} />
                                                    <h4 className="text-2xl font-black italic uppercase tracking-tighter">Reporte completado</h4>
                                                </div>
                                                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Enviado hoy a las {new Date(todaysReport.date + 'T12:00:00').toLocaleDateString()}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {!todaysReport ? (
                                            <Button
                                                onClick={() => setIsReportModalOpen(true)}
                                                variant="primary"
                                                className="h-12 px-8 rounded-xl shadow-lg shadow-primary/20 text-[10px] font-black uppercase tracking-widest gap-2 flex-1"
                                                icon={Send}
                                            >
                                                Completar Ahora
                                            </Button>
                                        ) : (
                                            <>
                                                <Button
                                                    onClick={() => setIsReportModalOpen(true)}
                                                    variant="outline"
                                                    className="h-12 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 flex-1"
                                                    icon={Edit2}
                                                >
                                                    Editar
                                                </Button>
                                                <Button
                                                    onClick={handleDeleteTodaysReport}
                                                    variant="ghost"
                                                    className="h-12 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 text-rose-500 hover:bg-rose-500/10"
                                                    icon={Trash2}
                                                >
                                                    Eliminar
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {isLinkModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-main border border-base rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden"
                            >
                                <button
                                    onClick={() => setIsLinkModalOpen(false)}
                                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-muted"
                                >
                                    <X size={20} />
                                </button>

                                <h3 className="text-2xl font-black text-base italic uppercase tracking-tighter mb-8 flex items-center gap-3">
                                    <Link size={24} className="text-primary" /> Links de Agendamiento
                                </h3>

                                <div className="space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                                    {availableLinks.events.map(event => (
                                        <div key={event.id} className="space-y-4">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Badge variant="primary" className="text-[9px]">{event.name}</Badge>
                                                <div className="h-px bg-base flex-1" />
                                            </div>

                                            <div className="bg-surface p-4 rounded-xl border border-white/5 space-y-2 group hover:border-primary/20 transition-all">
                                                <p className="text-[9px] font-black text-muted uppercase tracking-widest">Link General (Equipo)</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 bg-main p-3 rounded-lg border border-base text-xs font-mono text-muted/70 truncate">
                                                        {window.location.origin}/book/{event.slug}
                                                    </div>
                                                    <Button
                                                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/book/${event.slug}`)}
                                                        variant="ghost"
                                                        className="h-10 w-10 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                                                    >
                                                        <Copy size={16} />
                                                    </Button>
                                                    <a
                                                        href={`/book/${event.slug}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-primary/10 hover:text-primary text-muted transition-colors opacity-50 hover:opacity-100"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {availableLinks.closers.map(closer => (
                                                    <div key={closer.id} className="bg-surface/50 p-3 rounded-xl border border-white/5 flex items-center justify-between group hover:border-primary/10 transition-all">
                                                        <div className="min-w-0">
                                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1 truncate">@{closer.username}</p>
                                                            <p className="text-[10px] text-muted/30 truncate hidden group-hover:block transition-all hover:text-primary cursor-pointer" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/book/${event.slug}-${closer.username}`)}>
                                                                Copiar Link
                                                            </p>
                                                        </div>
                                                        <Button
                                                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/book/${event.slug}-${closer.username}`)}
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <Copy size={14} />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <div className="w-full max-w-6xl mt-8 flex justify-end gap-4">
                    <Button
                        onClick={() => setIsHistoryModalOpen(true)}
                        variant="ghost"
                        className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest text-muted hover:text-white hover:bg-white/5"
                    >
                        <FileText size={16} className="mr-2" /> Mis Reportes
                    </Button>
                    <Button
                        onClick={() => window.open('/setter/statistics', '_blank')}
                        variant="ghost"
                        className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest text-muted hover:text-white hover:bg-white/5"
                    >
                        <BarChart3 size={16} className="mr-2" /> Estadísticas
                    </Button>
                </div>
            </div>

            <ReportsHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                onEdit={handleEditReport}
                onDeleteSuccess={() => {
                    checkTodaysReport();
                    fetchQuestionsAndStats();
                }}
            />

            <AgendaManagerModal
                isOpen={isAgendaModalOpen}
                appointment={selectedAgenda}
                onClose={() => setIsAgendaModalOpen(false)}
                onSuccess={fetchQuestionsAndStats}
                mode="setter"
            />

            <SetterReportModal
                isOpen={isReportModalOpen}
                onClose={() => {
                    setIsReportModalOpen(false);
                    setSelectedReport(null);
                }}
                reportDate={new Date().toISOString().split('T')[0]}
                existingReport={selectedReport || todaysReport}
                onSuccess={() => {
                    checkTodaysReport();
                    fetchQuestionsAndStats();
                    setSuccess('Reporte guardado con éxito');
                    setTimeout(() => setSuccess(null), 3000);
                }}
            />
        </div>
    );
};

export default SetterDashboard;
