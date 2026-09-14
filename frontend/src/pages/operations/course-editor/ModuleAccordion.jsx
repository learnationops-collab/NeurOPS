import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, Copy, Trash2, Plus } from 'lucide-react';
import LessonRow from './LessonRow';

const ModuleAccordion = ({
    module, expanded, onToggle, onRename, onDuplicate, onDelete,
    onAddLesson, onEditLesson, onDeleteLesson, onOpenMove, onJumpModule,
}) => {
    const { setNodeRef, isOver } = useDroppable({ id: `module-${module.id}` });
    const [name, setName] = useState(module.name);

    const commitName = () => {
        const trimmed = name.trim();
        if (trimmed && trimmed !== module.name) onRename(module, trimmed);
        else setName(module.name);
    };

    return (
        <div className={`module-accordion${isOver ? ' is-drop-target' : ''}`}>
            <div className="module-accordion__header">
                <button type="button" className="module-accordion__chevron" onClick={() => onToggle(module.id)} aria-label={expanded ? `Contraer ${module.name}` : `Expandir ${module.name}`}>
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <input
                    className="module-accordion__name"
                    value={name}
                    aria-label="Nombre del módulo"
                    onChange={(e) => setName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                />
                <span className="module-accordion__count">{module.lessons.length} {module.lessons.length === 1 ? 'lección' : 'lecciones'}</span>
                <span className="module-accordion__actions">
                    <button type="button" className="icon-btn" title="Duplicar módulo" aria-label={`Duplicar ${module.name}`} onClick={() => onDuplicate(module)}>
                        <Copy size={14} />
                    </button>
                    <button type="button" className="icon-btn danger" title="Eliminar módulo" aria-label={`Eliminar ${module.name}`} onClick={() => onDelete(module)}>
                        <Trash2 size={14} />
                    </button>
                </span>
            </div>

            {expanded && (
                <div className="module-accordion__body" ref={setNodeRef}>
                    <SortableContext items={module.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                        {module.lessons.map((lesson) => (
                            <LessonRow
                                key={lesson.id}
                                lesson={lesson}
                                onEdit={onEditLesson}
                                onDelete={onDeleteLesson}
                                onOpenMove={onOpenMove}
                                onJumpModule={(dir) => onJumpModule(module, lesson, dir)}
                            />
                        ))}
                    </SortableContext>
                    {module.lessons.length === 0 && <p className="empty-hint">Sin lecciones todavía — arrastrá una acá o agregá una nueva.</p>}
                    <button type="button" className="dashed-add-btn" onClick={() => onAddLesson(module)}>
                        <Plus size={15} /> Lección
                    </button>
                </div>
            )}
        </div>
    );
};

export default ModuleAccordion;
