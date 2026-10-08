import React, { useState } from 'react';
import {
    ChevronDown, ArrowUp, ArrowDown, Copy, Trash2, Ban, X, Plus, Minus, Info,
} from 'lucide-react';
import { Chip } from '../Piezas';
import {
    FIJAS, TIPOS, conOpciones, duplicar, mover, notasDe, preguntaNueva, tipoDe,
} from '../../lib/formularios';

// Las preguntas de un formulario, agrupadas por bloque como las ve la
// postulante. Cada una se prende o apaga desde su cabecera y, abierta, deja
// editar el texto, la ayuda, las opciones (cuál es excluyente, cuántos puntos
// suma) y su lugar en el formulario. Las originales no se borran ni cambian de
// tipo: el panel las lee por su id. Las nuevas sí.

const Interruptor = ({ on, onClick, etiqueta, disabled, title }) => (
    <button type="button" role="switch" aria-checked={on} aria-label={etiqueta} title={title || etiqueta}
        className="tl-switch" onClick={onClick} disabled={disabled} />
);

const Opciones = ({ q, onCambiar }) => {
    // Las opciones sin marcas llegan como texto plano (así las escribe el formulario público);
    // al tocar una, todas pasan a objeto. El backend acepta las dos formas.
    const ops = (q.o || []).map((o) => (typeof o === 'string' ? { t: o } : o));
    const set = (j, cambio) => onCambiar({ o: ops.map((o, k) => (k === j ? { ...o, ...cambio } : o)) });
    return (
        <>
            <p className="tl-lbl-q">Opciones</p>
            <div className="tl-ops">
                {ops.map((o, j) => {
                    const letra = String.fromCharCode(65 + j);
                    const cls = o.ko ? ' tl-op--ko' : o.correcta ? ' tl-op--ok' : '';
                    let extra = <span />;
                    if (q.puntua) {
                        extra = (
                            <span className="tl-op-pts" role="group" aria-label="Puntos">
                                <button type="button" disabled={!(o.pts > 0)} aria-label="Menos puntos" onClick={() => set(j, { pts: Math.max(0, (o.pts || 0) - 1) })}><Minus size={12} /></button>
                                <b>{o.pts || 0}</b>
                                <button type="button" disabled={(o.pts || 0) >= 10} aria-label="Más puntos" onClick={() => set(j, { pts: Math.min(10, (o.pts || 0) + 1) })}><Plus size={12} /></button>
                            </span>
                        );
                    } else if (o.correcta) extra = <Chip c="var(--success)" chico>Correcta</Chip>;
                    else if (o.reexplica) extra = <Chip c="var(--warning)" chico>Reexplica</Chip>;
                    else if (o.bloquea) extra = <Chip c="var(--warning)" chico>Bloquea</Chip>;
                    return (
                        <div key={j} className={`tl-op${cls}`}>
                            <span className="tl-op-letra">{letra}</span>
                            <input className="tl-op-in" maxLength={240} value={o.t || ''} aria-label={`Opción ${letra}`}
                                onChange={(e) => set(j, { t: e.target.value })} />
                            {extra}
                            {q.tipo === 'radio' ? (
                                <button type="button" className="ibtn" aria-pressed={Boolean(o.ko)} aria-label="Excluyente"
                                    title="Excluyente: quien la elige va a la pantalla de descarte"
                                    onClick={() => set(j, { ko: !o.ko })}>
                                    <Ban size={15} />
                                </button>
                            ) : <span />}
                            <button type="button" className="ibtn ibtn--peligro" aria-label="Eliminar opción" disabled={ops.length <= 1}
                                onClick={() => onCambiar({ o: ops.filter((_, k) => k !== j) })}>
                                <X size={15} />
                            </button>
                        </div>
                    );
                })}
            </div>
            <div>
                <button type="button" className="tl-link-btn" onClick={() => onCambiar({ o: [...ops, { t: `Opción ${String.fromCharCode(65 + ops.length)}` }] })}>
                    <Plus size={14} /> Opción
                </button>
            </div>
        </>
    );
};

