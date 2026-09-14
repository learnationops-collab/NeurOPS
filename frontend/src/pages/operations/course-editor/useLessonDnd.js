import { useMemo, useState } from 'react';
import {
    DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors,
    DragOverlay, defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// Encapsula el drag-and-drop de lecciones entre módulos de una misma área,
// calcado del patrón de CloserKanbanBoard.jsx (drag entre columnas): cada
// módulo es una lista sortable ("columna"), y `onDragOver` mueve la lección
// entre los arrays LOCALES de los módulos para que el usuario vea el cambio
// en tiempo real, sin esperar al servidor. `onDropped` se llama recién al
// soltar, con (moduleIdDestino, lessonIdsFinales, moduleIdOrigen, lessonIdsOrigenAntes)
// -- lo único que necesita el caller para pegarle al endpoint de reorder y
// armar el "Deshacer".
export function useLessonDnd(modules, setModules, onDropped) {
    const [activeLesson, setActiveLesson] = useState(null);
    const dragStartSnapshot = useMemo(() => ({ moduleId: null, lessonIds: null }), []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const findModuleOfLesson = (lessonId) => modules.find((m) => m.lessons.some((l) => l.id === lessonId));

    const handleDragStart = (event) => {
        const lessonId = event.active.id;
        const mod = findModuleOfLesson(lessonId);
        if (!mod) return;
        setActiveLesson(mod.lessons.find((l) => l.id === lessonId));
        dragStartSnapshot.moduleId = mod.id;
        dragStartSnapshot.lessonIds = mod.lessons.map((l) => l.id);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;
        const activeId = active.id;
        const overId = over.id;
        if (activeId === overId) return;

        const fromModule = findModuleOfLesson(activeId);
        // `over` puede ser otra lección (id de lección) o el módulo vacío (id "module-<id>")
        let toModule = findModuleOfLesson(overId);
        if (!toModule) {
            const match = modules.find((m) => `module-${m.id}` === overId);
            if (match) toModule = match;
        }
        if (!fromModule || !toModule) return;

        setModules((prev) => {
            const next = prev.map((m) => ({ ...m, lessons: [...m.lessons] }));
            const fromMod = next.find((m) => m.id === fromModule.id);
            const toMod = next.find((m) => m.id === toModule.id);
            const fromIndex = fromMod.lessons.findIndex((l) => l.id === activeId);
            if (fromIndex === -1) return prev;
            const [moved] = fromMod.lessons.splice(fromIndex, 1);

            if (fromMod.id === toMod.id) {
                const overIndex = toMod.lessons.findIndex((l) => l.id === overId);
                toMod.lessons.splice(overIndex === -1 ? toMod.lessons.length : overIndex, 0, moved);
            } else {
                const overIndex = toMod.lessons.findIndex((l) => l.id === overId);
                toMod.lessons.splice(overIndex === -1 ? toMod.lessons.length : overIndex, 0, moved);
            }
            return next;
        });
    };

    const handleDragEnd = (event) => {
        setActiveLesson(null);
        const { active } = event;
        const finalModule = findModuleOfLesson(active.id);
        if (!finalModule || !dragStartSnapshot.moduleId) return;

        const changed = finalModule.id !== dragStartSnapshot.moduleId ||
            finalModule.lessons.map((l) => l.id).join(',') !== dragStartSnapshot.lessonIds.join(',');

        if (changed) {
            onDropped(finalModule.id, finalModule.lessons.map((l) => l.id), dragStartSnapshot.moduleId, dragStartSnapshot.lessonIds);
        }
        dragStartSnapshot.moduleId = null;
        dragStartSnapshot.lessonIds = null;
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
    };

    return {
        sensors, activeLesson, dropAnimation,
        DndContext, DragOverlay, closestCorners,
        handleDragStart, handleDragOver, handleDragEnd,
    };
}
