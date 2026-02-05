import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';
import ThemeSelector from '../../../components/ui/ThemeSelector';
import GoogleCalendarSettings from '../../../components/GoogleCalendarSettings';
import { useTheme } from '../../../context/ThemeContext';
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
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SLOTS = Array.from({ length: 16 }, (_, i) => {
    const totalMinutes = i * 90;
    const hour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const min = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hour}:${min}`;
});

const BackgroundPicker = () => {
    const {
        backgroundType, setBackgroundType,
        customBackground, setCustomBackground,
        stockBackground, setStockBackground
    } = useTheme();

    const stockImages = [
        { name: 'Abstract Blue', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop' },
        { name: 'Cyberpunk City', url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=2670&auto=format&fit=crop' },
        { name: 'Minimal Mountain', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2670&auto=format&fit=crop' },
        { name: 'Dark Nebula', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2522&auto=format&fit=crop' },
        { name: 'Glass Geometry', url: 'https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?q=80&w=2532&auto=format&fit=crop' }
    ];

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCustomBackground(reader.result);
                setBackgroundType('custom');
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-12">
            <div className="flex gap-4 p-1.5 bg-main/50 rounded-2xl border border-base max-w-fit">
                {[
                    { id: 'theme', label: 'TEMA ORIGINAL', icon: Palette },
                    { id: 'stock', label: 'GALERÍA STOCK', icon: Layers },
                    { id: 'custom', label: 'PERSONALIZADO', icon: Plus }
                ].map(type => (
                    <button
                        key={type.id}
                        onClick={() => setBackgroundType(type.id)}
                        className={`
                            px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                            ${backgroundType === type.id ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-base'}
                        `}
                    >
                        <type.icon size={14} />
                        {type.label}
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in zoom-in duration-500">
                {backgroundType === 'theme' && (
                    <div className="p-10 border border-dashed border-base rounded-[3rem] text-center space-y-4">
                        <Info className="w-10 h-10 text-muted mx-auto" />
                        <p className="text-muted font-black uppercase tracking-widest text-[10px]">Utilizando los colores definidos por el tema actual</p>
                    </div>
                )}

                {backgroundType === 'stock' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        {stockImages.map(img => (
                            <button
                                key={img.url}
                                onClick={() => setStockBackground(img.url)}
                                className={`
                                    group relative aspect-video rounded-2xl overflow-hidden border-2 transition-all
                                    ${stockBackground === img.url ? 'border-primary scale-95 ring-4 ring-primary/20' : 'border-base hover:border-white/20'}
                                `}
                            >
                                <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                                    <p className="text-[8px] font-black text-white uppercase tracking-tighter">{img.name}</p>
                                </div>
                                {stockBackground === img.url && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                        <div className="bg-primary text-white p-1.5 rounded-full shadow-xl">
                                            <Check size={16} strokeWidth={4} />
                                        </div>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {backgroundType === 'custom' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <label className="flex flex-col items-center justify-center aspect-video p-10 border-2 border-dashed border-base hover:border-primary/50 rounded-[3rem] cursor-pointer transition-all group bg-main/20">
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-xl">
                                <Plus size={32} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted group-hover:text-base">Subir Imagen Nueva</span>
                        </label>

                        {customBackground && (
                            <div className="relative aspect-video rounded-[3rem] overflow-hidden border-2 border-primary shadow-2xl">
                                <img src={customBackground} alt="Custom Background" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                    <div className="bg-primary text-white px-6 py-2 rounded-full font-black text-[10px] tracking-widest shadow-2xl">VISTA PREVIA ACTIVA</div>
                                </div>
                                <button
                                    onClick={() => setCustomBackground(null)}
                                    className="absolute top-6 right-6 p-3 bg-rose-500 text-white rounded-2xl shadow-xl hover:bg-rose-600 transition-all"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const CloserSettingsPage = () => {
    const [availability, setAvailability] = useState([]);
    const [weeklySchedule, setWeeklySchedule] = useState({});
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('availability');
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    const [quickFill, setQuickFill] = useState({
        days: [0, 1, 2, 3, 4],
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
            if (slots.length > 0) newSchedule[dayStr] = slots;
        });
        setWeeklySchedule(newSchedule);
    };

    const handleResetWeekly = () => {
        if (window.confirm("¿Estás seguro?")) setWeeklySchedule({});
    };

    const handleSaveWeekly = async () => {
        setSubmitting(true);
        try {
            const schedule = Object.entries(weeklySchedule).map(([day, slots]) => ({
                day: parseInt(day),
                slots: slots.sort((a, b) => a.start.localeCompare(b.start))
            }));
            await api.post('/closer/weekly-availability', { schedule });
            alert("Guardado.");
        } catch (err) {
            alert("Error.");
        } finally {
            setSubmitting(false);
        }
    };

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
            <p className="text-muted font-black uppercase tracking-[0.3em] text-[10px]">Cargando...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-main gap-6">
            <Card variant="surface" className="p-10 text-center space-y-6">
                <AlertCircle className="w-12 h-12 text-accent mx-auto" />
                <h3 className="text-xl font-black text-base uppercase">{error}</h3>
                <Button onClick={fetchInitialData} variant="primary">Reintentar</Button>
            </Card>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-base pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-3 h-10 bg-primary rounded-full"></div>
                        <h1 className="text-5xl font-black text-base italic tracking-tighter uppercase leading-none">Settings Central</h1>
                    </div>
                    <p className="text-muted font-bold uppercase text-[10px] tracking-[0.45em] ml-7">Optimiza tu flujo</p>
                </div>

                <div className="flex bg-surface p-1.5 rounded-[2rem] border border-base backdrop-blur-3xl shadow-2xl">
                    <button onClick={() => setActiveTab('availability')} className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'availability' ? 'bg-primary text-white' : 'text-muted'}`}>Disponibilidad</button>
                    <button onClick={() => setActiveTab('links')} className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'links' ? 'bg-primary text-white' : 'text-muted'}`}>Links</button>
                    <button onClick={() => setActiveTab('appearance')} className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'appearance' ? 'bg-primary text-white' : 'text-muted'}`}>Apariencia</button>
                    <button onClick={() => setActiveTab('integrations')} className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'integrations' ? 'bg-primary text-white' : 'text-muted'}`}>Integraciones</button>
                </div>
            </header>

            <main className="grid grid-cols-1 gap-12">
                {activeTab === 'availability' && (
                    <div className="space-y-10">
                        <Card variant="surface" className="p-10 border-primary/10">
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="flex bg-main p-1.5 rounded-2xl border border-base">
                                    {DAYS_ES.map((day, idx) => (
                                        <button key={day} onClick={() => {
                                            const newDays = quickFill.days.includes(idx) ? quickFill.days.filter(d => d !== idx) : [...quickFill.days, idx];
                                            setQuickFill({ ...quickFill, days: newDays });
                                        }} className={`w-10 h-10 rounded-xl text-[10px] font-black ${quickFill.days.includes(idx) ? 'bg-primary text-white' : 'text-muted'}`}>{day[0]}</button>
                                    ))}
                                </div>
                                <input type="time" value={quickFill.start} onChange={e => setQuickFill({ ...quickFill, start: e.target.value })} className="bg-main border border-base rounded-xl px-4 py-2.5" />
                                <input type="time" value={quickFill.end} onChange={e => setQuickFill({ ...quickFill, end: e.target.value })} className="bg-main border border-base rounded-xl px-4 py-2.5" />
                                <Button onClick={handleQuickFill} variant="primary">Aplicar</Button>
                            </div>
                        </Card>

                        <Card variant="surface" className="p-10">
                            <div className="flex flex-wrap gap-4 mb-8">
                                <Button onClick={handleResetWeekly} variant="ghost" className="text-rose-500">Limpiar</Button>
                                <Button onClick={handleSaveWeekly} loading={submitting} variant="primary">Guardar</Button>
                            </div>
                            <div className="border border-base rounded-[2.5rem] overflow-hidden">
                                <div className="grid grid-cols-8 border-b border-base bg-surface-hover/10">
                                    <div className="p-5"></div>
                                    {DAYS_ES.map(d => <div key={d} className="p-5 text-center font-black text-[11px] uppercase">{d}</div>)}
                                </div>
                                <div className="max-h-[600px] overflow-y-auto">
                                    {SLOTS.map(t => (
                                        <div key={t} className="grid grid-cols-8 border-b border-base/50 last:border-0 hover:bg-surface-hover/5">
                                            <div className="p-3 text-center border-r border-base text-[10px] font-black opacity-40">{t}</div>
                                            {DAYS_ES.map((_, idx) => (
                                                <div key={idx} onClick={() => toggleSlot(idx, t)} className={`h-12 border-l border-base/30 cursor-pointer ${isSlotSelected(idx, t) ? 'bg-primary/20' : ''}`}>
                                                    {isSlotSelected(idx, t) && <div className="h-full w-full bg-primary/40 flex items-center justify-center"><Check size={14} className="text-white" /></div>}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'links' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {events.map(ev => (
                            <Card key={ev.id} variant="surface" className="p-8 space-y-6">
                                <h3 className="text-2xl font-black uppercase tracking-tighter italic">{ev.name}</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-muted">Duración:</span>
                                        <span className="text-primary font-black">{ev.duration_minutes}m</span>
                                    </div>
                                    <input type="range" min="15" max="120" step="15" value={ev.duration_minutes} onChange={e => handleUpdateEvent(ev.id, 'duration_minutes', e.target.value)} className="w-full accent-primary" />
                                </div>
                                <Button onClick={() => handleCopyLink(ev.utm_source)} variant={copiedId === ev.utm_source ? 'primary' : 'ghost'} className="w-full h-12">
                                    {copiedId === ev.utm_source ? 'COPIADO' : 'COPIAR LINK'}
                                </Button>
                            </Card>
                        ))}
                    </div>
                )}

                {activeTab === 'appearance' && (
                    <div className="space-y-12">
                        <Card variant="surface" className="p-10 border-base shadow-2xl">
                            <h3 className="text-3xl font-black italic uppercase mb-8">Temas del Sistema</h3>
                            <ThemeSelector />
                        </Card>
                        <Card variant="surface" className="p-10 border-base shadow-2xl">
                            <h3 className="text-3xl font-black italic uppercase mb-8">Fondo de Pantalla</h3>
                            <BackgroundPicker />
                        </Card>
                    </div>
                )}

                {activeTab === 'integrations' && (
                    <Card variant="surface" className="p-10">
                        <h3 className="text-3xl font-black italic uppercase mb-8">Google Calendar</h3>
                        <GoogleCalendarSettings />
                    </Card>
                )}
            </main>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .animate-in { animation: initial 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .fade-in { animation-name: fade-in; }
            `}} />
        </div>
    );
};

export default CloserSettingsPage;
