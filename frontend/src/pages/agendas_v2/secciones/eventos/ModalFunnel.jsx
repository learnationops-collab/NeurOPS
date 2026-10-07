// El funnel es una categoría simple de los eventos: «Nuevo funnel» y el engranaje de cada grupo en
// Eventos abren este modal. Un funnel existe para generar agendamientos: no se crea vacío.
//  - Nuevo: nombre, tipo y su primer agendamiento, que se abre al crearlo. Armarlo con IA (formulario,
//    estrategias y evento de una) queda plegado aparte.
//  - Editar: nombre, tipo, si recibe agendas, sus links (en setting, los de cada setter por evento), sus
//    eventos y, plegado, «Editar con IA»: el prompt lleva el funnel tal como está, la IA lo cambia y el
//    JSON se escribe encima (mismos links). El evento queda como borrador hasta publicarlo.
// Tipo: para qué cuenta en las estadísticas (Workshop, VSL, Setting u Otro; ver operacion._fuente). En
// un workshop, el origen «Grabación» (o Replay) cuenta como la grabación; el resto, como la clase en vivo.
// Setting: cada setter del funnel tiene su link (?o=<su usuario>) y la agenda queda a su nombre. Se eligen
// cuáles trabajan el funnel; sin elegir ninguno, son todos los setters activos de NeurOPS.

import { useState } from 'react';
import { Avatar, Icono, Modal, Seg, Switch } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { copiarTexto, toast } from '../../ui/toast';
import { almacen, useDatos } from '../../data/hooks';
import { buscar, colorLibre, maxOrden, nombreOrigen, ord } from '../../core/datos';
import { linkEvento } from '../../core/eventos';
import { slugify, uid } from '../../core/util';
import { LinksSetters, abrirEvento, crearEvento, useSetters } from './comun';

const TIPOS = [
    { v: 'workshop', n: 'Workshop', ico: 'monitor', ayuda: 'Clase en vivo. Un link «Grabación» cuenta como la grabación.' },
    { v: 'vsl', n: 'VSL', ico: 'play', ayuda: 'Las agendas quedan con fuente VSL.' },
    { v: 'setting', n: 'Setting', ico: 'users', ayuda: 'Cada setter tiene su link y la agenda queda a su nombre.' },
    { v: 'otro', n: 'Otro', ico: 'link', ayuda: 'La fuente de la agenda es el nombre del link.' },
];

// El tipo del funnel en tarjetas: qué es cada uno se lee sin abrir nada.
function Tipos({ valor, onChange }) {
    return (
        <div className="fm-tipos" role="radiogroup" aria-label="Tipo del funnel">
            {TIPOS.map(t => (
                <button key={t.v} type="button" role="radio" className="fm-tipo" aria-checked={valor === t.v} onClick={() => onChange(t.v)}>
                    <span className="fm-tipo-ico"><Icono n={t.ico} s={17} /></span>
                    <b>{t.n}</b><span>{t.ayuda}</span>
                </button>
            ))}
        </div>
    );
}
const ESTRATEGIA = { llenar: 'llenar agenda', horario: 'máxima disponibilidad', repartir: 'distribuida' };

export function crearFunnel(d, nombre, tipo = 'otro') {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return null;
    const base = slugify(nombre) || 'funnel';
    let s = base, n = 2;
    while (d.funnels.some(f => f.slug === s)) s = base + '-' + n++;
    return almacen.crear('funnels', {
        nombre, slug: s, tipo, setting: tipo === 'setting', color: colorLibre(d, 'funnels'), activo: true, orden: maxOrden(d, 'funnels') + 1,
    });
}

// Lo que pega la persona puede venir con el bloque ```json de la IA, o con texto alrededor.
export function leerPaquete(texto) {
    const t = String(texto || '').trim();
    const bloque = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const crudo = bloque ? bloque[1] : t.slice(Math.max(0, t.indexOf('{')), t.lastIndexOf('}') + 1);
    try { return { paquete: JSON.parse(crudo) }; } catch { return { error: 'No es un JSON válido. Copiá el bloque completo que te dio la IA.' }; }
}

const primerEvento = (d, f) => ord(d, 'eventos').find(e => e.funnel === f.id);
const eventosDe = (d, f) => ord(d, 'eventos').filter(e => e.funnel === f.id);
const urlDe = (d, ev, o) => window.location.origin + '/agendas-v2' + linkEvento(d, ev) + '?o=' + o;

