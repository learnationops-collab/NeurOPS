import React from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { ASIGNADAS_SEMANA, CLOSERS, closerPorId } from '../shared/mockData';
import { colorSeg } from './SeccionSegmentos';

const MODOS = {
    prioridad: { label: 'Prioridad', desc: 'Llena al primero de la cola hasta su tope y recién ahí pasa al siguiente.' },
    simetrico: { label: 'Simétrico', desc: 'Reparte parejo: el próximo lead va al que menos lleva esta semana.' },
    ponderado: { label: 'Ponderado', desc: 'Reparte en proporción a los pesos. Un peso 2 recibe el doble que un peso 1.' },
};

const iniciales = (n) => n.split(' ').map(p => p[0]).slice(0, 2).join('');

function numOpcional(v) {
    if (v === '' || v == null) return undefined;
    return Math.max(0, Number(v) || 0);
}

function ItemCola({ item, modo, onCampo, onQuitar }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.closer });
    const closer = closerPorId(item.closer);
    const n = ASIGNADAS_SEMANA[item.closer] || 0;
    const tope = item.max ?? Math.max(n, 1) * 1.5;
    const lleno = item.max != null && n >= item.max;

    return (
        <div ref={setNodeRef} className={`ag2-qitem ${isDragging ? 'drag' : ''}`}
            style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined, position: 'relative' }}>
            <span className="ag2-grip" {...attributes} {...listeners} aria-label={`Mover a ${closer?.nombre}`}><GripVertical size={16} /></span>
            <span className="ag2-av">{iniciales(closer?.nombre || '?')}</span>
            <div style={{ minWidth: 0 }}>
                <div className="ag2-qname">{closer?.nombre}</div>
                <div className="ag2-load">
                    <span className="ag2-loadbar" aria-hidden="true">
                        <i className={lleno ? 'full' : ''} style={{ width: `${Math.min(100, (n / tope) * 100)}%` }} />
                        {item.min != null && <b style={{ left: `${Math.min(100, (item.min / tope) * 100)}%` }} />}
                    </span>
                    <span>{n} esta semana{lleno ? ' · en su tope' : ''}</span>
                </div>
            </div>
            <div className="ag2-quota">
                <label>Mín<input className="ag2-num" type="number" min={0} placeholder="–" value={item.min ?? ''} onChange={(e) => onCampo('min', numOpcional(e.target.value))} /></label>
                <label>Máx<input className="ag2-num" type="number" min={0} placeholder="–" value={item.max ?? ''} onChange={(e) => onCampo('max', numOpcional(e.target.value))} /></label>
                {modo === 'ponderado' && (
                    <label>Peso<input className="ag2-num" type="number" min={1} value={item.peso ?? 1} onChange={(e) => onCampo('peso', Math.max(1, Number(e.target.value) || 1))} /></label>
                )}
            </div>
            <button type="button" className="ag2-icon" aria-label={`Quitar a ${closer?.nombre}`} onClick={onQuitar}><X size={14} /></button>
        </div>
    );
}

// La cola de closers de un segmento: orden, modo de reparto, cuotas y a dónde desborda.
export default function SeccionReparto({ segmento, estrategia, editar }) {
    const cfg = estrategia.enrutamiento[segmento.id];
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const enCola = new Set(cfg.cola.map(c => c.closer));
    const libres = CLOSERS.filter(c => !enCola.has(c.id));
    const otros = estrategia.segmentos.filter(s => s.id !== segmento.id);
    const color = colorSeg(segmento.id);

    const set = (fn) => editar(e => fn(e.enrutamiento[segmento.id]));
    const onDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        set(c => {
            const from = c.cola.findIndex(x => x.closer === active.id);
            const to = c.cola.findIndex(x => x.closer === over.id);
            c.cola = arrayMove(c.cola, from, to);
        });
    };

    return (
        <section className="ag2-card" aria-labelledby={`ag2-rep-${segmento.id}`}>
            <div className="ag2-card-h">
                <div>
                    <h2 id={`ag2-rep-${segmento.id}`}><span style={{ color }}>{segmento.id}</span> · {segmento.nombre}</h2>
                    <p>Arrastrá para cambiar el orden. Los mínimos se cumplen primero, en cualquier modo.</p>
                </div>
                <div className="ag2-modes" role="radiogroup" aria-label="Modo de reparto">
                    {Object.entries(MODOS).map(([k, m]) => (
                        <button key={k} type="button" role="radio" aria-checked={cfg.modo === k} className={cfg.modo === k ? 'on' : ''}
                            onClick={() => set(c => { c.modo = k; })}>{m.label}</button>
                    ))}
                </div>
            </div>
            <p className="ag2-modedesc">{MODOS[cfg.modo].desc}</p>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={cfg.cola.map(c => c.closer)} strategy={verticalListSortingStrategy}>
                    <div className="ag2-queue">
                        {cfg.cola.map((item, idx) => (
                            <ItemCola key={item.closer} item={item} modo={cfg.modo}
                                onCampo={(campo, v) => set(c => { if (v === undefined) delete c.cola[idx][campo]; else c.cola[idx][campo] = v; })}
                                onQuitar={() => set(c => { c.cola.splice(idx, 1); })} />
                        ))}
                        {!cfg.cola.length && <div className="ag2-modedesc">Sin closers: los leads de este segmento no van a ver horarios.</div>}
                    </div>
                </SortableContext>
            </DndContext>

            <div className="ag2-foot">
                {libres.length ? (
                    <select className="ag2-sel" value="" aria-label="Sumar closer" onChange={(e) => set(c => { c.cola.push({ closer: e.target.value }); })}>
                        <option value="" disabled>+ Sumar closer</option>
                        {libres.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                ) : <span />}
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    Si todos están en su tope
                    <select className="ag2-sel" value={cfg.desborde || ''} onChange={(e) => set(c => { c.desborde = e.target.value || null; })}>
                        <option value="">se queda sin horarios</option>
                        {otros.map(s => <option key={s.id} value={s.id}>pasa a {s.id}</option>)}
                    </select>
                </label>
            </div>
        </section>
    );
}
