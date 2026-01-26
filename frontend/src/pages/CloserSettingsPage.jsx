import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ThemeSelector from '../components/ui/ThemeSelector';
import {
    Clock,
    Calendar,
    Trash2,
    Plus,
    Check,
    X,
    Loader2,
    Settings,
    Shield,
    User as UserIcon,
    Bell,
    Link as LinkIcon,
    ExternalLink,
    Copy,
    Share2,
    Save,
    AlertCircle,
    ChevronRight,
    MousePointer2,
    Info,
    CalendarDays,
    Zap,
    Columns,
    Layers,
    DollarSign,
    Palette
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SLOTS = Array.from({ length: 16 }, (_, i) => {
    const totalMinutes = i * 90;
    const hour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const min = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hour}:${min}`;
});

const CloserSettingsPage = () => {
    // States
    const [availability, setAvailability] = useState([]);
    const [weeklySchedule, setWeeklySchedule] = useState({});
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('availability');
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // Quick Fill State
    const [quickFill, setQuickFill] = useState({
        days: [0, 1, 2, 3, 4], // Lunes a Viernes default
        start: '09:00',
        end: '18:00'
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [availRes, eventsRes, weeklyRes] = await Promise.all([
                api.get('/closer/availability'),
                api.get('/closer/events'),
                api.get('/closer/weekly-availability')
            ]);
            setAvailability(Array.isArray(availRes.data) ? availRes.data : []);
            setEvents(eventsRes.data || []);
            setWeeklySchedule(weeklyRes.data || {});
        } catch (err) {
            console.error("Error fetching data", err);
            setError("Error al cargar la configuración.");
        } finally {
            setLoading(false);
        }
    };

    // --- Weekly Grid Logic ---
    const isSlotSelected = (dayIdx, timeStr) => {
        const dayStr = dayIdx.toString();
        const slots = weeklySchedule[dayStr] || [];
        return slots.some(s => s.start === timeStr);
    };

    const toggleSlot = (dayIdx, timeStr) => {
        const dayStr = dayIdx.toString();
        const currentSlots = [...(weeklySchedule[dayStr] || [])];

        const [h, m] = timeStr.split(':').map(Number);
        const totalMinutes = h * 60 + m + 90;
        const endH = Math.floor(totalMinutes / 60);
        const endM = totalMinutes % 60;
        const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        const index = currentSlots.findIndex(s => s.start === timeStr);

        let newSchedule;
        if (index > -1) {
            currentSlots.splice(index, 1);
            if (currentSlots.length === 0) {
                const { [dayStr]: removed, ...rest } = weeklySchedule;
                newSchedule = rest;
            } else {
                newSchedule = { ...weeklySchedule, [dayStr]: currentSlots };
            }
        } else {
            currentSlots.push({ start: timeStr, end: endTimeStr });
            newSchedule = { ...weeklySchedule, [dayStr]: currentSlots };
        }
        setWeeklySchedule(newSchedule);
    };

    const handleQuickFill = () => {
        const newSchedule = { ...weeklySchedule };

        quickFill.days.forEach(dayIdx => {
            const dayStr = dayIdx.toString();
            const slots = [];

            // Loop through SLOTS and add those within range
            SLOTS.forEach(timeStr => {
                if (timeStr >= quickFill.start && timeStr < quickFill.end) {
                    const [h, min] = timeStr.split(':').map(Number);
                    const totalMin = h * 60 + min + 90;
                    const endH = Math.floor(totalMin / 60);
                    const endM = totalMin % 60;
                    const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
                    slots.push({ start: timeStr, end: endTimeStr });
                }
            });

            if (slots.length > 0) {
                newSchedule[dayStr] = slots;
            }
        });

        setWeeklySchedule(newSchedule);
    };

    const handleResetWeekly = () => {
        if (window.confirm("¿Estás seguro de que deseas borrar toda tu disponibilidad semanal?")) {
            setWeeklySchedule({});
        }
    };

    const handleSaveWeekly = async () => {
        setSubmitting(true);
        try {
            const schedule = Object.entries(weeklySchedule).map(([day, slots]) => ({
                day: parseInt(day),
                slots: slots.sort((a, b) => a.start.localeCompare(b.start))
            }));
            await api.post('/closer/weekly-availability', { schedule });
            alert("Disponibilidad semanal guardada");
        } catch (err) {
            alert("Error al guardar");
        } finally {
            setSubmitting(false);
        }
    };

    // --- Event Logic ---
    const handleUpdateEvent = async (eventId, field, value) => {
        try {
            await api.patch(`/closer/events/${eventId}`, { [field]: parseInt(value) });
            setEvents(events.map(e => e.id === eventId ? { ...e, [field]: parseInt(value) } : e));
        } catch (err) {
            console.error(err);
        }
    };

    const handleCopyLink = (utmSource) => {
        if (!user) return;
        const link = `${window.location.origin}/book/${user.username}/${utmSource}`;
        navigator.clipboard.writeText(link);
        setCopiedId(utmSource);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-main gap-6">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <p className="text-muted font-black uppercase tracking-[0.3em] text-[10px]">Cargando Sistema...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-main gap-6">
            <Card variant="surface" className="p-10 text-center space-y-6 border-accent/20">
                <AlertCircle className="w-12 h-12 text-accent mx-auto" />
                <h3 className="text-xl font-black text-base italic uppercase">{error}</h3>
                <Button onClick={fetchInitialData} variant="primary">Reintentar Conexión</Button>
            </Card>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 min-h-screen">

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-base pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-3 h-10 bg-primary rounded-full shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]"></div>
                        <h1 className="text-5xl font-black text-base italic tracking-tighter uppercase leading-none">Settings Central</h1>
                    </div>
                    <p className="text-muted font-bold uppercase text-[10px] tracking-[0.45em] ml-7">Optimiza tu flujo de agendamiento</p>
                </div>

                <div className="flex bg-surface p-1.5 rounded-[2rem] border border-base backdrop-blur-3xl shadow-2xl">
                    <button
                        onClick={() => setActiveTab('availability')}
                        className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'availability' ? 'bg-primary text-white shadow-xl shadow-primary/40' : 'text-muted hover:text-base'}`}
                    >
                        <CalendarDays size={16} /> Horarios Semanales
                    </button>
                    <button
                        onClick={() => setActiveTab('links')}
                        className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'links' ? 'bg-primary text-white shadow-xl shadow-primary/40' : 'text-muted hover:text-base'}`}
                    >
                        <Zap size={16} /> Links & Embudos
                    </button>
                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'appearance' ? 'bg-primary text-white shadow-xl shadow-primary/40' : 'text-muted hover:text-base'}`}
                    >
                        <Palette size={16} /> Apariencia
                    </button>
                </div>
            </header>

            <main className="grid grid-cols-1 gap-12">

                {/* --- Availability Grid Tab --- */}
                {activeTab === 'availability' && (
                    <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">

                        {/* Quick Fill Section */}
                        <Card variant="surface" className="p-10 border-primary/10">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-base italic tracking-tighter uppercase flex items-center gap-3">
                                        <Zap className="text-primary" size={24} /> Llenado Rápido
                                    </h3>
                                    <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Establece un horario fijo para varios días a la vez</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-6">
                                    <div className="flex bg-main p-1.5 rounded-2xl border border-base">
                                        {DAYS_ES.map((day, idx) => {
                                            const isSelected = quickFill.days.includes(idx);
                                            return (
                                                <button
                                                    key={day}
                                                    onClick={() => {
                                                        const newDays = isSelected ? quickFill.days.filter(d => d !== idx) : [...quickFill.days, idx];
                                                        setQuickFill({ ...quickFill, days: newDays });
                                                    }}
                                                    className={`w-10 h-10 rounded-xl text-[10px] font-black flex items-center justify-center transition-all ${isSelected ? 'bg-primary text-white shadow-lg' : 'text-muted hover:bg-surface-hover hover:text-base'}`}
                                                >
                                                    {day.substring(0, 1)}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <input
                                            type="time"
                                            value={quickFill.start}
                                            onChange={(e) => setQuickFill({ ...quickFill, start: e.target.value })}
                                            className="bg-main border border-base rounded-xl px-4 py-2.5 text-xs font-black text-base outline-none focus:ring-1 focus:ring-primary transition-all"
                                        />
                                        <span className="text-muted font-black text-xs">A</span>
                                        <input
                                            type="time"
                                            value={quickFill.end}
                                            onChange={(e) => setQuickFill({ ...quickFill, end: e.target.value })}
                                            className="bg-main border border-base rounded-xl px-4 py-2.5 text-xs font-black text-base outline-none focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleQuickFill}
                                        variant="primary"
                                        className="h-12 px-8"
                                    >
                                        Aplicar Horario
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Interactive Grid */}
                        <Card variant="surface" className="p-10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                                <div>
                                    <h3 className="text-2xl font-black text-base italic tracking-tighter uppercase mb-2">Editor de Disponibilidad</h3>
                                    <div className="flex items-center gap-2">
                                        <Info size={12} className="text-primary" />
                                        <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Haz click en los bloques de 1.5 horas para activar tu agenda</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <Button
                                        onClick={handleResetWeekly}
                                        variant="ghost"
                                        className="h-16 px-8 border-rose-500/20 text-rose-500 hover:bg-rose-500/5"
                                        icon={Trash2}
                                    >
                                        Limpiar Todo
                                    </Button>
                                    <Button
                                        onClick={handleSaveWeekly}
                                        loading={submitting}
                                        variant="primary"
                                        className="h-16 px-12"
                                        icon={Save}
                                    >
                                        Guardar Configuración
                                    </Button>
                                </div>
                            </div>

                            <div className="relative border border-base rounded-[2.5rem] overflow-hidden bg-main/50 backdrop-blur-xl shadow-inner">
                                {/* Grid Header */}
                                <div className="grid grid-cols-8 border-b border-base">
                                    <div className="p-5 bg-surface-hover/20"></div>
                                    {DAYS_ES.map(day => (
                                        <div key={day} className="p-5 text-center border-l border-base bg-surface-hover/10">
                                            <span className="text-[11px] font-black text-primary uppercase tracking-widest">
                                                {day}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Grid Body */}
                                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                    {SLOTS.map(timeStr => (
                                        <div key={timeStr} className="grid grid-cols-8 border-b border-base/50 last:border-0 hover:bg-surface-hover/10 transition-colors">
                                            <div className="p-3 text-center flex flex-col items-center justify-center opacity-40 border-r border-base">
                                                <span className="text-[10px] font-black text-base tracking-widest">
                                                    {timeStr}
                                                </span>
                                            </div>
                                            {DAYS_ES.map((_, dayIdx) => {
                                                const active = isSlotSelected(dayIdx, timeStr);
                                                return (
                                                    <div
                                                        key={dayIdx}
                                                        onClick={() => toggleSlot(dayIdx, timeStr)}
                                                        className={`h-12 border-l border-base/30 transition-all cursor-pointer flex items-center justify-center relative group/box ${active ? 'bg-primary/20' : 'hover:bg-primary/5'}`}
                                                    >
                                                        {active && (
                                                            <div className="absolute inset-2 bg-primary rounded-lg shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] flex items-center justify-center animate-in zoom-in duration-200">
                                                                <Check size={14} className="text-white" />
                                                            </div>
                                                        )}
                                                        <div className="opacity-0 group-hover/box:opacity-100 text-[8px] font-black text-primary/50 uppercase tracking-tighter transition-opacity pointer-events-none">
                                                            {active ? 'Eliminar' : 'Activar'}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* --- Events & Links Tab --- */}
                {activeTab === 'links' && (
                    <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-500">
                        <Card variant="surface" className="p-10 border-primary/10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                                <div>
                                    <h3 className="text-3xl font-black text-base italic tracking-tighter uppercase mb-2">Herramientas Manuales</h3>
                                    <p className="text-muted text-xs font-bold uppercase tracking-widest">Registros rápidos fuera de los embudos automáticos</p>
                                </div>
                                <div className="flex gap-4">
                                    <Button
                                        as={Link}
                                        to="/closer/sales/new"
                                        variant="ghost"
                                        className="bg-success text-white border-success hover:bg-success/80 h-14 px-8"
                                        icon={DollarSign}
                                    >
                                        Declarar Venta Manual
                                    </Button>
                                    <Button
                                        as={Link}
                                        to="/closer/appointments/new"
                                        variant="primary"
                                        className="h-14 px-8"
                                        icon={Calendar}
                                    >
                                        Nueva Agenda Manual
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        <section className="space-y-10">
                            <div className="mb-4">
                                <h3 className="text-3xl font-black text-base italic tracking-tighter uppercase mb-2">Configuración de Embudos</h3>
                                <p className="text-muted text-xs font-bold uppercase tracking-widest">Personaliza la duración, descansos y obtén tus links únicos</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                                {events.length > 0 ? events.map((ev) => (
                                    <Card key={ev.id} variant="surface" className="flex flex-col justify-between group/card border-base hover:border-primary/30 transition-all duration-500 shadow-2xl p-8">

                                        <div className="space-y-8">
                                            <div className="flex items-start justify-between">
                                                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 group-hover/card:bg-primary group-hover/card:text-white transition-all shadow-inner">
                                                    <LinkIcon size={28} />
                                                </div>
                                                <Badge variant="primary" className="font-black px-4 py-1.5 uppercase items-center flex">
                                                    {ev.utm_source}
                                                </Badge>
                                            </div>

                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-black text-base italic tracking-tighter uppercase leading-none">{ev.name}</h3>
                                                <div className="h-1 w-12 bg-primary rounded-full"></div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-6 pt-4">
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Duración de Sesión</label>
                                                        <span className="text-primary text-xs font-black">{ev.duration_minutes || 30}m</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="15"
                                                        max="120"
                                                        step="15"
                                                        value={ev.duration_minutes || 30}
                                                        onChange={(e) => handleUpdateEvent(ev.id, 'duration_minutes', e.target.value)}
                                                        className="w-full h-1.5 bg-base rounded-lg appearance-none cursor-pointer accent-primary"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Descanso entre Citas</label>
                                                        <span className="text-primary/70 text-xs font-black">{ev.buffer_minutes || 0}m</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="60"
                                                        step="5"
                                                        value={ev.buffer_minutes || 0}
                                                        onChange={(e) => handleUpdateEvent(ev.id, 'buffer_minutes', e.target.value)}
                                                        className="w-full h-1.5 bg-base rounded-lg appearance-none cursor-pointer accent-primary/70"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-12 space-y-4">
                                            <div className="bg-primary/5 border border-primary/10 p-5 rounded-2xl flex flex-col gap-2 group/url cursor-default">
                                                <span className="text-[9px] font-black text-primary uppercase tracking-widest">URL de Agendamiento</span>
                                                <p className="text-[11px] text-base font-bold truncate opacity-80 italic">
                                                    {window.location.origin}/book/{user?.username}/{ev.utm_source}
                                                </p>
                                            </div>

                                            <div className="flex gap-4">
                                                <Button
                                                    onClick={() => handleCopyLink(ev.utm_source)}
                                                    variant={copiedId === ev.utm_source ? 'primary' : 'ghost'}
                                                    className={`flex-1 h-14 ${copiedId === ev.utm_source ? 'bg-success border-success' : 'border-base text-base'}`}
                                                    icon={copiedId === ev.utm_source ? Check : Copy}
                                                >
                                                    {copiedId === ev.utm_source ? 'LINK COPIADO' : 'COPIAR LINK'}
                                                </Button>
                                                <Button
                                                    as="a"
                                                    href={`/book/${user?.username}/${ev.utm_source}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    variant="primary"
                                                    className="w-14 h-14 p-0 shadow-xl shadow-primary/20"
                                                    icon={ExternalLink}
                                                />
                                            </div>
                                        </div>
                                    </Card>
                                )) : (
                                    <div className="col-span-full py-20 bg-surface/40 border border-base border-dashed rounded-[3rem] text-center space-y-4">
                                        <AlertCircle className="w-12 h-12 text-muted mx-auto" />
                                        <p className="text-muted font-black uppercase tracking-[0.2em] text-xs">No se encontraron embudos configurados</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'appearance' && (
                    <div className="animate-in slide-in-from-bottom-6 duration-500 space-y-10">
                        <Card variant="surface" className="p-10">
                            <div className="mb-12">
                                <h3 className="text-3xl font-black text-base italic tracking-tighter uppercase mb-2">Apariencia del Sistema</h3>
                                <p className="text-muted text-xs font-bold uppercase tracking-widest">Personaliza el look & feel de tu dashboard</p>
                            </div>
                            <ThemeSelector />
                        </Card>
                    </div>
                )}
            </main>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-in-from-bottom { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes zoom-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-in { animation: initial 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
                .fade-in { animation-name: fade-in; }
                .slide-in-from-bottom-6 { animation-name: slide-in-from-bottom; }
                .zoom-in { animation-name: zoom-in; }
            `}} />
        </div>
    );
};

export default CloserSettingsPage;
