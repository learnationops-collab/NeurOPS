import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
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
    DollarSign
} from 'lucide-react';

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SLOTS = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2).toString().padStart(2, '0');
    const min = (i % 2 === 0 ? '00' : '30');
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
        let endH = h;
        let endM = m + 30;
        if (endM === 60) {
            endH += 1;
            endM = 0;
        }
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
                    let endH = h;
                    let endM = min + 30;
                    if (endM === 60) { endH += 1; endM = 0; }
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-black gap-6">
            <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Cargando Sistema...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black gap-6">
            <div className="p-10 bg-rose-500/10 border border-rose-500/20 rounded-[3rem] text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-xl font-black text-white italic uppercase">{error}</h3>
                <button
                    onClick={fetchInitialData}
                    className="px-8 py-3 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                    Reintentar Conexión
                </button>
            </div>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 bg-black min-h-screen">

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-3 h-10 bg-gradient-to-b from-indigo-500 to-blue-600 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)]"></div>
                        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Settings Central</h1>
                    </div>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.45em] ml-7">Optimiza tu flujo de agendamiento</p>
                </div>

                <div className="flex bg-slate-900/40 p-1.5 rounded-[2rem] border border-white/5 backdrop-blur-3xl shadow-2xl">
                    <button
                        onClick={() => setActiveTab('availability')}
                        className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'availability' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' : 'text-slate-500 hover:text-white'}`}
                    >
                        <CalendarDays size={16} /> Horarios Semanales
                    </button>
                    <button
                        onClick={() => setActiveTab('links')}
                        className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'links' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' : 'text-slate-500 hover:text-white'}`}
                    >
                        <Zap size={16} /> Links & Embudos
                    </button>
                </div>
            </header>

            <main className="grid grid-cols-1 gap-12">

                {/* --- Availability Grid Tab --- */}
                {activeTab === 'availability' && (
                    <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">

                        {/* Quick Fill Section */}
                        <section className="bg-gradient-to-br from-slate-900/40 to-indigo-950/10 rounded-[3rem] border border-white/5 p-10 backdrop-blur-2xl shadow-2xl">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                                        <Zap className="text-indigo-500" size={24} /> Llenado Rápido
                                    </h3>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Establece un horario fijo para varios días a la vez</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-6">
                                    <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                                        {DAYS_ES.map((day, idx) => {
                                            const isSelected = quickFill.days.includes(idx);
                                            return (
                                                <button
                                                    key={day}
                                                    onClick={() => {
                                                        const newDays = isSelected ? quickFill.days.filter(d => d !== idx) : [...quickFill.days, idx];
                                                        setQuickFill({ ...quickFill, days: newDays });
                                                    }}
                                                    className={`w-10 h-10 rounded-xl text-[10px] font-black flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}
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
                                            className="bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                                        />
                                        <span className="text-slate-600 font-black text-xs">A</span>
                                        <input
                                            type="time"
                                            value={quickFill.end}
                                            onChange={(e) => setQuickFill({ ...quickFill, end: e.target.value })}
                                            className="bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                                        />
                                    </div>

                                    <button
                                        onClick={handleQuickFill}
                                        className="px-8 h-12 bg-white text-black hover:bg-indigo-50 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-xl"
                                    >
                                        Aplicar Horario
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Interactive Grid */}
                        <section className="bg-slate-900/20 rounded-[3rem] border border-white/5 p-10 relative overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                                <div>
                                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Editor de Disponibilidad</h3>
                                    <div className="flex items-center gap-2">
                                        <Info size={12} className="text-indigo-400" />
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Haz click en los bloques de 30 minutos para activar tu agenda</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveWeekly}
                                    disabled={submitting}
                                    className="px-12 h-16 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest flex items-center gap-4 transition-all active:scale-95 shadow-[0_20px_40px_rgba(79,70,229,0.3)] border border-indigo-400/20"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Guardar Configuración</>}
                                </button>
                            </div>

                            <div className="relative border border-white/5 rounded-[2.5rem] overflow-hidden bg-slate-950/40 backdrop-blur-xl shadow-inner">
                                {/* Grid Header */}
                                <div className="grid grid-cols-8 border-b border-white/5">
                                    <div className="p-5 bg-white/[0.02]"></div>
                                    {DAYS_ES.map(day => (
                                        <div key={day} className="p-5 text-center border-l border-white/5 bg-white/[0.01]">
                                            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">
                                                {day}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Grid Body */}
                                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                    {SLOTS.map(timeStr => (
                                        <div key={timeStr} className="grid grid-cols-8 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01] transition-colors">
                                            <div className="p-3 text-center flex flex-col items-center justify-center opacity-40 border-r border-white/5">
                                                <span className="text-[10px] font-black text-white tracking-widest">
                                                    {timeStr}
                                                </span>
                                            </div>
                                            {DAYS_ES.map((_, dayIdx) => {
                                                const active = isSlotSelected(dayIdx, timeStr);
                                                return (
                                                    <div
                                                        key={dayIdx}
                                                        onClick={() => toggleSlot(dayIdx, timeStr)}
                                                        className={`h-12 border-l border-white/[0.02] transition-all cursor-pointer flex items-center justify-center relative group/box ${active ? 'bg-indigo-600/20' : 'hover:bg-indigo-500/5'}`}
                                                    >
                                                        {active && (
                                                            <div className="absolute inset-2 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center justify-center animate-in zoom-in duration-200">
                                                                <Check size={14} className="text-white" />
                                                            </div>
                                                        )}
                                                        <div className="opacity-0 group-hover/box:opacity-100 text-[8px] font-black text-indigo-400/50 uppercase tracking-tighter transition-opacity pointer-events-none">
                                                            {active ? 'Eliminar' : 'Activar'}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* --- Events & Links Tab --- */}
                {activeTab === 'links' && (
                    <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-500">
                        <section className="bg-slate-900/40 p-10 rounded-[3rem] border border-white/5 backdrop-blur-3xl shadow-2xl">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                                <div>
                                    <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Herramientas Manuales</h3>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Registros rápidos fuera de los embudos automáticos</p>
                                </div>
                                <div className="flex gap-4">
                                    <Link
                                        to="/closer/sales/new"
                                        className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                                    >
                                        <DollarSign size={16} /> Declarar Venta Manual
                                    </Link>
                                    <Link
                                        to="/closer/leads"
                                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-indigo-900/20"
                                    >
                                        <Calendar size={16} /> Nueva Agenda Manual
                                    </Link>
                                </div>
                            </div>
                        </section>

                        <section className="bg-slate-900/40 p-10 rounded-[3rem] border border-white/5 backdrop-blur-3xl shadow-2xl">
                            <div className="mb-12">
                                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Configuración de Embudos</h3>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Personaliza la duración, descansos y obtén tus links únicos</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                                {events.length > 0 ? events.map((ev) => (
                                    <div key={ev.id} className="relative group/card bg-black/40 border border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-500 shadow-2xl">

                                        <div className="space-y-8">
                                            <div className="flex items-start justify-between">
                                                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 border border-indigo-500/20 group-hover/card:bg-indigo-600 group-hover/card:text-white transition-all shadow-inner">
                                                    <LinkIcon size={28} />
                                                </div>
                                                <div className="px-4 py-1.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-black rounded-full border border-indigo-500/20 uppercase tracking-widest">
                                                    {ev.utm_source}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">{ev.name}</h3>
                                                <div className="h-1 w-12 bg-indigo-600 rounded-full"></div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-6 pt-4">
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Duración de Sesión</label>
                                                        <span className="text-indigo-400 text-xs font-black">{ev.duration_minutes || 30}m</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="15"
                                                        max="120"
                                                        step="15"
                                                        value={ev.duration_minutes || 30}
                                                        onChange={(e) => handleUpdateEvent(ev.id, 'duration_minutes', e.target.value)}
                                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Descanso entre Citas</label>
                                                        <span className="text-blue-400 text-xs font-black">{ev.buffer_minutes || 0}m</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="60"
                                                        step="5"
                                                        value={ev.buffer_minutes || 0}
                                                        onChange={(e) => handleUpdateEvent(ev.id, 'buffer_minutes', e.target.value)}
                                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-12 space-y-4">
                                            <div className="bg-indigo-950/20 border border-indigo-500/10 p-5 rounded-2xl flex flex-col gap-2 group/url cursor-default">
                                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">URL de Agendamiento</span>
                                                <p className="text-[11px] text-white font-bold truncate opacity-80 italic">
                                                    {window.location.origin}/book/{user?.username}/{ev.utm_source}
                                                </p>
                                            </div>

                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => handleCopyLink(ev.utm_source)}
                                                    className={`flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 ${copiedId === ev.utm_source
                                                        ? 'bg-green-600 text-white shadow-lg'
                                                        : 'bg-white text-black hover:bg-slate-200 shadow-xl'
                                                        }`}
                                                >
                                                    {copiedId === ev.utm_source ? <Check size={18} /> : <Copy size={18} />}
                                                    {copiedId === ev.utm_source ? 'LINK COPIADO' : 'COPIAR LINK'}
                                                </button>
                                                <a
                                                    href={`/book/${user?.username}/${ev.utm_source}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-xl shadow-indigo-900/20"
                                                >
                                                    <ExternalLink size={20} />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-20 bg-black/40 border border-white/5 rounded-[3rem] text-center space-y-4 border-dashed">
                                        <AlertCircle className="w-12 h-12 text-slate-700 mx-auto" />
                                        <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">No se encontraron embudos configurados</p>
                                    </div>
                                )}
                            </div>
                        </section>
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
