// Lista de eventos: agrupada por funnel, por formulario o toda junta, con la caja para crear uno.
// En la vista de closer solo aparecen sus eventos propios, sin agrupar.

import React, { useRef, useState } from 'react';
import { buscar, colorVar, maxOrden, nombreGrupo, ord } from '../../core/datos';
import { estadoEvento, linkEvento, slugLibre } from '../../core/eventos';
import { gruposDeForm } from '../../core/formulario';
import { slugify } from '../../core/util';
import { almacen, useDatos, usePermisos, useUi } from '../../data/hooks';
import { HUMO_MARCA, Humo, Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { EstadoEv, abrirEvento, copiarLink, probarEvento } from './comun';

const AGRUPAR = [['funnel', 'Funnels', 'funnel'], ['formulario', 'Forms', 'form'], ['nada', 'All', 'lista']];

function crearEvento(d, nombre, cm) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return 'Escribí un nombre.';
    const fu = ord(d, 'funnels')[0], fo = ord(d, 'formularios')[0];
    const datos = {
        nombre, funnel: fu ? fu.id : '', formulario: fo ? fo.id : '', duracion: 45, activo: true, publicado: '',
        orden: maxOrden(d, 'eventos') + 1,
    };
    let slug = slugify(nombre);
    // El closer crea eventos propios: quedan fijos a su persona y el link lleva su nombre.
    if (cm) { datos.persona = cm.id; slug = slugify(cm.nombre + '-' + nombre); }
    datos.slug = slugLibre(d, { id: null, funnel: datos.funnel }, slug || 'evento');
    abrirEvento(almacen.crear('eventos', datos));
    return '';
}

function ErrNuevo({ err, clase }) {
    return (
        <p className={clase} id="nuevo-err" role="alert" hidden={!err}>
            {err && <><Icono n="alerta" s={14} /><span>{err}</span></>}
        </p>
    );
}

// Caja grande para crear el primer evento.
function Compo({ cm, onCrear, err }) {
    const inp = useRef(null);
    return (
        <section className="compo caja compo--solo">
            <Humo clase="humo--hero" cols={HUMO_MARCA} />
            <div className="compo-txt">
                <span className="compo-icono"><Icono n="plus" s={19} /></span>
                <div style={{ display: 'grid', gap: 4 }}><h2 className="t-h3">{cm ? 'Creá tu primer evento propio' : 'Creá tu primer evento'}</h2></div>
            </div>
            <div className="compo-accion">
                <form className="entrada" noValidate onSubmit={ev => { ev.preventDefault(); onCrear(inp.current.value); }}>
                    <label className="sr" htmlFor="nuevo-nombre">Nuevo evento</label>
                    <input ref={inp} id="nuevo-nombre" type="text" maxLength={80} autoComplete="off" placeholder="Nombre, ej. Diagnóstico Workshop"
                        aria-describedby="nuevo-err" aria-invalid={!!err} />
                    <button type="submit" className="btn btn--cta btn--sm"><Icono n="plus" />Crear</button>
                </form>
                <ErrNuevo err={err} clase="campo-err" />
            </div>
        </section>
    );
}

function TarjetaEvento({ d, e }) {
    const f = buscar(d, 'funnels', e.funnel), fo = buscar(d, 'formularios', e.formulario);
    const pfx = e.persona && buscar(d, 'personas', e.persona);
    let rut = pfx ? [pfx.nombre + ' (fijo)'] : gruposDeForm(fo).map(id => nombreGrupo(d, id));
    if (!rut.length) rut = ['Sin ruteo'];
    const cc = f ? colorVar(f.color) : 'var(--brand-secondary)';
    return (
        <article className="tarjeta ev-card caja" data-id={e.id}>
            <Humo clase="humo--tarjeta humo--suave" cols={[cc, 'var(--brand-primary)', cc, 'var(--brand-navy)']} />
            <div className="ev-fila">
                <button type="button" className="ev-nom" data-nav="" onClick={() => abrirEvento(e.id)}>{e.nombre}</button>
                <EstadoEv est={estadoEvento(e, fo)} />
            </div>
            <div className="ev-fila"><span className="ev-link"><Icono n="link" /><span>{linkEvento(d, e)}</span></span></div>
            <div className="ev-fila">
                {f ? <span className="chip chip--n" style={{ '--c': colorVar(f.color) }}>{f.nombre}</span>
                    : <span className="chip" style={{ '--c': 'var(--warning)' }}>Sin funnel</span>}
                {fo ? <span className="chip chip--n" style={{ '--c': 'var(--info)' }}><Icono n="form" />{fo.nombre}</span>
                    : <span className="chip" style={{ '--c': 'var(--warning)' }}>Sin formulario</span>}
                <span className="chip chip--n" style={{ '--c': 'var(--brand-secondary)' }}><Icono n="rayo" />{rut.join(' · ')}</span>
                <span className="chip chip--n" style={{ '--c': 'var(--idle)' }}>{e.duracion} min</span>
                <div className="barra-der">
                    <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label={'Copiar link de ' + e.nombre} title="Copiar link" onClick={() => copiarLink(d, e)}>
                        <Icono n="copiar" s={15} />
                    </button>
                    <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label={'Probar ' + e.nombre} title="Probar" onClick={() => probarEvento(d, e)}>
                        <Icono n="play" s={15} />
                    </button>
                    <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={() => abrirEvento(e.id)}><Icono n="edit" />Abrir</button>
                </div>
            </div>
        </article>
    );
}

