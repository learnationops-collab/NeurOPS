import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PlayCircle, Clock, HelpCircle, Users, GraduationCap } from 'lucide-react';
import { usePlaybook } from '../../contexts/PlaybookContext';

const DISMISSED_KEY = 'playbook_notif_dismissed';

const getDismissed = () => {
    try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]')); } catch { return new Set(); }
};
const persistDismissed = (set) => {
    try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set])); } catch { }
};

// Aviso de lección nueva sin ver -- una vez por sesión de navegador por lección ("Después" no
// la marca como vista de verdad en el backend, solo evita que insista de nuevo hasta la
// próxima vez que se recargue la app, igual que "Después" en el mockup).
const PlaybookNotification = () => {
    const { pendingLessons, openPlaybook } = usePlaybook();
    const [current, setCurrent] = useState(null);

    useEffect(() => {
        const dismissed = getDismissed();
        const next = pendingLessons.find(l => l.state === 'nuevo' && !dismissed.has(l.id));
        setCurrent(next || null);
    }, [pendingLessons]);

    if (!current) return null;

    const dismiss = () => {
        const dismissed = getDismissed();
        dismissed.add(current.id);
        persistDismissed(dismissed);
        setCurrent(null);
    };

    const viewNow = () => {
        dismiss();
        openPlaybook('pending');
    };

    return createPortal(
        <div className="fixed inset-0 z-[380] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={dismiss}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-surface border border-primary/30 rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 space-y-5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                        <GraduationCap size={16} /> Playbook nuevo
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                            <PlayCircle size={26} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{current.roadmap_name} · {current.module_name}</p>
                            <h3 className="text-base font-black truncate">{current.title}</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[9px] font-black uppercase tracking-widest">
                        {current.author_name && <span className="px-2 py-1 rounded-lg bg-white/5 text-muted">{current.author_name}</span>}
                        {current.duration_minutes != null && <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-muted"><Clock size={11} /> {current.duration_minutes} min</span>}
                        {current.question_count > 0 && <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-muted"><HelpCircle size={11} /> {current.question_count} pregunta(s)</span>}
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-muted"><Users size={11} /> {current.audience_label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={viewNow} className="flex-1 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all">
                            Verlo ahora
                        </button>
                        <button onClick={dismiss} className="px-5 py-3 rounded-2xl border border-base text-xs font-black uppercase tracking-widest text-muted hover:text-white">
                            Después
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PlaybookNotification;