function Resumen({ r }) {
    const tipo = { workshop: 'de workshop', vsl: 'de VSL', setting: 'de setting' }[r.tipo];
    return (
        <div className="ia-resumen" role="status">
            <p className="t-sm"><b>Va a quedar así:</b></p>
            <ul className="t-sm">
                <li>Funnel {tipo ? tipo + ' ' : ''}<b>{r.funnel}</b> (<code>/{r.slug}</code>){r.tipo === 'setting' ? ', con un link por setter' : ` con ${r.origenes} ${r.origenes === 1 ? 'link' : 'links'}`}</li>
                <li>{r.prioridades.length} {r.prioridades.length === 1 ? 'estrategia' : 'estrategias'}: {r.prioridades.map(g => `${g.nombre} (${ESTRATEGIA[g.estrategia] || g.estrategia}, ${g.closers} ${g.closers === 1 ? 'closer' : 'closers'}${g.existente ? ', la que ya existe' : ''})`).join(' · ')}</li>
                <li>Formulario <b>{r.formulario}</b>{r.formulario_existente ? ' (el que ya existe)' : ` con ${r.preguntas} ${r.preguntas === 1 ? 'pregunta' : 'preguntas'} y ${r.reglas} ${r.reglas === 1 ? 'regla' : 'reglas'} de segmentación`}</li>
                <li>Evento <b>{r.evento}</b> de {r.duracion} min</li>
                {r.personas_nuevas && r.personas_nuevas.length > 0 && <li>Se suman a Team: <b>{r.personas_nuevas.join(', ')}</b> (de lunes a viernes de 9 a 18; ajustalo en Team)</li>}
            </ul>
        </div>
    );
}