const Pregunta = ({ q, num, abierta, onAbrir, onCambiar, onMover, onDuplicar, onBorrar, primera, ultima, tasaBrl }) => {
    const on = q.on !== false;
    const req = q.req !== false;
    const fija = FIJAS.has(q.id);
    const kos = (q.o || []).filter((o) => o.ko).length;
    const tp = tipoDe(q.tipo);

    return (
        <article className={`tl-pq${abierta ? ' tl-pq--abierta' : ''}${on ? '' : ' tl-pq--off'}`}>
            <div className="tl-pq-cab">
                <button type="button" className="tl-pq-abrir" onClick={onAbrir} aria-expanded={abierta}>
                    <span className="tl-pq-num">{num || '–'}</span>
                    <span className="tl-pq-tit">{q.t || 'Pregunta sin título'}</span>
                </button>
                <div className="tl-pq-chips">
                    <span className="chip chip--chico chip--neutro">{tp.n}</span>
                    {!req && q.tipo !== 'intro' && <Chip c="var(--text-muted)" chico>Opcional</Chip>}
                    {kos > 0 && <Chip c="var(--error)" icono={Ban} chico>Excluyente</Chip>}
                    {q.si && <Chip c="var(--info)" chico>Condicional</Chip>}
                    {!q.base && <Chip c="var(--brand-secondary)" chico>Nueva</Chip>}
                </div>
                <Interruptor on={on} etiqueta="Pregunta activa" disabled={fija}
                    title={fija ? 'Esta pregunta no se apaga' : on ? 'Activa: aparece en la página' : 'Apagada: no aparece'}
                    onClick={() => onCambiar({ on: !on })} />
            </div>
            {abierta && (
                <div className="tl-pq-cuerpo">
                    <div className="tl-pq-ajustes">
                        <label className="tl-sel">
                            <select className="tl-input tl-input--sm" value={q.tipo} disabled={q.base} aria-label="Tipo de pregunta"
                                title={q.base ? 'El tipo de una pregunta original no se cambia' : undefined}
                                onChange={(e) => {
                                    const tipo = e.target.value;
                                    onCambiar(conOpciones(tipo) && !(q.o || []).length ? { tipo, o: [{ t: 'Opción A' }] } : { tipo });
                                }}>
                                {TIPOS.map((t) => <option key={t.k} value={t.k}>{t.n}</option>)}
                            </select>
                            <ChevronDown size={15} />
                        </label>
                        <div className="der">
                            {q.tipo !== 'intro' && (
                                <span className="tl-sw">Obligatoria
                                    <Interruptor on={req} etiqueta="Obligatoria" disabled={fija} onClick={() => onCambiar({ req: !req })} />
                                </span>
                            )}
                            <button type="button" className="ibtn ibtn--sm" aria-label="Subir" disabled={primera} onClick={() => onMover(-1)}><ArrowUp /></button>
                            <button type="button" className="ibtn ibtn--sm" aria-label="Bajar" disabled={ultima} onClick={() => onMover(1)}><ArrowDown /></button>
                            <button type="button" className="ibtn ibtn--sm" aria-label="Duplicar" title="Duplicar" onClick={onDuplicar}><Copy /></button>
                            {!q.base && (
                                <button type="button" className="ibtn ibtn--sm ibtn--peligro" aria-label="Eliminar" title="Eliminar" onClick={onBorrar}><Trash2 /></button>
                            )}
                        </div>
                    </div>

                    <p className="tl-lbl-q">Pregunta</p>
                    <textarea className="tl-area" rows={2} maxLength={300} placeholder="Escribí la pregunta" value={q.t || ''}
                        onChange={(e) => onCambiar({ t: e.target.value })} />
                    {Object.keys(q.t_pais || {}).map((pais) => (
                        <React.Fragment key={pais}>
                            <p className="tl-lbl-q">Si vive en {pais}</p>
                            <input className="tl-input tl-input--sm" maxLength={300} value={q.t_pais[pais] || ''}
                                onChange={(e) => onCambiar({ t_pais: { ...q.t_pais, [pais]: e.target.value } })} />
                        </React.Fragment>
                    ))}
                    <p className="tl-lbl-q">Texto de ayuda</p>
                    <textarea className="tl-area" rows={2} maxLength={600} placeholder="Opcional" style={{ fontWeight: 600, fontSize: 14 }}
                        value={q.h || ''} onChange={(e) => onCambiar({ h: e.target.value })} />
                    {q.tipo === 'numero' && (
                        <>
                            <p className="tl-lbl-q">Unidad</p>
                            <input className="tl-input tl-input--sm" maxLength={40} placeholder="Ej.: USD por mes" value={q.unidad || ''}
                                onChange={(e) => onCambiar({ unidad: e.target.value })} />
                        </>
                    )}
                    {q.tipo === 'parrafo' && (
                        <>
                            <p className="tl-lbl-q">Máximo de caracteres</p>
                            <input className="tl-input tl-input--sm" type="number" min="50" max="3000" step="50" style={{ width: 160 }}
                                value={q.largo || 500} onChange={(e) => onCambiar({ largo: Number(e.target.value) || 500 })} />
                        </>
                    )}
                    {notasDe(q, tasaBrl).map((t) => <p key={t} className="tl-nota-q"><Info size={15} /><span>{t}</span></p>)}
                    {conOpciones(q.tipo) && <Opciones q={q} onCambiar={onCambiar} />}
                </div>
            )}
        </article>
    );
};

