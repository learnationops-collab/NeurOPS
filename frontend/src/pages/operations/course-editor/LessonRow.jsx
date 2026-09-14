import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FolderInput, Pencil, Trash2, CheckCircle2, EyeOff } from 'lucide-react';

// `onJumpModule(dir)`: Alt+flecha salta la lección al módulo anterior/siguiente
// DENTRO de la misma área -- atajo rápido para el caso común; para moverla a
// otra área hace falta el modal (icono FolderInput / MoveLessonModal).
const LessonRow = ({ lesson, onEdit, onDelete, onOpenMove, onJumpModule, isOverlay = false }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });

    const style = { transform: CSS.Translate.toString(transform), transition };

    const handleKeyDown = (e) => {
        if (!e.altKey) return;
        if (e.key === 'ArrowUp') { e.preventDefault(); onJumpModule(-1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onJumpModule(1); }
    };

    return (
        <div
            ref={!isOverlay ? setNodeRef : null}
            style={!isOverlay ? style : undefined}
            className={`lesson-row${isDragging ? ' is-dragging' : ''}`}
        >
            <button
                type="button"
                className="lesson-row__handle"
                aria-label={`Mover ${lesson.title}. Flechas arriba y abajo para reordenar, Alt más flecha para cambiar de módulo`}
                onKeyDown={handleKeyDown}
                {...(!isOverlay ? { ...attributes, ...listeners } : {})}
            >
                <GripVertical size={16} />
            </button>

            <div className="lesson-row__body">
                <p className="lesson-row__title">{lesson.title}</p>
                <div className="lesson-row__meta">
                    <span>{lesson.question_count} pregunta{lesson.question_count === 1 ? '' : 's'}</span>
                    <span>· {lesson.seen_count ?? 0}/{lesson.assigned_count ?? 0} la vieron</span>
                    <span>· {lesson.audience_label}</span>
                </div>
            </div>

            <span className={`lesson-row__status ${lesson.is_active ? 'is-published' : 'is-draft'}`}>
                {lesson.is_active ? <CheckCircle2 size={11} /> : <EyeOff size={11} />}
                {lesson.is_active ? 'Publicada' : 'Sin publicar'}
            </span>

            <span className="lesson-row__actions">
                <button type="button" className="icon-btn" title="Mover a otro módulo o área" aria-label={`Mover ${lesson.title} a otro módulo o área`} onClick={() => onOpenMove(lesson)}>
                    <FolderInput size={14} />
                </button>
                <button type="button" className="icon-btn" title="Editar" aria-label={`Editar ${lesson.title}`} onClick={() => onEdit(lesson)}>
                    <Pencil size={14} />
                </button>
                <button type="button" className="icon-btn danger" title="Eliminar" aria-label={`Eliminar ${lesson.title}`} onClick={() => onDelete(lesson)}>
                    <Trash2 size={14} />
                </button>
            </span>
        </div>
    );
};

export default LessonRow;
