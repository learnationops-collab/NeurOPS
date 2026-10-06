// El funnel, desde Eventos: «Nuevo funnel» y el engranaje de cada grupo abren este modal.
//  - Nuevo: en blanco (nombre y tipo) o con IA (el prompt arma el funnel completo: formulario,
//    prioridades y evento).
//  - Editar: nombre, tipo, si recibe agendas, sus links y «Editar con IA»: el prompt lleva el funnel tal
//    como está, la IA lo cambia y el JSON se escribe encima (mismos links). El evento y el formulario
//    quedan como borrador hasta publicarlos; el resto se aplica en el momento.
// Tipo: para qué cuenta en las estadísticas (Workshop, VSL, Setting u Otro; ver operacion._fuente). En
// un workshop, el origen «Grabación» (o Replay) cuenta como la grabación; el resto, como la clase en vivo.
// Setting: cada setter activo de NeurOPS tiene su link (?o=<su usuario>) y la agenda queda a su nombre.

import { useEffect, useState } from 'react';
import { Avatar, Icono, Modal, Seg, Switch } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { copiarTexto, toast } from '../../ui/toast';
import { almacen, useDatos } from '../../data/hooks';
import { buscar, colorLibre, maxOrden, nombreOrigen, ord } from '../../core/datos';
import { linkEvento } from '../../core/eventos';
import { slugify, uid } from '../../core/util';

const TIPOS = [{ v: 'workshop', n: 'Workshop' }, { v: 'vsl', n: 'VSL' }, { v: 'setting', n: 'Setting' }, { v: 'otro', n: 'Otro' }];
const AYUDA_TIPO = {
    workshop: 'Cuenta en el panel del workshop. Un link llamado «Grabación» cuenta como la grabación; el resto, como la clase en vivo.',
    vsl: 'Las agendas quedan con fuente VSL.',
    setting: 'Cada setter tiene su link y la agenda queda a su nombre.',
    otro: 'La fuente de la agenda es el nombre del link.',
};
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

// Setters activos de la app. null mientras carga; [] en modo local o si falla.
function useSetters() {
    const [lista, setLista] = useState(null);
    useEffect(() => {
        let vivo = true;
        Promise.resolve(almacen.adaptador.usuarios ? almacen.adaptador.usuarios('setter') : [])
            .then(u => { if (vivo) setLista(u); }, () => { if (vivo) setLista([]); });
        return () => { vivo = false; };
    }, []);
    return lista;
}

function LinksDeSetters({ d, f }) {
    const sts = useSetters();
    const ev = primerEvento(d, f);
    if (sts === null) return <p className="t-sm mut">Cargando…</p>;
    if (!sts.length) return <p className="t-sm mut">No hay setters activos en la app.</p>;
    return (
        <div className="cf-origenes">
            {sts.map(s => {
                const url = ev ? urlDe(d, ev, slugify(s.nombre)) : '';
                return (
                    <span key={s.id} className="cf-o cf-o--setter">
                        {s.nombre}
                        <button type="button" style={{ color: ev ? 'var(--brand-secondary)' : undefined }} disabled={!ev}
                            aria-label={ev ? 'Copiar link de ' + s.nombre : 'Sin link: el funnel no tiene eventos'}
                            title={ev ? 'Copiar ' + url : 'Creá un evento en este funnel para tener el link'} onClick={() => copiarTexto(url)}>
                            <Icono n="copiar" s={12} />
                        </button>
                    </span>
                );
            })}
            <span className="t-xs mut" style={{ flexBasis: '100%' }}>Cada setter también ve sus links en su menú de NeurOPS.</span>
        </div>
    );
}

function Bloque({ titulo, children }) {
    return <section className="fm-bloque"><h3 className="t-rotulo">{titulo}</h3>{children}</section>;
}

function NuevoFunnel({ d, cerrar }) {
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState('workshop');
    const crear = (e) => {
        e.preventDefault();
        const id = crearFunnel(d, nombre, tipo);
        if (!id) return;
        toast('Funnel creado');
        ui.set({ funnel: { id } });
    };
    const conIA = (r) => {
        toast('Funnel creado. Revisá el evento y publicalo.');
        cerrar();
        ui.set({ seccion: 'eventos', ev: { id: r.creados.evento, tab: 'config', nodo: null, calor: true } });
    };
    return (
        <>
            <Bloque titulo="En blanco">
                <form className="fm-nuevo" noValidate onSubmit={crear}>
                    <label className="sr" htmlFor="fm-nombre">Nombre del funnel</label>
                    <input id="fm-nombre" className="input" type="text" maxLength={80} autoComplete="off" placeholder="Nombre, ej. Workshop octubre"
                        value={nombre} onChange={e => setNombre(e.target.value)} />
                    <Seg sm label="Tipo del funnel" valor={tipo} opciones={TIPOS} onChange={setTipo} />
                    <span className="t-xs mut">{AYUDA_TIPO[tipo]}</span>
                    <div className="fm-acc"><button type="submit" className="btn btn--cta btn--sm" disabled={!nombre.trim()}><Icono n="plus" />Crear</button></div>
                </form>
            </Bloque>
            <Bloque titulo="Con IA: el funnel completo (estrategias, formulario y evento)">
                <ConIA onListo={conIA} />
            </Bloque>
        </>
    );
}

function EditarFunnel({ d, f, cerrar }) {
    const eventos = ord(d, 'eventos').filter(e => e.funnel === f.id);
    const [eventoIA, setEventoIA] = useState(eventos[0] ? eventos[0].id : '');
    const [borrar, setBorrar] = useState(false);
    const editar = (cambios, ya) => almacen.editar('funnels', f.id, cambios, ya);
    return (
        <>
            <Bloque titulo="Funnel">
                <label className="sr" htmlFor="fm-nombre">Nombre del funnel</label>
                <input id="fm-nombre" className="input" type="text" maxLength={80} defaultValue={f.nombre}
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== f.nombre) editar({ nombre: v }, true); }} />
                <Seg sm label="Tipo del funnel" valor={f.tipo} opciones={TIPOS} onChange={v => editar({ tipo: v, setting: v === 'setting' }, true)} />
                <span className="t-xs mut">{AYUDA_TIPO[f.tipo]}</span>
                <label className="fm-fila">
                    <Switch on={f.activo} label={f.nombre + ' recibe agendas'} onChange={v => editar({ activo: v }, true)} />
                    <span className="t-sm">Recibe agendas</span>
                </label>
            </Bloque>
            <Bloque titulo={f.setting ? 'Links de los setters' : 'Links'}>
                {f.setting ? <LinksDeSetters d={d} f={f} /> : <Origenes d={d} f={f} />}
            </Bloque>
            <Bloque titulo={eventos.length ? 'Editar con IA' : 'Completar con IA'}>
                {!eventos.length ? (
                    <ConIA funnel={f.id} onListo={(r) => {
                        toast('Funnel completo. Revisá el agendamiento y publicalo.');
                        cerrar();
                        ui.set({ seccion: 'eventos', ev: { id: r.creados.evento, tab: 'config', nodo: null, calor: true } });
                    }} />
                ) : (
                    <>
                        {eventos.length > 1 && (
                            <Seg sm label="Qué agendamiento editar" valor={eventoIA} onChange={setEventoIA}
                                opciones={eventos.map(e => ({ v: e.id, n: e.nombre }))} />
                        )}
                        <ConIA key={eventoIA} evento={eventoIA} onListo={() => toast('Cambios aplicados. Revisá el evento y publicalo para que los vea el lead.')} />
                    </>
                )}
            </Bloque>
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
