import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import {
    Calendar,
    Clock,
    User,
    CheckCircle2,
    AlertCircle,
    ChevronDown
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

// New Sub-components
import LookupStep from './booking/components/LookupStep';
import ContactStep from './booking/components/ContactStep';
import SurveyStep from './booking/components/SurveyStep';
import CalendarStep from './booking/components/CalendarStep';
import { COUNTRY_CODES } from './booking/constants';

const BookingPage = () => {
    const { username, event_slug, setter_id } = useParams();
    const [searchParams] = useSearchParams();

    // States
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [emailChecking, setEmailChecking] = useState(false);
    const [lookupValue, setLookupValue] = useState(''); // Unified Email or Instagram
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

    // Grouping availability by date (LOCAL USER TIMEZONE)
    const groupedAvailability = useMemo(() => {
        const groups = {};
        availability.forEach(slot => {
            const dateObj = new Date(slot.utc_iso);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const localDateKey = `${year}-${month}-${day}`;
            const localStart = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

            if (!groups[localDateKey]) groups[localDateKey] = [];
            groups[localDateKey].push({
                ...slot,
                localStart,
                localDateKey
            });
        });

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

            // Initial Data from URL Parameters
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

                if (emailParam) setLookupValue(emailParam);
                else if (instaParam) setLookupValue(instaParam);
            }
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || err.message || "Error al conectar con el servidor.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckLookup = async (value) => {
        setEmailChecking(true);
        setError(null);
        try {
            const isEmail = value.includes('@') && value.includes('.');
            const payload = isEmail ? { email: value } : { instagram: value };

            const res = await api.post('/public/clients/check', payload);
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
                    email: isEmail ? value : (client.email || prev.email),
                    name: prev.name || client.full_name || '',
                    phone: prev.phone || subscriberNumber || '',
                    instagram: !isEmail ? value : (client.instagram || prev.instagram || '')
                }));

                if (res.data.survey_answers) {
                    setSurveyAnswers(res.data.survey_answers);
                }
                setRecognizedUser(true);
            } else {
                setRecognizedUser(false);
                if (isEmail) setContactData(p => ({ ...p, email: value }));
                else setContactData(p => ({ ...p, instagram: value }));
                setCurrentStep(2);
            }
        } catch (err) {
            console.error("Error checking lookup:", err);
            setCurrentStep(2);
        } finally {
            setEmailChecking(false);
        }
    };

    const nextStep = async () => {
        if (currentStep === 2) {
            try {
                const res = await api.post('/public/submit-lead', {
                    ...contactData,
                    phone: `${phonePrefix} ${contactData.phone.replace(/\D/g, '')}`
                });
                if (res.data.id) setClientId(res.data.id);
                setCurrentStep(questions.length === 0 ? 4 : 3);
            } catch (err) {
                console.error("Error saving lead info:", err);
                setCurrentStep(questions.length === 0 ? 4 : 3);
            }
        } else if (currentStep === 3) {
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
                setCurrentStep(4);
            }
        }
    };

    const prevStep = () => {
        if (currentStep === 4) setCurrentStep(questions.length === 0 ? 2 : 3);
        else setCurrentStep(currentStep - 1);
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
                utm_campaign: searchParams.get('utm_campaign'),
                setter: searchParams.get('setter') || searchParams.get('ref'),
                setter_id: setter_id
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
            <p className="text-muted font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Cargando experiencia...</p>
        </div>
    );

    if (success) return (
        <div className="min-h-screen bg-main flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-success/5 blur-[120px] rounded-full pointer-events-none" />
            <Card variant="surface" className="max-w-md w-full p-12 text-center border-success/20 shadow-2xl backdrop-blur-3xl animate-in zoom-in-95 duration-500 relative z-10">
                <div className="w-24 h-24 bg-success/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-success/20 shadow-[0_0_30px_rgba(var(--success-rgb),0.1)]">
                    <CheckCircle2 className="w-14 h-14 text-success" />
                </div>
                <h1 className="text-4xl font-bold text-base italic mb-4 uppercase tracking-tighter">¡Brutal!</h1>
                <p className="text-muted mb-6 font-bold uppercase text-[10px] tracking-widest">
                    Tu sesión con <span className="text-primary font-bold">@{bookedCloser || username}</span> ha sido reservada.
                </p>
                {redirectUrl && (
                    <p className="text-[10px] font-black text-primary animate-pulse mb-6 uppercase tracking-[0.2em]">
                        Redirigiendo en {countdown} segundos...
                    </p>
                )}
                <div className="bg-main/50 p-8 rounded-[2rem] border border-base mb-10 text-left space-y-4 shadow-inner">
                    <div className="flex items-center gap-4 text-sm">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="text-base font-black italic">{selectedSlot ? new Date(selectedSlot.localDateKey + "T00:00:00").toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <Clock className="w-5 h-5 text-primary" />
                        <span className="text-base font-black italic">{selectedSlot?.localStart} HS</span>
                    </div>
                </div>
                <Button onClick={handleFinalize} variant="primary" className="w-full h-18 text-base tracking-widest font-bold">Continuar</Button>
            </Card>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#07080a] text-base flex flex-col font-sans selection:bg-primary/30 relative overflow-x-hidden">
            <div className="fixed inset-0 z-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-2xl mx-auto w-full p-6 md:p-12 flex-1 flex flex-col justify-center relative z-10">
                {error && (
                    <div className="mb-10 p-6 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center gap-4 text-red-500 animate-in fade-in zoom-in-95 duration-500 backdrop-blur-md">
                        <AlertCircle className="w-8 h-8 shrink-0" />
                        <div className="space-y-1 text-left">
                            <p className="font-bold tracking-[0.05em] text-[10px]">Error del sistema</p>
                            <p className="text-[9px] font-medium opacity-80 tracking-tight leading-tight">{error}</p>
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
                                <div className={`h-2 w-full rounded-full transition-all duration-700 relative overflow-hidden ${isCompleted ? 'bg-primary/20' : isActive ? 'bg-primary/10' : 'bg-base'}`}>
                                    <div
                                        className={`absolute inset-0 bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]`}
                                        style={{ width: isCompleted ? '100%' : isActive ? '100%' : '0%' }}
                                    />
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className={`text-[9px] font-bold tracking-[0.1em] whitespace-nowrap transition-colors duration-500 ${isActive ? 'text-primary' : isCompleted ? 'text-primary/70' : 'text-muted'}`}>{stepLabels[step - 1]}</span>
                                    {isActive && <div className="w-1 h-1 bg-primary rounded-full animate-ping" />}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {currentStep === 1 && (
                    <LookupStep
                        lookupValue={lookupValue}
                        setLookupValue={setLookupValue}
                        emailChecking={emailChecking}
                        handleLookupNext={() => handleCheckLookup(lookupValue)}
                        recognizedUser={recognizedUser}
                        setRecognizedUser={setRecognizedUser}
                        setCurrentStep={setCurrentStep}
                        username={username}
                    />
                )}

                {currentStep === 2 && (
                    <ContactStep
                        contactData={contactData}
                        setContactData={setContactData}
                        phonePrefix={phonePrefix}
                        setPhonePrefix={setPhonePrefix}
                        prevStep={prevStep}
                        nextStep={nextStep}
                    />
                )}

                {currentStep === 3 && (
                    <SurveyStep
                        questions={questions}
                        surveyAnswers={surveyAnswers}
                        setSurveyAnswers={setSurveyAnswers}
                        prevStep={prevStep}
                        nextStep={nextStep}
                    />
                )}

                {currentStep === 4 && (
                    <CalendarStep
                        eventInfo={eventInfo}
                        availableDates={availableDates}
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
                        selectedSlot={selectedSlot}
                        setSelectedSlot={setSelectedSlot}
                        groupedAvailability={groupedAvailability}
                        prevStep={prevStep}
                        handleBook={handleBook}
                        booking={booking}
                    />
                )}

                <footer className="mt-20 text-center space-y-2 opacity-30">
                    <p className="text-[8px] font-bold text-muted tracking-[0.25em]">NeurOPS Intelligent Scheduling System</p>
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

export default BookingPage;
