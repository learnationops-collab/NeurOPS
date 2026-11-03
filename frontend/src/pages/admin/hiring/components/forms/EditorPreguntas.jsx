import React, { useEffect, useRef, useState } from 'react';
import { Ban, GitBranch, GripVertical, Pencil, Plus, RotateCcw } from 'lucide-react';
import PanelPregunta from './PanelPregunta';
import { Switch } from '../../../../../components/standard';
import {
    FIJAS, cambiarTipo, dependientes, duplicar, mover, preguntaNueva, soltar, tieneExcluyente, tipoDe, tipoVisible,
} from '../../lib/formularios';
import './editorPreguntas.css';

// Editor de preguntas en dos columnas: a la izquierda la lista, agrupada por
// bloque como la ve la postulante (se arrastra para ordenar y se prende o apaga
// desde cada fila); a la derecha, el panel de la pregunta elegida.

const Fila = ({ q, num, elegida, onElegir, onCambiar, arrastre }) => {
    const on = q.on !== false;
    const fija = FIJAS.has(q.id);
    const ko = tieneExcluyente(q);
    return (
        <div className={`tl-ed-fila${elegida ? ' is-elegida' : ''}${on ? '' : ' is-off'}${arrastre.clase}`}
            draggable {...arrastre.eventos}>
            <GripVertical className="tl-ed-asa" size={15} aria-hidden="true" />
            <button type="button" className="tl-ed-fila-btn" onClick={onElegir} aria-current={elegida || undefined}>
                <span className="tl-ed-fila-num">{num || '–'}</span>
                <span className="tl-ed-fila-tit">{q.t || 'Pregunta sin título'}</span>
                <span className="tl-ed-fila-tipo">{tipoDe(tipoVisible(q)).n}</span>
                {ko && <Ban className="tl-ed-marca tl-ed-marca--ko" size={13} aria-label="Con excluyentes" />}
                {q.si && <GitBranch className="tl-ed-marca" size={13} aria-label="Condicional" />}
            </button>
            <Switch checked={on} label="Pregunta activa" disabled={fija}
                title={fija ? 'Esta pregunta no se apaga' : on ? 'Activa: aparece en el formulario' : 'Apagada: no aparece'}
                onChange={() => onCambiar({ on: !on })} />
        </div>
    );
};

// Nombre de un bloque: clic para editarlo; Enter o salir del campo guarda, Escape cancela.
const NombreBloque = ({ nombre, onRenombrar }) => {
    const [texto, setTexto] = useState(null);
    const guardar = () => {
        const limpio = (texto || '').trim();
        if (limpio && limpio !== nombre) onRenombrar(limpio);
        setTexto(null);
    };
    if (texto !== null) {
        return (
            <input className="tl-ed-bloque-in" value={texto} maxLength={60} autoFocus aria-label="Nombre del bloque"
                onChange={(e) => setTexto(e.target.value)} onBlur={guardar}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); guardar(); }
                    if (e.key === 'Escape') setTexto(null);
                }} />
        );
    }
    return (
        <button type="button" className="tl-ed-bloque-nom" title="Cambiar el nombre del bloque" onClick={() => setTexto(nombre)}>
            <span className="tl-rotulo">{nombre}</span>
            <Pencil size={11} aria-hidden="true" />
        </button>
    );
};

