// Una pregunta del editor: cabecera (mover, abrir, fichas, duplicar, eliminar) y, abierta, todos sus ajustes.

import { useCallback } from 'react';
import { almacen } from '../../data/hooks';
import { TIPOS, conOpciones, tipo } from '../../core/catalogos';
import { copiarPregunta } from '../../core/formulario';
import { letra, uid } from '../../core/util';
import { AreaAuto, Humo, HUMO_MARCA, Icono, Sx } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { toast } from '../../ui/toast';
import { useOrdenable } from '../../ui/useOrdenable';
import { TituloConToken, mutarForm, setFormUi } from './comun';

const OPC_TIPO = TIPOS.map(t => ({ v: t.k, n: t.n, icono: t.ico }));
function ptsColor(v) { return v == null ? 'var(--text-muted-40)' : v >= 8 ? 'var(--success)' : v >= 5 ? 'var(--warning)' : 'var(--error)'; }
const opVacia = () => ({ id: uid('o'), texto: '', puntos: null, descalifica: false });

// Columnas fijas: tipo, peso y estado ocupan siempre el mismo ancho, haya dato o no.
function Fichas({ q }) {
    const op = conOpciones(q.tipo);
    const falta = !q.titulo.trim() || (op && !q.opciones.some(o => o.texto.trim()));
    const filtra = op && q.opciones.some(o => o.descalifica);
    return (
        <>
            <span className="pq-c pq-c--tipo"><span className="chip chip--n" style={{ '--c': 'var(--idle)' }}>{tipo(q.tipo).n}</span></span>
            <span className="pq-c pq-c--peso">{op && q.peso > 0 && <span className="chip" style={{ '--c': 'var(--success)' }} title="Peso">×{q.peso}</span>}</span>
            <span className="pq-c">
                {falta ? <span className="chip chip--sq" style={{ '--c': 'var(--warning)' }} title="Incompleta"><Icono n="alerta" /></span>
                    : filtra ? <span className="chip chip--sq" style={{ '--c': 'var(--error)' }} title="Filtra"><Icono n="prohibido" /></span> : null}
            </span>
        </>
    );
}

