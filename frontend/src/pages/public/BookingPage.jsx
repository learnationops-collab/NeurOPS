import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
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
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

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
    const [recognizedUser, setRecognizedUser] = useState(false);
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
                        // Redirect immediately
                        let target = redirectUrl;
                        if (target.includes('.') && !target.startsWith('http') && !target.startsWith('/')) {
                            target = 'https://' + target;
                        }
                        window.location.href = target;
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
            const params = {};
            if (username) params.username = username;

            const res = await api.get(`/public/funnel/${event_slug}`, { params });
            setEventInfo(res.data.event);
            setQuestions(res.data.questions);
            setAvailability(res.data.availability);
            setCloserName(res.data.closer_name);

            // 1. Initial Data from URL Parameters
            const emailParam = searchParams.get('email');
            const nameParam = searchParams.get('name');
            const phoneParam = searchParams.get('phone');
            const instaParam = searchParams.get('instagram') || searchParams.get('insta');

            if (emailParam || nameParam || phoneParam || instaParam) {
                setContactData(prev => ({
                    ...prev,
                    email: emailParam || prev.email,
                    name: nameParam || prev.name,
                    phone: phoneParam || prev.phone,
                    instagram: instaParam || prev.instagram
                }));

                // If email is present, trigger lookup
                if (emailParam) {
                    handleCheckExistingEmail(emailParam, {
                        name: nameParam,
                        phone: phoneParam,
                        instagram: instaParam
                    });
                }
            }
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || err.message || "Error al conectar con el servidor.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckExistingEmail = async (email, overrides = {}) => {
        setEmailChecking(true);
        setError(null);
        try {
            const res = await api.post('/public/clients/check', { email });
            if (res.data.exists) {
                const client = res.data.client;
                setClientId(client.id);

                const fullPhone = client.phone || '';
                let matchedPrefix = '+54';
                let subscriberNumber = fullPhone.replace(/\D/g, '');

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
                    email,
                    // PRIORITY: URL/Manual > Database
                    name: overrides.name || prev.name || client.full_name || '',
                    phone: overrides.phone || prev.phone || subscriberNumber || '',
                    instagram: overrides.instagram || prev.instagram || client.instagram || ''
                }));

                if (client.survey_answers) {
                    setSurveyAnswers(client.survey_answers);
                }
                setRecognizedUser(true);
            } else {
                setRecognizedUser(false);
                setCurrentStep(2);
            }
        } catch (err) {
            console.error("Error checking email:", err);
            // Don't block navigation even if check fails
            setCurrentStep(2);
        } finally {
            setEmailChecking(false);
        }
    };

    const handleEmailNext = () => {
        if (!contactData.email) return;
        handleCheckExistingEmail(contactData.email);
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
        <div className="min-h-screen bg-[#07080a] text-base flex flex-col font-sans selection:bg-primary/30 relative overflow-x-hidden">
            {/* Mesh Gradient Background */}
            <div className="fixed inset-0 z-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-2xl mx-auto w-full p-6 md:p-12 flex-1 flex flex-col justify-center relative z-10">

                {error && (
                    <div className="mb-10 p-6 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center gap-4 text-red-500 animate-in fade-in zoom-in-95 duration-500 backdrop-blur-md">
                        <AlertCircle className="w-8 h-8 shrink-0" />
                        <div className="space-y-1">
                            <p className="font-black uppercase tracking-[0.2em] text-[10px]">Error del Sistema</p>
                            <p className="text-[9px] font-bold opacity-80 uppercase tracking-tight leading-tight">{error}</p>
                        </div>
                    </div>
                )}

                {/* Stepper */}
                <div className="flex items-center justify-between mb-16 gap-3">
                    {[1, 2, 3, 4].map((step) => {
                        const isCompleted = currentStep > step;
                        const isActive = currentStep === step;
                        const stepLabels = ["Email", "Tus Datos", "Experiencia", "Agendar"];
                        return (
                            <div key={step} className="flex-1 flex flex-col items-center gap-4 relative">
                                <div className={`h-2 w-full rounded-full transition-all duration-700 relative overflow-hidden ${isCompleted ? 'bg-primary/20' : isActive ? 'bg-primary/10' : 'bg-base'
                                    }`}>
                                    <div
                                        className={`absolute inset-0 bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]`}
                                        style={{ width: isCompleted ? '100%' : isActive ? '100%' : '0%' }}
                                    />
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.25em] whitespace-nowrap transition-colors duration-500 ${isActive ? 'text-primary' : isCompleted ? 'text-primary/70' : 'text-muted'
                                        }`}>{stepLabels[step - 1]}</span>
                                    {isActive && <div className="w-1 h-1 bg-primary rounded-full animate-ping" />}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Step 1: Email Entry */}
                {currentStep === 1 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <header className="text-center space-y-4 mb-10">
                            <h2 className="text-6xl font-black text-base italic uppercase tracking-tighter leading-tight">EMPECEMOS</h2>
                            <p className="text-muted font-black uppercase text-[10px] tracking-[0.4em]">Ingresa tu mail para ahorrarte algunos pasos</p>
                        </header>

                        <Card variant="surface" className="p-10 shadow-2xl space-y-8 bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                            {/* Decorative background element for the card */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />

                            {!recognizedUser ? (
                                <div className="space-y-8">
                                    <FormInput
                                        label="Tu Email"
                                        type="email"
                                        icon={<Mail size={20} />}
                                        placeholder="ejemplo@mail.com"
                                        value={contactData.email}
                                        onChange={(v) => {
                                            setContactData({ ...contactData, email: v });
                                            // Reset recognized status if they type a different email after seeing it
                                            if (recognizedUser) setRecognizedUser(false);
                                        }}
                                    />

                                    <Button
                                        onClick={handleEmailNext}
                                        disabled={!contactData.email || emailChecking}
                                        loading={emailChecking}
                                        variant="primary"
                                        className="w-full h-18 text-base tracking-widest font-black"
                                        icon={ChevronRight}
                                        type="button"
                                    >
                                        VERIFICAR EMAIL
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-10 animate-in zoom-in-95 duration-500">
                                    <div className="text-center space-y-4">
                                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                                            <CheckCircle2 className="w-8 h-8 text-primary" />
                                        </div>
                                        <h3 className="text-2xl font-black text-base uppercase tracking-tight italic">¡HOLA DE NUEVO!</h3>
                                        <p className="text-muted font-black uppercase text-[10px] tracking-widest px-4">
                                            Parece que ya habías agendado previamente con nosotros, te gustaría:
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <Button
                                            onClick={() => {
                                                setRecognizedUser(false);
                                                setCurrentStep(2);
                                            }}
                                            variant="outline"
                                            className="h-16 text-[10px] tracking-[0.2em] border-primary/20 text-primary hover:bg-primary/5"
                                            type="button"
                                        >
                                            MODIFICAR MIS RESPUESTAS
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setRecognizedUser(false);
                                                setCurrentStep(4);
                                            }}
                                            variant="primary"
                                            className="h-18 text-[11px] font-black tracking-[0.3em]"
                                            icon={CalendarDays}
                                            type="button"
                                        >
                                            IR DIRECTO AL AGENDAMIENTO
                                        </Button>
                                    </div>

                                    <button
                                        onClick={() => setRecognizedUser(false)}
                                        className="w-full text-[8px] font-black uppercase tracking-[0.4em] text-muted hover:text-primary transition-colors mt-4"
                                    >
                                        O usa un correo diferente
                                    </button>
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {/* Step 2: Full Contact Info */}
                {currentStep === 2 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
                        <header className="text-center space-y-4 mb-10">
                            <h2 className="text-6xl font-black text-base italic uppercase tracking-tighter leading-none">TUS DATOS</h2>
                            <p className="text-muted font-black uppercase text-[10px] tracking-[0.4em]">Personaliza tu experiencia</p>
                        </header>

                        <Card variant="surface" className="p-10 shadow-2xl space-y-8 bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />

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
                                        <div className="relative group/select">
                                            <select
                                                className="bg-main border border-base rounded-2xl px-4 py-5 text-xs font-black outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer pr-10 hover:border-primary/30 transition-all"
                                                value={phonePrefix}
                                                onChange={(e) => setPhonePrefix(e.target.value)}
                                            >
                                                {COUNTRY_CODES.map(c => <option key={c.code + c.country} value={c.code}>{c.flag} {c.code}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none group-focus-within/select:text-primary" />
                                        </div>
                                        <input
                                            type="tel"
                                            className="flex-1 bg-main border border-base rounded-2xl py-5 px-6 text-base outline-none focus:ring-2 focus:ring-primary/50 font-black placeholder:text-muted/20 hover:border-primary/30 transition-all"
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

                            <div className="flex gap-6 pt-4">
                                <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border border-base rounded-2xl hover:border-primary/30" icon={ChevronLeft} type="button" />
                                <Button
                                    onClick={nextStep}
                                    disabled={!contactData.name || !contactData.phone || !contactData.instagram}
                                    variant="primary"
                                    className="flex-1 h-18 text-base tracking-widest font-black"
                                    icon={ChevronRight}
                                    type="button"
                                >
                                    CONTINUAR
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Step 3: Survey */}
                {currentStep === 3 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
                        <header className="text-center space-y-4 mb-10">
                            <h2 className="text-6xl font-black text-base italic uppercase tracking-tighter leading-none">TU PERFIL</h2>
                            <p className="text-muted font-black uppercase text-[10px] tracking-[0.4em]">Cuéntanos más sobre ti</p>
                        </header>

                        <Card variant="surface" className="p-10 shadow-2xl space-y-8 bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />

                            <div className="max-h-[40vh] overflow-y-auto pr-4 custom-scrollbar space-y-8">
                                {questions.map((q) => (
                                    <div key={q.id} className="space-y-4">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{q.text}</label>
                                        {q.type === 'select' ? (
                                            <div className="relative group/select">
                                                <select
                                                    className="w-full bg-main border border-base rounded-2xl py-5 px-6 text-sm outline-none focus:ring-2 focus:ring-primary/50 font-black appearance-none cursor-pointer hover:border-primary/30 transition-all text-base/80"
                                                    value={surveyAnswers[q.id] || ''}
                                                    onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [q.id]: e.target.value })}
                                                >
                                                    <option value="">Seleccionar una opción...</option>
                                                    {Array.isArray(q.options)
                                                        ? q.options.map(opt => <option key={opt.text} value={opt.text}>{opt.text}</option>)
                                                        : q.options?.split(',').map(opt => <option key={opt} value={opt}>{opt}</option>)
                                                    }
                                                </select>
                                                <ChevronDown size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none group-focus-within/select:text-primary" />
                                            </div>
                                        ) : (
                                            <input
                                                type={q.type}
                                                className="w-full bg-main border border-base rounded-2xl py-5 px-6 text-sm outline-none focus:ring-2 focus:ring-primary/50 font-black placeholder:text-muted/20 hover:border-primary/30 transition-all"
                                                placeholder="Tu respuesta aquí..."
                                                value={surveyAnswers[q.id] || ''}
                                                onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [q.id]: e.target.value })}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-6 pt-4">
                                <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border border-base rounded-2xl hover:border-primary/30" icon={ChevronLeft} type="button" />
                                <Button onClick={nextStep} variant="primary" className="flex-1 h-18 text-base tracking-widest font-black" icon={ChevronRight} type="button">
                                    CASI LISTO
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Step 4: Booking */}
                {currentStep === 4 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-700">
                        <header className="text-center space-y-4 mb-10">
                            <h2 className="text-6xl font-black text-base italic uppercase tracking-tighter leading-none">RESERVAR</h2>
                            <div className="flex items-center justify-center gap-6">
                                <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                                    <Clock size={14} />
                                    <span>{eventInfo?.duration} MINUTOS</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted font-black uppercase text-[9px] tracking-widest">
                                    <Globe size={14} className="text-primary/40" />
                                    <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                                </div>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                            <Card variant="surface" className="md:col-span-3 p-10 shadow-2xl bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] ml-1">Selecciona Fecha</h4>
                                    <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar">
                                        {availableDates.map(dateStr => {
                                            const d = new Date(dateStr + "T00:00:00");
                                            const isActive = selectedDate === dateStr;
                                            return (
                                                <button
                                                    key={dateStr}
                                                    onClick={() => setSelectedDate(dateStr)}
                                                    className={`p-5 rounded-2xl border text-left transition-all duration-300 group/date relative overflow-hidden ${isActive
                                                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                                        : 'bg-white/5 border-white/10 text-muted hover:border-primary/30 hover:bg-white/[0.07]'
                                                        }`}
                                                >
                                                    <div className="relative z-10">
                                                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 transition-colors ${isActive ? 'text-white/70' : 'text-primary'}`}>
                                                            {d.toLocaleDateString('es-ES', { weekday: 'long' })}
                                                        </p>
                                                        <p className="font-black italic text-lg uppercase tracking-tight">
                                                            {d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                                        </p>
                                                    </div>
                                                    {isActive && <div className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center animate-in fade-in zoom-in duration-500">
                                                        <CheckCircle size={16} />
                                                    </div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </Card>

                            <Card variant="surface" className="md:col-span-2 p-10 shadow-2xl bg-surface/40 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] ml-1">Horarios ({selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString('es-ES', { day: 'numeric' }) : ''})</h4>
                                    <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar">
                                        {groupedAvailability[selectedDate]?.map(slot => (
                                            <button
                                                key={slot.ts}
                                                onClick={() => setSelectedSlot(slot)}
                                                className={`p-4 rounded-xl border text-center text-sm font-black transition-all duration-300 ${selectedSlot?.ts === slot.ts
                                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.05]'
                                                    : 'bg-white/5 border-white/10 text-muted hover:border-primary/30 hover:bg-white/[0.07]'
                                                    }`}
                                            >
                                                {slot.localStart} HS
                                            </button>
                                        ))}
                                        {(!groupedAvailability[selectedDate] || groupedAvailability[selectedDate].length === 0) && (
                                            <div className="py-20 text-center space-y-4 opacity-50">
                                                <CalendarDays size={32} className="mx-auto text-muted/30" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Sin horarios disponibles</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <div className="flex gap-6">
                            <Button onClick={prevStep} variant="ghost" className="h-18 w-24 p-0 border border-base rounded-2xl hover:border-primary/30" icon={ChevronLeft} type="button" />
                            <Button
                                onClick={handleBook}
                                disabled={!selectedSlot || booking}
                                loading={booking}
                                variant="primary"
                                className="flex-1 h-18 text-lg tracking-widest font-black uppercase italic shadow-[0_20px_40px_-15px_rgba(var(--primary-rgb),0.3)]"
                                type="button"
                            >
                                CONFIRMAR SESIÓN
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
