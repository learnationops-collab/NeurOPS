// Segmentación: reglas en orden; la primera que se cumple elige la estrategia. Lo que no cumple ninguna va a "Todo lo demás".
// Una regla o «Todo lo demás» puede mandar a «No califica» en vez de a una estrategia: ese lead no agenda y ve el fin.

import { useCallback, useEffect, useRef, useState } from 'react';
import { almacen } from '../../data/hooks';
import { conOpciones } from '../../core/catalogos';
import { buscar, nombreGrupo, ord as ordCol } from '../../core/datos';
import { NO_CALIFICA, preguntasRuteo, reglasRotas, revisarSegmentacion } from '../../core/formulario';
import { urlOk } from '../../core/normalizar';
import { uid } from '../../core/util';
import { Humo, HUMO_MARCA, Icono, Sx } from '../../ui/base';
import Lienzo from '../../ui/Lienzo';
import { useOrdenable } from '../../ui/useOrdenable';
import { colorNivel, mutarForm, opcionesPrioridad, setFormUi, useEnfocar } from './comun';
import RuteoFlujo from './RuteoFlujo';
import { FieldError, Grid, IconButton, Input, Segmented } from '../../../../components/standard';
import { useEnPantalla } from '../../../../components/ui/useEnPantalla';

const AYUDA_RUTEO = 'Se revisan de arriba a abajo: la primera regla que se cumple elige la estrategia. En cada condición alcanza cualquiera de las respuestas marcadas.';

function opsTxt(q, ops) { return q ? q.opciones.filter(o => ops.includes(o.id)).map(o => o.texto) : []; }

const NIVEL = { error: ['var(--error)', 'alerta'], warning: ['var(--warning)', 'alerta'], info: ['var(--info)', 'flujo'] };

// Lo que no cierra de la segmentación: casos sin cubrir, reglas que se pisan, repetidas o vacías.
function Revision({ avisos }) {
    if (!avisos.length) return <p className="revision-ok" role="status"><Icono n="check" s={15} />Cada combinación de respuestas tiene un solo destino.</p>;
    return (
        <ul className="revision" aria-label="Revisión de la segmentación">
            {avisos.map((a, i) => (
                <li key={i} className="revision-item" style={{ '--c': NIVEL[a.nivel][0] }}><Icono n={NIVEL[a.nivel][1]} s={15} /><span>{a.t}</span></li>
            ))}
        </ul>
    );
}

// «No califica»: va en todos los destinos, después de las estrategias.
const OP_NO = { v: NO_CALIFICA, n: 'No califica', icono: 'prohibido', color: 'var(--error)' };

function Destino({ d, valor, onChange, label, extra = [] }) {
    const gs = ordCol(d, 'grupos'), g = buscar(d, 'grupos', valor), i = gs.indexOf(g), no = valor === NO_CALIFICA;
    return (
        <div className="destino" style={{ '--c': g ? colorNivel(i + 1) : no ? 'var(--error)' : 'var(--idle)' }}>
            <span className="destino-flecha" aria-hidden="true"><Icono n="chevron-right" s={16} /></span>
            <Sx sm label={label} valor={g || no ? valor : ''} opciones={opcionesPrioridad(d).concat([OP_NO], extra)} onChange={onChange} />
        </div>
    );
}

// La sesión que toma el lead de la regla: la del evento del formulario o otro evento del equipo
// (C/D → «Sesión diagnóstica» de 30 min con el triage). Los eventos propios de un closer no van.
const opcionesSesion = (d) => [{ v: '', n: 'La del formulario' },
    ...ordCol(d, 'eventos').filter(e => !e.persona).map(e => ({ v: e.id, n: e.nombre }))];

// Destino de una regla: una estrategia o una página (el lead no agenda y va a esa URL).
// Lo que se escribe queda en borrador hasta que es una URL https válida: así no se borra mientras se tipea.
const A_URL = '__url';
function DestinoRegla({ d, r, onGrupo, onUrl }) {
    const [enUrl, setEnUrl] = useState(!!r.url);
    const [borrador, setBorrador] = useState(r.url || 'https://');
    // La url cambió desde afuera (deshacer, otra pestaña): se toma esa.
    const [previa, setPrevia] = useState(r.url);
    if (previa !== r.url) { setPrevia(r.url); if (r.url) { setEnUrl(true); setBorrador(r.url); } }
    if (!enUrl) {
        return <Destino d={d} valor={r.grupo} label="Estrategia" extra={[{ v: A_URL, n: 'Ir a una página (URL)', icono: 'link', color: 'var(--info)' }]}
            onChange={v => { if (v === A_URL) setEnUrl(true); else onGrupo(v); }} />;
    }
    const mal = !urlOk(borrador);
    return (
        <div className="destino destino--url" style={{ '--c': 'var(--info)' }}>
            <span className="destino-flecha" aria-hidden="true"><Icono n="link" s={15} /></span>
            <Input invalid={mal} type="url" value={borrador} aria-label="Página a la que va el lead" placeholder="https://…"
                onChange={e => { setBorrador(e.target.value); if (urlOk(e.target.value)) onUrl(urlOk(e.target.value)); }} />
            <IconButton label="Mandar a una estrategia" icon={<Icono n="x" />} size="xs" title="Mandar a una estrategia"
                onClick={() => { setEnUrl(false); setBorrador('https://'); onUrl(''); }} />
        </div>
    );
}

