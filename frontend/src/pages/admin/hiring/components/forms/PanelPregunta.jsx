import React from 'react';
import {
    ArrowUp, ArrowDown, Copy, Trash2, Ban, X, Plus, Minus, Info,
    CircleDot, ListChecks, Search, Type, Mail, AlignLeft, Hash, DollarSign, Phone, Link2, Hand,
} from 'lucide-react';
import { Aura, IconButton, Select, Switch } from '../../../../../components/standard';
import { Chip } from '../Piezas';
import { FIJAS, TIPOS, conOpciones, notasDe, tipoDe, tipoVisible } from '../../lib/formularios';

// El panel de la derecha del editor: todo lo de la pregunta elegida (tipo,
// texto, ayuda, opciones, si es obligatoria y su lugar).

const ICONO_TIPO = {
    radio: CircleDot, check: ListChecks, buscable: Search, texto: Type, email: Mail, parrafo: AlignLeft,
    numero: Hash, dinero: DollarSign, tel: Phone, link: Link2, intro: Hand,
};

const OPCIONES_TIPO = TIPOS.map((t) => {
    const Ico = ICONO_TIPO[t.k];
    return { value: t.k, label: t.n, icon: <Ico size={15} /> };
});

const Campo = ({ etiqueta, children, className = '' }) => (
    <div className={`tl-ed-campo ${className}`}>
        <span className="tl-ed-etq">{etiqueta}</span>
        {children}
    </div>
);

const Opciones = ({ q, onCambiar }) => {
    // Las opciones sin marcas llegan como texto plano (así las escribe el formulario público);
    // al tocar una, todas pasan a objeto. El backend acepta las dos formas.
    const ops = (q.o || []).map((o) => (typeof o === 'string' ? { t: o } : o));
    const set = (j, cambio) => onCambiar({ o: ops.map((o, k) => (k === j ? { ...o, ...cambio } : o)) });
    return (
        <Campo etiqueta="Opciones">
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
        </Campo>
    );
};

// Límites excluyentes de una pregunta numérica: quien responde fuera va a la
// pantalla de descarte (vacío = sin ese límite).
const Limites = ({ q, onCambiar }) => {
    const set = (k, texto) => {
        const n = texto.replace(/\D/g, '');
        onCambiar({ [k]: n === '' ? undefined : Number(n) });
    };
    const al = q.ko_min != null && q.ko_max != null && q.ko_min > q.ko_max;
    return (
        <div className={`tl-ed-limites${q.ko_min != null || q.ko_max != null ? ' is-activo' : ''}`}>
            <span className="tl-ed-etq"><Ban size={12} aria-hidden="true" /> Límites excluyentes</span>
            <div className="tl-ed-limites-campos">
                <label>
                    <span>Descarta si es menor a</span>
                    <input className="tl-input tl-input--sm" inputMode="numeric" placeholder="Sin mínimo"
                        value={q.ko_min ?? ''} onChange={(e) => set('ko_min', e.target.value)} />
                </label>
                <label>
                    <span>Descarta si es mayor a</span>
                    <input className="tl-input tl-input--sm" inputMode="numeric" placeholder="Sin máximo"
                        value={q.ko_max ?? ''} onChange={(e) => set('ko_max', e.target.value)} />
                </label>
            </div>
            <small className={al ? 'is-error' : undefined}>
                {al ? 'El mínimo es mayor que el máximo: así no se guarda.'
                    : `Quien responda fuera de ${q.ko_min ?? 'cero'} a ${q.ko_max ?? 'sin tope'}${q.unidad ? ` ${q.unidad}` : ''} va a la pantalla de descarte.`}
            </small>
        </div>
    );
};

