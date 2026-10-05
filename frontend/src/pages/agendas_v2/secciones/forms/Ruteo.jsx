// Ruteo: reglas en orden; la primera que se cumple elige la prioridad. Lo que no cumple ninguna va a "Todo lo demás".

import { useCallback, useEffect, useRef } from 'react';
import { almacen } from '../../data/hooks';
import { conOpciones } from '../../core/catalogos';
import { buscar, ord as ordCol } from '../../core/datos';
import { reglasRotas } from '../../core/formulario';
import { uid } from '../../core/util';
import { Humo, HUMO_MARCA, Icono, Sx } from '../../ui/base';
import { useOrdenable } from '../../ui/useOrdenable';
import { colorNivel, mutarForm, opcionesPrioridad, setFormUi, useEnfocar } from './comun';
import RuteoFlujo from './RuteoFlujo';

const AYUDA_RUTEO = 'Se revisan de arriba a abajo: la primera regla que se cumple elige la prioridad. En cada condición alcanza cualquiera de las respuestas marcadas.';

function opsTxt(q, ops) { return q ? q.opciones.filter(o => ops.includes(o.id)).map(o => o.texto) : []; }

function Destino({ d, valor, onChange, label }) {
    const gs = ordCol(d, 'grupos'), g = buscar(d, 'grupos', valor), i = gs.indexOf(g);
    return (
        <div className="destino" style={{ '--c': g ? colorNivel(i + 1) : 'var(--idle)' }}>
            <span className="destino-flecha" aria-hidden="true"><Icono n="chevron-right" s={16} /></span>
            <Sx sm label={label} valor={g ? valor : ''} opciones={opcionesPrioridad(d)} onChange={onChange} />
        </div>
    );
}

// Selector de varias respuestas de una pregunta (alcanza cualquiera de las marcadas).
function Msel({ id, q, ops, abierto, onAbrir, onCerrar, onToggle }) {
    const caja = useRef(null);
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
                <div className="msel-pop" role="listbox" aria-multiselectable="true">
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
                    const q = f.preguntas.find(x => x.id === c.q && conOpciones(x.tipo)) || null, clave = r.id + ':' + j;
                    return (
                        <div className="cond" key={j} data-c={j}>
                            <span className="cond-y">{j ? 'y' : 'si'}</span>
                            <Sx sm id={'cq-' + r.id + '-' + j} label="Pregunta" valor={qs.some(x => x.id === c.q) ? c.q : ''} opciones={opcQ}
                                onChange={v => cambiar(x => { x.cond[j] = { q: v, ops: [] }; })} />
                            <Msel id={'ms-' + r.id + '-' + j} q={q} ops={c.ops} abierto={msel === clave}
                                onAbrir={() => setFormUi({ msel: clave })} onCerrar={(foco) => cerrarMsel(foco ? String(j) : null)}
                                onToggle={o => cambiar(x => { const cs = x.cond[j]; cs.ops = cs.ops.includes(o) ? cs.ops.filter(y => y !== o) : cs.ops.concat([o]); })} />
                            <button type="button" className="ibtn ibtn--xs" aria-label="Quitar condición" disabled={r.cond.length < 2}
                                onClick={() => { cambiar(x => { x.cond.splice(j, 1); }); enfocar('[data-r="' + i + '"] .cond-mas'); }}>
                                <Icono n="x" />
                            </button>
                        </div>
                    );
                })}
                <button type="button" className="cond-mas" onClick={() => { cambiar(x => { x.cond.push({ q: '', ops: [] }); }); enfocar('[data-r="' + i + '"] .cond-mas'); }}>
                    <Icono n="plus" />Condición
                </button>
                {rota && (
                    <p className="campo-err" role="note">
                        <Icono n="alerta" s={14} /><span>Esta regla usa una pregunta o respuesta que ya no existe: nunca se va a cumplir.</span>
                    </p>
                )}
            </div>
            <Destino d={d} valor={r.grupo} label="Prioridad" onChange={v => cambiar(x => { x.grupo = v; })} />
            <button type="button" className="ibtn ibtn--xs ibtn--peligro regla-x" aria-label={'Eliminar regla ' + (i + 1)}
                onClick={() => { mutarForm(f.id, 'reglas', rs => rs.filter(y => y.id !== r.id)); enfocar('[data-regla-add]'); }}>
                <Icono n="basura" />
            </button>
        </div>
    );
}

export default function Ruteo({ f, d, modo, msel }) {
    const raiz = useRef(null);
    const enfocar = useEnfocar(raiz);
    const qs = f.preguntas.filter(q => conOpciones(q.tipo) && q.opciones.some(o => o.texto.trim()));
    const rotas = reglasRotas(f);
    const reordenar = useCallback((nuevos) => mutarForm(f.id, 'reglas', rs => nuevos.map(id => rs.find(r => r.id === id)).filter(Boolean)), [f.id]);
    const ord = useOrdenable(f.reglas.map(r => r.id), reordenar);
    const { contenedor, lista } = ord;
    const porId = Object.fromEntries(f.reglas.map(r => [r.id, r]));
    const resto = <Destino d={d} valor={f.resto} label="Prioridad" onChange={v => almacen.editar('formularios', f.id, { resto: v })} />;

    const agregar = () => {
        const q1 = f.preguntas.find(x => conOpciones(x.tipo)), g1 = ordCol(d, 'grupos')[0];
        mutarForm(f.id, 'reglas', rs => { rs.push({ id: uid('r'), grupo: g1 ? g1.id : '', cond: [{ q: q1 ? q1.id : '', ops: [] }] }); });
        enfocar('[data-r="' + f.reglas.length + '"] .cond-mas');
    };

    return (
        <section className="ruteo caja" ref={raiz}>
            <Humo clase="humo--tarjeta humo--suave" cols={HUMO_MARCA} />
            <div className="ruteo-cab">
                <h2 className="t-h3">Ruteo</h2>
                <span className="ayuda" tabIndex={0} role="note" aria-label={AYUDA_RUTEO} data-tip={AYUDA_RUTEO}>?</span>
                <div className="seg seg--sm" role="group" aria-label="Vista del ruteo" style={{ marginLeft: 'auto' }}>
                    <button type="button" data-nav="" aria-pressed={modo === 'reglas'} onClick={() => setFormUi({ ruteoModo: 'reglas', msel: null })}><Icono n="lista" />Reglas</button>
                    <button type="button" data-nav="" aria-pressed={modo === 'flujo'} onClick={() => setFormUi({ ruteoModo: 'flujo', msel: null })}><Icono n="flujo" />Flujo</button>
                </div>
            </div>
            {modo === 'flujo' ? <RuteoFlujo f={f} d={d} rotas={rotas} />
                : !qs.length ? (
                    <>
                        <p className="t-sm mut">Agregá preguntas de opción para armar reglas.</p>
                        <div className="regla regla--resto"><span className="regla-resto-t">Todos</span>{resto}</div>
                    </>
                ) : (
                    <>
                        <div className="lista reglas" ref={contenedor}>
                            {lista.map(id => porId[id] && (
                                <Regla key={id} r={porId[id]} i={f.reglas.indexOf(porId[id])} f={f} d={d} qs={qs} msel={msel}
                                    rota={rotas.includes(f.reglas.indexOf(porId[id]))} ord={ord} enfocar={enfocar} />
                            ))}
                        </div>
                        <button type="button" className="agregar agregar--sm" data-regla-add="" onClick={agregar}><Icono n="plus" />Regla</button>
                        <div className="regla regla--resto"><span className="regla-resto-t">Todo lo demás</span>{resto}<span /></div>
                    </>
                )}
        </section>
    );
}