// Selector de varias respuestas de una pregunta (alcanza cualquiera de las marcadas).
function Msel({ id, q, ops, abierto, onAbrir, onCerrar, onToggle }) {
    const caja = useRef(null);
    const enPantalla = useEnPantalla();
    const elegidas = opsTxt(q, ops);
    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => { if (!caja.current?.contains(e.target)) onCerrar(false); };
        document.addEventListener('mousedown', fuera, true);
        return () => document.removeEventListener('mousedown', fuera, true);
    }, [abierto, onCerrar]);
    const tecla = (e) => {
        if (e.key === 'Escape' && abierto) { e.preventDefault(); e.stopPropagation(); onCerrar(true); return; }
        if (!abierto || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
        const bs = [...caja.current.querySelectorAll('.msel-op')], k = bs.indexOf(document.activeElement);
        e.preventDefault();
        const j = k < 0 ? 0 : Math.max(0, Math.min(bs.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1)));
        bs[j]?.focus();
    };
    return (
        <div className="msel-caja" ref={caja} onKeyDown={tecla}>
            <button type="button" className={'msel' + (elegidas.length ? '' : ' msel--vacio')} id={id} aria-haspopup="listbox" aria-expanded={abierto}
                aria-label={'Respuestas' + (elegidas.length ? ': ' + elegidas.join(' o ') : '')} disabled={!q} onClick={abierto ? () => onCerrar(false) : onAbrir}>
                <span>{elegidas.length ? elegidas.join(' o ') : 'Respuestas…'}</span>
                {elegidas.length > 1 && <b className="num">{elegidas.length}</b>}
                <Icono n="chevron-down" s={14} />
            </button>
            {abierto && q && (
                <div ref={enPantalla} className="msel-pop" role="listbox" aria-multiselectable="true">
                    {q.opciones.filter(o => o.texto.trim()).map(o => (
                        <button key={o.id} type="button" className="msel-op" role="option" aria-selected={ops.includes(o.id)} onClick={() => onToggle(o.id)}>
                            <i aria-hidden="true"><Icono n="check" s={12} /></i><span>{o.texto}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function Regla({ r, i, f, d, qs, msel, rota, ord, enfocar }) {
    const cambiar = (fn) => mutarForm(f.id, 'reglas', rs => { const x = rs.find(y => y.id === r.id); if (x) fn(x); });
    const cerrarMsel = useCallback((foco) => { setFormUi({ msel: null }); if (foco) enfocar('#ms-' + r.id + '-' + foco); }, [enfocar, r.id]);
    const opcQ = [{ v: '', n: 'Pregunta…' }].concat(qs.map(x => ({ v: x.id, n: x.titulo || 'Pregunta sin escribir' })));
    return (
        <div className={'regla' + ord.claseItem(r.id)} data-item={r.id} data-r={i}>
            <button type="button" className="grip" {...ord.grip(r.id, 'Mover regla ' + (i + 1))}><Icono n="grip" /></button>
            <div className="conds">
                {r.cond.map((c, j) => {
                    const q = qs.find(x => x.id === c.q) || null, clave = r.id + ':' + j;
                    return (
                        <div className="cond" key={j} data-c={j}>
                            <span className="cond-y">{j ? 'y' : 'si'}</span>
                            <Sx sm id={'cq-' + r.id + '-' + j} label="Pregunta" valor={qs.some(x => x.id === c.q) ? c.q : ''} opciones={opcQ}
                                onChange={v => cambiar(x => { x.cond[j] = { q: v, ops: [] }; })} />
                            <Msel id={'ms-' + r.id + '-' + j} q={q} ops={c.ops} abierto={msel === clave}
                                onAbrir={() => setFormUi({ msel: clave })} onCerrar={(foco) => cerrarMsel(foco ? String(j) : null)}
                                onToggle={o => cambiar(x => { const cs = x.cond[j]; cs.ops = cs.ops.includes(o) ? cs.ops.filter(y => y !== o) : cs.ops.concat([o]); })} />
                            <IconButton label="Quitar condición" icon={<Icono n="x" />} size="xs" disabled={r.cond.length < 2}
                                onClick={() => { cambiar(x => { x.cond.splice(j, 1); }); enfocar('[data-r="' + i + '"] .cond-mas'); }} />
                        </div>
                    );
                })}
                <button type="button" className="cond-mas" onClick={() => { cambiar(x => { x.cond.push({ q: '', ops: [] }); }); enfocar('[data-r="' + i + '"] .cond-mas'); }}>
                    <Icono n="plus" />Condición
                </button>
                {rota && (
                    <FieldError role="note"><span>Esta regla usa una pregunta o respuesta que ya no existe: nunca se va a cumplir.</span>
                    </FieldError>
                )}
            </div>
            <div style={{ display: 'grid', gap: 'var(--s2)', alignContent: 'start' }}>
                <DestinoRegla d={d} r={r} onGrupo={v => cambiar(x => { x.grupo = v; x.url = ''; })} onUrl={u => cambiar(x => { x.url = u; if (u) { x.grupo = ''; delete x.evento; } })} />
                {!r.url && r.grupo !== NO_CALIFICA && (
                    <Sx sm label="Sesión" valor={r.evento || ''} opciones={opcionesSesion(d)}
                        onChange={v => cambiar(x => { if (v) x.evento = v; else delete x.evento; })} />
                )}
            </div>
            <IconButton label={'Eliminar regla ' + (i + 1)} icon={<Icono n="basura" />} size="xs" danger className="regla-x"
                onClick={() => { mutarForm(f.id, 'reglas', rs => rs.filter(y => y.id !== r.id)); enfocar('[data-regla-add]'); }} />
        </div>
    );
}

export default function Ruteo({ f, d, modo, msel }) {
    const raiz = useRef(null);
    const enfocar = useEnfocar(raiz);
    // Con la segmentación activa, «Segmento del lead» (A a D) se elige como una pregunta más.
    const qs = preguntasRuteo(f).filter(q => conOpciones(q.tipo) && q.opciones.some(o => o.texto.trim()));
    const rotas = reglasRotas(f);
    const avisos = revisarSegmentacion(f, (id) => nombreGrupo(d, id));
    const conAviso = [...new Set(avisos.filter(a => a.regla != null && a.nivel !== 'info').map(a => a.regla))];
    const reordenar = useCallback((nuevos) => mutarForm(f.id, 'reglas', rs => nuevos.map(id => rs.find(r => r.id === id)).filter(Boolean)), [f.id]);
    const ord = useOrdenable(f.reglas.map(r => r.id), reordenar);
    const { contenedor, lista } = ord;
    const porId = Object.fromEntries(f.reglas.map(r => [r.id, r]));
    const resto = <Destino d={d} valor={f.resto} label="Estrategia" onChange={v => almacen.editar('formularios', f.id, { resto: v })} />;

    const agregar = () => {
        const q1 = f.preguntas.find(x => conOpciones(x.tipo)), g1 = ordCol(d, 'grupos')[0];
        mutarForm(f.id, 'reglas', rs => { rs.push({ id: uid('r'), grupo: g1 ? g1.id : '', cond: [{ q: q1 ? q1.id : '', ops: [] }] }); });
        enfocar('[data-r="' + f.reglas.length + '"] .cond-mas');
    };

    return (
        <section className="ruteo caja" ref={raiz}>
            <Humo clase="humo--tarjeta humo--suave" cols={HUMO_MARCA} />
            <div className="ruteo-cab">
                <h2 className="t-h3">Segmentación</h2>
                <span className="ayuda" tabIndex={0} role="note" aria-label={AYUDA_RUTEO} data-tip={AYUDA_RUTEO}>?</span>
                <Segmented size="sm" label="Vista del ruteo" style={{ marginLeft: 'auto' }} itemProps={{ 'data-nav': '' }} value={modo}
                    onChange={v => setFormUi({ ruteoModo: v, msel: null })}
                    options={[{ value: 'reglas', label: 'Reglas', icon: <Icono n="lista" /> }, { value: 'flujo', label: 'Flujo', icon: <Icono n="flujo" /> }]} />
            </div>
            <Revision avisos={avisos} />
            {modo === 'flujo' ? <Lienzo etiqueta="Flujo de la segmentación"><RuteoFlujo f={f} d={d} rotas={rotas} avisos={conAviso} /></Lienzo>
                : !qs.length ? (
                    <>
                        <p className="t-sm mut">Agregá preguntas de opción para armar reglas.</p>
                        <div className="regla regla--resto"><span className="regla-resto-t">Todos</span>{resto}</div>
                    </>
                ) : (
                    <>
                        <Grid variant="list" className="reglas" ref={contenedor}>
                            {lista.map(id => porId[id] && (
                                <Regla key={id} r={porId[id]} i={f.reglas.indexOf(porId[id])} f={f} d={d} qs={qs} msel={msel}
                                    rota={rotas.includes(f.reglas.indexOf(porId[id]))} ord={ord} enfocar={enfocar} />
                            ))}
                        </Grid>
                        <button type="button" className="agregar agregar--sm" data-regla-add="" onClick={agregar}><Icono n="plus" />Regla</button>
                        <div className="regla regla--resto"><span className="regla-resto-t">Todo lo demás</span>{resto}<span /></div>
                    </>
                )}
        </section>
    );
}