function Opciones({ q, cambiar, enfocar }) {
    const ids = q.opciones.map(o => o.id);
    const reordenar = useCallback((nuevos) => cambiar(x => { x.opciones = nuevos.map(id => x.opciones.find(o => o.id === id)).filter(Boolean); }), [cambiar]);
    const ord = useOrdenable(ids, reordenar);
    const { contenedor, lista } = ord;
    const porId = Object.fromEntries(q.opciones.map(o => [o.id, o]));
    const sel = (j, d) => '[data-q="' + q.id + '"] .op-fila[data-i="' + j + '"] [data-pts="' + d + '"]:not(:disabled)';

    const pts = (j, d) => {
        cambiar(x => { const o = x.opciones[j]; o.puntos = o.puntos == null ? (d > 0 ? 5 : null) : o.puntos + d < 0 ? null : Math.min(10, o.puntos + d); });
        enfocar(sel(j, d), null, sel(j, -d));
    };
    const borrar = (j) => {
        const sig = q.opciones[j + 1] || q.opciones[j - 1];
        cambiar(x => { x.opciones.splice(j, 1); });
        enfocar(sig ? '#op-' + sig.id : '[data-q="' + q.id + '"] [data-op-add]');
    };
    const agregar = () => { const no = opVacia(); cambiar(x => { x.opciones.push(no); }); enfocar('#op-' + no.id); };
    // Pegar varias líneas en una opción crea una opción por línea (sin viñetas ni números).
    const pegar = (e, j) => {
        const lineas = ((e.clipboardData || window.clipboardData).getData('text') || '').split(/\r?\n/)
            .map(s => s.replace(/^\s*[-•*\d.)]+\s+/, '').trim()).filter(Boolean);
        if (lineas.length < 2) return;
        e.preventDefault();
        const nuevas = lineas.map(l => ({ ...opVacia(), texto: l.slice(0, 200) }));
        cambiar(x => {
            let k = j;
            if (!x.opciones[k].texto.trim()) x.opciones.splice(k, 1); else k++;
            x.opciones.splice(k, 0, ...nuevas);
            x.opciones = x.opciones.slice(0, 60);
        });
        enfocar('#op-' + nuevas[nuevas.length - 1].id);
        toast(nuevas.length + ' opciones');
    };

    return (
        <div className="ops">
            <div className="ops-cab"><span>Opciones</span><span>Pts</span><span title="Descalifica"><Icono n="prohibido" /></span><span /></div>
            <div className="ops" ref={contenedor}>
                {lista.map((id, k) => {
                    // j: índice real (para editar); k: posición en pantalla (la letra sigue al arrastre).
                    const o = porId[id], j = q.opciones.indexOf(o);
                    if (!o) return null;
                    return (
                        <div key={id} data-item={id} data-i={j} className={'op-fila' + (o.descalifica ? ' op-fila--desc' : '') + ord.claseItem(id)}>
                            <button type="button" className="grip" {...ord.grip(id, 'Mover opción ' + letra(k))}><Icono n="grip" /></button>
                            <span className="op-letra">{letra(k)}</span>
                            <input className="input op-in" id={'op-' + o.id} maxLength={200} value={o.texto} placeholder={'Opción ' + (k + 1)} aria-label={'Opción ' + letra(k)}
                                onChange={e => { const v = e.target.value; cambiar(x => { x.opciones[j].texto = v; }); }} onPaste={e => pegar(e, j)} />
                            <span className="pts" role="group" aria-label={'Puntos de la opción ' + letra(k)}>
                                <button type="button" data-pts="-1" aria-label="Menos puntos" disabled={!q.peso || o.puntos == null} onClick={() => pts(j, -1)}><Icono n="minus" /></button>
                                <b className="num" style={{ '--c': ptsColor(o.puntos) }}>{o.puntos == null ? '–' : o.puntos}</b>
                                <button type="button" data-pts="1" aria-label="Más puntos" disabled={!q.peso || o.puntos === 10} onClick={() => pts(j, 1)}><Icono n="plus" /></button>
                            </span>
                            <button type="button" className="ibtn ibtn--xs" aria-pressed={o.descalifica} aria-label="Descalifica" title="Descalifica: no agenda"
                                onClick={() => cambiar(x => { x.opciones[j].descalifica = !x.opciones[j].descalifica; })}>
                                <Icono n="prohibido" />
                            </button>
                            <button type="button" className="ibtn ibtn--xs ibtn--peligro" aria-label="Eliminar opción" onClick={() => borrar(j)}><Icono n="x" /></button>
                        </div>
                    );
                })}
            </div>
            <div><button type="button" className="link-btn" data-op-add="" onClick={agregar}><Icono n="plus" />Opción</button></div>
        </div>
    );
}

function Cuerpo({ q, cambiar, enfocar }) {
    const op = conOpciones(q.tipo);
    const pesoSel = (d) => '[data-q="' + q.id + '"] [data-peso="' + d + '"]:not(:disabled)';
    const peso = (d) => { cambiar(x => { x.peso = Math.max(0, Math.min(5, x.peso + d)); }); enfocar(pesoSel(d), null, pesoSel(-d)); };
    const cambiarTipo = (v) => cambiar(x => {
        x.tipo = v;
        if (conOpciones(v) && !x.opciones.length) x.opciones = [opVacia(), opVacia()];
        if (conOpciones(v) && !x.peso) x.peso = 1;
    });
    // Inserta {nombre} donde está el cursor; si el título está vacío, arranca con "{nombre}, ".
    const token = () => {
        const ta = document.getElementById('pt-' + q.id);
        if (!ta) return;
        const s0 = ta.selectionStart, s1 = ta.selectionEnd, ins = ta.value.trim() ? '{nombre}' : '{nombre}, ';
        const v = (ta.value.slice(0, s0) + ins + ta.value.slice(s1)).slice(0, 300);
        cambiar(x => { x.titulo = v; });
        enfocar('#pt-' + q.id, [s0 + ins.length, s0 + ins.length]);
    };
    return (
        <div className="pq-cuerpo">
            <div className="pq-ajustes">
                <Sx id={'tipo-' + q.id} label="Tipo" valor={q.tipo} opciones={OPC_TIPO} onChange={cambiarTipo} />
                <div className="der">
                    {op && (
                        <span className="sw">Peso
                            <div className="paso">
                                <button type="button" data-peso="-1" aria-label="Menos peso" disabled={q.peso <= 0} onClick={() => peso(-1)}><Icono n="minus" /></button>
                                <b>{q.peso ? '×' + q.peso : 'No'}</b>
                                <button type="button" data-peso="1" aria-label="Más peso" disabled={q.peso >= 5} onClick={() => peso(1)}><Icono n="plus" /></button>
                            </div>
                        </span>
                    )}
                    <span className="sw">Obligatoria
                        <button type="button" className="switch" role="switch" aria-checked={q.obligatoria} aria-label="Obligatoria" onClick={() => cambiar(x => { x.obligatoria = !x.obligatoria; })} />
                    </span>
                </div>
            </div>
            <div className="campo-q">
                <label className="sr" htmlFor={'pt-' + q.id}>Pregunta</label>
                <AreaAuto id={'pt-' + q.id} maxLength={300} placeholder="Escribí la pregunta" value={q.titulo}
                    onChange={e => { const v = e.target.value; cambiar(x => { x.titulo = v; }); }} />
                <button type="button" className="token-btn" aria-label="Insertar el nombre del lead" title="Insertar nombre" onMouseDown={e => e.preventDefault()} onClick={token}>
                    <Icono n="user" />
                </button>
            </div>
            <label className="sr" htmlFor={'pa-' + q.id}>Texto de ayuda</label>
            <input className="input" id={'pa-' + q.id} maxLength={300} value={q.ayuda} placeholder="Texto de ayuda (opcional)"
                onChange={e => { const v = e.target.value; cambiar(x => { x.ayuda = v; }); }} />
            {op && <Opciones q={q} cambiar={cambiar} enfocar={enfocar} />}
        </div>
    );
}

