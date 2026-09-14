import { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { ArrowLeft, Plus, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import ModuleAccordion from './ModuleAccordion';
import EditLessonModal from './EditLessonModal';
import MoveLessonModal from './MoveLessonModal';
import UndoToast from './UndoToast';
import LessonRow from './LessonRow';
import { useLessonDnd } from './useLessonDnd';
import { DEFAULT_ICON } from './constants';
import { flattenModules, chipTone } from './treeHelpers';

const AreaDetail = ({ roadmap, overview, onBack, onRefetch }) => {
    const [modules, setModules] = useState(roadmap.modules);
    const [expanded, setExpanded] = useState(() => new Set(roadmap.modules.map((m) => m.id)));
    const [title, setTitle] = useState(roadmap.name);
    const [newModuleOpen, setNewModuleOpen] = useState(false);
    const [newModuleName, setNewModuleName] = useState('');
    const [editingLesson, setEditingLesson] = useState(null); // null | 'new' | lesson-admin-object
    const [newLessonModuleId, setNewLessonModuleId] = useState(null);
    const [movingLesson, setMovingLesson] = useState(null);

    useEffect(() => { setModules(roadmap.modules); setTitle(roadmap.name); }, [roadmap]);

    const flatModules = flattenModules(overview);
    const Icon = LucideIcons[roadmap.icon] || LucideIcons[DEFAULT_ICON];
    const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);

    const toggleModule = (id) => setExpanded((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const commitTitle = async () => {
        const trimmed = title.trim();
        if (!trimmed || trimmed === roadmap.name) { setTitle(roadmap.name); return; }
        try {
            await api.put(`/playbook/roadmaps/${roadmap.id}`, { name: trimmed });
            onRefetch();
        } catch {
            toast.error('No se pudo renombrar el área');
            setTitle(roadmap.name);
        }
    };

    const createModule = async () => {
        if (!newModuleName.trim()) return;
        try {
            await api.post('/playbook/modules', { roadmap_id: roadmap.id, name: newModuleName.trim() });
            setNewModuleName('');
            setNewModuleOpen(false);
            onRefetch();
        } catch {
            toast.error('No se pudo crear el módulo');
        }
    };

    const renameModule = async (module, name) => {
        try {
            await api.put(`/playbook/modules/${module.id}`, { name });
            onRefetch();
        } catch {
            toast.error('No se pudo renombrar el módulo');
        }
    };

    const duplicateModule = async (module) => {
        try {
            await api.post(`/playbook/modules/${module.id}/duplicate`);
            toast.success(`"${module.name}" duplicado`);
            onRefetch();
        } catch {
            toast.error('No se pudo duplicar el módulo');
        }
    };

    const deleteModule = async (module) => {
        if (!window.confirm(`¿Eliminar el módulo "${module.name}" con todas sus lecciones?`)) return;
        try {
            await api.delete(`/playbook/modules/${module.id}`);
            onRefetch();
        } catch {
            toast.error('No se pudo eliminar el módulo');
        }
    };

    const deleteLesson = async (lesson) => {
        if (!window.confirm(`¿Eliminar la lección "${lesson.title}"?`)) return;
        try {
            await api.delete(`/playbook/lessons/${lesson.id}`);
            onRefetch();
        } catch {
            toast.error('No se pudo eliminar la lección');
        }
    };

    const openEditLesson = async (lesson) => {
        try {
            const res = await api.get(`/playbook/lessons/${lesson.id}/admin`);
            setEditingLesson(res.data);
        } catch {
            toast.error('No se pudo cargar la lección');
        }
    };

    const openNewLesson = (module) => {
        setNewLessonModuleId(module.id);
        setEditingLesson('new');
    };

    const closeEditModal = () => { setEditingLesson(null); setNewLessonModuleId(null); };
    const handleLessonSaved = () => { closeEditModal(); onRefetch(); };

    // --- Reorder / mover (drag, modal, Alt+flecha) — todos pegan al mismo endpoint ---
    const commitReorder = async (moduleId, lessonIds, originModuleId, originLessonIds) => {
        try {
            await api.put(`/playbook/modules/${moduleId}/lessons/reorder`, { lesson_ids: lessonIds });
            onRefetch();
            if (originModuleId) {
                toast.custom((t) => (
                    <UndoToast
                        message="Orden actualizado"
                        onDismiss={() => toast.dismiss(t.id)}
                        onUndo={async () => {
                            try {
                                await api.put(`/playbook/modules/${originModuleId}/lessons/reorder`, { lesson_ids: originLessonIds });
                                onRefetch();
                            } catch {
                                toast.error('No se pudo deshacer');
                            }
                        }}
                    />
                ), { duration: 5000 });
            }
        } catch {
            toast.error('No se pudo reordenar');
            onRefetch();
        }
    };

    const handleDropped = (destModuleId, destLessonIds, originModuleId, originLessonIds) => {
        commitReorder(destModuleId, destLessonIds, originModuleId, originLessonIds);
    };

    const handleMoveConfirm = async (targetModuleId, position) => {
        const targetModule = modules.find((m) => m.id === targetModuleId) || { lessons: [] };
        const originModule = modules.find((m) => m.lessons.some((l) => l.id === movingLesson.id));
        const withoutLesson = targetModule.lessons.filter((l) => l.id !== movingLesson.id).map((l) => l.id);
        const finalIds = position === 'start' ? [movingLesson.id, ...withoutLesson] : [...withoutLesson, movingLesson.id];
        await commitReorder(targetModuleId, finalIds, originModule?.id, originModule?.lessons.map((l) => l.id));
        setMovingLesson(null);
    };

    const handleJumpModule = (module, lesson, dir) => {
        const index = modules.findIndex((m) => m.id === module.id);
        const target = modules[index + dir];
        if (!target) return;
        const originIds = module.lessons.map((l) => l.id);
        const destIds = dir > 0 ? [lesson.id, ...target.lessons.map((l) => l.id)] : [...target.lessons.map((l) => l.id), lesson.id];
        commitReorder(target.id, destIds, module.id, originIds);
    };

    const pct = roadmap.avg_progress_pct ?? 0;

    return (
        <section>
            <button type="button" className="ce-back-btn" onClick={onBack}><ArrowLeft size={14} /> Todas las áreas</button>

            <div className="area-detail__header" style={{ marginTop: 18 }}>
                <div className="area-detail__identity">
                    <span className="area-detail__icon"><Icon size={24} /></span>
                    <input
                        className="area-detail__title"
                        value={title}
                        aria-label="Nombre del área"
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                    />
                </div>
                <span className="area-detail__pill">{modules.length} módulo{modules.length === 1 ? '' : 's'}</span>
            </div>

            <div className="area-detail__toolbar">
                <span className="chip">{totalLessons} {totalLessons === 1 ? 'lección' : 'lecciones'}</span>
                <span className={`chip tone-${chipTone(pct)}`}>{pct}% de avance</span>
                <div style={{ flex: 1 }} />
                {newModuleOpen ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input autoFocus className="form-input" style={{ width: 220 }} placeholder="Nombre del módulo" value={newModuleName}
                            onChange={(e) => setNewModuleName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') createModule(); if (e.key === 'Escape') setNewModuleOpen(false); }} />
                        <button type="button" className="icon-btn" onClick={createModule} aria-label="Crear módulo"><Check size={14} /></button>
                        <button type="button" className="icon-btn" onClick={() => setNewModuleOpen(false)} aria-label="Cancelar"><X size={14} /></button>
                    </div>
                ) : (
                    <button type="button" className="btn-primary-pill" onClick={() => setNewModuleOpen(true)}><Plus size={15} /> Módulo</button>
                )}
            </div>

            {modules.length === 0 && (
                <div className="ce-empty">
                    <h2>Sin módulos todavía</h2>
                    <p>Creá el primero para empezar a cargar lecciones.</p>
                </div>
            )}

            <LessonDndArea
                modules={modules}
                setModules={setModules}
                onDropped={handleDropped}
                expanded={expanded}
                onToggle={toggleModule}
                onRenameModule={renameModule}
                onDuplicateModule={duplicateModule}
                onDeleteModule={deleteModule}
                onAddLesson={openNewLesson}
                onEditLesson={openEditLesson}
                onDeleteLesson={deleteLesson}
                onOpenMove={setMovingLesson}
                onJumpModule={handleJumpModule}
            />

            {editingLesson && (
                <EditLessonModal
                    lesson={editingLesson === 'new' ? null : editingLesson}
                    defaultModuleId={newLessonModuleId}
                    flatModules={flatModules}
                    onClose={closeEditModal}
                    onSaved={handleLessonSaved}
                />
            )}

            {movingLesson && (
                <MoveLessonModal
                    lesson={movingLesson}
                    flatModules={flatModules}
                    onClose={() => setMovingLesson(null)}
                    onConfirm={handleMoveConfirm}
                />
            )}
        </section>
    );
};

// Subcomponente local: solo lo usa AreaDetail, no amerita archivo propio.
const LessonDndArea = ({
    modules, setModules, onDropped, expanded, onToggle,
    onRenameModule, onDuplicateModule, onDeleteModule, onAddLesson, onEditLesson, onDeleteLesson, onOpenMove, onJumpModule,
}) => {
    const {
        sensors, activeLesson, dropAnimation, DndContext, DragOverlay, closestCorners,
        handleDragStart, handleDragOver, handleDragEnd,
    } = useLessonDnd(modules, setModules, onDropped);

    return (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div className="module-list">
                {modules.map((module) => (
                    <ModuleAccordion
                        key={module.id}
                        module={module}
                        expanded={expanded.has(module.id)}
                        onToggle={onToggle}
                        onRename={onRenameModule}
                        onDuplicate={onDuplicateModule}
                        onDelete={onDeleteModule}
                        onAddLesson={onAddLesson}
                        onEditLesson={onEditLesson}
                        onDeleteLesson={onDeleteLesson}
                        onOpenMove={onOpenMove}
                        onJumpModule={onJumpModule}
                    />
                ))}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
                {activeLesson ? <LessonRow lesson={activeLesson} isOverlay onEdit={() => {}} onDelete={() => {}} onOpenMove={() => {}} onJumpModule={() => {}} /> : null}
            </DragOverlay>
        </DndContext>
    );
};

export default AreaDetail;
