// Propiedades de una vista de Confirmar (ADR-W220, W222): qué se ve y en qué orden. Las filas no se mueven al
// prender o apagar (antes las prendidas subían y la fila tocada saltaba de lugar); se ordenan arrastrando
// cualquier fila (dnd-kit). El orden se guarda en `ordenProps` solo al arrastrar, y sin las preguntas del
// formulario salvo que se hayan ordenado: con todas, las preferencias pasaban el tope del servidor y no se guardaban.
import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '../../../components/standard';

const Titulo = ({ children, accion }) => (
    <div className="cv-pop__tit"><span>{children}</span>{accion}</div>
);

// El orden de todas las propiedades: el que se arrastró y, detrás, el del catálogo. No depende de qué está
// prendido, así prender o apagar no mueve ninguna fila.
export function ordenDePropiedades(vista, catalogo) {
    const claves = catalogo.map(p => p.clave);
    const visibles = vista.props.filter(k => claves.includes(k));
    const guardado = (vista.ordenProps || []).filter(k => claves.includes(k));
    return { visibles, guardado, orden: [...guardado, ...claves.filter(k => !guardado.includes(k))] };
}

function Fila({ p, on, onAlternar }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.clave });
    return (
        <div ref={setNodeRef} className={`cv-op cv-op--orden${isDragging ? ' cv-op--arr' : ''}`}
            style={{ transform: CSS.Translate.toString(transform), transition }} {...listeners}>
            <span className="cv-op__mango" {...attributes} aria-label={`Mover ${p.titulo}`}><GripVertical className="cv-op__asa" aria-hidden="true" /></span>
            <span className="cv-op__t" title={p.titulo}>{p.titulo}</span>
            <Switch checked={on} onChange={onAlternar} label={`Mostrar ${p.titulo}`} />
        </div>
    );
}

export default function Propiedades({ vista, catalogo, onCambio }) {
    const [q, setQ] = useState('');
    const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
    const { visibles, guardado, orden } = ordenDePropiedades(vista, catalogo);
    const esFormulario = (k) => !!catalogo.find(p => p.clave === k)?.formulario;
    const buscado = q.trim().toLowerCase();
    const de = (formulario) => orden.map(k => catalogo.find(p => p.clave === k))
        .filter(p => !!p.formulario === formulario && p.titulo.toLowerCase().includes(buscado));
    // Lo prendido siempre en el orden de la lista: así las etiquetas salen en ese orden.
    const mostrar = (nuevasVisibles) => onCambio({ props: orden.filter(k => nuevasVisibles.includes(k)) });
    const alternar = (k) => mostrar(visibles.includes(k) ? visibles.filter(x => x !== k) : [...visibles, k]);
    const soltar = ({ active, over }) => {
        if (!over || active.id === over.id || esFormulario(active.id) !== esFormulario(over.id)) return;
        const nuevo = arrayMove(orden, orden.indexOf(active.id), orden.indexOf(over.id));
        const conFormulario = esFormulario(active.id) || guardado.some(esFormulario);
        onCambio({
            ordenProps: nuevo.filter(k => conFormulario || !esFormulario(k)),
            props: nuevo.filter(k => visibles.includes(k)),
        });
    };
    const lista = (items) => (
        <SortableContext items={items.map(p => p.clave)} strategy={verticalListSortingStrategy}>
            {items.map(p => <Fila key={p.clave} p={p} on={visibles.includes(p.clave)} onAlternar={() => alternar(p.clave)} />)}
        </SortableContext>
    );
    const agenda = de(false), formulario = de(true);
    return (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
            <input className="cv-pop__q" placeholder="Buscar una propiedad" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <Titulo accion={visibles.length > 0 && <button type="button" onClick={() => mostrar([])}>Ocultar todas</button>}>Agenda</Titulo>
            <div className="cv-op cv-op--fija"><span className="cv-op__t">Nombre</span><small>siempre</small></div>
            {lista(agenda)}
            <Titulo accion={formulario.length > 0 && (
                <button type="button" onClick={() => mostrar([...visibles, ...formulario.map(p => p.clave)])}>Mostrar todas</button>
            )}>Respuestas del formulario</Titulo>
            {formulario.length ? lista(formulario) : <p className="cv-pop__nada">Ningún lead del tablero respondió un formulario.</p>}
        </DndContext>
    );
}