export default function Pregunta({ q, i, f, on, ord, enfocar }) {
    const fid = f.id, qid = q.id;
    // Cambia esta pregunta (sobre una copia de la versión guardada más reciente).
    const cambiar = useCallback((fn) => mutarForm(fid, 'preguntas', ps => { const x = ps.find(p => p.id === qid); if (x) fn(x); }), [fid, qid]);

    const duplicar = () => {
        const c = copiarPregunta(q);
        mutarForm(fid, 'preguntas', ps => { ps.splice(ps.findIndex(p => p.id === qid) + 1, 0, c); });
        setFormUi({ sel: c.id });
        enfocar('[data-q="' + c.id + '"] .pq-abrir');
    };
    const borrar = () => {
        const ps0 = almacen.buscar('formularios', fid).preguntas, ib = ps0.findIndex(p => p.id === qid), qq = ps0[ib];
        mutarForm(fid, 'preguntas', ps => ps.filter(p => p.id !== qid));
        if (on) setFormUi({ sel: null });
        toast('Pregunta eliminada', 'ok', {
            txt: 'Deshacer',
            fn: () => {
                const f0 = ui.getState().form;
                if (!f0 || f0.id !== fid || !almacen.buscar('formularios', fid)) return;
                mutarForm(fid, 'preguntas', ps => { ps.splice(Math.min(ib, ps.length), 0, qq); });
                setFormUi({ sel: qq.id });
            },
        });
    };

    return (
        <article className={'pq' + (on ? ' pq--on caja' : '') + ord.claseItem(qid)} data-item={qid} data-q={qid}>
            {on && <Humo clase="humo--tarjeta humo--suave" cols={HUMO_MARCA} />}
            <div className="pq-cab">
                <button type="button" className="grip" {...ord.grip(qid, 'Mover pregunta ' + (i + 1) + ' (flechas arriba y abajo)')}><Icono n="grip" /></button>
                <button type="button" className="pq-abrir" data-nav="" aria-expanded={on} onClick={() => setFormUi({ sel: on ? null : qid })}>
                    <span className="pq-num num">{i + 1}</span>
                    <span className="pq-tit" id={'pqt-' + qid}><TituloConToken t={q.titulo} /></span>
                </button>
                <Fichas q={q} />
                <div className="pq-acc">
                    <button type="button" className="ibtn ibtn--xs" aria-label="Duplicar" title="Duplicar" onClick={duplicar}><Icono n="copiar" /></button>
                    <button type="button" className="ibtn ibtn--xs ibtn--peligro" aria-label="Eliminar" title="Eliminar" onClick={borrar}><Icono n="basura" /></button>
                </div>
            </div>
            {on && <Cuerpo q={q} cambiar={cambiar} enfocar={enfocar} />}
        </article>
    );
}