const EditorPreguntas = ({ preguntas, tasaBrl, onCambiar }) => {
    const [sel, setSel] = useState(null);

    const set = (id, cambio) => onCambiar(preguntas.map((q) => (q.id === id ? { ...q, ...cambio } : q)));

    const porBloque = {};
    preguntas.forEach((q) => {
        const b = q.bloque || 'Extra';
        porBloque[b] = porBloque[b] || { on: 0, total: 0 };
        porBloque[b].total += 1;
        if (q.on !== false) porBloque[b].on += 1;
    });

    // Bloques consecutivos, en el orden de las preguntas (un bloque puede repetirse si alguien
    // movió una pregunta afuera del suyo: se respeta el orden real).
    const tramos = [];
    preguntas.forEach((q, i) => {
        const b = q.bloque || 'Extra';
        if (!tramos.length || tramos[tramos.length - 1].bloque !== b) tramos.push({ bloque: b, items: [] });
        tramos[tramos.length - 1].items.push({ q, i });
    });

    let n = 0;
    return (
        <>
            {tramos.map((tr, k) => (
                <div key={`${tr.bloque}-${k}`} style={{ display: 'grid', gap: 8 }}>
                    <div className="tl-bloque-cab">
                        <span className="tl-rotulo">{tr.bloque}</span>
                        <b>{porBloque[tr.bloque].on} de {porBloque[tr.bloque].total}</b>
                    </div>
                    <div className="tl-pq-lista">
                        {tr.items.map(({ q, i }) => {
                            const cuenta = q.on !== false && q.tipo !== 'intro';
                            if (cuenta) n += 1;
                            return (
                                <Pregunta
                                    key={q.id}
                                    q={q}
                                    num={cuenta ? n : null}
                                    abierta={sel === q.id}
                                    primera={i === 0}
                                    ultima={i === preguntas.length - 1}
                                    tasaBrl={tasaBrl}
                                    onAbrir={() => setSel(sel === q.id ? null : q.id)}
                                    onCambiar={(cambio) => set(q.id, cambio)}
                                    onMover={(d) => onCambiar(mover(preguntas, q.id, d))}
                                    onDuplicar={() => {
                                        const copia = duplicar(preguntas, q);
                                        const lista = [...preguntas];
                                        lista.splice(i + 1, 0, copia);
                                        onCambiar(lista);
                                        setSel(copia.id);
                                    }}
                                    onBorrar={() => { onCambiar(preguntas.filter((x) => x.id !== q.id)); setSel(null); }}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
            <button type="button" className="tl-fe-mas" onClick={() => {
                const nueva = preguntaNueva(preguntas);
                onCambiar([...preguntas, nueva]);
                setSel(nueva.id);
            }}>
                <span className="tl-fe-mas-ico"><Plus size={18} /></span>
                <span><b>Agregar pregunta</b><em>Se suma al final, en el bloque Extra</em></span>
            </button>
        </>
    );
};

export default EditorPreguntas;
