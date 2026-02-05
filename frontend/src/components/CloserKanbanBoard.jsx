import { useState, memo, useMemo } from 'react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ChevronLeft,
    ChevronRight,
    User,
    Calendar,
    Clock,
    MessageSquare,
    ExternalLink,
    GripVertical,
    ArrowRight
} from 'lucide-react';
import Badge from './ui/Badge';

// --- Sortable Item Component ---
const KanbanCard = memo(({ item, stages = [], currentStage = null, onMove, onCardClick, isOverlay = false }) => {
    if (!item) return null;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none'
    };

    const handleCardClick = (e) => {
        if (onCardClick) onCardClick(item);
    };

    const cardContent = (
        <div
            ref={!isOverlay ? setNodeRef : null}
            style={style}
            {...(!isOverlay ? { ...attributes, ...listeners } : {})}
            onClick={handleCardClick}
            className={`bg-surface border border-base p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-primary/30 transition-all group cursor-grab active:cursor-grabbing relative overflow-hidden select-none ${isOverlay ? 'shadow-2xl border-primary ring-2 ring-primary/20 scale-105' : ''}`}
        >
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <h4 className="text-sm font-black italic tracking-tighter uppercase leading-tight">{item.lead_name}</h4>
                    <div className="flex items-center gap-2 text-muted">
                        <Calendar size={10} className="text-primary/40" />
                        <span className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">
                            {new Date(item.start_time).toLocaleDateString()} - {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
                <div className="p-1.5 bg-main rounded-xl text-muted group-hover:text-primary transition-colors opacity-30 group-hover:opacity-100 border border-base">
                    <GripVertical size={14} />
                </div>
            </div>
        </div>
    );

    return cardContent;
});

// --- Column Component ---
const KanbanColumn = memo(({ id, title, items, stages, onMove, onCardClick, onSetOutcome }) => {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col w-[320px] min-w-[320px] bg-surface/30 rounded-[2.5rem] border transition-colors p-6 h-[calc(100vh-280px)] select-none ${isOver ? 'border-primary/50 bg-primary/5' : 'border-base'}`}
        >
            <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                    <h3 className="text-[11px] font-black text-base tracking-[0.2em] italic">{title}</h3>
                </div>
                <Badge variant="neutral" className="rounded-lg h-6 min-w-[24px] flex items-center justify-center font-bold text-[10px]">
                    {items.length}
                </Badge>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {items.map(item => (
                        <KanbanCard
                            key={item.id}
                            item={item}
                            stages={stages}
                            currentStage={id}
                            onMove={onMove}
                            onCardClick={onCardClick}
                            onSetOutcome={onSetOutcome}
                        />
                    ))}
                </SortableContext>

                {items.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-base rounded-[2rem] flex items-center justify-center opacity-20 group">
                        <p className="text-[9px] font-black tracking-widest group-hover:opacity-100 transition-opacity">Sin agendas</p>
                    </div>
                )}
            </div>
        </div>
    );
});

// --- Main Board Component ---
const CloserKanbanBoard = ({ stages, board, onMove, onCardClick, onSetOutcome }) => {
    const [activeId, setActiveId] = useState(null);
    const [activeItem, setActiveItem] = useState(null);

    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5,
        },
    });

    const keyboardSensor = useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    });

    const sensors = useMemo(() => useSensors(pointerSensor, keyboardSensor), [pointerSensor, keyboardSensor]);

    const handleDragStart = (event) => {
        const { active } = event;

        // Find item first to ensure state is ready before re-render
        let foundItem = null;
        for (const stage of Object.keys(board)) {
            const item = board[stage].find(i => i.id === active.id);
            if (item) {
                foundItem = item;
                break;
            }
        }

        if (foundItem) {
            setActiveItem(foundItem);
            setActiveId(active.id);
            document.body.classList.add('select-none');
            document.body.classList.add('touch-none');
        }
    };

    const lastMoveRef = useMemo(() => ({ id: null, toStage: null }), []);

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Prevent redundant moves for the same item to the same stage
        if (lastMoveRef.id === activeId && lastMoveRef.toStage === overId) return;

        let activeStage = null;
        for (const stage of Object.keys(board)) {
            if (board[stage].find(i => i.id === activeId)) {
                activeStage = stage;
                break;
            }
        }

        let overStage = null;
        if (stages.includes(overId)) {
            overStage = overId;
        } else {
            for (const stage of Object.keys(board)) {
                if (board[stage].find(i => i.id === overId)) {
                    overStage = stage;
                    break;
                }
            }
        }

        if (activeStage && overStage && activeStage !== overStage) {
            lastMoveRef.id = activeId;
            lastMoveRef.toStage = overStage;
            onMove(activeId, activeStage, overStage);
        }
    };

    const handleDragEnd = (event) => {
        setActiveId(null);
        setActiveItem(null);
        document.body.classList.remove('select-none');
        document.body.classList.remove('touch-none');
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-6 overflow-x-auto pb-8 pt-4 custom-scrollbar">
                {stages.map(stage => (
                    <KanbanColumn
                        key={stage}
                        id={stage}
                        title={stage}
                        items={board[stage] || []}
                        stages={stages}
                        onMove={onMove}
                        onCardClick={onCardClick}
                        onSetOutcome={onSetOutcome}
                    />
                ))}
            </div>

            <DragOverlay dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                    styles: {
                        active: {
                            opacity: '0.4',
                        },
                    },
                }),
            }}>
                {activeId ? (
                    <KanbanCard
                        item={activeItem}
                        stages={stages}
                        currentStage={activeItem?.last_stage}
                        isOverlay
                        onCardClick={onCardClick}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default memo(CloserKanbanBoard);