// Copiar el prompt → la IA devuelve un JSON → pegarlo, revisarlo y aplicarlo. Con `evento`, edita ese
// evento (y su funnel, formulario y prioridades); sin él, crea un funnel nuevo con todo.
function ConIA({ evento, funnel, onListo }) {
    const destino = evento || (funnel ? { funnel } : undefined);
    const ad = almacen.adaptador;
    const [texto, setTexto] = useState('');
    const [paso, setPaso] = useState('editar'); // editar | revisando | listo | aplicando
    const [errores, setErrores] = useState([]);
    const [resumen, setResumen] = useState(null);

    if (!ad.promptPaquete) return <p className="t-sm mut">La IA necesita el servidor (no funciona en modo local).</p>;

    const copiarPrompt = async () => {
        try { copiarTexto(await ad.promptPaquete(destino), 'Prompt copiado: pegalo en Claude o ChatGPT'); }
        catch { toast('No se pudo armar el prompt. Revisá la conexión.', 'error'); }
    };
    const enviar = async (simular) => {
        const { paquete, error } = leerPaquete(texto);
        if (error) { setErrores([error]); setResumen(null); return; }
        setPaso(simular ? 'revisando' : 'aplicando');
        try {
            const r = await ad.importarPaquete(paquete, simular, destino);
            setErrores([]);
            setResumen(r.resumen);
            if (simular) { setPaso('listo'); return; }
            await almacen.recargar();
            onListo(r);
        } catch (e) {
            setErrores(e.errores && e.errores.length ? e.errores : [e.message || 'No se pudo aplicar.']);
            setResumen(null);
            setPaso('editar');
        }
    };
    const ocupado = paso === 'revisando' || paso === 'aplicando';
    return (
        <div className="ia">
            <p className="t-sm mut">
                {evento ? 'Copiá el prompt (lleva el agendamiento como está), contale a la IA qué cambiar y pegá acá el JSON.'
                    : funnel ? 'Copiá el prompt (lleva este funnel y lo que ya existe para reusar), la IA arma lo que falta y pegá acá el JSON.'
                        : 'Copiá el prompt, la IA te pregunta lo necesario (y reusa lo que ya existe) y pegá acá el JSON.'}
            </p>
            <button type="button" className="btn btn--cta btn--sm" onClick={copiarPrompt}><Icono n="copiar" />Copiar prompt</button>
            <label className="sr" htmlFor="ia-json">JSON del funnel</label>
            <textarea id="ia-json" className="input" rows={8} spellCheck={false} placeholder='{ "paquete_thalamus": 1, ... }' value={texto}
                aria-invalid={errores.length > 0 || undefined} aria-describedby={errores.length ? 'ia-errores' : undefined}
                onChange={e => { setTexto(e.target.value); setPaso('editar'); setResumen(null); setErrores([]); }}
                style={{ fontFamily: 'ui-monospace, monospace', width: '100%' }} />
            {errores.length > 0 && (
                <div className="campo-err" id="ia-errores" role="alert">
                    <Icono n="alerta" s={14} />
                    <div><b>Hay que corregir esto (podés pedírselo a la IA):</b><ul>{errores.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
                </div>
            )}
            {resumen && <Resumen r={resumen} />}
            <div className="fm-acc">
                <button type="button" className="btn btn--linea btn--sm" disabled={!texto.trim() || ocupado} onClick={() => enviar(true)}>
                    {paso === 'revisando' ? 'Revisando…' : 'Revisar'}
                </button>
                <button type="button" className="btn btn--cta btn--sm" disabled={paso !== 'listo'} onClick={() => enviar(false)}>
                    <Icono n="check" />{paso === 'aplicando' ? 'Aplicando…' : evento ? 'Aplicar cambios' : funnel ? 'Completar funnel' : 'Crear todo'}
                </button>
            </div>
        </div>
    );
}

function Origenes({ d, f }) {
    const [nuevo, setNuevo] = useState('');
    const ev = primerEvento(d, f);
    const crear = (e) => {
        e.preventDefault();
        const n = nuevo.replace(/\s+/g, ' ').trim();
        if (n && !f.origenes.some(o => nombreOrigen(d, o).toLowerCase() === n.toLowerCase())) {
            almacen.editar('funnels', f.id, { origenes: [...f.origenes, { id: uid('o'), nombre: n, setter: '' }] }, true);
            setNuevo('');
        }
    };
    return (
        <div className="cf-origenes">
            {f.origenes.map(o => {
                const p = o.setter && buscar(d, 'personas', o.setter), nom = nombreOrigen(d, o);
                const url = ev ? urlDe(d, ev, slugify(nom) || o.id) : '';
                return (
                    <span key={o.id} className={'cf-o' + (p ? ' cf-o--setter' : '')}>
                        {p && <Avatar p={p} clase="avatar--xs" />}{nom}
                        <button type="button" style={{ color: ev ? 'var(--brand-secondary)' : undefined }} disabled={!ev}
                            aria-label={ev ? 'Copiar link de ' + nom : 'Sin link: el funnel no tiene eventos'}
                            title={ev ? 'Copiar ' + url : 'Creá un evento en este funnel para tener el link'} onClick={() => copiarTexto(url)}>
                            <Icono n="copiar" s={12} />
                        </button>
                        <button type="button" aria-label={'Quitar ' + nom}
                            onClick={() => almacen.editar('funnels', f.id, { origenes: f.origenes.filter(x => x.id !== o.id) }, true)}>
                            <Icono n="x" s={12} />
                        </button>
                    </span>
                );
            })}
            <form className="cf-o-nuevo" noValidate onSubmit={crear}>
                <label className="sr" htmlFor={'cfo-' + f.id}>Nuevo link</label>
                <input id={'cfo-' + f.id} maxLength={60} autoComplete="off" placeholder={f.tipo === 'workshop' ? '+ Link, ej. Grabación' : '+ Link, ej. Instagram'}
                    value={nuevo} onChange={e => setNuevo(e.target.value)} />
            </form>
        </div>
    );
}

function Bloque({ titulo, ayuda, children }) {
    return (
        <section className="fm-bloque">
            <h3 className="t-rotulo">{titulo}</h3>
            {ayuda && <p className="t-sm mut">{ayuda}</p>}
            {children}
        </section>
    );
}

// Armar o editar con IA: plegado, para que no tape la configuración a mano.
function PlegableIA({ titulo, children }) {
    return (
        <details className="plegable fm-ia">
            <summary><Icono n="rayo" />{titulo}<Icono n="chevron-down" className="chev" /></summary>
            <div className="cuerpo">{children}</div>
        </details>
    );
}

function NuevoFunnel({ d, cerrar }) {
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState('workshop');
    const [evento, setEvento] = useState('');
    const crear = (e) => {
        e.preventDefault();
        const id = crearFunnel(d, nombre, tipo);
        if (!id) return;
        cerrar();
        crearEvento(d, evento.trim() || nombre, { funnel: id });
        toast('Funnel creado. Configurá su agendamiento y publicalo.');
    };
    const conIA = (r) => {
        toast('Funnel creado. Revisá el evento y publicalo.');
        cerrar();
        ui.set({ seccion: 'eventos', ev: { id: r.creados.evento, tab: 'config', nodo: null, calor: true } });
    };
    return (
        <>
            <form className="fm-nuevo" noValidate onSubmit={crear}>
                <label className="t-rotulo" htmlFor="fm-nombre">Nombre</label>
                <input id="fm-nombre" className="input" type="text" maxLength={80} autoComplete="off" placeholder="Ej. Workshop octubre"
                    value={nombre} onChange={e => setNombre(e.target.value)} />
                <span className="t-rotulo">Tipo</span>
                <Tipos valor={tipo} onChange={setTipo} />
                <label className="t-rotulo" htmlFor="fm-evento">Primer agendamiento</label>
                <input id="fm-evento" className="input" type="text" maxLength={80} autoComplete="off"
                    placeholder={nombre.trim() ? 'Ej. Diagnóstico (si lo dejás vacío: ' + nombre.trim() + ')' : 'Ej. Diagnóstico'}
                    value={evento} onChange={e => setEvento(e.target.value)} />
                <div className="fm-acc"><button type="submit" className="btn btn--cta btn--sm" disabled={!nombre.trim()}><Icono n="plus" />Crear funnel</button></div>
            </form>
            <PlegableIA titulo="Armarlo con IA: formulario, estrategias y evento de una">
                <ConIA onListo={conIA} />
            </PlegableIA>
        </>
    );
}

// Qué setters trabajan este funnel. Sin ninguno marcado, todos los activos (como antes de poder elegir).
function SettersDelFunnel({ f, editar }) {
    const sts = useSetters();
    if (sts === null) return <p className="t-sm mut">Cargando setters…</p>;
    if (!sts.length) return <p className="t-sm mut">No hay setters activos en la app.</p>;
    const el = new Set(f.setters);
    const todos = !el.size;
    const alternar = (id) => {
        const n = new Set(todos ? sts.map(s => Number(s.id)) : el);
        if (n.has(id)) n.delete(id); else n.add(id);
        // Todos marcados vuelve a «todos» (los setters nuevos se suman solos).
        editar({ setters: n.size === sts.length ? [] : [...n] }, true);
    };
    return (
        <div className="fm-setters" role="group" aria-label="Setters del funnel">
            {sts.map(s => {
                const on = todos || el.has(Number(s.id));
                return (
                    <button key={s.id} type="button" className="chip chip--n fm-setter" aria-pressed={on}
                        style={{ '--c': on ? 'var(--brand-secondary)' : 'var(--idle)' }} onClick={() => alternar(Number(s.id))}>
                        <Icono n={on ? 'check' : 'plus'} s={13} />{s.nombre}
                    </button>
                );
            })}
            <p className="t-xs mut">{todos ? 'Todos los setters activos trabajan este funnel. Desmarcá los que no.' : el.size + ' de ' + sts.length + ' setters trabajan este funnel.'}</p>
        </div>
    );
}

function LinksDelFunnel({ d, f, eventos }) {
    if (!f.setting) return <Origenes d={d} f={f} />;
    if (!eventos.length) return <p className="t-sm mut">Creá un evento en este funnel y acá aparecen los links de cada setter.</p>;
    return (
        <div className="fm-evlinks">
            {eventos.map(e => (
                <div key={e.id} className="fm-evlink">
                    <b className="t-sm">{e.nombre}</b>
                    <LinksSetters d={d} e={e} />
                </div>
            ))}
            <p className="t-xs mut">Cada setter también ve sus links en su menú de NeurOPS.</p>
        </div>
    );
}

// Un funnel sin agendamientos no genera agendas: lo primero que se ofrece es crearle uno.
function AgregarAgendamiento({ d, f, cerrar }) {
    const [nombre, setNombre] = useState('');
    const crear = (e) => {
        e.preventDefault();
        cerrar();
        crearEvento(d, nombre.trim() || f.nombre, { funnel: f.id });
    };
    return (
        <form className="fm-nuevo" noValidate onSubmit={crear}>
            <p className="t-sm">Sin agendamientos, este funnel no genera agendas.</p>
            <label className="sr" htmlFor="fm-evento">Nombre del agendamiento</label>
            <input id="fm-evento" className="input" type="text" maxLength={80} autoComplete="off"
                placeholder={'Ej. Diagnóstico (si lo dejás vacío: ' + f.nombre + ')'} value={nombre} onChange={e => setNombre(e.target.value)} />
            <div className="fm-acc"><button type="submit" className="btn btn--cta btn--sm"><Icono n="plus" />Agregar agendamiento</button></div>
        </form>
    );
}

function EditarFunnel({ d, f, cerrar }) {
    const eventos = eventosDe(d, f);
    const [eventoIA, setEventoIA] = useState(eventos[0] ? eventos[0].id : '');
    const [borrar, setBorrar] = useState(false);
    const editar = (cambios, ya) => almacen.editar('funnels', f.id, cambios, ya);
    return (
        <>
            <Bloque titulo="Funnel">
                <label className="sr" htmlFor="fm-nombre">Nombre del funnel</label>
                <input id="fm-nombre" className="input" type="text" maxLength={80} defaultValue={f.nombre}
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== f.nombre) editar({ nombre: v }, true); }} />
                <Tipos valor={f.tipo} onChange={v => editar({ tipo: v, setting: v === 'setting' }, true)} />
                <label className="fm-fila">
                    <Switch on={f.activo} label={f.nombre + ' recibe agendas'} onChange={v => editar({ activo: v }, true)} />
                    <span className="t-sm">Recibe agendas</span>
                </label>
            </Bloque>
            {f.setting && (
                <Bloque titulo="Setters" ayuda="Quiénes trabajan este funnel: cada uno tiene su link y ve sus links en su menú de NeurOPS.">
                    <SettersDelFunnel f={f} editar={editar} />
                </Bloque>
            )}
            <Bloque titulo={f.setting ? 'Links de setters' : 'Links por procedencia'}
                ayuda={f.setting ? 'Un link por setter y por evento: la agenda que entra por ahí queda a su nombre.'
                    : 'Cada link suma ?o=nombre al del evento, para saber de dónde vino cada agenda.'}>
                <LinksDelFunnel d={d} f={f} eventos={eventos} />
            </Bloque>
            <Bloque titulo="Eventos de este funnel">
                {eventos.length ? (
                    <ul className="fm-evs">
                        {eventos.map(e => (
                            <li key={e.id}>
                                <button type="button" className="link-btn" onClick={() => { cerrar(); abrirEvento(e.id); }}><Icono n="calendar" />{e.nombre}</button>
                            </li>
                        ))}
                    </ul>
                ) : <AgregarAgendamiento d={d} f={f} cerrar={cerrar} />}
            </Bloque>
            <PlegableIA titulo={eventos.length ? 'Editar con IA' : 'Completar con IA: formulario, estrategias y evento'}>
                {!eventos.length ? (
                    <ConIA funnel={f.id} onListo={(r) => {
                        toast('Funnel completo. Revisá el evento y publicalo.');
                        cerrar();
                        ui.set({ seccion: 'eventos', ev: { id: r.creados.evento, tab: 'config', nodo: null, calor: true } });
                    }} />
                ) : (
                    <>
                        {eventos.length > 1 && (
                            <Seg sm label="Qué evento editar" valor={eventoIA} onChange={setEventoIA}
                                opciones={eventos.map(e => ({ v: e.id, n: e.nombre }))} />
                        )}
                        <ConIA key={eventoIA} evento={eventoIA} onListo={() => toast('Cambios aplicados. Revisá el evento y publicalo para que los vea el lead.')} />
                    </>
                )}
            </PlegableIA>
            <div className="fm-acc">
                {borrar ? (
                    <>
                        <span className="t-sm">¿Eliminar <b>{f.nombre}</b>? Sus links dejan de funcionar.</span>
                        <button type="button" className="btn btn--linea btn--sm" onClick={() => setBorrar(false)}>Cancelar</button>
                        <button type="button" className="btn btn--borrar btn--sm" autoFocus
                            onClick={() => { almacen.borrar('funnels', f.id); toast(f.nombre + ' eliminado'); cerrar(); }}>
                            <Icono n="basura" />Eliminar
                        </button>
                    </>
                ) : <button type="button" className="btn btn--linea btn--sm" onClick={() => setBorrar(true)}><Icono n="basura" />Eliminar funnel</button>}
            </div>
        </>
    );
}

export default function ModalFunnel({ estado }) {
    const { d } = useDatos();
    const f = estado.id ? buscar(d, 'funnels', estado.id) : null;
    const cerrar = () => { almacen.flush(); ui.set({ funnel: null }); };
    return (
        <Modal onCerrar={cerrar} id="funnel" labelledBy="fm-tit" clase="modal--conf">
            <div className="fm-cab">
                <h2 className="t-h2" id="fm-tit">{f ? f.nombre : 'Nuevo funnel'}</h2>
                <button type="button" className="ibtn" aria-label="Cerrar" onClick={cerrar}><Icono n="x" /></button>
            </div>
            <div className="conf-cuerpo">
                {f ? <EditarFunnel d={d} f={f} cerrar={cerrar} /> : <NuevoFunnel d={d} cerrar={cerrar} />}
            </div>
        </Modal>
    );
}
