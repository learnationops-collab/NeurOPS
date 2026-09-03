import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Send, Loader2, CheckCircle2, AlertOctagon, Clipboard, Video, XCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Lado máximo (px) al que se reduce cualquier captura pegada a mano antes de mandarla: el
// portapapeles puede traer una imagen a resolución nativa (una captura de Windows en 4K pesa
// varios MB), y eso viaja como texto base64 en el JSON del reporte.
const MAX_PASTED_DIM = 1400;

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

// Redimensiona y recomprime un blob de imagen arbitrario (lo que venga en el portapapeles) a
// un data URL liviano, con el mismo criterio de peso que captureScreenshot de arriba.
const blobToCompressedDataUrl = (blob) => new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
        const scale = Math.min(1, MAX_PASTED_DIM / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(e);
    };
    img.src = objectUrl;
});

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
    const [extraScreenshots, setExtraScreenshots] = useState([]);
    const [loomLink, setLoomLink] = useState('');
    const [pasting, setPasting] = useState(false);

    const reset = () => {
        setStep(isReactive ? 'description' : 'problem');
        setProblem('');
        setDescription('');
        setExtraScreenshots([]);
        setLoomLink('');
    };

    const handleClose = () => {
        onClose();
        setTimeout(reset, 300);
    };

    const addPastedImage = async (blob) => {
        setPasting(true);
        try {
            const dataUrl = await blobToCompressedDataUrl(blob);
            setExtraScreenshots((prev) => [...prev, dataUrl]);
            toast.success('Captura agregada');
        } catch (e) {
            console.error('No se pudo procesar la imagen pegada:', e);
            toast.error('No se pudo agregar la captura.');
        } finally {
            setPasting(false);
        }
    };

    // Ctrl+V pega la imagen que esté en el portapapeles (además de la captura automática que
    // ya se toma sola al enviar) — pedido del usuario para poder adjuntar algo que no sea la
    // pantalla actual, por ejemplo un error que pasó en otra ventana. Usa el evento nativo
    // "paste" en vez de navigator.clipboard.read(): es el mismo atajo que ya usa el sistema
    // operativo para pegar, así que no hace falta pedir permiso de portapapeles al navegador.
    // Si lo que se pegó es texto (p.ej. dentro del textarea de descripción o el input de
    // Loom), no hay item de imagen y se deja que el pegado normal siga su curso.
    useEffect(() => {
        if (!isOpen || step === 'submitting' || step === 'done') return;
        const handlePaste = (e) => {
            const items = Array.from(e.clipboardData?.items || []);
            const imageItem = items.find((it) => it.type.startsWith('image/'));
            if (!imageItem) return;
            e.preventDefault();
            const blob = imageItem.getAsFile();
            if (blob) addPastedImage(blob);
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen, step]);

    // Respaldo para el botón "Pegar captura": no todos los navegadores permiten leer el
    // portapapeles a demanda (fuera de un evento paste real) sin este permiso explícito.
    const pasteFromClipboardButton = async () => {
        if (!navigator.clipboard || !navigator.clipboard.read) {
            toast.error('Tu navegador no permite leer el portapapeles con este botón. Probá Ctrl+V.');
            return;
        }
        setPasting(true);
        try {
            const items = await navigator.clipboard.read();
            let added = 0;
            for (const item of items) {
                const imageType = item.types.find((t) => t.startsWith('image/'));
                if (!imageType) continue;
                const blob = await item.getType(imageType);
                const dataUrl = await blobToCompressedDataUrl(blob);
                setExtraScreenshots((prev) => [...prev, dataUrl]);
                added += 1;
            }
            if (added > 0) {
                toast.success(added === 1 ? 'Captura agregada' : `${added} capturas agregadas`);
            } else {
                toast.error('No encontré una imagen en el portapapeles');
            }
        } catch (e) {
            console.error('No se pudo leer el portapapeles:', e);
            toast.error('No se pudo leer el portapapeles. Probá Ctrl+V.');
        } finally {
            setPasting(false);
        }
    };

    const removeExtraScreenshot = (index) => {
        setExtraScreenshots((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        setStep('submitting');

        const screenshot = await captureScreenshot();

        try {
            await api.post('/bug-reports', {
                problem: isReactive ? null : problem,
                description,
                route: window.location.pathname,
                user_agent: navigator.userAgent,
                technical_context: technicalContext ? JSON.stringify(technicalContext) : null,
                screenshot,
                extra_screenshots: extraScreenshots,
                loom_link: loomLink.trim() || null,
            }, { skipBugReport: true });
            setStep('done');
        } catch (err) {
            console.error('Error al enviar el reporte de bug:', err);
            toast.error('No se pudo enviar el reporte. Intenta de nuevo.');
            setStep('attachments');
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
                    className="fixed bottom-8 right-8 z-[210] w-[min(24rem,calc(100vw-2rem))] max-h-[70vh] bg-surface rounded-[2rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden"
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

                        {(step === 'description' || step === 'attachments' || step === 'submitting' || step === 'done') && !isReactive && (
                            <div className="bg-primary/10 text-primary rounded-2xl rounded-tr-sm p-3 text-sm max-w-[85%] ml-auto whitespace-pre-wrap break-words">
                                {problem}
                            </div>
                        )}

                        {(step === 'description' || step === 'attachments' || step === 'submitting' || step === 'done') && (
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
                                    onClick={() => setStep('attachments')}
                                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-2xl py-3 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                                >
                                    Continuar <Send size={14} />
                                </button>
                            </div>
                        )}

                        {(step === 'attachments' || step === 'submitting' || step === 'done') && (
                            <>
                                <div className="bg-primary/10 text-primary rounded-2xl rounded-tr-sm p-3 text-sm max-w-[85%] ml-auto whitespace-pre-wrap break-words">
                                    {description}
                                </div>

                                <div className="flex items-start gap-2">
                                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                        <Bot size={14} />
                                    </div>
                                    <div className="bg-surface rounded-2xl rounded-tl-sm p-3 text-sm max-w-[85%]">
                                        Ya tomé una captura de esta pantalla automáticamente. ¿Querés agregar algo más? Todo esto es opcional.
                                    </div>
                                </div>
                            </>
                        )}

                        {step === 'attachments' && (
                            <div className="space-y-3 pl-9">
                                <button
                                    type="button"
                                    disabled={pasting}
                                    onClick={pasteFromClipboardButton}
                                    className="w-full flex items-center justify-center gap-2 bg-surface border border-dashed border-base hover:border-primary hover:text-primary rounded-2xl py-3 text-xs font-bold uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {pasting ? <Loader2 size={14} className="animate-spin" /> : <Clipboard size={14} />}
                                    Pegar captura (Ctrl+V)
                                </button>

                                {extraScreenshots.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {extraScreenshots.map((src, i) => (
                                            <div key={i} className="relative group">
                                                <img src={src} alt={`Captura ${i + 1}`} className="w-full h-16 object-cover rounded-xl border border-base" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeExtraScreenshot(i)}
                                                    className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Quitar captura"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="relative">
                                    <Video size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <input
                                        type="url"
                                        value={loomLink}
                                        onChange={(e) => setLoomLink(e.target.value)}
                                        placeholder="Link de Loom (opcional)"
                                        className="w-full bg-surface border border-base rounded-2xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    />
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-2xl py-3 active:scale-95 transition-all"
                                >
                                    Enviar reporte <Send size={14} />
                                </button>
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
