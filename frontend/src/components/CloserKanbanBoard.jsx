import { useState } from 'react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
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
const KanbanCard = ({ item, isOverlay = false }) => {
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
    };

    const cardContent = (
        <div
            className={`bg-surface border border-base p-5 rounded-3xl shadow-sm hover:shadow-xl hover:border-primary/30 transition-all group cursor-grab active:cursor-grabbing ${isOverlay ? 'shadow-2xl border-primary ring-2 ring-primary/20' : ''}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-main border border-base flex items-center justify-center font-black text-muted group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                        {item.lead_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <h4 className="text-sm font-black italic tracking-tight">{item.lead_name}</h4>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{item.type || 'Primera Agenda'}</p>
                    </div>
                </div>
                <div {...attributes} {...listeners} className="p-2 text-muted hover:text-primary transition-colors">
                    <GripVertical size={16} />
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted">
                    <Calendar size={12} className="text-primary" />
                    <span className="text-[10px] font-bold uppercase">{new Date(item.start_time).toLocaleDateString()}</span>
                    <span className="text-[10px] font-black ml-auto opacity-50">{new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-base/50">
                    <Badge variant={item.status === 'completed' ? 'success' : 'primary'} className="px-2 py-0.5 text-[8px]">
                        {item.status}
                    </Badge>
                    {item.result && (
                        <Badge variant="neutral" className="px-2 py-0.5 text-[8px] border-primary/20 text-primary">
                            {item.result}
                        </Badge>
                    )}
                </div>
            </div>

            {item.linked_call && (
                <a
                    href={item.linked_call}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-main border border-base rounded-xl text-[9px] font-black uppercase text-muted hover:text-primary hover:border-primary/30 transition-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ExternalLink size={12} />
                    Ver Grabación
                </a>
            )}
        </div>
    );

    if (isOverlay) return cardContent;

    return (
        <div ref={setNodeRef} style={style}>
            {cardContent}
        </div>
    );
};

// --- Column Component ---
const KanbanColumn = ({ id, title, items }) => {
    return (
        <div className="flex flex-col w-[320px] min-w-[320px] bg-surface/30 rounded-[2.5rem] border border-base p-6 h-[calc(100vh-280px)]">
            <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                    <h3 className="text-[11px] font-black text-base uppercase tracking-[0.2em] italic">{title}</h3>
                </div>
                <Badge variant="neutral" className="rounded-lg h-6 min-w-[24px] flex items-center justify-center font-bold text-[10px]">
                    {items.length}
                </Badge>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {items.map(item => (
                        <KanbanCard key={item.id} item={item} />
                    ))}
                </SortableContext>

                {items.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-base rounded-[2rem] flex items-center justify-center opacity-20 group">
                        <p className="text-[9px] font-black uppercase tracking-widest group-hover:opacity-100 transition-opacity">Sin Agendas</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Board Component ---
const CloserKanbanBoard = ({ stages, board, onMove }) => {
    const [activeId, setActiveId] = useState(null);
    const [activeItem, setActiveItem] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);

        // Find the active item in the board
        for (const stage of Object.keys(board)) {
            const item = board[stage].find(i => i.id === active.id);
            if (item) {
                setActiveItem(item);
                break;
            }
        }
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Find current stage and target stage
        let activeStage = null;
        for (const stage of Object.keys(board)) {
            if (board[stage].find(i => i.id === activeId)) {
                activeStage = stage;
                break;
            }
        }

        let overStage = null;
        // Check if over is a stage header/container or an item
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
            onMove(activeId, activeStage, overStage);
        }
    };

    const handleDragEnd = (event) => {
        setActiveId(null);
        setActiveItem(null);
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
                    />
                ))}
            </div>

            <DragOverlay dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                    styles: {
                        active: {
                            opacity: '0.5',
                        },
                    },
                }),
            }}>
                {activeId ? <KanbanCard item={activeItem} isOverlay /> : null}
            </DragOverlay>
        </DndContext>
    );
};

export default CloserKanbanBoard;
