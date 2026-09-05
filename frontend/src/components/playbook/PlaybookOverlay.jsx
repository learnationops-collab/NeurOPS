import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, GraduationCap, Clock, CheckCircle2, PlayCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { usePlaybook } from '../../contexts/PlaybookContext';
import PlaybookLessonView from './PlaybookLessonView';

const ACCENT_CLASSES = {
    magenta: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20', bar: 'bg-pink-500' },
    blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', bar: 'bg-blue-500' },
    green: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500' },
};

const STATE_BADGE = {
    nuevo: 'bg-primary/10 text-primary border-primary/20',
    en_progreso: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    pendiente: 'bg-white/5 text-muted border-white/10',
    completado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};
const STATE_TEXT = { nuevo: 'Nuevo', en_progreso: 'En progreso', pendiente: 'Pendiente', completado: 'Completado' };

// Overlay de pantalla completa del Playbook (formación interna): Pendientes -> Roadmaps ->
// Módulos -> Lección+Quiz. Portal a document.body y montado una única vez en App.jsx (ver
// PlaybookContext) para que abra igual sin importar qué página lo dispare.
const PlaybookOverlay = () => {
    const { isOpen, initialView, closePlaybook, refreshPending } = usePlaybook();
    const [view, setView] = useState('pending');
    const [roadmapId, setRoadmapId] = useState(null);
    const [moduleId, setModuleId] = useState(null);
    const [lessonId, setLessonId] = useState(null);

    const [pendingData, setPendingData] = useState(null);
    const [roadmaps, setRoadmaps] = useState([]);
    const [modules, setModules] = useState([]);
    const [moduleInfo, setModuleInfo] = useState(null);
    const [lessons, setLessons] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setView(initialView || 'pending');
            setRoadmapId(null);
            setModuleId(null);
            setLessonId(null);
        }
    }, [isOpen, initialView]);

    useEffect(() => {
        if (!isOpen) return;
        if (view === 'pending') {
            setLoading(true);
            api.get('/playbook/pending').then(res => setPendingData(res.data)).catch(() => toast.error('No se pudo cargar el Playbook')).finally(() => setLoading(false));
        } else if (view === 'roadmaps') {
            setLoading(true);
            api.get('/playbook/roadmaps/summary').then(res => setRoadmaps(res.data)).catch(() => toast.error('No se pudieron cargar los roadmaps')).finally(() => setLoading(false));
        } else if (view === 'modules' && roadmapId) {
            setLoading(true);
            api.get(`/playbook/roadmaps/${roadmapId}/modules`).then(res => setModules(res.data)).catch(() => toast.error('No se pudieron cargar los módulos')).finally(() => setLoading(false));
        } else if (view === 'lessons' && moduleId) {
            setLoading(true);
            api.get(`/playbook/modules/${moduleId}/lessons`).then(res => { setLessons(res.data.lessons); setModuleInfo(res.data.module); }).catch(() => toast.error('No se pudieron cargar las lecciones')).finally(() => setLoading(false));
        }
    }, [isOpen, view, roadmapId, moduleId]);

    if (!isOpen) return null;

    const openRoadmap = (id) => { setRoadmapId(id); setView('modules'); };
    const openModule = (id, rId) => { setModuleId(id); setRoadmapId(rId); setView('lessons'); };
    const openLesson = (id, mId) => { setLessonId(id); if (mId) setModuleId(mId); setView('lesson'); };

    const handleClose = () => { closePlaybook(); refreshPending(); };

    return createPortal(
        <div className="fixed inset-0 z-[350] bg-[#05060a] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-[#05060a]/95 backdrop-blur-md border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                        <GraduationCap size={16} className="text-primary" />
                        Playbook · Centro de formación
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-xl hover:bg-white/5 text-muted hover:text-white">
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8 text-white">
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="animate-spin text-primary" size={28} />
                    </div>
                ) : view === 'pending' ? (
                    <PendingView data={pendingData} onOpenLesson={(id) => openLesson(id)} onViewRoadmaps={() => setView('roadmaps')} />
                ) : view === 'roadmaps' ? (
                    <RoadmapsView roadmaps={roadmaps} onOpen={openRoadmap} onBack={() => setView('pending')} />
                ) : view === 'modules' ? (
                    <ModulesView modules={modules} onOpen={(id) => openModule(id, roadmapId)} onBack={() => setView('roadmaps')} />
                ) : view === 'lessons' ? (
                    <LessonsView moduleInfo={moduleInfo} lessons={lessons} onOpen={(id) => openLesson(id, moduleId)} onBack={() => setView('modules')} />
                ) : view === 'lesson' ? (
                    <PlaybookLessonView
                        lessonId={lessonId}
                        onBack={() => setView('lessons')}
                        onNavigateLesson={(id) => setLessonId(id)}
                        onCompleted={refreshPending}
                        onModuleResolved={(mId, rId) => { setModuleId(mId); if (rId) setRoadmapId(rId); }}
                    />
                ) : null}
            </div>
        </div>,
        document.body
    );
};

const Metric = ({ label, value }) => (
    <div className="bg-surface border border-base rounded-2xl p-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted">{label}</p>
        <p className="text-2xl font-black mt-1">{value}</p>
    </div>
);

