import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Send, Loader2, CheckCircle2, AlertOctagon } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const URGENCY_OPTIONS = [
    { value: 'muy_urgente', label: 'Muy urgente' },
    { value: 'urgente', label: 'Urgente' },
    { value: 'neutro', label: 'Neutro' },
    { value: 'sin_urgencia', label: 'Sin urgencia' },
];

// Captura una screenshot liviana del viewport actual (excluyendo el propio drawer del
// chat, que ya está oculto en el momento de la captura porque se llama justo antes de
// desmontarlo visualmente vía el estado 'submitting').
const captureScreenshot = async () => {
    try {
        const canvas = await html2canvas(document.body, {
            logging: false,
            useCORS: true,
            scale: 0.5,
            ignoreElements: (el) => el.dataset?.bugReportIgnore === 'true',
        });
        return canvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
        console.error('No se pudo capturar la pantalla para el reporte:', e);
        return null;
    }
};

// Si el reporte no viene de un error detectado automáticamente, no hay contexto técnico
// que explique "cuál es el problema" — por eso se pregunta explícitamente antes de pedir
// qué intentaba hacer el usuario. Si sí viene de un error, esa pregunta ya está respondida
// por el error mismo y se salta directo a "qué intentabas hacer".
const BugReportChat = ({ isOpen, onClose, technicalContext }) => {
    const { user } = useAuth();
    const isReactive = !!technicalContext;
    const [step, setStep] = useState(isReactive ? 'description' : 'problem');
    const [problem, setProblem] = useState('');
    const [description, setDescription] = useState('');
    const [urgency, setUrgency] = useState(null);

    const reset = () => {
        setStep(isReactive ? 'description' : 'problem');
        setProblem('');
        setDescription('');
        setUrgency(null);
    };

    const handleClose = () => {
        onClose();
        setTimeout(reset, 300);
    };

    const handleSubmit = async (selectedUrgency) => {
        setUrgency(selectedUrgency);
        setStep('submitting');

        const screenshot = await captureScreenshot();

        try {
            await api.post('/bug-reports', {
                problem: isReactive ? null : problem,
                description,
                urgency: selectedUrgency,
                route: window.location.pathname,
                user_agent: navigator.userAgent,
                technical_context: technicalContext ? JSON.stringify(technicalContext) : null,
                screenshot,
            }, { skipBugReport: true });
            setStep('done');
        } catch (err) {
            console.error('Error al enviar el reporte de bug:', err);
            toast.error('No se pudo enviar el reporte. Intenta de nuevo.');
            setStep('urgency');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    data-bug-report-ignore="true"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.95 }}
                    className="fixed bottom-8 right-8 z-[210] w-[min(24rem,calc(100vw-2rem))] max-h-[70vh] glass-effect rounded-[2rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden"
                >
                    <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                                <Bot size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-tight">Reportar un problema</h3>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{user?.username || 'Usuario'} · {user?.role}</p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-xl text-muted hover:text-base transition-all active:scale-95">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                        {technicalContext && (
                            <div className="flex items-start gap-2 text-xs bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-2xl p-3">
                                <AlertOctagon size={14} className="mt-0.5 shrink-0" />
                                <span className="break-words">
                                    Detecté un error técnico: <strong>{technicalContext.message}</strong>
                                    {technicalContext.status ? ` (status ${technicalContext.status})` : ''}
                                </span>
                            </div>
                        )}

                        {!isReactive && (
                            <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                    <Bot size={14} />
                                </div>
                                <div className="bg-surface rounded-2xl rounded-tl-sm p-3 text-sm max-w-[85%]">
                                    ¿Cuál es el problema?
                                </div>
                            </div>
                        )}

                        {step === 'problem' && (
                            <div className="space-y-3 pl-9">
                                <textarea
                                    autoFocus
                                    value={problem}
                                    onChange={(e) => setProblem(e.target.value)}
                                    placeholder="Describe el problema..."
                                    className="w-full bg-surface border border-base rounded-2xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                                <button
                                    disabled={!problem.trim()}
                                    onClick={() => setStep('description')}
                                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-2xl py-3 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                                >
                                    Continuar <Send size={14} />
                                </button>
                            </div>
                        )}

                        {(step === 'description' || step === 'urgency' || step === 'submitting' || step === 'done') && !isReactive && (
                            <div className="bg-primary/10 text-primary rounded-2xl rounded-tr-sm p-3 text-sm max-w-[85%] ml-auto whitespace-pre-wrap break-words">
                                {problem}
                            </div>
                        )}

                        {(step === 'description' || step === 'urgency' || step === 'submitting' || step === 'done') && (
                            <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                    <Bot size={14} />
                                </div>
                                <div className="bg-surface rounded-2xl rounded-tl-sm p-3 text-sm max-w-[85%]">
                                    ¿Qué intentabas hacer cuando apareció el error o problema?
                                </div>
                            </div>
                        )}

                        {step === 'description' && (
                            <div className="space-y-3 pl-9">
                                <textarea
                                    autoFocus
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Escribe qué estabas haciendo..."
                                    className="w-full bg-surface border border-base rounded-2xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                                <button
                                    disabled={!description.trim()}
                                    onClick={() => setStep('urgency')}
                                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-2xl py-3 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                                >
                                    Continuar <Send size={14} />
                                </button>
                            </div>
                        )}

                        {(step === 'urgency' || step === 'submitting' || step === 'done') && (
                            <>
                                <div className="bg-primary/10 text-primary rounded-2xl rounded-tr-sm p-3 text-sm max-w-[85%] ml-auto whitespace-pre-wrap break-words">
                                    {description}
                                </div>

                                <div className="flex items-start gap-2">
                                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                        <Bot size={14} />
                                    </div>
                                    <div className="bg-surface rounded-2xl rounded-tl-sm p-3 text-sm max-w-[85%]">
                                        ¿Qué tan urgente es lo que necesitas hacer?
                                    </div>
                                </div>
                            </>
                        )}

                        {step === 'urgency' && (
                            <div className="grid grid-cols-2 gap-2 pl-9">
                                {URGENCY_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleSubmit(opt.value)}
                                        className="bg-surface border border-base hover:border-primary hover:text-primary rounded-2xl py-3 text-xs font-bold uppercase tracking-wide transition-all active:scale-95"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {step === 'submitting' && (
                            <div className="flex items-center gap-2 pl-9 text-xs text-muted">
                                <Loader2 size={14} className="animate-spin" /> Enviando reporte y capturando pantalla...
                            </div>
                        )}

                        {step === 'done' && (
                            <div className="flex items-start gap-2 pl-9">
                                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl p-3 text-sm">
                                    <CheckCircle2 size={16} className="shrink-0" />
                                    ¡Gracias! Tu reporte fue enviado.
                                </div>
                            </div>
                        )}
                    </div>

                    {step === 'done' && (
                        <div className="p-4 border-t border-white/5">
                            <button
                                onClick={handleClose}
                                className="w-full bg-surface border border-base rounded-2xl py-3 text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BugReportChat;