export default function ListaEventos() {
    const { d } = useDatos();
    const { evAgrupar } = useUi();
    const { modoCloser: cm } = usePermisos();
    const [err, setErr] = useState('');
    const inp = useRef(null);
    const es = ord(d, 'eventos').filter(e => !cm || e.persona === cm.id);
    const crear = (v) => { const m = crearEvento(d, v, cm); setErr(m); if (!m && inp.current) inp.current.value = ''; };

    if (!es.length) return <Compo cm={cm} onCrear={crear} err={err} />;

    const agrupar = cm ? 'nada' : (evAgrupar || 'funnel');
    const grupos = new Map();
    es.forEach(e => {
        const k = agrupar === 'funnel' ? e.funnel : agrupar === 'formulario' ? e.formulario : 'todo';
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(e);
    });

    return (
        <>
            <div className="ev-top">
                {cm && <span className="ev-mios"><Icono n="user" s={14} />Tus eventos</span>}
                <div hidden={!!cm} className="seg seg--sm ev-agr" role="group" aria-label="Agrupar">
                    <span className="ev-agr-ico" title="Agrupar"><Icono n="capas" s={15} /></span>
                    {AGRUPAR.map(o => (
                        <button key={o[0]} type="button" data-nav="" aria-pressed={agrupar === o[0]} onClick={() => ui.set({ evAgrupar: o[0] })}>
                            <Icono n={o[2]} s={13} />{o[1]}
                        </button>
                    ))}
                </div>
                {!cm && <button type="button" className="btn btn--linea btn--sm" onClick={() => ui.set({ funnel: {} })}><Icono n="funnel" />Nuevo funnel</button>}
                <form className="entrada ev-nuevo" noValidate onSubmit={ev => { ev.preventDefault(); crear(inp.current.value); }}>
                    <label className="sr" htmlFor="nuevo-nombre">Nuevo evento</label>
                    <span className="prefijo"><Icono n="plus" /></span>
                    <input ref={inp} id="nuevo-nombre" type="text" maxLength={80} autoComplete="off" placeholder="Nuevo evento, ej. Diagnóstico Workshop"
                        aria-describedby="nuevo-err" aria-invalid={!!err} onChange={() => { if (err) setErr(''); }} />
                    <button type="submit" className="btn btn--cta btn--sm">Crear</button>
                </form>
            </div>
            <ErrNuevo err={err} clase="err-nuevo" />
            {[...grupos.entries()].map(([k, lista]) => {
                const ref = agrupar === 'nada' ? null : buscar(d, agrupar === 'funnel' ? 'funnels' : 'formularios', k);
                return (
                    <React.Fragment key={k || '-'}>
                        {agrupar !== 'nada' && (
                            <div className="ev-grupo-tit">
                                {agrupar === 'funnel' && ref ? <span className="cf-punto" style={{ '--c': colorVar(ref.color) }} /> : <Icono n={agrupar === 'funnel' ? 'funnel' : 'form'} />}
                                <span className="t-rotulo">{ref ? ref.nombre : 'Sin ' + agrupar}</span>
                                <span className="t-cap mut40">{lista.length}</span>
                                {agrupar === 'funnel' && ref && (
                                    <button type="button" className="ibtn ibtn--sm" aria-label={'Editar funnel ' + ref.nombre} title="Editar funnel"
                                        onClick={() => ui.set({ funnel: { id: ref.id } })}><Icono n="ajustes" s={15} /></button>
                                )}
                            </div>
                        )}
                        <div className="lista">{lista.map(e => <TarjetaEvento key={e.id} d={d} e={e} />)}</div>
                    </React.Fragment>
                );
            })}
        </>
    );
}