const PendingView = ({ data, onOpenLesson, onViewRoadmaps }) => {
    if (!data) return null;
    const { lessons, pending_count, new_count, total_minutes } = data;
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Tus playbooks</p>
                    <h1 className="text-2xl font-black tracking-tight">{pending_count} playbook(s) te esperan</h1>
                </div>
                <button onClick={onViewRoadmaps} className="px-4 py-2.5 rounded-2xl border border-base text-[10px] font-black uppercase tracking-widest hover:bg-white/5">
                    Ver roadmaps
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Metric label="Pendientes" value={pending_count} />
                <Metric label="Nuevos" value={new_count} />
                <Metric label="Tiempo total" value={`${total_minutes} min`} />
            </div>

            {lessons.length === 0 ? (
                <div className="text-center py-16 text-muted text-xs font-bold uppercase tracking-wide bg-surface border border-dashed border-base rounded-3xl">
                    Estás al día — no tenés playbooks pendientes.
                </div>
            ) : (
                <div className="space-y-2">
                    {lessons.map(l => {
                        const accent = ACCENT_CLASSES[l.roadmap_accent] || ACCENT_CLASSES.magenta;
                        return (
                            <button
                                key={l.id}
                                onClick={() => onOpenLesson(l.id)}
                                className="w-full flex items-center gap-4 bg-surface border border-base rounded-2xl p-4 text-left hover:border-white/20 transition-all"
                            >
                                <div className={`w-9 h-9 rounded-full ${accent.bg} ${accent.text} flex items-center justify-center shrink-0`}>
                                    <PlayCircle size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{l.title}</p>
                                    <p className="text-[10px] text-muted font-medium truncate">
                                        {l.roadmap_name} · {l.module_name}{l.author_name ? ` · ${l.author_name}` : ''}
                                    </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shrink-0 ${STATE_BADGE[l.state]}`}>
                                    {STATE_TEXT[l.state]}
                                </span>
                                {l.duration_minutes != null && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted shrink-0"><Clock size={12} /> {l.duration_minutes} min</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const RoadmapsView = ({ roadmaps, onOpen, onBack }) => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Playbook · Centro de formación</p>
                <h1 className="text-2xl font-black tracking-tight">Elegí tu roadmap</h1>
            </div>
            <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted hover:text-white">
                <ChevronLeft size={14} /> Volver
            </button>
        </div>
        {roadmaps.length === 0 ? (
            <div className="text-center py-16 text-muted text-xs font-bold uppercase tracking-wide bg-surface border border-dashed border-base rounded-3xl">
                Todavía no hay contenido publicado para tu rol.
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {roadmaps.map(r => {
                    const accent = ACCENT_CLASSES[r.accent] || ACCENT_CLASSES.magenta;
                    return (
                        <div key={r.id} className={`bg-surface border ${accent.border} rounded-3xl p-6 space-y-4`}>
                            <div className="flex items-center justify-between">
                                <div className={`w-10 h-10 rounded-2xl ${accent.bg} ${accent.text} flex items-center justify-center`}>
                                    <GraduationCap size={18} />
                                </div>
                                {r.pending_count > 0 && (
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${accent.border} ${accent.bg} ${accent.text}`}>
                                        {r.pending_count} pendiente(s)
                                    </span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-black">{r.name}</h3>
                                <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">{r.module_count} módulos · {r.lesson_count} lecciones</p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full ${accent.bar}`} style={{ width: `${r.pct}%` }} />
                                </div>
                                <p className="text-[10px] font-bold text-muted text-right">{r.pct}%</p>
                            </div>
                            <button onClick={() => onOpen(r.id)} className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white ${accent.bar}`}>
                                Continuar
                            </button>
                        </div>
                    );
                })}
            </div>
        )}
    </div>
);

const ModulesView = ({ modules, onOpen, onBack }) => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Playbook</p>
                <h1 className="text-2xl font-black tracking-tight">{modules[0]?.roadmap_name || 'Roadmap'}</h1>
            </div>
            <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted hover:text-white">
                <ChevronLeft size={14} /> Roadmaps
            </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map(m => (
                <div key={m.id} className="bg-surface border border-base rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted">Módulo #{m.order}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${m.status === 'completo' ? 'text-emerald-400' : m.status === 'en_curso' ? 'text-primary' : 'text-muted'}`}>
                            {m.status === 'completo' ? 'Completo' : m.status === 'en_curso' ? 'En curso' : 'No iniciado'}
                        </span>
                    </div>
                    <h3 className="text-base font-black">{m.name}</h3>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{m.lesson_count} lecciones</p>
                    <div className="space-y-1.5">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${m.lesson_count ? Math.round(100 * m.approved_count / m.lesson_count) : 0}%` }} />
                        </div>
                        <p className="text-[10px] font-bold text-muted">{m.approved_count}/{m.lesson_count} aprobadas</p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted">{m.total_minutes} min aprox.</span>
                        <button onClick={() => onOpen(m.id)} className="px-4 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest">Entrar</button>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const LessonsView = ({ moduleInfo, lessons, onOpen, onBack }) => (
    <div className="space-y-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted hover:text-white">
            <ChevronLeft size={14} /> Módulos · {moduleInfo?.roadmap_name}
        </button>
        <h1 className="text-2xl font-black tracking-tight">{moduleInfo?.name}</h1>
        <div className="max-w-2xl space-y-2">
            {lessons.map((l, i) => (
                <button key={l.id} onClick={() => onOpen(l.id)} className="w-full flex items-center gap-3 bg-surface border border-base rounded-2xl p-4 text-left hover:border-white/20 transition-all">
                    {l.state === 'completado' ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : (
                        <span className="w-[18px] h-[18px] rounded-full border border-base text-[9px] font-black flex items-center justify-center text-muted shrink-0">{i + 1}</span>
                    )}
                    <span className="flex-1 min-w-0 text-sm font-bold truncate">{l.title}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shrink-0 ${STATE_BADGE[l.state]}`}>{STATE_TEXT[l.state]}</span>
                    {l.duration_minutes != null && <span className="text-[10px] text-muted shrink-0">{l.duration_minutes} min</span>}
                </button>
            ))}
        </div>
    </div>
);

export default PlaybookOverlay;
