import React from 'react';
import {
    ArrowUp, ArrowDown, Copy, Trash2, Ban, X, Plus, Minus, Info,
    CircleDot, ListChecks, Search, Type, AlignLeft, Hash, Phone, Link2, Hand,
} from 'lucide-react';
import { Chip } from '../Piezas';
import { FIJAS, TIPOS, conOpciones, notasDe } from '../../lib/formularios';

// El panel de la derecha del editor: todo lo de la pregunta elegida (tipo,
// texto, ayuda, opciones, si es obligatoria y su lugar).

const ICONO_TIPO = {
    radio: CircleDot, check: ListChecks, buscable: Search, texto: Type, parrafo: AlignLeft,
    numero: Hash, tel: Phone, link: Link2, intro: Hand,
};

export const Interruptor = ({ on, onClick, etiqueta, disabled, title }) => (
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
                            <button type="button" className="ibtn" aria-pressed={Boolean(o.ko)} aria-label="Excluyente"
                                title="Excluyente: quien la elige va a la pantalla de descarte"
                                onClick={() => set(j, { ko: !o.ko })}>
                                <Ban size={15} />
                            </button>
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

const PanelPregunta = ({ q, num, primera, ultima, tasaBrl, depende, onCambiar, onTipo, onMover, onDuplicar, onBorrar }) => {
    const on = q.on !== false;
    const req = q.req !== false;
    const fija = FIJAS.has(q.id);
    let motivoNoBorra = '';
    if (fija) motivoNoBorra = 'Sin el nombre no se guarda la postulación';
    else if (depende.length) motivoNoBorra = `De esta depende «${depende[0].t || depende[0].id}»: borrá o cambiá esa primero`;

    return (
        <div className="tl-ed-panel-in" key={q.id}>
            <header className="tl-ed-cab">
                <span className="tl-ed-num">{num || '–'}</span>
                <div className="tl-ed-cab-txt">
                    <small>{q.bloque || 'Extra'}{on ? '' : ' · apagada'}</small>
                    <h3>{q.t || 'Pregunta sin título'}</h3>
                </div>
                <div className="tl-ed-acc">
                    <button type="button" className="ibtn ibtn--sm" aria-label="Subir" title="Subir" disabled={primera} onClick={() => onMover(-1)}><ArrowUp /></button>
                    <button type="button" className="ibtn ibtn--sm" aria-label="Bajar" title="Bajar" disabled={ultima} onClick={() => onMover(1)}><ArrowDown /></button>
                    <button type="button" className="ibtn ibtn--sm" aria-label="Duplicar" title="Duplicar" onClick={onDuplicar}><Copy /></button>
                    <button type="button" className="ibtn ibtn--sm ibtn--peligro" aria-label="Eliminar" disabled={Boolean(motivoNoBorra)}
                        title={motivoNoBorra || 'Eliminar'} onClick={onBorrar}><Trash2 /></button>
                </div>
            </header>

            <div className="tl-ed-sws">
                <span className="tl-sw">
                    <Interruptor on={on} etiqueta="Activa" disabled={fija} onClick={() => onCambiar({ on: !on })}
                        title={fija ? 'Esta pregunta no se apaga' : undefined} />
                    {on ? 'Activa en el formulario' : 'Apagada'}
                </span>
                {q.tipo !== 'intro' && (
                    <span className="tl-sw">
                        <Interruptor on={req} etiqueta="Obligatoria" disabled={fija} onClick={() => onCambiar({ req: !req })} />
                        Obligatoria
                    </span>
                )}
            </div>

            <p className="tl-lbl-q">Tipo de respuesta</p>
            <div className="tl-ed-tipos" role="radiogroup" aria-label="Tipo de respuesta">
                {TIPOS.map((t) => {
                    const Ico = ICONO_TIPO[t.k];
                    return (
                        <button key={t.k} type="button" role="radio" aria-checked={q.tipo === t.k} className="tl-ed-tipo"
                            disabled={fija && q.tipo !== t.k} onClick={() => q.tipo !== t.k && onTipo(t.k)}>
                            <Ico size={17} aria-hidden="true" /><span>{t.n}</span>
                        </button>
                    );
                })}
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
            {conOpciones(q.tipo) && <Opciones q={q} onCambiar={onCambiar} />}
            {notasDe(q, tasaBrl).map((t) => <p key={t} className="tl-nota-q"><Info size={15} /><span>{t}</span></p>)}
        </div>
    );
};

export default PanelPregunta;