const PanelPregunta = ({ q, num, primera, ultima, tasaBrl, depende, onCambiar, onTipo, onMover, onDuplicar, onBorrar }) => {
    const on = q.on !== false;
    const req = q.req !== false;
    const fija = FIJAS.has(q.id);
    let motivoNoBorra = '';
    if (fija) motivoNoBorra = 'Sin el nombre no se guarda la postulación';
    else if (depende.length) motivoNoBorra = `De esta depende «${depende[0].t || depende[0].id}»: borrá o cambiá esa primero`;

    const visible = tipoVisible(q);
    const Ico = ICONO_TIPO[visible] || Type;

    return (
        <div className="tl-ed-panel-in" key={q.id}>
            <Aura soft size="card" colors={['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-navy)']} />
            <header className="tl-ed-cab">
                <span className="tl-ed-num">{num || <Ico size={18} aria-hidden="true" />}</span>
                <div className="tl-ed-cab-txt">
                    <h3>{q.t || 'Pregunta sin título'}</h3>
                    <p>{q.bloque || 'Extra'} · {tipoDe(visible).n}{on ? '' : ' · apagada'}</p>
                </div>
                <div className="tl-ed-acc">
                    <IconButton size="sm" icon={<ArrowUp size={15} />} label="Subir" title="Subir" disabled={primera} onClick={() => onMover(-1)} />
                    <IconButton size="sm" icon={<ArrowDown size={15} />} label="Bajar" title="Bajar" disabled={ultima} onClick={() => onMover(1)} />
                    <IconButton size="sm" icon={<Copy size={15} />} label="Duplicar" title="Duplicar" onClick={onDuplicar} />
                    <IconButton size="sm" danger icon={<Trash2 size={15} />} label="Eliminar" disabled={Boolean(motivoNoBorra)}
                        title={motivoNoBorra || 'Eliminar'} onClick={onBorrar} />
                </div>
            </header>

            <div className="tl-ed-ajustes">
                <Campo etiqueta="Tipo de respuesta" className="tl-ed-campo--tipo">
                    <Select label="Tipo de respuesta" value={visible} options={OPCIONES_TIPO} disabled={fija}
                        title={fija ? 'El nombre es siempre texto corto' : undefined}
                        onChange={(t) => t !== visible && onTipo(t)} />
                </Campo>
                <div className="tl-ed-sws">
                    <label className="tl-ed-sw">
                        <Switch checked={on} label="Activa" disabled={fija} onChange={() => onCambiar({ on: !on })}
                            title={fija ? 'Esta pregunta no se apaga' : undefined} />
                        Activa
                    </label>
                    {q.tipo !== 'intro' && (
                        <label className="tl-ed-sw">
                            <Switch checked={req} label="Obligatoria" disabled={fija} onChange={() => onCambiar({ req: !req })} />
                            Obligatoria
                        </label>
                    )}
                </div>
            </div>

            <Campo etiqueta="Pregunta">
                <textarea className="tl-area tl-ed-tit" rows={2} maxLength={300} placeholder="Escribí la pregunta" value={q.t || ''}
                    onChange={(e) => onCambiar({ t: e.target.value })} />
            </Campo>
            {Object.keys(q.t_pais || {}).map((pais) => (
                <Campo key={pais} etiqueta={`Si vive en ${pais}`}>
                    <input className="tl-input tl-input--sm" maxLength={300} value={q.t_pais[pais] || ''}
                        onChange={(e) => onCambiar({ t_pais: { ...q.t_pais, [pais]: e.target.value } })} />
                </Campo>
            ))}
            <Campo etiqueta="Texto de ayuda">
                <textarea className="tl-area" rows={2} maxLength={600} placeholder="Opcional"
                    value={q.h || ''} onChange={(e) => onCambiar({ h: e.target.value })} />
            </Campo>
            {(visible === 'numero' || visible === 'dinero') && (
                <>
                    <Campo etiqueta={visible === 'dinero' ? 'Moneda y período' : 'Unidad'}>
                        <input className="tl-input tl-input--sm" maxLength={40} placeholder={visible === 'dinero' ? 'Ej.: USD por mes' : 'Ej.: años'}
                            value={q.unidad || ''} onChange={(e) => onCambiar({ unidad: e.target.value })} />
                    </Campo>
                    <Limites q={q} onCambiar={onCambiar} />
                </>
            )}
            {q.tipo === 'parrafo' && (
                <Campo etiqueta="Máximo de caracteres">
                    <input className="tl-input tl-input--sm" type="number" min="50" max="3000" step="50" style={{ width: 160 }}
                        value={q.largo || 500} onChange={(e) => onCambiar({ largo: Number(e.target.value) || 500 })} />
                </Campo>
            )}
            {conOpciones(q.tipo) && <Opciones q={q} onCambiar={onCambiar} />}
            {notasDe(q, tasaBrl).length > 0 && (
                <ul className="tl-ed-notas">
                    {notasDe(q, tasaBrl).map((t) => <li key={t}><Info size={14} aria-hidden="true" /><span>{t}</span></li>)}
                </ul>
            )}
        </div>
    );
};

export default PanelPregunta;
