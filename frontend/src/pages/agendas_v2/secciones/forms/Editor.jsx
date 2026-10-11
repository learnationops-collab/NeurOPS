// Editor de un formulario: barra (volver, vistas, importar preguntas, "No califica", eliminar) y la vista elegida.

import { useCallback, useEffect, useRef, useState } from 'react';
import { almacen, useDatos, usePermisos, useUi } from '../../data/hooks';
import { CONTACTO } from '../../core/catalogos';
import { buscar } from '../../core/datos';
import { nuevaPregunta, resumenForm } from '../../core/formulario';
import { Humo, HUMO_MARCA, Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import EnTope from '../../ui/EnTope';
import { useOrdenable } from '../../ui/useOrdenable';
import { mutarForm, setFormUi, useBorrador, useEnfocar } from './comun';
import { borrarForm } from './ListaForms';
import Pregunta from './Pregunta';
import Ruteo from './Ruteo';
import Previa from './Previa';
import { ModalImportar, ModalNoCalifica, fuentesImport } from './Modales';
import { toast } from '../../ui/toast';

const VISTAS = [{ v: 'preguntas', n: 'Preguntas', icono: 'lista' }, { v: 'ruteo', n: 'Segmentación', icono: 'flujo' }, { v: 'previa', n: 'Vista previa', icono: 'ojo' }];

function cerrarForm() { almacen.flush(); ui.set({ form: null }); window.scrollTo({ top: 0 }); }

function Barra({ f, vista, prevModo, onFin, finRef, onImportar }) {
    const { lectura } = usePermisos();
    const [borrar, setBorrar] = useState(false);
    const r = resumenForm(f);
    const papelera = useRef(null), cancelar = useRef(null);
    useEffect(() => { if (borrar) cancelar.current?.focus(); }, [borrar]);
    const cerrarPop = () => { setBorrar(false); papelera.current?.focus(); };
    return (
        <div className="barra">
            <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={cerrarForm}><Icono n="volver" />Formularios</button>
            <div className="seg" role="group" aria-label="Vista" style={{ marginInline: 'auto' }}>
                {VISTAS.map(o => (
                    <button key={o.v} type="button" data-nav="" aria-pressed={vista === o.v}
                        onClick={() => { almacen.flush(); setFormUi({ vista: o.v, msel: null }); }}>
                        <Icono n={o.icono} />{o.n}
                    </button>
                ))}
            </div>
            <div className="barra-der fe-acc" style={{ minWidth: 132, justifyContent: 'flex-end' }}>
                {vista === 'previa' ? (
                    <div className="seg seg--sm" role="group" aria-label="Pantalla">
                        <button type="button" data-nav="" aria-pressed={prevModo === 'escritorio'} aria-label="Escritorio" title="Escritorio" onClick={() => ui.set({ prevModo: 'escritorio' })}><Icono n="monitor" /></button>
                        <button type="button" data-nav="" aria-pressed={prevModo === 'celular'} aria-label="Celular" title="Celular" onClick={() => ui.set({ prevModo: 'celular' })}><Icono n="celular" /></button>
                    </div>
                ) : !lectura && (
                    <>
                        <button type="button" className="fe-btn" title="Traer preguntas de otro formulario" onClick={e => onImportar(e.currentTarget)}>
                            <Icono n="importar" s={15} /><span>Importar preguntas</span>
                        </button>
                        <button type="button" className="fe-btn" ref={finRef} title="Pantalla para quien no califica" onClick={onFin}>
                            <Icono n="prohibido" s={15} /><span>No califica</span>{r.filtra > 0 && <b className="num">{r.filtra}</b>}
                        </button>
                        <div className="fe-borrar-caja" onKeyDown={e => { if (e.key === 'Escape' && borrar) { e.stopPropagation(); cerrarPop(); } }}>
                            <button type="button" ref={papelera} className="ibtn ibtn--sm ibtn--peligro" aria-label="Eliminar formulario" title="Eliminar formulario" aria-expanded={borrar}
                                onClick={() => setBorrar(b => !b)}>
                                <Icono n="basura" s={15} />
                            </button>
                            {borrar && (
                                <div className="pop-borrar" role="dialog" aria-label="Confirmar">
                                    <p className="t-sm">¿Eliminar <b>{f.nombre}</b>? No se puede recuperar.</p>
                                    <div className="der">
                                        <button type="button" ref={cancelar} className="btn btn--linea btn--sm" onClick={cerrarPop}>Cancelar</button>
                                        <button type="button" className="btn btn--borrar btn--sm" onClick={() => { ui.set({ form: null }); borrarForm(f); }}><Icono n="basura" />Eliminar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Cabecera({ f }) {
    const r = resumenForm(f);
    const nombre = useBorrador(f.nombre, v => almacen.editar('formularios', f.id, { nombre: v.trim() || 'Sin nombre' }));
    return (
        <section className="fe-cab">
            <Humo clase="humo--hero" cols={HUMO_MARCA} />
            <div>
                <label className="sr" htmlFor="fe-nombre">Nombre del formulario</label>
                <input className="fe-nombre" id="fe-nombre" type="text" maxLength={80} autoComplete="off" {...nombre} />
                <p className="fe-meta num">
                    <b>{r.n + CONTACTO.length}</b> preguntas<i /><b style={{ color: 'var(--success)' }}>{r.puntua}</b> puntúan
                    {r.filtra > 0 && <><i /><b style={{ color: 'var(--error)' }}>{r.filtra}</b> {r.filtra === 1 ? 'filtra' : 'filtran'}</>}
                </p>
            </div>
            <div className="ct-linea">
                <span className="t-rotulo">Contacto</span>
                <div className="ct-pills" role="group" aria-label="Datos de contacto obligatorios">
                    {CONTACTO.map(c => {
                        const on = f.contacto[c.k];
                        return (
                            <button key={c.k} type="button" className="ct-pill" role="switch" aria-checked={on} aria-label={c.n + ' obligatorio'} title={on ? 'Obligatorio' : 'Opcional'}
                                onClick={() => mutarForm(f.id, 'contacto', ct => { ct[c.k] = !ct[c.k]; })}>
                                <Icono n={c.ico} s={14} /><span>{c.n}</span><i className="mini-sw" aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function VistaPreguntas({ f, sel, raiz, onImportar }) {
    const { lectura } = usePermisos();
    const enfocar = useEnfocar(raiz);
    const ids = f.preguntas.map(q => q.id);
    // Si se llega con una pregunta elegida (ej. "Editar en Forms" desde Events), queda abierta y a la vista.
    useEffect(() => {
        if (!sel) return;
        const el = raiz.current?.querySelector('[data-q="' + sel + '"]');
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.querySelector('.pq-abrir')?.focus({ preventScroll: true }); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const reordenar = useCallback((nuevos) => {
        mutarForm(f.id, 'preguntas', ps => nuevos.map(id => ps.find(q => q.id === id)).filter(Boolean));
    }, [f.id]);
    const ord = useOrdenable(ids, reordenar);
    const { contenedor, lista } = ord;
    const porId = Object.fromEntries(f.preguntas.map(q => [q.id, q]));
    const agregar = () => {
        const nq = nuevaPregunta();
        mutarForm(f.id, 'preguntas', ps => { ps.push(nq); });
        setFormUi({ sel: nq.id });
        enfocar('#pt-' + nq.id);
    };
    return (
        <div className="columna">
            <Cabecera f={f} />
            <div className="panel-cab" style={{ margin: 0, padding: '0 4px' }}><h2 className="t-h3">Preguntas</h2></div>
            {f.preguntas.length ? (
                <div className="lista" ref={contenedor}>
                    {lista.map((id) => porId[id] && (
                        <Pregunta key={id} q={porId[id]} i={lista.indexOf(id)} f={f} on={sel === id} ord={ord} enfocar={enfocar} />
                    ))}
                </div>
            ) : (
                <div className="panel vacio">
                    <p className="t-sm mut">{lectura ? 'Sin preguntas propias: solo pide los datos de contacto.' : 'Sin preguntas propias todavía. Agregá una o traelas de otro formulario.'}</p>
                    {!lectura && <button type="button" className="btn btn--linea btn--sm" onClick={e => onImportar(e.currentTarget)}><Icono n="importar" />Importar preguntas</button>}
                </div>
            )}
            <div className="fe-mas" hidden={lectura}>
                <button type="button" className="fe-mas-b caja" onClick={agregar}>
                    <Humo clase="humo--tarjeta" cols={HUMO_MARCA} />
                    <span className="fe-mas-ico"><Icono n="plus" s={18} /></span><span><b>Agregar pregunta</b><em>Opción, desplegable o texto</em></span>
                </button>
                <button type="button" className="fe-mas-b fe-mas-b--imp caja" onClick={e => onImportar(e.currentTarget)}>
                    <Humo clase="humo--tarjeta" cols={['var(--info)', 'var(--brand-primary)', 'var(--fc-turquesa)', 'var(--brand-navy)']} />
                    <span className="fe-mas-ico"><Icono n="importar" s={18} /></span><span><b>Importar</b><em>De otro formulario</em></span>
                </button>
            </div>
        </div>
    );
}

export default function Editor() {
    const { d } = useDatos();
    const { form, prevModo } = useUi();
    const f = buscar(d, 'formularios', form.id);
    const raiz = useRef(null), finRef = useRef(null), volver = useRef(null);
    const [modal, setModal] = useState(null); // 'fin' | 'imp'

    // Si el formulario desaparece (lo borró otra pestaña o se deshizo su creación), se vuelve a la lista.
    useEffect(() => { if (!f) ui.set({ form: null }); }, [f]);
    // Al salir del editor queda guardado lo pendiente.
    useEffect(() => () => almacen.flush(), []);
    if (!f) return null;

    const vista = form.vista || 'preguntas';
    const abrir = (m, origen) => { almacen.flush(); volver.current = origen; setModal(m); };
    const importar = (o) => { if (fuentesImport(d, f.id).length) abrir('imp', o); else toast('No hay otros formularios con preguntas.', 'error'); };
    const cerrar = () => {
        almacen.flush(); setModal(null);
        const v = volver.current; volver.current = null;
        requestAnimationFrame(() => { if (v && document.body.contains(v)) v.focus(); });
    };

    return (
        <div ref={raiz} style={{ display: 'contents' }}>
            <EnTope reemplaza><Barra f={f} vista={vista} prevModo={prevModo} finRef={finRef} onFin={() => abrir('fin', finRef.current)} onImportar={importar} /></EnTope>
            {vista === 'previa' ? <Previa f={f} prevModo={prevModo} />
                : vista === 'ruteo' ? <div className="columna"><Ruteo f={f} d={d} modo={form.ruteoModo || 'reglas'} msel={form.msel || null} /></div>
                    : <VistaPreguntas f={f} sel={form.sel || null} raiz={raiz} onImportar={importar} />}
            {modal === 'fin' && <ModalNoCalifica f={f} onCerrar={cerrar} />}
            {modal === 'imp' && <ModalImportar f={f} d={d} onCerrar={cerrar} onImportado={(qid) => {
                setModal(null); volver.current = null; setFormUi({ sel: qid, vista: 'preguntas' });
                requestAnimationFrame(() => raiz.current?.querySelector('[data-q="' + qid + '"] .pq-abrir')?.focus());
            }} />}
        </div>
    );
}
