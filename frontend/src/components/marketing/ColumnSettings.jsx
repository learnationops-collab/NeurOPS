import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Settings, Check } from 'lucide-react';

const SortableItem = ({ column, onToggle }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: column.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between p-3 rounded-xl border mb-2 transition-colors ${
                isDragging ? 'bg-slate-800 border-blue-500 shadow-2xl' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
        >
            <div className="flex items-center gap-3">
                <button 
                    {...attributes} 
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                    <GripVertical size={16} />
                </button>
                <span className={`text-[10px] font-black uppercase tracking-wider ${column.visible ? 'text-white' : 'text-slate-600'}`}>
                    {column.label}
                </span>
            </div>
            
            <button
                onClick={() => onToggle(column.id)}
                className={`p-2 rounded-lg transition-all ${
                    column.visible 
                        ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' 
                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                }`}
            >
                {column.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
        </div>
    );
};

const ColumnSettings = ({ columns, setColumns }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = columns.findIndex((col) => col.id === active.id);
            const newIndex = columns.findIndex((col) => col.id === over.id);
            setColumns(arrayMove(columns, oldIndex, newIndex));
        }
    };

    const toggleColumn = (id) => {
        setColumns(columns.map(col => 
            col.id === id ? { ...col, visible: !col.visible } : col
        ));
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                    isOpen 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title="Configurar Columnas"
            >
                <Settings size={16} className={isOpen ? 'animate-spin-slow' : ''} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Columnas</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-[100] p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personalizar Vista</h4>
                        <span className="text-[8px] font-bold text-slate-600 bg-slate-950 px-2 py-0.5 rounded-full">
                            {columns.filter(c => c.visible).length} / {columns.length}
                        </span>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={columns.map(c => c.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {columns.map((column) => (
                                    <SortableItem 
                                        key={column.id} 
                                        column={column} 
                                        onToggle={toggleColumn} 
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Cerrar Panel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColumnSettings;
