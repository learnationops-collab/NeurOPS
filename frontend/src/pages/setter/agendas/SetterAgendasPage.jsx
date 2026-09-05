import React, { useState, useEffect } from 'react';
import { CalendarDays, Calendar as CalendarIcon, Link as LinkIcon, Search, User, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import BookingLinkModal from '../../../components/dashboard/BookingLinkModal';
import AgendaManagerModal from '../../../components/modals/AgendaManagerModal';
import SetterUnclaimedAgendas from './SetterUnclaimedAgendas';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { parseUtcIso } from '../../../utils/datetime';

const SetterAgendasPage = () => {
    const [loading, setLoading] = useState(true);
    const [agendas, setAgendas] = useState([]);
    const [sinAsignar, setSinAsignar] = useState([]);
    const [bookingLinks, setBookingLinks] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed'

    // Modals state
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);

    const fetchAgendas = async () => {
        try {
            setLoading(true);
            const res = await api.get('/setter/agendas', { params: { status: filter } });
            setAgendas(res.data || []);
        } catch (err) {
            console.error("Error fetching setter agendas", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSinAsignar = async () => {
        try {
            const res = await api.get('/setter/agendas/sin-asignar');
            setSinAsignar(res.data || []);
        } catch (err) {
            console.error("Error fetching agendas sin asignar", err);
        }
    };

    // Al reclamar una agenda pasa a tener la fuente del setter, así que sale de la
    // bandeja y entra en su lista; al descartarla solo sale de la bandeja.
    const handleAgendaResuelta = (agendaId, resultado) => {
        setSinAsignar(prev => prev.filter(a => a.id !== agendaId));
        if (resultado?.accion === 'mia') fetchAgendas();
    };

    const fetchBookingLinks = async () => {
        try {
            const res = await api.get('/setter/booking-link');
            setBookingLinks(res.data || []);
        } catch (err) {
            console.error("Error fetching booking links", err);
        }
    };

    useEffect(() => {
        fetchAgendas();
    }, [filter]);

    useEffect(() => {
        fetchBookingLinks();
        fetchSinAsignar();
    }, []);

    // Handle "L" key for links globally
    useEffect(() => {
        const handleKeys = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.key.toLowerCase() === 'l') {
                setIsLinkModalOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, []);

    // El detalle se pide por la AGENDA, no por la cita: el permiso lo da la fuente
    // y así el modal abre también cuando todavía no hay cita sincronizada.
    const handleAgendaClick = async (agendaRes) => {
        try {
            const res = await api.get(`/setter/agendas/${agendaRes.id}/detalle`);
            setSelectedAgenda(res.data);
            setIsAgendaModalOpen(true);
        } catch (err) {
            console.error("Error fetching agenda details", err);
            toast.error(err.response?.data?.error || 'No se pudo abrir el detalle de la agenda');
        }
    };

    const StatusBadge = ({ stage, result }) => {
        if (!result) return <Badge variant="warning" className="text-[10px]">Pendiente</Badge>;

        const successResults = ['Venta Cerrada', 'Reserva', 'Seguimiento Fuerte'];
        if (successResults.includes(result)) {
            return <Badge variant="success" className="text-[10px] whitespace-nowrap">{result}</Badge>;
        }

        return <Badge variant="error" className="text-[10px] whitespace-nowrap">{result}</Badge>;
    };

    return (
        <div className="h-screen overflow-y-auto custom-scrollbar pb-32">
            <div className="flex flex-col items-center justify-start p-12">
                <div className="w-full max-w-6xl space-y-8 py-12">
                    {/* Header */}
                    <header className="flex justify-between items-end border-b border-base pb-8 mb-4">
                        <div className="space-y-1 text-left">
                            <h1 className="text-5xl font-black text-base italic tracking-tighter uppercase leading-none flex items-center gap-4">
                                <CalendarDays size={40} className="text-primary mb-1" /> Agendas
                            </h1>
                            <p className="text-muted font-medium uppercase text-[10px] tracking-[0.2em]">Las agendas cuya fuente sos vos</p>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button
                                onClick={() => setIsLinkModalOpen(true)}
                                variant="primary"
                                className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 text-[10px] font-black uppercase tracking-widest gap-2"
                                icon={LinkIcon}
                            >
                                Links de Agendamiento
                            </Button>
                        </div>
                    </header>

                    {/* Agendas de setting sin dueño: se le pregunta al equipo de quién son */}
                    <SetterUnclaimedAgendas agendas={sinAsignar} onResuelta={handleAgendaResuelta} />

                    {/* Filters & Table Wrapper */}
                    <div className="space-y-6">
                        {/* Status Filters */}
                        <div className="flex bg-surface p-1 rounded-2xl w-fit border border-base">
                            {[
                                { id: 'all', label: 'Todas' },
                                { id: 'pending', label: 'Pendientes' },
                                { id: 'completed', label: 'Completadas' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className={`
                                        px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                                        ${filter === f.id
                                            ? 'bg-[#1534ff] text-white shadow-lg shadow-blue-500/20'
                                            : 'text-muted hover:text-white hover:bg-white/5'}
                                    `}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Enhanced Table */}
                        <Card variant="surface" className="border-base/50 overflow-hidden shadow-xl">
                            <div className="bg-surface/50 px-6 py-4 border-b border-base flex items-center justify-between">
                                <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <CalendarIcon size={14} className="text-primary" /> Historial de Agendas
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500/50"></span> Total: {agendas.length}
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : agendas.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
                                    <div className="w-16 h-16 rounded-3xl bg-base flex flex-col items-center justify-center border border-white/5">
                                        <Search size={24} className="text-muted/30" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-white">No hay agendas</p>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
                                            {filter === 'all'
                                                ? 'Todavía no hay agendas con tu fuente.'
                                                : `No hay agendas en estado ${filter === 'pending' ? 'Pendiente' : 'Completada'}.`}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-surface/30 border-b border-base/50">
                                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Lead / Cliente</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Closer Asignado</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Fecha y Hora</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">Estado</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {agendas.map((agenda, idx) => {
                                                const date = parseUtcIso(agenda.start_time);
                                                return (
                                                    <motion.tr
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                        key={agenda.id}
                                                        className="border-b border-base/30 hover:bg-surface/50 transition-colors group cursor-pointer"
                                                        onClick={() => handleAgendaClick(agenda)}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-white text-sm">{agenda.lead_name}</span>
                                                                <span className="text-[10px] text-muted font-mono">{agenda.phone || 'Sin teléfono'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-[#1534ff]/20 flex items-center justify-center text-[10px] font-bold text-[#1534ff]">
                                                                    {(agenda.closer_name || '?').charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="text-sm font-medium text-muted/80">{agenda.closer_name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-1.5 rounded-lg bg-base border border-white/5">
                                                                    <Clock size={14} className="text-primary" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-white/90">
                                                                        {date ? date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Sin fecha'}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted font-bold tracking-wider">
                                                                        {date ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <StatusBadge stage={agenda.last_stage} result={agenda.result} />
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button className="p-2 rounded-xl text-muted opacity-0 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                                <ArrowRight size={16} />
                                                            </button>
                                                        </td>
                                                    </motion.tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <BookingLinkModal
                isOpen={isLinkModalOpen}
                onClose={() => setIsLinkModalOpen(false)}
                data={bookingLinks}
            />

            <AgendaManagerModal
                isOpen={isAgendaModalOpen}
                appointment={selectedAgenda}
                onClose={() => setIsAgendaModalOpen(false)}
                onSuccess={fetchAgendas}
                mode="setter"
            />
        </div>
    );
};

export default SetterAgendasPage;
