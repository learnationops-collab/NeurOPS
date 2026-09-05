import { useState, useEffect } from 'react';
import { GraduationCap, Plus, Pencil, Trash2, RefreshCw, EyeOff, Users, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Card from '../ui/Card';
import PlaybookLessonFormModal from './PlaybookLessonFormModal';

const ACCENT_OPTIONS = [
    { value: 'magenta', label: 'Magenta', className: 'bg-pink-500' },
    { value: 'blue', label: 'Azul', className: 'bg-blue-500' },
    { value: 'green', label: 'Verde', className: 'bg-emerald-500' },
];

const ROLE_LABELS = {
    admin: 'Admin', operator: 'Operador', closer: 'Closer', setter: 'Setter',
    triage: 'Call Confirmer', director_comercial: 'Dir. Comercial', director_marketing: 'Dir. Marketing',
};

const PlaybookAdminPanel = () => {
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});
    const [formState, setFormState] = useState(null); // null | { moduleId } | lesson-object (edit)
    const [newRoadmapName, setNewRoadmapName] = useState('');
    const [newModuleFor, setNewModuleFor] = useState(null);
    const [newModuleName, setNewModuleName] = useState('');

    const fetchOverview = () => {
        setLoading(true);
        api.get('/playbook/admin/overview')
            .then(res => setOverview(res.data))
            .catch(() => toast.error('No se pudo cargar el Playbook'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchOverview(); }, []);

    const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    const handleCreateRoadmap = async (e) => {
        e.preventDefault();
        if (!newRoadmapName.trim()) return;
        try {
            await api.post('/playbook/roadmaps', { name: newRoadmapName.trim(), accent: ACCENT_OPTIONS[(overview?.roadmaps.length || 0) % 3].value });
            setNewRoadmapName('');
            fetchOverview();
        } catch {
            toast.error('No se pudo crear el roadmap');
        }
    };

    const handleCreateModule = async (roadmapId) => {
        if (!newModuleName.trim()) return;
        try {
            await api.post('/playbook/modules', { roadmap_id: roadmapId, name: newModuleName.trim() });
            setNewModuleName('');
            setNewModuleFor(null);
            fetchOverview();
        } catch {
            toast.error('No se pudo crear el módulo');
        }
    };

    const handleDeleteRoadmap = async (roadmap) => {
        if (!window.confirm(`¿Eliminar el roadmap "${roadmap.name}" con todos sus módulos y lecciones?`)) return;
        try {
            await api.delete(`/playbook/roadmaps/${roadmap.id}`);
            fetchOverview();
        } catch {
            toast.error('No se pudo eliminar el roadmap');
        }
    };

    const handleDeleteModule = async (module) => {
        if (!window.confirm(`¿Eliminar el módulo "${module.name}" con todas sus lecciones?`)) return;
        try {
            await api.delete(`/playbook/modules/${module.id}`);
            fetchOverview();
        } catch {
            toast.error('No se pudo eliminar el módulo');
        }
    };

    const handleDeleteLesson = async (lesson) => {
        if (!window.confirm(`¿Eliminar la lección "${lesson.title}"?`)) return;
        try {
            await api.delete(`/playbook/lessons/${lesson.id}`);
            fetchOverview();
        } catch {
            toast.error('No se pudo eliminar la lección');
        }
    };

    const handleTogglePublish = async (lesson) => {
        try {
            await api.put(`/playbook/lessons/${lesson.id}`, {
                title: lesson.title, description: lesson.description, loom_link: lesson.loom_link,
                duration_minutes: lesson.duration_minutes, target_roles: lesson.target_roles,
                is_active: !lesson.is_active,
            });
            fetchOverview();
        } catch {
            toast.error('No se pudo cambiar la publicación');
        }
    };

    const handleEditLesson = async (lesson) => {
        try {
            const res = await api.get(`/playbook/lessons/${lesson.id}/admin`);
            setFormState(res.data);
        } catch {
            toast.error('No se pudo cargar la lección');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <RefreshCw className="animate-spin text-indigo-500" size={32} />
                <span className="text-xs font-black uppercase tracking-widest text-muted">Cargando Playbook...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
                        <GraduationCap size={22} /> Playbook — Formación interna
                    </h2>
                    <p className="text-xs text-muted uppercase tracking-widest font-medium">Roadmap → Módulo → Lección, con quiz de comprensión</p>
                </div>
                <button onClick={fetchOverview} className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-black tracking-wider uppercase text-white transition-all">
                    <RefreshCw size={14} /> Refrescar
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card variant="surface" className="p-4 bg-surface/30 border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted">Lecciones publicadas</p>
                    <p className="text-2xl font-black mt-1">{overview.lessons_published}</p>
                </Card>
                <Card variant="surface" className="p-4 bg-surface/30 border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted">Cumplimiento del equipo</p>
                    <p className="text-2xl font-black mt-1 text-emerald-400">{overview.compliance_pct}%</p>
                </Card>
                <Card variant="surface" className="p-4 bg-surface/30 border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted">Pendientes en el equipo</p>
                    <p className="text-2xl font-black mt-1">{overview.pending_total}</p>
                </Card>
                <Card variant="surface" className="p-4 bg-surface/30 border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted">Publicadas esta semana</p>
                    <p className="text-2xl font-black mt-1 text-primary">{overview.published_this_week}</p>
                </Card>
            </div>

            {overview.by_role.length > 0 && (
                <Card variant="surface" className="p-5 bg-surface/30 border-white/5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted">Cumplimiento por rol</p>
                    <div className="space-y-2.5">
                        {overview.by_role.map(r => (
                            <div key={r.role} className="flex items-center gap-3">
                                <span className="text-xs font-bold w-32 shrink-0">{ROLE_LABELS[r.role] || r.role}</span>
                                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${r.pct}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-muted w-14 text-right shrink-0">{r.done}/{r.total}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <form onSubmit={handleCreateRoadmap} className="flex items-center gap-2">
                <input
                    value={newRoadmapName}
                    onChange={(e) => setNewRoadmapName(e.target.value)}
                    placeholder="Nombre del nuevo roadmap (ej: Skills)"
                    className="flex-1 bg-main border border-base rounded-2xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button type="submit" className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shrink-0">
                    <Plus size={14} /> Roadmap
                </button>
            </form>

            <div className="space-y-4">
                {overview.roadmaps.map(roadmap => (
                    <Card key={roadmap.id} variant="surface" className="p-5 bg-surface/30 border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${ACCENT_OPTIONS.find(a => a.value === roadmap.accent)?.className || 'bg-pink-500'}`} />
                                <h3 className="text-base font-black">{roadmap.name}</h3>
                                <span className="text-[10px] text-muted font-bold">{roadmap.modules.length} módulo(s)</span>
                            </div>
                            <button onClick={() => handleDeleteRoadmap(roadmap)} className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all">
                                <Trash2 size={13} />
                            </button>
                        </div>

                        <div className="pl-2 border-l-2 border-white/5 space-y-2">
                            {roadmap.modules.map(module => (
                                <div key={module.id} className="space-y-1.5">
                                    <div className="flex items-center gap-2 group">
                                        <button onClick={() => toggleExpand(module.id)} className="text-muted hover:text-white">
                                            {expanded[module.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <span className="text-sm font-bold flex-1">{module.name}</span>
                                        <span className="text-[10px] text-muted">{module.lessons.length} lección(es)</span>
                                        <button onClick={() => setFormState({ module_id: module.id })} className="text-[9px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                            + Lección
                                        </button>
                                        <button onClick={() => handleDeleteModule(module)} className="p-1.5 rounded-lg text-muted hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>

                                    {expanded[module.id] && (
                                        <div className="pl-6 space-y-1.5">
                                            {module.lessons.map(lesson => (
                                                <div key={lesson.id} className="flex items-center gap-2 bg-main/60 border border-base rounded-xl px-3 py-2">
                                                    <span className="flex-1 min-w-0 text-xs font-bold truncate">{lesson.title}</span>
                                                    {!lesson.is_active && <EyeOff size={12} className="text-muted shrink-0" />}
                                                    <span className="flex items-center gap-1 text-[9px] text-muted shrink-0"><CheckCircle2 size={11} /> {lesson.question_count}</span>
                                                    <span className="flex items-center gap-1 text-[9px] text-muted shrink-0"><Users size={11} /> {lesson.completed_count}/{lesson.assigned_count}</span>
                                                    <span className="text-[9px] text-muted shrink-0">{lesson.audience_label}</span>
                                                    <button onClick={() => handleEditLesson(lesson)} className="p-1.5 rounded-lg text-muted hover:text-white shrink-0"><Pencil size={12} /></button>
                                                    <button onClick={() => handleTogglePublish(lesson)} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${lesson.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-muted hover:bg-white/5'}`}>
                                                        {lesson.is_active ? 'Publicada' : 'Despublicada'}
                                                    </button>
                                                    <button onClick={() => handleDeleteLesson(lesson)} className="p-1.5 rounded-lg text-muted hover:text-rose-500 shrink-0"><Trash2 size={12} /></button>
                                                </div>
                                            ))}
                                            {module.lessons.length === 0 && (
                                                <p className="text-[10px] text-muted italic">Sin lecciones todavía.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {newModuleFor === roadmap.id ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        value={newModuleName}
                                        onChange={(e) => setNewModuleName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateModule(roadmap.id)}
                                        placeholder="Nombre del módulo"
                                        className="flex-1 bg-main border border-base rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    <button onClick={() => handleCreateModule(roadmap.id)} className="text-[10px] font-black uppercase tracking-widest text-primary">Crear</button>
                                    <button onClick={() => { setNewModuleFor(null); setNewModuleName(''); }} className="text-[10px] font-black uppercase tracking-widest text-muted">Cancelar</button>
                                </div>
                            ) : (
                                <button onClick={() => setNewModuleFor(roadmap.id)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted hover:text-primary">
                                    <Plus size={12} /> Módulo
                                </button>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {formState && (
                <PlaybookLessonFormModal
                    lesson={formState.id ? formState : null}
                    defaultModuleId={formState.module_id}
                    onClose={() => setFormState(null)}
                    onSaved={() => { setFormState(null); fetchOverview(); }}
                />
            )}
        </div>
    );
};

export default PlaybookAdminPanel;
