// El Learnito del chat (ADR-W253): tocar el botón abre esto, no la pregunta directa. Learnito lee la conversación
// entera y el setter elige qué quiere: resumen, una respuesta, un seguimiento, la info del programa que le sirve o
// una pregunta suya. Lo elegido abre el modal de Learnito con la conversación como contexto.
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, CalendarClock, FileText, Reply, Sparkles } from 'lucide-react';
import useDesplegable from './useDesplegable';

const OPCIONES = [
    { id: 'respuesta', texto: 'Sugerime una respuesta', detalle: 'Dos opciones del próximo mensaje', icono: Reply, color: 'var(--brand-secondary)' },
    { id: 'seguimiento', texto: 'Sugerime un seguimiento', detalle: 'Para retomarla y cuándo', icono: CalendarClock, color: '#7D63E6' },
    { id: 'resumen', texto: 'Resumime la conversación', detalle: 'Qué quiere, dudas, en qué quedó', icono: FileText, color: 'var(--info)' },
    { id: 'info', texto: 'Qué info me sirve', detalle: 'Del programa y el material', icono: BookOpen, color: 'var(--success)' },
];

export default function LearnitoLead({ contacto, ocupado, borrador, onElegir }) {
    const d = useDesplegable();
    const [pregunta, setPregunta] = useState('');
    const campo = useRef(null);
    useEffect(() => { if (d.abierto) { setPregunta(borrador?.startsWith('/') ? '' : borrador || ''); setTimeout(() => campo.current?.focus(), 60); } }, [d.abierto]); // eslint-disable-line react-hooks/exhaustive-deps
    const elegir = (id, pedido = '') => { d.setAbierto(false); onElegir(id, pedido); };
    const quien = contacto.username ? `@${contacto.username}` : contacto.nombre || 'este lead';
    return (
        <span className="cv-tarjeta-pop-caja cv-ll" ref={d.caja}>
            <button type="button" className="cv-learnito-btn" disabled={ocupado} aria-expanded={d.abierto} onClick={() => d.setAbierto((a) => !a)}
                data-tip="Learnito|Lee la conversación y te ayuda: respuesta, seguimiento, resumen o lo que le preguntes">
                <Sparkles size={14} aria-hidden="true" />Learnito
            </button>
            {d.abierto && (
                <div className="cv-ll-pop" role="dialog" aria-label="Learnito con esta conversación">
                    <div className="cv-ll-cab">
                        <span className="cv-ll-ojo"><Sparkles size={15} aria-hidden="true" /></span>
                        <span><b>Leo toda la conversación</b><small>con {quien}. ¿Qué querés?</small></span>
                    </div>
                    <div className="cv-ll-ops">
                        {OPCIONES.map(({ id, texto, detalle, icono: Icono, color }, i) => (
                            <button key={id} type="button" className="cv-ll-op" style={{ '--c': color, '--i': i }} onClick={() => elegir(id)}>
                                <span className="cv-ll-op-ico"><Icono size={15} aria-hidden="true" /></span>
                                <span><b>{texto}</b><small>{detalle}</small></span>
                            </button>
                        ))}
                    </div>
                    <form className="cv-ll-preg" onSubmit={(e) => { e.preventDefault(); if (pregunta.trim()) elegir('pregunta', pregunta.trim()); }}>
                        <input ref={campo} value={pregunta} maxLength={300} placeholder="O preguntá algo de esta conversación…"
                            aria-label="Pregunta sobre esta conversación" onChange={(e) => setPregunta(e.target.value)}
                            onKeyDown={(e) => e.key === 'Escape' && d.setAbierto(false)} />
                        <button type="submit" aria-label="Preguntar" disabled={!pregunta.trim()}><ArrowUp size={14} strokeWidth={2.5} /></button>
                    </form>
                </div>
            )}
        </span>
    );
}
