import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
    Calendar,
    Clock,
    User,
    Mail,
    Phone,
    CheckCircle2,
    Loader2,
    AlertCircle,
    ChevronRight,
    ChevronLeft,
    CheckCircle,
    Globe,
    CalendarDays,
    Instagram,
    ChevronDown
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const COUNTRY_CODES = [
    { code: '+54', country: 'Argentina', flag: '🇦🇷' },
    { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
    { code: '+55', country: 'Brasil', flag: '🇧🇷' },
    { code: '+56', country: 'Chile', flag: '🇨🇱' },
    { code: '+57', country: 'Colombia', flag: '🇨🇴' },
    { code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
    { code: '+53', country: 'Cuba', flag: '🇨🇺' },
    { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
    { code: '+503', country: 'El Salvador', flag: '🇸🇻' },
    { code: '+34', country: 'España', flag: '🇪🇸' },
    { code: '+1', country: 'Estados Unidos', flag: '🇺🇸' },
    { code: '+502', country: 'Guatemala', flag: '🇬🇹' },
    { code: '+504', country: 'Honduras', flag: '🇭🇳' },
    { code: '+52', country: 'México', flag: '🇲🇽' },
    { code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
    { code: '+507', country: 'Panamá', flag: '🇵🇦' },
    { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
    { code: '+51', country: 'Perú', flag: '🇵🇪' },
    { code: '+1', country: 'Puerto Rico', flag: '🇵🇷' },
    { code: '+1', country: 'Rep. Dominicana', flag: '🇩🇴' },
    { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
    { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
];

const BookingPage = () => {
    const { username, event_slug } = useParams();
    const [searchParams] = useSearchParams();

    // States
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [emailChecking, setEmailChecking] = useState(false);
    const [clientId, setClientId] = useState(null);
    const [bookedCloser, setBookedCloser] = useState('');
    const [redirectUrl, setRedirectUrl] = useState(null);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        let timer;
        if (success && redirectUrl) {
            timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        handleFinalize();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [success, redirectUrl]);

    // Data from API
    const [eventInfo, setEventInfo] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [closerName, setCloserName] = useState('');

    // Grouping availability by date
    // Grouping availability by date (LOCAL USER TIMEZONE)
    const groupedAvailability = useMemo(() => {
        const groups = {};
        availability.forEach(slot => {
            // Parse UTC ISO string
            const dateObj = new Date(slot.utc_iso);

            // Format to YYYY-MM-DD in local time for grouping
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const localDateKey = `${year}-${month}-${day}`;

            // Format to HH:mm in local time for display
            const localStart = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

            if (!groups[localDateKey]) groups[localDateKey] = [];
            groups[localDateKey].push({
                ...slot,
                localStart,
                // We keep original slot data for backend submission, but display local stuff
                localDateKey
            });
        });

        // Sort slots within days
        Object.keys(groups).forEach(dateKey => {
            groups[dateKey].sort((a, b) => a.ts - b.ts);
        });

        return groups;
    }, [availability]);

    const availableDates = useMemo(() => Object.keys(groupedAvailability).sort(), [groupedAvailability]);
    const [selectedDate, setSelectedDate] = useState(null);

    // Form States
    const [contactData, setContactData] = useState({ name: '', email: '', phone: '', instagram: '' });
    const [phonePrefix, setPhonePrefix] = useState('+54');
    const [surveyAnswers, setSurveyAnswers] = useState({});
    const [selectedSlot, setSelectedSlot] = useState(null);

    useEffect(() => {
        fetchFunnelData();
    }, [username, event_slug]);

    useEffect(() => {
        if (availableDates.length > 0 && !selectedDate) {
            setSelectedDate(availableDates[0]);
        }
    }, [availableDates, selectedDate]);

    const fetchFunnelData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/public/funnel/${event_slug}`);
            setEventInfo(res.data.event);
            setQuestions(res.data.questions);
            setAvailability(res.data.availability);
            setCloserName(res.data.closer_name);
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || err.message || "Error al conectar con el servidor.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailNext = async () => {
        if (!contactData.email) return;
        setEmailChecking(true);
        setError(null);
        try {
            const res = await api.post('/public/clients/check', { email: contactData.email });
            if (res.data.exists) {
                setClientId(res.data.client.id);

                const fullPhone = res.data.client.phone || '';
                let matchedPrefix = '+54';
                let subscriberNumber = fullPhone.replace(/\D/g, '');

                // Find matching prefix (longest match first)
                const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
                for (const c of sortedCodes) {
                    if (fullPhone.startsWith(c.code)) {
                        matchedPrefix = c.code;
                        subscriberNumber = fullPhone.slice(c.code.length).replace(/\D/g, '');
                        break;
                    }
                }

                setPhonePrefix(matchedPrefix);
                setContactData(prev => ({
                    ...prev,
                    name: res.data.client.full_name || prev.name,
                    phone: subscriberNumber,
                    instagram: res.data.client.instagram || prev.instagram
                }));

                if (res.data.client.survey_answers) {
                    setSurveyAnswers(res.data.client.survey_answers);
                }
            }
            setCurrentStep(2);
        } catch (err) {
            setError("Error verificando email. Intenta de nuevo.");
        } finally {
            setEmailChecking(false);
        }
    };

    const nextStep = async () => {
        if (currentStep === 2) {
            // Step 2 to 3: Save Lead Info
            try {
                const res = await api.post('/public/submit-lead', {
                    ...contactData,
                    phone: `${phonePrefix} ${contactData.phone.replace(/\D/g, '')}`
                });
                if (res.data.id) setClientId(res.data.id);

                if (questions.length === 0) setCurrentStep(4);
                else setCurrentStep(3);
            } catch (err) {
                console.error("Error saving lead info:", err);
                // Continue anyway to not block user, but maybe show warning?
                if (questions.length === 0) setCurrentStep(4);
                else setCurrentStep(3);
            }
        } else if (currentStep === 3) {
            // Step 3 to 4: Save Survey Answers
            try {
                if (clientId) {
                    const answers = Object.entries(surveyAnswers).map(([qId, val]) => ({
                        question_id: parseInt(qId),
                        answer: val
                    }));
                    if (answers.length > 0) {
                        await api.post('/public/submit-survey', { client_id: clientId, answers });
                    }
                }
                setCurrentStep(4);
            } catch (err) {
                console.error("Error saving survey answers:", err);
                setCurrentStep(4); // Move forward anyway so the lead isn't blocked
            }
        }
    };

    const prevStep = () => {
        if (currentStep === 4) {
            if (questions.length === 0) setCurrentStep(2);
            else setCurrentStep(3);
        } else if (currentStep === 3) {
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(1);
        }
    };

    const handleBook = async () => {
        if (!selectedSlot) return;
        setBooking(true);
        setError(null);
        try {
            const payload = {
                ...contactData,
                phone: `${phonePrefix} ${contactData.phone.replace(/\D/g, '')}`,
                timestamp: selectedSlot.ts,
                event_id: eventInfo.id,
                closer_id: selectedSlot.closer_id,
                survey_answers: surveyAnswers,
                utm_source: searchParams.get('utm_source') || eventInfo.utm_source,
                utm_medium: searchParams.get('utm_medium'),
                utm_campaign: searchParams.get('utm_campaign')
            };
            const res = await api.post(`/public/book`, payload);
            if (res.data.closer_name) setBookedCloser(res.data.closer_name);
            if (res.data.redirect_url) setRedirectUrl(res.data.redirect_url);

            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.error || "Error al confirmar el agendamiento.");
        } finally {
            setBooking(false);
        }
    };

    const handleFinalize = () => {
        if (redirectUrl) {
            let target = redirectUrl;
            if (target.includes('.') && !target.startsWith('http') && !target.startsWith('/')) {
                target = 'https://' + target;
            }
            window.location.href = target;
        } else {
            window.location.reload();
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-main flex flex-col items-center justify-center gap-6">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-muted font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Cargando Experiencia...</p>
        </div>
    );

    if (success) return (
        <div className="min-h-screen bg-main flex items-center justify-center p-6">
            <Card variant="surface" className="max-w-md w-full p-12 text-center border-success/20 shadow-2xl backdrop-blur-3xl animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-success/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-success/20 shadow-[0_0_30px_rgba(var(--success-rgb),0.1)]">
                    <CheckCircle2 className="w-14 h-14 text-success" />
                </div>
                <h1 className="text-4xl font-black text-base italic mb-4 uppercase tracking-tighter">¡BRUTAL!</h1>
                <p className="text-muted mb-6 font-bold uppercase text-[10px] tracking-widest">
                    Tu sesión con <span className="text-primary font-black">@{bookedCloser || username}</span> ha sido reservada.
                </p>
                {redirectUrl && (
                    <p className="text-[10px] font-black text-primary animate-pulse mb-6 uppercase tracking-[0.2em]">
                        Redirigiendo en {countdown} segundos...
                    </p>
                )}

                <div className="bg-main/50 p-8 rounded-[2rem] border border-base mb-10 text-left space-y-4 shadow-inner">
                    <div className="flex items-center gap-4 text-sm">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="text-base font-black italic">{selectedSlot ? new Date(selectedSlot.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <Clock className="w-5 h-5 text-primary" />
                        <span className="text-base font-black italic">{selectedSlot?.start} HS</span>
                    </div>
                </div>
                <Button
                    onClick={handleFinalize}
                    variant="primary"
                    className="w-full h-18 text-base tracking-widest font-black"
                    type="button"
                >
                    CONTINUAR
                </Button>
            </Card>
        </div>
    );

    return (
        <div className="min-h-screen bg-main text-base flex flex-col font-sans selection:bg-primary/30">
            <div className="max-w-2xl mx-auto w-full p-6 md:p-12 flex-1 flex flex-col justify-center">

                {error && (
                    <div className="mb-10 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-500 animate-in fade-in zoom-in-95 duration-500">
                        <AlertCircle className="w-8 h-8 shrink-0" />
                        <div className="space-y-1">
                            <p className="font-black uppercase tracking-widest text-xs">Error</p>
                            <p className="text-[10px] font-medium opacity-80 uppercase tracking-tight">{error}</p>
                        </div>
                    </div>
                )}

                {/* Stepper */}
                <div className="flex items-center justify-between mb-16 gap-3">
                    {[1, 2, 3, 4].map((step) => {
                        const isCompleted = currentStep > step;
                        const isActive = currentStep === step;
                        const stepLabels = ["Email", "Datos", "Encuesta", "Reserva"];
                        return (
                            <div key={step} className="flex-1 flex flex-col items-center gap-3">
                                <div className={`h-1.5 w-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-primary' : isActive ? 'bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.6)]' : 'bg-base'
                                    }`} />
                                <span className={`text-[8px] font-black uppercase tracking-[0.2em] whitespace-nowrap ${isActive ? 'text-primary' : 'text-muted'
                                    }`}>{stepLabels[step - 1]}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Step 1: Email Entry */}
                {currentStep === 1 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <header className="text-center space-y-3">
                            <h2 className="text-5xl font-black text-base italic uppercase tracking-tighter leading-none">BIENVENIDO</h2>
                            <p className="text-muted font-black uppercase text-[10px] tracking-[0.5em] ml-1">Ingresa tu correo para continuar</p>
                        </header>

                        <Card variant="surface" className="p-10 shadow-2xl space-y-8">
                            <FormInput
                                label="Email Corporativo"
                                type="email"
                                icon={<Mail size={20} />}
                                placeholder="tu@negocio.com"
                                value={contactData.email}
                                onChange={(v) => setContactData({ ...contactData, email: v })}
                            />

                            <Button
                                onClick={handleEmailNext}
                                disabled={!contactData.email || emailChecking}
                                loading={emailChecking}
                                variant="primary"
                                className="w-full h-18 text-base tracking-widest"
                                icon={ChevronRight}
                                type="button"
                            >
                                CONTINUAR
                            </Button>
                        </Card>
                    </div>
                )}

                {/* Step 2: Full Contact Info */}
                {currentStep === 2 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
                        <header className="text-center space-y-3">
                            <h2 className="text-5xl font-black text-base italic uppercase tracking-tighter leading-none">TUS DATOS</h2>
                            <p className="text-muted font-black uppercase text-[10px] tracking-[0.5em] ml-1">Completa tu perfil</p>
                        </header>

                        <Card variant="surface" className="p-10 shadow-2xl space-y-8">
                            <div className="space-y-6">
                                <FormInput
                                    label="Nombre Completo"
                                    icon={<User size={20} />}
                                    placeholder="Nombre y Apellido"
                                    value={contactData.name}
                                    onChange={(v) => setContactData({ ...contactData, name: v })}
                                />

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">WhatsApp</label>
                                    <div className="flex gap-3">
                                        <select
                                            className="bg-main border border-base rounded-2xl px-4 text-xs font-black outline-none focus:ring-2 focus:ring-primary/50"
                                            value={phonePrefix}
                                            onChange={(e) => setPhonePrefix(e.target.value)}
                                        >
                                            {COUNTRY_CODES.map(c => <option key={c.code + c.country} value={c.code}>{c.flag} {c.code}</option>)}
                                        </select>
                                        <input
                                            type="tel"
                                            className="flex-1 bg-main border border-base rounded-2xl py-5 px-6 text-base outline-none focus:ring-2 focus:ring-primary/50 font-black"
                                            placeholder="123456789"
                                            value={contactData.phone}
                                            onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <FormInput
                                    label="Instagram"
                                    icon={<Instagram size={20} />}
                                    placeholder="@usuario"
                                    value={contactData.instagram}
                                    onChange={(v) => setContactData({ ...contactData, instagram: v })}
                                />
                            </div>

                            <div className="flex gap-6">
                                <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border-base" icon={ChevronLeft} type="button" />
                                <Button
                                    onClick={nextStep}
                                    disabled={!contactData.name || !contactData.phone || !contactData.instagram}
                                    variant="primary"
                                    className="flex-1 h-18 text-base tracking-widest"
                                    icon={ChevronRight}
                                    type="button"
                                >
                                    SIGUIENTE
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Step 3: Survey */}
                {currentStep === 3 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
                        <header className="text-center space-y-3">
                            <h2 className="text-5xl font-black text-base italic uppercase tracking-tighter leading-none">ENCUESTA</h2>
                            <p className="text-muted font-black uppercase text-[10px] tracking-[0.5em] ml-1">Casi terminamos</p>
                        </header>

                        <Card variant="surface" className="p-10 shadow-2xl space-y-8 max-h-[50vh] overflow-y-auto custom-scrollbar">
                            {questions.map((q) => (
                                <div key={q.id} className="space-y-4">
                                    <label className="text-[11px] font-black text-muted uppercase tracking-widest">{q.text}</label>
                                    {q.type === 'select' ? (
                                        <select
                                            className="w-full bg-main border border-base rounded-2xl py-5 px-6 text-base outline-none focus:ring-2 focus:ring-primary/50 font-black appearance-none cursor-pointer"
                                            value={surveyAnswers[q.id] || ''}
                                            onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [q.id]: e.target.value })}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {Array.isArray(q.options)
                                                ? q.options.map(opt => <option key={opt.text} value={opt.text}>{opt.text}</option>)
                                                : q.options?.split(',').map(opt => <option key={opt} value={opt}>{opt}</option>)
                                            }
                                        </select>
                                    ) : (
                                        <input
                                            type={q.type}
                                            className="w-full bg-main border border-base rounded-2xl py-5 px-6 text-base outline-none focus:ring-2 focus:ring-primary/50 font-black"
                                            value={surveyAnswers[q.id] || ''}
                                            onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [q.id]: e.target.value })}
                                        />
                                    )}
                                </div>
                            ))}
                        </Card>

                        <div className="flex gap-6">
                            <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border-base" icon={ChevronLeft} type="button" />
                            <Button onClick={nextStep} variant="primary" className="flex-1 h-18 text-base tracking-widest" icon={ChevronRight} type="button">
                                CONTINUAR
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Booking */}
                {currentStep === 4 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
                        <header className="text-center space-y-3">
                            <h2 className="text-5xl font-black text-base italic uppercase tracking-tighter leading-none">RESERVAR</h2>
                            <div className="flex items-center justify-center gap-4 text-muted font-black uppercase text-[10px] tracking-[0.3em]">
                                <Clock size={12} className="text-primary" />
                                <span>{eventInfo?.duration} MIN</span>
                                <Globe size={12} className="text-primary" />
                                <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                            </div>
                        </header>

                        <Card variant="surface" className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 shadow-2xl">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-muted uppercase tracking-widest">Fecha</h4>
                                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {availableDates.map(dateStr => {
                                        const d = new Date(dateStr + "T00:00:00");
                                        const isActive = selectedDate === dateStr;
                                        return (
                                            <button
                                                key={dateStr}
                                                onClick={() => setSelectedDate(dateStr)}
                                                className={`p-4 rounded-xl border text-left transition-all ${isActive ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted'}`}
                                            >
                                                <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{d.toLocaleDateString('es-ES', { weekday: 'long' })}</p>
                                                <p className="font-black italic text-sm">{d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-muted uppercase tracking-widest">Hora</h4>
                                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {groupedAvailability[selectedDate]?.map(slot => (
                                        <button
                                            key={slot.ts}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`p-3 rounded-xl border text-center text-xs font-black transition-all ${selectedSlot?.ts === slot.ts ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-muted'}`}
                                        >
                                            {slot.localStart}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        <div className="flex gap-6">
                            <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border-base" icon={ChevronLeft} type="button" />
                            <Button
                                onClick={handleBook}
                                disabled={!selectedSlot || booking}
                                loading={booking}
                                variant="primary"
                                className="flex-1 h-18 text-base tracking-widest font-black"
                                type="button"
                            >
                                AGENDAR {eventInfo?.duration} MIN
                            </Button>
                        </div>
                    </div>
                )}

                <footer className="mt-20 text-center space-y-2 opacity-30">
                    <p className="text-[8px] font-black text-muted uppercase tracking-[0.4em]">NeurOPS Intelligent Scheduling System</p>
                </footer>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--primary-rgb), 0.2); border-radius: 10px; }
            `}} />
        </div>
    );
};

const FormInput = ({ label, icon, placeholder, value, onChange, type = "text" }) => (
    <div className="space-y-3">
        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{label}</label>
        <div className="relative group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted/50 group-focus-within:text-primary transition-colors">
                {icon}
            </div>
            <input
                type={type}
                className="w-full bg-main border border-base rounded-2xl py-5 pl-16 pr-6 text-base outline-none focus:ring-2 focus:ring-primary/50 transition-all font-black placeholder:text-muted/20"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    </div>
);

export default BookingPage;