const EditorPreguntas = ({ preguntas, originales, tasaBrl, onCambiar }) => {
    const [sel, setSel] = useState(preguntas[0]?.id || null);
    const [arrastrando, setArrastrando] = useState(null);
    const [sobre, setSobre] = useState(null);
    const panel = useRef(null);

    // En pantallas angostas el panel va debajo de la lista: al elegir, se baja a él.
    const elegir = (id) => {
        setSel(id);
        if (window.matchMedia('(max-width: 1000px)').matches) {
            requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    };

    useEffect(() => {
        if (!preguntas.some((q) => q.id === sel)) setSel(preguntas[0]?.id || null);
    }, [preguntas, sel]);

    const arrastreDe = (id) => ({
        clase: arrastrando === id ? ' is-arrastrando' : sobre === id && arrastrando ? ' is-destino' : '',
        eventos: {
            onDragStart: (e) => { e.dataTransfer.effectAllowed = 'move'; setArrastrando(id); },
            onDragEnd: () => { setArrastrando(null); setSobre(null); },
            onDragOver: (e) => { if (!arrastrando) return; e.preventDefault(); if (sobre !== id) setSobre(id); },
            onDrop: (e) => {
                e.preventDefault();
                if (arrastrando) onCambiar(soltar(preguntas, arrastrando, id));
                setArrastrando(null); setSobre(null);
            },
        },
    });

    const set = (id, cambio) => onCambiar(preguntas.map((q) => (q.id === id ? { ...q, ...cambio } : q)));
    const ids = new Set(preguntas.map((q) => q.id));
    const borradas = originales.filter((q) => !ids.has(q.id));

    // Bloques consecutivos, en el orden real de las preguntas.
    const tramos = [];
    const numeros = {};
    let n = 0;
    preguntas.forEach((q) => {
        const b = q.bloque || 'Extra';
        if (!tramos.length || tramos[tramos.length - 1].bloque !== b) tramos.push({ bloque: b, items: [] });
        tramos[tramos.length - 1].items.push(q);
        if (q.on !== false && q.tipo !== 'intro') { n += 1; numeros[q.id] = n; }
    });

    const i = preguntas.findIndex((q) => q.id === sel);
    const q = preguntas[i];

    return (
        <div className="tl-ed">
            <aside className="tl-ed-lista" aria-label="Preguntas">
                {tramos.map((tr, k) => (
                    <div key={`${tr.bloque}-${k}`} className="tl-ed-bloque">
                        <div className="tl-bloque-cab">
                            <NombreBloque nombre={tr.bloque} onRenombrar={(nuevo) => {
                                const delTramo = new Set(tr.items.map((x) => x.id));
                                onCambiar(preguntas.map((x) => (delTramo.has(x.id) ? { ...x, bloque: nuevo } : x)));
                            }} />
                            <b>{tr.items.filter((x) => x.on !== false).length} de {tr.items.length}</b>
                        </div>
                        {tr.items.map((x) => (
                            <Fila key={x.id} q={x} num={numeros[x.id]} elegida={x.id === sel} arrastre={arrastreDe(x.id)}
                                onElegir={() => elegir(x.id)} onCambiar={(cambio) => set(x.id, cambio)} />
                        ))}
                    </div>
                ))}
                <button type="button" className="tl-fe-mas" onClick={() => {
                    const nueva = preguntaNueva(preguntas);
                    onCambiar([...preguntas, nueva]);
                    elegir(nueva.id);
                }}>
                    <span className="tl-fe-mas-ico"><Plus size={18} /></span>
                    <span><b>Agregar pregunta</b><em>Se suma al final, en el bloque Extra</em></span>
                </button>
                {borradas.length > 0 && (
                    <div className="tl-ed-bloque">
                        <div className="tl-bloque-cab">
                            <span className="tl-rotulo">Eliminadas</span>
                            <b>{borradas.length}</b>
                        </div>
                        {borradas.map((x) => (
                            <button key={x.id} type="button" className="tl-ed-recuperar" title="Vuelve al final de la lista"
                                onClick={() => { onCambiar([...preguntas, x]); elegir(x.id); }}>
                                <RotateCcw size={14} aria-hidden="true" />
                                <span>{x.t || x.id}</span>
                                <em>Recuperar</em>
                            </button>
                        ))}
                    </div>
                )}
            </aside>

            <section className="tl-ed-panel" ref={panel} aria-label="Configuración de la pregunta">
                {q ? (
                    <PanelPregunta
                        q={q}
                        num={numeros[q.id]}
                        primera={i === 0}
                        ultima={i === preguntas.length - 1}
                        tasaBrl={tasaBrl}
                        depende={dependientes(preguntas, q.id)}
                        onCambiar={(cambio) => set(q.id, cambio)}
                        onTipo={(tipo) => {
                            const { lista, id } = cambiarTipo(preguntas, q, tipo);
                            onCambiar(lista);
                            setSel(id);
                        }}
                        onMover={(d) => onCambiar(mover(preguntas, q.id, d))}
                        onDuplicar={() => {
                            const copia = duplicar(preguntas, q);
                            const lista = [...preguntas];
                            lista.splice(i + 1, 0, copia);
                            onCambiar(lista);
                            setSel(copia.id);
                        }}
                        onBorrar={() => {
                            const vecina = preguntas[i + 1] || preguntas[i - 1];
                            onCambiar(preguntas.filter((x) => x.id !== q.id));
                            setSel(vecina ? vecina.id : null);
                        }}
                    />
                ) : (
                    <p className="tl-ed-vacio">Elegí una pregunta de la lista para configurarla.</p>
                )}
            </section>
        </div>
    );
};

export default EditorPreguntas;
